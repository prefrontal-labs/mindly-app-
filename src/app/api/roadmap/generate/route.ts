import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/groq'
import { ExamType, EXAM_CONFIGS, SubjectAssessment } from '@/types'

// Subject weights + high-yield topics per exam
const EXAM_SUBJECT_WEIGHTS: Partial<Record<ExamType, Record<string, { pct: number; highYield: string[] }>>> = {
  JEE_MAINS: {
    Physics:     { pct: 33, highYield: ['Mechanics', 'Electrostatics & Current Electricity', 'Optics', 'Modern Physics', 'Waves & Sound'] },
    Chemistry:   { pct: 33, highYield: ['Organic Chemistry Reactions', 'Chemical Equilibrium', 'Electrochemistry', 'Coordination Compounds', 'Thermodynamics'] },
    Mathematics: { pct: 34, highYield: ['Calculus (Differentiation & Integration)', 'Coordinate Geometry', 'Algebra & Sequences', 'Probability & Statistics', 'Vectors & 3D'] },
  },
  JEE_ADVANCED: {
    Physics:     { pct: 33, highYield: ['Mechanics', 'Electromagnetism', 'Modern Physics', 'Optics', 'Thermodynamics'] },
    Chemistry:   { pct: 33, highYield: ['Organic Chemistry', 'Physical Chemistry', 'Inorganic Chemistry', 'Equilibrium'] },
    Mathematics: { pct: 34, highYield: ['Calculus', 'Algebra', 'Coordinate Geometry', 'Probability', 'Complex Numbers'] },
  },
  NEET: {
    'Biology (Botany)':  { pct: 25, highYield: ['Cell Biology', 'Plant Physiology', 'Genetics', 'Ecology'] },
    'Biology (Zoology)': { pct: 25, highYield: ['Human Physiology', 'Reproduction', 'Genetics', 'Evolution'] },
    Physics:             { pct: 25, highYield: ['Mechanics', 'Electrostatics', 'Modern Physics', 'Optics'] },
    Chemistry:           { pct: 25, highYield: ['Organic Chemistry', 'Biomolecules', 'Chemical Equilibrium', 'Electrochemistry'] },
  },
  UPSC_CSE: {
    Polity:           { pct: 18, highYield: ['Constitution', 'Parliament & Legislature', 'Judiciary', 'Federalism', 'Constitutional Bodies'] },
    History:          { pct: 15, highYield: ['Modern India (1857–1947)', 'Ancient India', 'World History', 'Art & Culture'] },
    Geography:        { pct: 12, highYield: ['Physical Geography', 'Indian Geography', 'Economic Geography', 'Climatology'] },
    Economy:          { pct: 15, highYield: ['Indian Economy Overview', 'Budget & Fiscal Policy', 'Monetary Policy', 'Agriculture & Industry'] },
    'Science & Technology': { pct: 10, highYield: ['Space & ISRO', 'Defence Technology', 'Biotechnology', 'IT & Cyber Security'] },
    Environment:      { pct: 10, highYield: ['Climate Change', 'Biodiversity', 'National Parks & Wildlife', 'Pollution & Acts'] },
    'Current Affairs':{ pct: 15, highYield: ['Government Schemes', 'International Relations', 'Awards & Summits', 'Reports & Indices'] },
    Ethics:           { pct: 5,  highYield: ['Case Studies', 'Ethical Theories', 'Aptitude & Foundational Values'] },
  },
  GATE_CS: {
    'Data Structures':       { pct: 10, highYield: ['Arrays & Linked Lists', 'Trees & Graphs', 'Hashing', 'Heaps'] },
    'Algorithms':            { pct: 10, highYield: ['Sorting', 'Dynamic Programming', 'Graph Algorithms', 'Greedy'] },
    'Operating Systems':     { pct: 10, highYield: ['Process Scheduling', 'Memory Management', 'Deadlock', 'File Systems'] },
    'DBMS':                  { pct: 8,  highYield: ['SQL', 'Normalization', 'Transactions', 'ER Model'] },
    'Computer Networks':     { pct: 8,  highYield: ['TCP/IP', 'DNS & HTTP', 'Routing Algorithms', 'Data Link Layer'] },
    'Theory of Computation': { pct: 10, highYield: ['DFA/NFA', 'Context-Free Grammars', 'Turing Machines', 'Decidability'] },
    'Compiler Design':       { pct: 8,  highYield: ['Lexical Analysis', 'Parsing', 'Intermediate Code', 'Code Optimization'] },
    'Digital Logic':         { pct: 8,  highYield: ['Boolean Algebra', 'Combinational Circuits', 'Sequential Circuits', 'K-Maps'] },
    'Discrete Mathematics':  { pct: 10, highYield: ['Graph Theory', 'Combinatorics', 'Logic & Proofs', 'Relations & Functions'] },
    'Linear Algebra':        { pct: 9,  highYield: ['Matrix Operations', 'Eigenvalues', 'Vector Spaces', 'Linear Transformations'] },
    'Probability':           { pct: 9,  highYield: ['Probability Theorems', 'Random Variables', 'Distributions', 'Bayes Theorem'] },
  },
  CAT: {
    'Verbal Ability & Reading Comprehension': { pct: 34, highYield: ['Reading Comprehension', 'Para-jumbles', 'Sentence Correction', 'Critical Reasoning'] },
    'Data Interpretation & Logical Reasoning': { pct: 33, highYield: ['Bar/Pie Charts', 'Caselets', 'Seating Arrangements', 'Blood Relations'] },
    'Quantitative Aptitude': { pct: 33, highYield: ['Arithmetic', 'Algebra', 'Geometry', 'Number System', 'Permutation & Combination'] },
  },
  SSC_CGL: {
    'General Intelligence & Reasoning': { pct: 25, highYield: ['Analogies', 'Series', 'Coding-Decoding', 'Syllogism', 'Puzzle'] },
    'General Awareness':                { pct: 25, highYield: ['History', 'Polity', 'Current Affairs', 'Science', 'Geography'] },
    'Quantitative Aptitude':            { pct: 25, highYield: ['Ratio & Proportion', 'Percentage', 'Time & Work', 'Mensuration', 'Number System'] },
    'English Comprehension':            { pct: 25, highYield: ['Reading Comprehension', 'Cloze Test', 'Idioms & Phrases', 'Error Spotting'] },
  },
}

