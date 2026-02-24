import { createClient } from '@/lib/supabase/server'
import RoadmapClient from '@/components/roadmap/RoadmapClient'
import { redirect } from 'next/navigation'

export default async function RoadmapPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const [roadmapRes, profileRes] = await Promise.all([
    supabase.from('roadmaps').select('*').eq('user_id', user.id).single(),
    supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
  ])

  return (
    <RoadmapClient
      roadmap={roadmapRes.data}
      profile={profileRes.data}
      initialCompletedDays={roadmapRes.data?.completed_days ?? []}
      initialCompletedTopics={roadmapRes.data?.completed_topics ?? []}
    />
  )
}
