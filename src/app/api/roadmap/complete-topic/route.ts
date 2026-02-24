import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Key format: "YYYY-MM-DD:topicIndex"  e.g. "2026-02-24:0"
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { date, topicIndex, completed, totalTopicsForDay } = await req.json()
    if (!date || topicIndex === undefined) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

    const key = `${date}:${topicIndex}`

    const { data: roadmap, error: fetchError } = await supabase
      .from('roadmaps')
      .select('completed_topics, completed_days')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

    const currentTopics: string[] = roadmap.completed_topics ?? []
    const updatedTopics = completed
      ? Array.from(new Set([...currentTopics, key]))
      : currentTopics.filter((k: string) => k !== key)

    // Derive whether all topics for this day are now done
    const doneIndicesForDay = updatedTopics
      .filter((k: string) => k.startsWith(`${date}:`))
      .map((k: string) => parseInt(k.split(':')[1]))
    const allTopicsDone = typeof totalTopicsForDay === 'number'
      && doneIndicesForDay.length >= totalTopicsForDay

    // Keep completed_days in sync
    const currentDays: string[] = roadmap.completed_days ?? []
    const updatedDays = allTopicsDone
      ? Array.from(new Set([...currentDays, date]))
      : currentDays.filter((d: string) => d !== date)

    const { error: updateError } = await supabase
      .from('roadmaps')
      .update({ completed_topics: updatedTopics, completed_days: updatedDays })
      .eq('user_id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, completed_topics: updatedTopics, completed_days: updatedDays })
  } catch (err) {
    console.error('[Complete Topic]', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
