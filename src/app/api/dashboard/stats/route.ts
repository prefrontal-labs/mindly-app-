import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

    const [userData, streakData, flashcardsDue, dailyUsage, weeklyQuizzes, weeklySessions, roadmap, profile] = await Promise.all([
      supabase.from('users').select('name, plan, streak_count, total_xp').eq('id', user.id).single(),
      supabase.from('streak_data').select('current_streak, longest_streak').eq('user_id', user.id).single(),
      supabase.from('flashcards').select('id', { count: 'exact' }).eq('user_id', user.id).lte('next_review_date', today),
      supabase.from('daily_usage').select('*').eq('user_id', user.id).eq('usage_date', today).single(),
      supabase.from('quiz_attempts').select('accuracy').eq('user_id', user.id).gte('created_at', weekAgo),
      supabase.from('study_sessions').select('duration_minutes, topic').eq('user_id', user.id).gte('session_date', weekAgo),
      supabase.from('roadmaps').select('phases, current_phase').eq('user_id', user.id).single(),
      supabase.from('user_profiles').select('exam, exam_date, daily_hours').eq('user_id', user.id).single(),
    ])

    const avgAccuracy = weeklyQuizzes.data?.length
      ? Math.round(weeklyQuizzes.data.reduce((a, q) => a + q.accuracy, 0) / weeklyQuizzes.data.length)
      : 0

    const hoursToday = (dailyUsage.data
      ? Math.round(((dailyUsage.data.flashcards_reviewed || 0) * 0.5 + (dailyUsage.data.quiz_questions_answered || 0) * 1) / 60 * 10) / 10
      : 0)

    const dailyGoalHours = profile.data?.daily_hours || 3
    const dailyGoalProgress = Math.min(100, Math.round((hoursToday / dailyGoalHours) * 100))

    const daysToExam = profile.data?.exam_date
      ? Math.max(0, Math.ceil((new Date(profile.data.exam_date).getTime() - Date.now()) / 86400000))
      : null

    const topicsThisWeek = new Set(weeklySessions.data?.map(s => s.topic) || []).size

    // Today's tasks from roadmap
    const todaysTasks = getTodaysTasks(roadmap.data)

    return NextResponse.json({
      user: userData.data,
      streak: streakData.data?.current_streak || userData.data?.streak_count || 0,
      longest_streak: streakData.data?.longest_streak || 0,
      flashcards_due: flashcardsDue.count || 0,
      quiz_accuracy_week: avgAccuracy,
      hours_today: hoursToday,
      daily_goal_progress: dailyGoalProgress,
      topics_this_week: topicsThisWeek,
      days_to_exam: daysToExam,
      exam: profile.data?.exam,
      today_tasks: todaysTasks,
      daily_goal_hours: dailyGoalHours,
    })
  } catch (err) {
    console.error('[Dashboard Stats]', err)
    return NextResponse.json({ error: 'Failed to load stats' }, { status: 500 })
  }
}

function getTodaysTasks(roadmap: { phases: { phase: string; weeks: { week_number: number; topics: string[] }[] }[] } | null) {
  if (!roadmap?.phases?.length) return []
  const phase = roadmap.phases[0]
  const week = phase.weeks?.[0]
  if (!week?.topics) return []
  return week.topics.slice(0, 5).map((topic: string, i: number) => ({
    id: `task-${i}`,
    topic,
    estimated_minutes: 45,
    subject: phase.phase,
    completed: false,
  }))
}
