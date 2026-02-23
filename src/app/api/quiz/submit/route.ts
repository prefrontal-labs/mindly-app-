import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXP, XP_REWARDS, updateStreak, checkAndAwardBadge } from '@/lib/xp'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { mode, topic, exam, responses, time_taken_seconds } = await req.json()
    // responses: [{ question_id, selected_answer, is_correct, time_taken }]

    const score = responses.filter((r: { is_correct: boolean }) => r.is_correct).length
    const total = responses.length
    const accuracy = total > 0 ? (score / total) * 100 : 0

    // Create attempt
    const { data: attempt, error } = await supabase
      .from('quiz_attempts')
      .insert({
        user_id: user.id,
        mode,
        topic,
        exam,
        score,
        total_questions: total,
        accuracy,
        time_taken_seconds,
      })
      .select()
      .single()

    if (error) throw error

    // Save responses
    await supabase.from('quiz_responses').insert(
      responses.map((r: { question_id: string; selected_answer: string; is_correct: boolean; time_taken_seconds: number }) => ({
        attempt_id: attempt.id,
        question_id: r.question_id,
        user_id: user.id,
        selected_answer: r.selected_answer,
        is_correct: r.is_correct,
        time_taken_seconds: r.time_taken_seconds || 0,
      }))
    )

    // Update daily usage
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('daily_usage').upsert(
      { user_id: user.id, usage_date: today, quiz_questions_answered: total },
      { onConflict: 'user_id,usage_date' }
    )

    // Award XP
    await awardXP(user.id, XP_REWARDS.quiz_complete, `Completed ${mode} quiz on ${topic}`)
    if (accuracy >= 80) {
      await awardXP(user.id, XP_REWARDS.quiz_above_80, 'Scored above 80%')
    }
    if (accuracy === 100) {
      await checkAndAwardBadge(user.id, 'quiz_champion')
    }

    await updateStreak(user.id)

    // Check if topic is consistently weak (below 50% three times)
    const { data: pastAttempts } = await supabase
      .from('quiz_attempts')
      .select('accuracy')
      .eq('user_id', user.id)
      .eq('topic', topic)
      .order('created_at', { ascending: false })
      .limit(3)

    const isConsistentlyWeak = pastAttempts?.length === 3 && pastAttempts.every(a => a.accuracy < 50)

    return NextResponse.json({
      success: true,
      attempt_id: attempt.id,
      score,
      total,
      accuracy,
      is_consistently_weak: isConsistentlyWeak,
    })
  } catch (err) {
    console.error('[Quiz Submit]', err)
    return NextResponse.json({ error: 'Failed to submit quiz' }, { status: 500 })
  }
}
