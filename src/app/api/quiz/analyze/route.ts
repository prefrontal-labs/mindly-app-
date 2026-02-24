import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/groq'

interface QuizQuestion {
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: string
  explanation: string
  topic: string
}

interface QuizResponse {
  selected_answer: string
  is_correct: boolean
  time_taken_seconds: number
}

interface AnalysisResult {
  summary: string
  strengths: string[]
  weaknesses: string[]
  study_topics: string[]
  quick_revision: string[]
}

function makeFallbackAnalysis(): AnalysisResult {
  return {
    summary: 'Quiz completed. Review your answers below for detailed feedback.',
    strengths: [],
    weaknesses: [],
    study_topics: [],
    quick_revision: [],
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { topic, exam, questions, responses } = await req.json() as {
      topic: string
      exam: string
      questions: QuizQuestion[]
      responses: QuizResponse[]
    }

    if (!questions?.length || !responses?.length) {
      return NextResponse.json(makeFallbackAnalysis())
    }

    const correct = responses.filter(r => r.is_correct).length
    const total = responses.length
    const accuracy = Math.round((correct / total) * 100)

    // Build detailed Q&A pairs for the AI
    const qaPairs = questions.map((q, i) => {
      const resp = responses[i]
      const status = resp?.is_correct ? '✅ CORRECT' : '❌ WRONG'
      const studentAns = resp?.selected_answer
        ? `${resp.selected_answer}. ${q.options[resp.selected_answer as keyof typeof q.options]}`
        : 'No answer'
      const correctAns = `${q.correct_answer}. ${q.options[q.correct_answer as keyof typeof q.options]}`
      return `Q${i + 1} [Topic: ${q.topic}] ${status}
Question: ${q.question}
Student answered: ${studentAns}
Correct answer: ${correctAns}
Explanation: ${q.explanation}`
    }).join('\n\n')

    const systemPrompt = `You are an expert exam tutor for Indian competitive exams. Analyze a student's quiz performance and identify precise conceptual strengths and gaps.

Rules:
- Be specific — name exact concepts, formulas, or sub-topics, NOT just subject names
- Base strengths/weaknesses only on the evidence from the questions answered
- study_topics should be ordered from most urgent to least
- quick_revision should be concrete facts/formulas the student clearly needs
- Keep each item concise (1 sentence max)

Return JSON only. No extra text.`

    const userPrompt = `Exam: ${exam}
Topic area: ${topic}
Score: ${correct}/${total} (${accuracy}%)

Questions and student responses:
${qaPairs}

Return JSON with exactly this structure:
{
  "summary": "1 sentence overall verdict mentioning specific concepts they got right and wrong",
  "strengths": ["specific concept or skill demonstrated, with evidence"],
  "weaknesses": ["specific concept they struggled with, naming the exact gap"],
  "study_topics": ["Topic to study next, most urgent first — be specific"],
  "quick_revision": ["Key formula or fact they need to review immediately"]
}`

    const analysis = await generateJSON<AnalysisResult>(systemPrompt, userPrompt, makeFallbackAnalysis())

    // Ensure arrays are present
    return NextResponse.json({
      summary: analysis.summary || makeFallbackAnalysis().summary,
      strengths: Array.isArray(analysis.strengths) ? analysis.strengths : [],
      weaknesses: Array.isArray(analysis.weaknesses) ? analysis.weaknesses : [],
      study_topics: Array.isArray(analysis.study_topics) ? analysis.study_topics : [],
      quick_revision: Array.isArray(analysis.quick_revision) ? analysis.quick_revision : [],
    })
  } catch (err) {
    console.error('[Quiz Analyze]', err)
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 })
  }
}
