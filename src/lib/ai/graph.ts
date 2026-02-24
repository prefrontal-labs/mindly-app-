/**
 * Mindly Adaptive Tutor — LangGraph Agentic System
 *
 * Graph: classify → (assess?) → plan → buildPrompt
 *
 * Implements 6 cognitive science principles:
 *  1. Desirable Difficulty
 *  2. Retrieval over Recognition
 *  3. Adaptive Spaced Repetition
 *  4. Interleaving
 *  5. Emotional Anchoring
 *  6. Metacognitive Calibration
 */

import { Annotation, StateGraph, START, END } from '@langchain/langgraph'
import Groq from 'groq-sdk'
import type {
  StudentState,
  StudentContext,
  AssessmentResult,
  MessageType,
  TutorAction,
  MasteryLevel,
} from './types'

// ─── Groq Singleton ──────────────────────────────────────────────────────────

let _groq: Groq | null = null
function getGroq(): Groq {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  return _groq
}
const MODEL = 'llama-3.3-70b-versatile'

// ─── Graph State ─────────────────────────────────────────────────────────────

const TutorState = Annotation.Root({
  userMessage: Annotation<string>(),
  studentState: Annotation<StudentState>(),
  chatHistory: Annotation<Array<{ role: string; content: string }>>(),
  // Real-time performance context passed in from the API route
  studentContext: Annotation<StudentContext | null>(),
  // Populated by classify node
  messageType: Annotation<MessageType>(),
  // Populated by assess node
  assessmentResult: Annotation<AssessmentResult | null>(),
  // Populated by plan node
  tutorAction: Annotation<TutorAction>(),
  updatedStudentState: Annotation<StudentState>(),
  // Populated by buildPrompt node (output to API route)
  systemPrompt: Annotation<string>(),
})

type State = typeof TutorState.State

// ─── Node 1: Classify ────────────────────────────────────────────────────────
// Determine what kind of message the student sent.
// Uses cheap heuristics first, falls back to a minimal LLM call.

async function classifyNode(state: State): Promise<Partial<State>> {
  const msg = state.userMessage.trim().toLowerCase()
  const hasPending = !!state.studentState.pendingQuestion
  const awaitingRating = state.studentState.awaitingConfidenceRating

  // Heuristic — covers the majority of cases without an LLM call
  if (!state.chatHistory.length || /^(hi|hello|hey|start|begin|let'?s (start|go)|good (morning|evening|afternoon))/i.test(msg)) {
    return { messageType: 'greeting' }
  }
  if (awaitingRating && /^[1-5]$/.test(msg)) {
    return { messageType: 'confidence_rating' }
  }
  if (/^i (know|remember|studied|saw|read) this/i.test(msg) || /^(i know|i've seen this)/i.test(msg)) {
    return { messageType: 'claimed_knowledge' }
  }
  if (/(i('m| am) (confused|lost|stuck)|not (getting|clear|understanding)|don'?t understand|struggling|this is (hard|difficult|confusing))/i.test(msg)) {
    return { messageType: 'confusion' }
  }
  if (/^(what|why|how|when|where|explain|tell me|can you|could you|is it|are there|what'?s)/i.test(msg)) {
    return { messageType: 'question' }
  }

  // LLM fallback for ambiguous messages
  const context = hasPending
    ? `Pending question from tutor: "${state.studentState.pendingQuestion}"`
    : 'No pending question.'

  try {
    const resp = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: `Classify this student message in a tutoring session.\n${context}\nStudent: "${state.userMessage}"\nReturn ONLY JSON: {"type":"answer"|"question"|"general"}`,
        },
      ],
      temperature: 0,
      max_tokens: 30,
      response_format: { type: 'json_object' },
    })
    const result = JSON.parse(resp.choices[0]?.message?.content || '{}')
    return { messageType: (result.type || 'general') as MessageType }
  } catch {
    return { messageType: hasPending ? 'answer' : 'general' }
  }
}

// ─── Node 2: Assess ──────────────────────────────────────────────────────────
// Evaluate the student's answer against the pending question.
// Only runs if messageType === 'answer' AND there is a pending question.