function makeFallbackRoadmap() {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)
  const days = Array.from({ length: 7 }, (_, i) => ({
    date: fmt(addDays(today, i)),
    topics: ['Introduction to subject basics', 'Core concepts overview'],
  }))
  return {
    phases: [{
      phase: 'foundation',
      start_date: fmt(today),
      end_date: fmt(addDays(today, 30)),
      daily_hours: 3,
      weeks: [{
        week_number: 1,
        start_date: fmt(today),
        end_date: fmt(addDays(today, 6)),
        theme: 'Foundation Building',
        topics: ['Introduction to subject basics', 'Core concepts overview'],
        resources: [{ type: 'book', title: 'NCERT Textbooks', author: 'NCERT' }],
        days,
      }],
    }],
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { exam, examDate, dailyHours, level, subjects } = await req.json()

    const examConfig = EXAM_CONFIGS[exam as ExamType]
    const daysLeft = Math.max(1, Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000))
    const timeCrunch = daysLeft < 90

    // Compute exact week counts per phase based on timeline
    const phaseSplit = timeCrunch
      ? { foundation: 0.20, depth: 0.40, revision: 0.25, mock: 0.15 }
      : { foundation: 0.40, depth: 0.35, revision: 0.15, mock: 0.10 }

    const foundationWeeks = Math.max(1, Math.round(daysLeft * phaseSplit.foundation / 7))
    const depthWeeks      = Math.max(1, Math.round(daysLeft * phaseSplit.depth / 7))
    const revisionWeeks   = Math.max(1, Math.round(daysLeft * phaseSplit.revision / 7))
    const mockWeeks       = Math.max(1, Math.round(daysLeft * phaseSplit.mock / 7))

    // Phase dates
    const startDate = new Date()
    const fmt = (d: Date) => d.toISOString().split('T')[0]
    const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

    const foundationEnd = addDays(startDate, foundationWeeks * 7 - 1)
    const depthEnd      = addDays(foundationEnd, depthWeeks * 7)
    const revisionEnd   = addDays(depthEnd, revisionWeeks * 7)

    // Subject categorisation
    const weakSubjects   = (subjects as SubjectAssessment[]).filter(s => s.status === 'not_started').map(s => s.subject)
    const mediumSubjects = (subjects as SubjectAssessment[]).filter(s => s.status === 'somewhat_done').map(s => s.subject)
    const strongSubjects = (subjects as SubjectAssessment[]).filter(s => s.status === 'confident').map(s => s.subject)

    // Subject weights for this exam
    const subjectWeights = EXAM_SUBJECT_WEIGHTS[exam as ExamType]
    const subjectAllocation = subjectWeights
      ? Object.entries(subjectWeights)
          .map(([subj, w]) => {
            const isWeak = weakSubjects.includes(subj)
            const isStrong = strongSubjects.includes(subj)
            const adjustedPct = isWeak ? Math.round(w.pct * 1.3) : isStrong ? Math.round(w.pct * 0.7) : w.pct
            return `${subj}: ~${adjustedPct}% of study time | High-yield: ${w.highYield.slice(0, 3).join(', ')}`
          })
          .join('\n')
      : examConfig.subjects.map(s => `${s}: equal allocation`).join('\n')

    const systemPrompt = `You are an expert academic strategist for Indian competitive exams. Generate a precise, phase-based daily study roadmap as JSON only — no extra text.

STRICT WEEK COUNT REQUIREMENTS (you MUST follow these exactly):
- Foundation phase: exactly ${foundationWeeks} week(s)
- Depth phase: exactly ${depthWeeks} week(s)
- Revision phase: exactly ${revisionWeeks} week(s)
- Mock Test phase: exactly ${mockWeeks} week(s)
Total: ${foundationWeeks + depthWeeks + revisionWeeks + mockWeeks} weeks across ${daysLeft} days

TOPIC QUALITY RULES:
- Every day must have 2–3 SPECIFIC, ACTIONABLE topics — NEVER vague labels
  BAD: "Physics" / "Revision" / "Practice"
  GOOD: "Newton's Laws of Motion — Free Body Diagrams, Atwood's Machine" / "Acid-Base Equilibrium — Henderson-Hasselbalch Equation, Buffer Solutions"
- Weak subjects get dedicated back-to-back days in Foundation/Depth
- Strong subjects get only 1–2 days in Revision phase
- High-yield topics MUST appear in both Foundation and Depth phases
- Mock phase: full-syllabus mock tests + topic-wise error analysis days
- ${timeCrunch ? 'TIME-CRUNCH MODE: Skip deep Foundation. Jump to Depth fast. Only cover high-yield topics.' : 'FULL PREP MODE: Cover complete syllabus with strong conceptual Foundation.'}

OUTPUT JSON STRUCTURE (exact):
{
  "phases": [
    {
      "phase": "foundation|depth|revision|mock",
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "daily_hours": <number>,
      "weeks": [
        {
          "week_number": <number>,
          "start_date": "YYYY-MM-DD",
          "end_date": "YYYY-MM-DD",
          "theme": "<2–5 word theme e.g. Mechanics & Thermodynamics>",
          "topics": ["topic1", "topic2"],
          "resources": [{"type": "book|youtube", "title": "...", "author": "..."}],
          "days": [
            {"date": "YYYY-MM-DD", "topics": ["Specific Topic A — subtopic detail", "Specific Topic B"]},
            ... exactly 7 entries, one per day from start_date to end_date
          ]
        }
      ]
    }
  ]
}`

    const userPrompt = `Exam: ${examConfig.name}
Exam Date: ${examDate} (${daysLeft} days from today — ${timeCrunch ? 'TIME-CRUNCH' : 'FULL PREP'} mode)
Daily Study Hours: ${dailyHours}h
Current Level: ${level}

Candidate Subject Status:
• Weak / Not started (needs most time): ${weakSubjects.join(', ') || 'none'}
• Partially done (needs reinforcement): ${mediumSubjects.join(', ') || 'none'}
• Confident (needs only revision): ${strongSubjects.join(', ') || 'none'}

Subject Time Allocation (adjust based on candidate weakness above):
${subjectAllocation}

Phase Date Ranges (use these exact dates):
• Foundation: ${fmt(startDate)} to ${fmt(foundationEnd)} (${foundationWeeks} weeks)
• Depth: ${fmt(addDays(foundationEnd, 1))} to ${fmt(depthEnd)} (${depthWeeks} weeks)
• Revision: ${fmt(addDays(depthEnd, 1))} to ${fmt(revisionEnd)} (${revisionWeeks} weeks)
• Mock: ${fmt(addDays(revisionEnd, 1))} to ${examDate} (${mockWeeks} weeks)

Generate the complete daily roadmap. Every week needs exactly 7 day entries with specific topics.`

    const roadmapData = await generateJSON(systemPrompt, userPrompt, makeFallbackRoadmap(), 32768)

    const { data: roadmap, error } = await supabase
      .from('roadmaps')
      .upsert({
        user_id: user.id,
        exam,
        phases: roadmapData.phases || makeFallbackRoadmap().phases,
        current_phase: 'foundation',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, roadmap })
  } catch (err) {
    console.error('[Roadmap Generate]', err)
    return NextResponse.json({ error: 'Failed to generate roadmap' }, { status: 500 })
  }
}
