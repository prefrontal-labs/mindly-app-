import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/groq'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Fetch all needed data in parallel
    const [profileRes, attemptsRes, flashcardsRes, streakRes] = await Promise.all([
      supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('quiz_attempts').select('accuracy, topic, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('flashcards').select('topic, repetitions, ease_factor').eq('user_id', user.id),
      supabase.from('streak_data').select('current_streak').eq('user_id', user.id).single(),
    ])

    const profile = profileRes.data
    const attempts = attemptsRes.data || []
    const flashcards = flashcardsRes.data || []
    const streak = streakRes.data

    const daysLeft = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000)
      : 0

    const avgAccuracy = attempts.length > 0
      ? attempts.reduce((sum, a) => sum + a.accuracy, 0) / attempts.length
      : 0

    const topicAccuracy: Record<string, number[]> = {}
    attempts.forEach(a => {
      if (!topicAccuracy[a.topic]) topicAccuracy[a.topic] = []
      topicAccuracy[a.topic].push(a.accuracy)
    })

    const weakTopics = Object.entries(topicAccuracy)
      .map(([topic, scores]) => ({
        topic,
        avg: scores.reduce((a, b) => a + b, 0) / scores.length,
      }))
      .filter(t => t.avg < 60)
      .sort((a, b) => a.avg - b.avg)
      .slice(0, 5)

    // AI readiness score
    const systemPrompt = `You are an exam readiness evaluator. Based on the data provided, return a JSON object with exactly these keys: score (0-100 integer), label (one of: "Not Ready", "Building Up", "On Track", "Ready"), summary (one sentence). Return only JSON, no other text.`

    const userPrompt = `Days left to exam: ${daysLeft}
Average quiz accuracy: ${avgAccuracy.toFixed(1)}%
Flashcards created: ${flashcards.length}
Current streak: ${streak?.current_streak || 0} days
Weak topics count: ${weakTopics.length}
Total quiz attempts: ${attempts.length}

Calculate exam readiness score.`

    const readiness = await generateJSON(systemPrompt, userPrompt, {
      score: Math.min(100, Math.round(avgAccuracy * 0.6 + (streak?.current_streak || 0) * 0.4)),
      label: avgAccuracy >= 75 ? 'On Track' : avgAccuracy >= 50 ? 'Building Up' : 'Not Ready',
      summary: 'Keep studying consistently to improve your readiness.',
    })

    return NextResponse.json({
      readiness,
      weak_topics: weakTopics,
      avg_accuracy: avgAccuracy,
      days_left: daysLeft,
      streak: streak?.current_streak || 0,
      total_attempts: attempts.length,
    })
  } catch (err) {
    console.error('[Analytics Readiness]', err)
    return NextResponse.json({ error: 'Failed to calculate readiness' }, { status: 500 })
  }
}