async function assessNode(state: State): Promise<Partial<State>> {
  if (state.messageType !== 'answer' || !state.studentState.pendingQuestion) {
    return { assessmentResult: null }
  }

  try {
    const resp = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'system',
          content:
            'You evaluate student answers in an adaptive tutoring session. Be strict but fair. Return ONLY JSON.',
        },
        {
          role: 'user',
          content: `Tutor asked: "${state.studentState.pendingQuestion}"
Concept being tested: "${state.studentState.pendingConcept || 'unknown'}"
Domain: ${state.studentState.examDomain}
Hints already given: ${state.studentState.hintsGiven}
Student answered: "${state.userMessage}"

Score 0–3:
3 = Correct AND demonstrates deep understanding (explains reasoning)
2 = Correct but shallow (right answer, unclear why)
1 = Partially correct or right direction
0 = Incorrect or completely off track

Return JSON: {"score":0-3,"isCorrect":true|false,"misconception":"string or null","feedback":"one sentence on what was right/wrong"}`,
        },
      ],
      temperature: 0,
      max_tokens: 150,
      response_format: { type: 'json_object' },
    })

    const result = JSON.parse(resp.choices[0]?.message?.content || '{}')
    return {
      assessmentResult: {
        score: result.score ?? 0,
        isCorrect: result.isCorrect ?? false,
        misconception: result.misconception ?? null,
        feedback: result.feedback ?? '',
      } as AssessmentResult,
    }
  } catch {
    return { assessmentResult: null }
  }
}

// ─── Mastery Helpers ─────────────────────────────────────────────────────────

const MASTERY_ORDER: MasteryLevel[] = ['NEW', 'FRAGILE', 'DEVELOPING', 'SOLID', 'MASTERED']

function advanceMastery(level: MasteryLevel): MasteryLevel {
  const idx = MASTERY_ORDER.indexOf(level)
  return MASTERY_ORDER[Math.min(idx + 1, MASTERY_ORDER.length - 1)]
}

function regressMastery(level: MasteryLevel): MasteryLevel {
  const idx = MASTERY_ORDER.indexOf(level)
  return MASTERY_ORDER[Math.max(idx - 1, 0)]
}

// ─── Node 3: Plan ────────────────────────────────────────────────────────────
// Pure TypeScript state machine — no LLM call.
// Updates student knowledge state and decides the next tutor action.

