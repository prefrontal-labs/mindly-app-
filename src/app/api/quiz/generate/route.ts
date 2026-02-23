import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/groq'
import { PLAN_LIMITS, ExamType, EXAM_CONFIGS } from '@/types'
import { getEffectivePlan } from '@/lib/plan'

interface QuizQuestion {
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

const FALLBACK_QUESTIONS: QuizQuestion[] = [{
  question: 'AI-generated content is temporarily unavailable. Which option is correct?',
  options: { A: 'Retry', B: 'Retry', C: 'Retry', D: 'Retry' },
  correct_answer: 'A',
  explanation: 'Please try generating again. The AI service is temporarily unavailable.',
}]

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { topic, exam, difficulty = 'medium', mode = 'topic', count = 10 } = await req.json()

    // Check plan limits
    const { data: userData } = await supabase
      .from('users')
      .select('plan, plan_expiry')
      .eq('id', user.id)
      .single()

    const plan = getEffectivePlan(userData?.plan, userData?.plan_expiry)
    const limit = PLAN_LIMITS[plan].quiz_questions_per_day

    if (limit !== Infinity) {
      const today = new Date().toISOString().split('T')[0]
      const { data: usage } = await supabase
        .from('daily_usage')
        .select('quiz_questions_answered')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .single()

      if ((usage?.quiz_questions_answered || 0) >= limit) {
        return NextResponse.json({ error: 'Daily limit reached', upgrade_required: true }, { status: 429 })
      }
    }

    // Mock test access check
    if (mode === 'full_mock' && !PLAN_LIMITS[plan].mock_tests) {
      return NextResponse.json({ error: 'Mock tests require Pro plan', upgrade_required: true }, { status: 403 })
    }

    const examConfig = EXAM_CONFIGS[exam as ExamType]
    const questionCount = mode === 'full_mock' ? (examConfig.totalQuestions || 100) : count

    const systemPrompt = `Generate multiple choice questions for Indian competitive exam preparation. Return only a JSON array, no other text. Each item must have: question (string), options (object with A, B, C, D keys), correct_answer (one of A/B/C/D), explanation (string, 3 sentences max).`

    const userPrompt = `Exam: ${examConfig?.name || exam}
Topic: ${topic}
Difficulty: ${difficulty}
Number of questions: ${questionCount}
Generate ${questionCount} ${difficulty} MCQs on ${topic} for ${examConfig?.name || exam}.
Each question must be factually accurate and exam-pattern aligned.
For each wrong option, the explanation must say why it's wrong.
Return only the JSON array.`

    const questions = await generateJSON<QuizQuestion[]>(systemPrompt, userPrompt, FALLBACK_QUESTIONS)

    const validQuestions = Array.isArray(questions) ? questions.slice(0, questionCount) : FALLBACK_QUESTIONS

    // Save questions to DB
    const { data: saved, error } = await supabase
      .from('quiz_questions')
      .insert(
        validQuestions.map(q => ({
          user_id: user.id,
          topic,
          exam,
          difficulty,
          question: q.question,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
        }))
      )
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, questions: saved })
  } catch (err) {
    console.error('[Quiz Generate]', err)
    return NextResponse.json({ error: 'Failed to generate quiz' }, { status: 500 })
  }
}
