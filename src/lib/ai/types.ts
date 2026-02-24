export type MasteryLevel = 'NEW' | 'FRAGILE' | 'DEVELOPING' | 'SOLID' | 'MASTERED'
export type SessionPhase = 'warmup' | 'new_concept' | 'practice' | 'metacognitive' | 'preview'
export type MessageType =
  | 'answer'
  | 'question'
  | 'greeting'
  | 'confusion'
  | 'claimed_knowledge'
  | 'confidence_rating'
  | 'general'
export type ConfidenceCalibration = 'overconfident' | 'underconfident' | 'calibrated' | 'unknown'
export type TutorAction =
  | 'warmup_retrieval'
  | 'introduce_new_concept'
  | 'interleaved_practice'
  | 'give_hint'
  | 'reveal_answer'
  | 'escalate_difficulty'
  | 'scaffold_back'
  | 'validate_and_pivot'
  | 'challenge_claimed_knowledge'
  | 'process_confidence_rating'
  | 'answer_then_test'
  | 'metacognitive_check'
  | 'preview_next'
  | 'respond_general'

export interface ConceptMasteryEntry {
  level: MasteryLevel
  lastTested: string // ISO date
  successCount: number
  failureCount: number
  hintsUsed: number
}

export interface Misconception {
  concept: string
  misconception: string
  sessionNumber: number
}

export interface StudentState {
  userId: string
  sessionPhase: SessionPhase
  conceptMastery: Record<string, ConceptMasteryEntry>
  misconceptions: Misconception[]
  confidenceCalibration: ConfidenceCalibration
  consecutiveFailures: number
  consecutiveSuccesses: number
  pendingQuestion: string | null
  hintsGiven: number
  lastConceptsTested: string[]
  sessionCount: number
  messagesInSession: number
  pendingConcept: string | null
  awaitingConfidenceRating: boolean
  examDomain: string
}

export interface AssessmentResult {
  score: number // 0–3
  isCorrect: boolean
  misconception: string | null
  feedback: string
}

export interface StudentContext {
  studentName: string | null
  examName: string
  daysToExam: number | null
  currentStreak: number
  quizAccuracyLast7Days: number | null // percentage 0–100, null if no recent quizzes
  todayTopicsDone: number
  todayTopicsTotal: number
  recentWeakTopics: string[] // topic names with low quiz accuracy
}

export function defaultStudentState(userId: string): StudentState {
  return {
    userId,
    sessionPhase: 'warmup',
    conceptMastery: {},
    misconceptions: [],
    confidenceCalibration: 'unknown',
    consecutiveFailures: 0,
    consecutiveSuccesses: 0,
    pendingQuestion: null,
    hintsGiven: 0,
    lastConceptsTested: [],
    sessionCount: 0,
    messagesInSession: 0,
    pendingConcept: null,
    awaitingConfidenceRating: false,
    examDomain: 'general',
  }
}
