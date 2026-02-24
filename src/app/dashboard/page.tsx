import { createClient } from '@/lib/supabase/server'
import DashboardClient from '@/components/dashboard/DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const [userRes, profileRes, roadmapRes, streakRes, flashcardsRes, attemptsRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
    supabase.from('roadmaps').select('exam, phases, completed_topics, completed_days').eq('user_id', user.id).single(),
    supabase.from('streak_data').select('*').eq('user_id', user.id).single(),
    supabase.from('flashcards')
      .select('id', { count: 'exact' })
      .eq('user_id', user.id)
      .lte('next_review_date', new Date().toISOString().split('T')[0]),
    supabase.from('quiz_attempts')
      .select('accuracy')
      .eq('user_id', user.id)
      .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
  ])

  const today = new Date().toISOString().split('T')[0]
  const { data: usage } = await supabase
    .from('daily_usage')
    .select('*')
    .eq('user_id', user.id)
    .eq('usage_date', today)
    .single()

  const userData = userRes.data
  const profile = profileRes.data
  const roadmap = roadmapRes.data
  const streak = streakRes.data
  const flashcardsDue = flashcardsRes.count || 0
  const weekAttempts = attemptsRes.data || []
  const weekAccuracy = weekAttempts.length > 0
    ? Math.round(weekAttempts.reduce((s, a) => s + a.accuracy, 0) / weekAttempts.length)
    : 0

  const daysLeft = profile?.exam_date
    ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <DashboardClient
      user={userData}
      profile={profile}
      roadmap={roadmap}
      streak={streak?.current_streak || 0}
      flashcardsDue={flashcardsDue}
      weekAccuracy={weekAccuracy}
      daysLeft={daysLeft}
      dailyUsage={usage}
      completedTopics={roadmap?.completed_topics ?? []}
    />
  )
}