function planNode(state: State): Partial<State> {
  // Deep clone student state so we can mutate safely
  const s: StudentState = JSON.parse(JSON.stringify(state.studentState))
  let action: TutorAction = 'respond_general'

  // ── Update mastery from assessment ────────────────────────────────────────
  if (state.assessmentResult && s.pendingConcept) {
    const { score, isCorrect, misconception } = state.assessmentResult
    const concept = s.pendingConcept

    const entry = s.conceptMastery[concept] ?? {
      level: 'NEW' as MasteryLevel,
      lastTested: new Date().toISOString(),
      successCount: 0,
      failureCount: 0,
      hintsUsed: s.hintsGiven,
    }

    if (isCorrect) {
      entry.successCount++
      s.consecutiveFailures = 0
      s.consecutiveSuccesses++
      // Score 3 = deep understanding → advance mastery
      // Score 2 = shallow correct → advance only from NEW
      if (score === 3) entry.level = advanceMastery(entry.level)
      else if (score === 2 && entry.level === 'NEW') entry.level = 'FRAGILE'

      // Correct answer — clear pending state so we move to next question
      entry.hintsUsed += s.hintsGiven
      s.pendingQuestion = null
      s.hintsGiven = 0
      s.awaitingConfidenceRating = false
    } else {
      entry.failureCount++
      s.consecutiveFailures++
      s.consecutiveSuccesses = 0
      // Regress mastery on failure (but never below FRAGILE)
      if (entry.level === 'SOLID' || entry.level === 'DEVELOPING') {
        entry.level = regressMastery(entry.level)
      } else if (entry.level === 'NEW') {
        entry.level = 'FRAGILE'
      }
      // WRONG answer — keep pendingQuestion + hintsGiven so hint tracking works
      // pendingQuestion and hintsGiven are cleared only in the action switch below
    }

    entry.lastTested = new Date().toISOString()
    s.conceptMastery[concept] = entry

    if (misconception) {
      s.misconceptions.push({ concept, misconception, sessionNumber: s.sessionCount })
    }
  }

  s.messagesInSession++

  // ── Decide next action ────────────────────────────────────────────────────
  switch (state.messageType) {
    case 'greeting':
      action = 'warmup_retrieval'
      s.sessionPhase = 'warmup'
      s.sessionCount++
      s.messagesInSession = 1
      break

    case 'confusion':
      action = 'validate_and_pivot'
      break

    case 'claimed_knowledge':
      action = 'challenge_claimed_knowledge'
      break

    case 'confidence_rating':
      action = 'process_confidence_rating'
      s.awaitingConfidenceRating = false
      // Infer calibration style from last assessment
      if (state.assessmentResult) {
        const confident = parseInt(state.userMessage.trim()) >= 4
        if (confident && !state.assessmentResult.isCorrect) s.confidenceCalibration = 'overconfident'
        else if (!confident && state.assessmentResult.isCorrect) s.confidenceCalibration = 'underconfident'
        else s.confidenceCalibration = 'calibrated'
      }
      break

    case 'answer':
      if (s.consecutiveFailures >= 3) {
        // Too many failures in a row — scaffold back regardless of question
        action = 'scaffold_back'
        s.pendingQuestion = null
        s.hintsGiven = 0
      } else if (!state.assessmentResult?.isCorrect && s.hintsGiven >= 2) {
        // Two hints given and still wrong — reveal the answer
        action = 'reveal_answer'
        s.pendingQuestion = null
        s.hintsGiven = 0
      } else if (!state.assessmentResult?.isCorrect && s.hintsGiven < 2) {
        // Wrong, still have hints — give next hint (keep pendingQuestion!)
        action = 'give_hint'
        s.hintsGiven++
      } else if (state.assessmentResult?.isCorrect && s.consecutiveSuccesses >= 3) {
        // On a streak — escalate and ask confidence
        action = 'escalate_difficulty'
        s.awaitingConfidenceRating = true
      } else {
        // Correct answer, normal progression
        action = 'interleaved_practice'
      }
      break

    case 'question':
      action = 'answer_then_test'
      break

    default:
      // Phase-based progression
      if (s.messagesInSession > 22) {
        action = 'preview_next'
        s.sessionPhase = 'preview'
      } else if (s.messagesInSession > 16) {
        action = 'metacognitive_check'
        s.sessionPhase = 'metacognitive'
      } else if (s.messagesInSession > 6) {
        action = 'interleaved_practice'
        s.sessionPhase = 'practice'
      } else if (s.messagesInSession > 2) {
        action = 'introduce_new_concept'
        s.sessionPhase = 'new_concept'
      } else {
        action = 'warmup_retrieval'
        s.sessionPhase = 'warmup'
      }
  }

  return { tutorAction: action, updatedStudentState: s }
}

// ─── Node 4: Build Prompt ────────────────────────────────────────────────────
// Constructs the dynamic system prompt combining the Mindly elite AI study
// strategist persona with 6 cognitive science principles + current student data.

function buildPromptNode(state: State): Partial<State> {
  const s = state.updatedStudentState ?? state.studentState
  const ctx = state.studentContext ?? null

  // PRINCIPLE 3: Spaced repetition — find FRAGILE/DEVELOPING concepts
  const fragileConcepts = Object.entries(s.conceptMastery)
    .filter(([, v]) => v.level === 'FRAGILE' || v.level === 'DEVELOPING')
    .sort(([, a], [, b]) => b.failureCount - a.failureCount) // highest failures first
    .map(([k]) => k)

  // PRINCIPLE 3: Concepts that haven't been tested in 3+ days (decay check)
  const overdueConcepts = Object.entries(s.conceptMastery)
    .filter(([, v]) => {
      const daysSince = (Date.now() - new Date(v.lastTested).getTime()) / 86_400_000
      return daysSince > 3 && v.level === 'SOLID'
    })
    .map(([k]) => k)

  const recentMisconceptions = s.misconceptions
    .slice(-3)
    .map((m) => `${m.concept}: "${m.misconception}"`)
    .join('; ') || 'none'

  // PRINCIPLE 4: Interleaving — recently tested topics
  const recentTopics = s.lastConceptsTested.slice(-4).join(', ') || 'none'

  // ── Build real performance context block ───────────────────────────────────
  let perfContextBlock = ''
  if (ctx) {
    const nameStr = ctx.studentName ? `${ctx.studentName}` : 'Student'
    const examStr = ctx.examName
    const daysStr = ctx.daysToExam !== null
      ? `${ctx.daysToExam} days`
      : 'exam date not set'
    const streakStr = `${ctx.currentStreak} day${ctx.currentStreak !== 1 ? 's' : ''}`
    const accuracyStr = ctx.quizAccuracyLast7Days !== null
      ? `${ctx.quizAccuracyLast7Days}%`
      : 'no recent quizzes'
    const todayStr = ctx.todayTopicsTotal > 0
      ? `${ctx.todayTopicsDone}/${ctx.todayTopicsTotal} topics done`
      : ctx.todayTopicsDone > 0
        ? `${ctx.todayTopicsDone} topics completed`
        : 'not started'
    const weakStr = ctx.recentWeakTopics.length > 0
      ? ctx.recentWeakTopics.join(', ')
      : 'not yet identified from quizzes'

    perfContextBlock = `
STUDENT PERFORMANCE DATA (ground every coaching response in these numbers):
- Student: ${nameStr} | Exam: ${examStr} | Time to exam: ${daysStr}
- Current study streak: ${streakStr}
- Quiz accuracy (last 7 days): ${accuracyStr}
- Today's roadmap progress: ${todayStr}
- Quiz-identified weak topics: ${weakStr}
`
  }

  // ── Action-specific instructions (implements all 6 principles) ─────────────
  const actionInstructions: Record<TutorAction, string> = {
    warmup_retrieval: `WARM-UP RETRIEVAL (Principle 1+3). Welcome the student back in ONE sentence — if you have their name and streak, reference both ("Welcome back, [name] — day [N] streak, let's keep it going."). Then immediately test 1-2 concepts from past sessions. Prioritize these FRAGILE/DEVELOPING concepts: [${fragileConcepts.join(', ') || 'not recorded yet — ask what topic they want to practice'}]. Also check overdue SOLID concepts: [${overdueConcepts.join(', ') || 'none'}]. Ask ONE open-ended question — no new content. No multiple choice.`,

    introduce_new_concept: `INTRODUCE NEW CONCEPT (Principle 2+5). Pick ONE concept that's a natural next step. Explain in 3-5 sentences MAX. Anchor it with a real-world incident, surprising fact, or famous exam case study — make it emotionally memorable (Principle 5). Then IMMEDIATELY ask a generative question to test initial understanding (Principle 2). Never ask "Do you have any questions?" — test them first.`,

    interleaved_practice: `INTERLEAVED PRACTICE (Principle 1+4). Ask a scenario-based question that MIXES multiple concepts. Do NOT label which topic you're testing — let the student figure it out. This is the learning. Recently tested topics: [${recentTopics}] — pick a DIFFERENT angle or concept combination. Use a realistic ${s.examDomain} scenario. After a correct answer, ask "Explain WHY that's right" to cement understanding (Principle 2). Escalate slightly from the last question (Principle 1).`,

    give_hint: `GIVE TARGETED HINT ${s.hintsGiven}/2 (Principle 1). Do NOT reveal the answer — that destroys the learning. Give ONE specific hint that narrows the search space and forces thinking in the right direction. Restate or reframe the question at the end. Make the hint earn its keep — too easy a hint is as bad as giving the answer.`,

    reveal_answer: `REVEAL ANSWER AFTER 2 HINTS (Principle 1+6). The student has exhausted their hints. Clearly explain the correct answer. Then diagnose the ROOT CAUSE of their error — check known misconceptions: [${recentMisconceptions}]. Say specifically: "Your thinking went wrong because..." Then ask the student to EXPLAIN THE ANSWER BACK in their own words — this is the highest-retention action available.`,

    escalate_difficulty: `ESCALATE DIFFICULTY (Principle 1). The student has answered ${s.consecutiveSuccesses} questions correctly in a row. Easy feels good but produces zero retention — escalate NOW. Add constraints, combine multiple concepts, require application in an unfamiliar context. Before asking, prompt a confidence rating: "On a scale of 1-5, how confident are you right now?" Then ask the harder question (Principle 6).`,

    scaffold_back: `SCAFFOLD BACK (Principle 1). The student has failed ${s.consecutiveFailures} times consecutively. Step back ONE level — not to the beginning. Use a completely different angle, analogy, or abstraction level than before (don't repeat what didn't work). Break the concept into a smaller concrete piece. Ask: "Let's zoom in on just [specific sub-concept]..." Never spoon-feed.`,

    validate_and_pivot: `VALIDATE + PIVOT STRATEGY (Principle 5). ONE sentence that genuinely acknowledges the difficulty — be specific about what's hard: "This trips up [type of student] because [specific reason]." Then COMPLETELY change strategy: different analogy, different abstraction level, different approach. Ask a simpler sub-question to rebuild confidence before returning to the original challenge.`,

    challenge_claimed_knowledge: `CHALLENGE CLAIMED KNOWLEDGE (Principle 2). The student claims to know this. Claimed knowledge ≠ retrievable knowledge. Respond: "Great — explain it to me right now without looking anything up. Walk me through [specific aspect]." Make the challenge respectful but firm. This is a retrieval test, not an insult.`,

    process_confidence_rating: `PROCESS CONFIDENCE RATING (Principle 6). Their calibration pattern: ${s.confidenceCalibration}. ${
      s.confidenceCalibration === 'overconfident'
        ? `HIGH CONFIDENCE + WRONG ANSWER — this is the single highest-value teaching moment. Don't move on. Say: "Interesting — you were sure about that. Let's unpack exactly where your intuition broke down." Focus on the ROOT CAUSE of the misconception: [${recentMisconceptions}].`
        : s.confidenceCalibration === 'underconfident'
        ? 'LOW CONFIDENCE + RIGHT ANSWER — acknowledge it: "You knew more than you thought. What made you doubt yourself?" Help them recognize and trust their knowledge.'
        : 'Well-calibrated — acknowledge it briefly. Move to the next concept.'
    } Then transition to the next question.`,

    answer_then_test: `ANSWER THEN TEST (Principle 2). Answer their question in 3-5 sentences MAX. Use a concrete example or analogy relevant to ${s.examDomain}. If it's a surprising or counterintuitive fact, lead with "Here's something most people get wrong..." (Principle 5). Then IMMEDIATELY follow with a generative question that tests understanding. Never end on passive delivery.`,

    metacognitive_check: `METACOGNITIVE CHECK (Principle 6). Ask: "Of everything we've covered today, what feels solid and what feels shaky?" Wait for their self-assessment. Your internal model says: FRAGILE concepts are [${fragileConcepts.join(', ') || 'none recorded'}]. After their response, gently correct calibration errors — name specifically where their self-assessment diverges from reality.`,

    preview_next: `SESSION WRAP-UP + PREVIEW. Briefly (2 sentences) name 1-2 specific things they solidified — specific praise, not generic. E.g., "You nailed the part about [detail] that most people miss." Then tease the next session with curiosity: "Next time we're covering [X] — and it actually breaks the assumption you just made about [current concept] in a surprising way." Leave them curious.`,

    respond_general: `COACHING RESPONSE. Be direct, specific, and data-backed. If the student asks what to study or how they're doing, reference their actual performance numbers from STUDENT PERFORMANCE DATA above. Give a specific micro-plan: not "study Physics" — "spend 40 min on [weak topic] today — this appears in 2-3 ${s.examDomain} questions annually." Use structured coaching sections when appropriate:
## 🔥 Today's Focus | ## 📊 Performance Insight | ## 🎯 Priority Weak Areas
## 🧠 Smart Strategy | ## ⏱️ Time Plan | ## 🚀 Expected Impact | ## 🔁 Streak Reminder
(only include sections relevant to what the student asked — don't force all of them)
Never end passively — close with a question or concrete next action.`,
  }

  const systemPrompt = `You are Mindly — an elite AI study strategist for Indian competitive exam students. You combine the precision of a performance data analyst, the expertise of a private tutor, and the drive of a coach. Your mission: convert every conversation into a measurable improvement in exam readiness.

COACHING IDENTITY:
- You are data-driven. Every coaching response references real numbers: streak, accuracy, days to exam, today's progress.
- You diagnose ROOT CAUSES, not symptoms. When a student gets something wrong, find the exact conceptual gap — not just "weak in Physics".
- Be direct and specific. Not "study more" — "spend 45 min on [specific topic] — your quiz data shows you missed 3 of 4 questions in this area."
- Acknowledge pressure in ONE sentence maximum, then redirect to concrete action. Never dwell on stress.
- When forecasting: "At your current accuracy rate, you're on track for [X]% in [subject]. To hit [target], fix [specific area] in the next [N] days."
${perfContextBlock}
STUDENT KNOWLEDGE STATE (session-level, from adaptive learning graph):
- Domain: ${s.examDomain}
- Session Phase: ${s.sessionPhase.replace('_', ' ').toUpperCase()} (message ${s.messagesInSession} of session ${s.sessionCount})
- In-session streak: ${s.consecutiveFailures} consecutive failures | ${s.consecutiveSuccesses} consecutive successes
- Confidence Calibration: ${s.confidenceCalibration}
- FRAGILE/DEVELOPING concepts (highest priority): ${fragileConcepts.slice(0, 5).join(', ') || 'none yet'}
- Overdue for review: ${overdueConcepts.slice(0, 3).join(', ') || 'none'}
- Recent misconceptions: ${recentMisconceptions}
- Awaiting confidence rating: ${s.awaitingConfidenceRating}

YOUR TASK THIS TURN:
${actionInstructions[state.tutorAction]}

NON-NEGOTIABLE RULES (override all other tendencies):
1. Max 150 words per response — unless revealing an answer after 2 failed hints
2. Never say "Great job!" without naming EXACTLY what was impressive
3. Never give a lecture without testing understanding within the same response
4. Never reveal an answer before giving 2 targeted hints
5. After every correct answer, ask the student to EXPLAIN WHY it's correct
6. Never end a response passively — always close with a question or challenge
7. If the student gets everything right effortlessly, escalate immediately
8. Never repeat the same explanation twice — if it didn't work, try a completely different angle
9. Use Indian exam context for examples when relevant (UPSC, GATE, JEE, NEET, CAT, IBPS, SSC)
10. When asked about study planning or what to focus on, use STUDENT PERFORMANCE DATA to give specific, time-boxed recommendations tied to days remaining to exam`

  return { systemPrompt }
}

// ─── Routing Function ─────────────────────────────────────────────────────────
// After classify: route to 'assess' if student is answering a question,
// otherwise skip straight to 'plan'.

function routeAfterClassify(state: State): 'assess' | 'plan' {
  return state.messageType === 'answer' && !!state.studentState.pendingQuestion
    ? 'assess'
    : 'plan'
}

// ─── Compiled Graph (lazy singleton) ─────────────────────────────────────────

let _graph: ReturnType<typeof buildGraph> | null = null

function buildGraph() {
  return new StateGraph(TutorState)
    .addNode('classify', classifyNode)
    .addNode('assess', assessNode)
    .addNode('plan', planNode)
    .addNode('buildPrompt', buildPromptNode)
    .addEdge(START, 'classify')
    .addConditionalEdges('classify', routeAfterClassify, {
      assess: 'assess',
      plan: 'plan',
    })
    .addEdge('assess', 'plan')
    .addEdge('plan', 'buildPrompt')
    .addEdge('buildPrompt', END)
    .compile()
}

export function getTutorGraph() {
  if (!_graph) _graph = buildGraph()
  return _graph
}

export type { State as TutorGraphState }
