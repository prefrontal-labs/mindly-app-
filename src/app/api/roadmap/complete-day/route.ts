import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { date, completed } = await req.json()
    if (!date) return NextResponse.json({ error: 'Missing date' }, { status: 400 })

    // Fetch current completed_days
    const { data: roadmap, error: fetchError } = await supabase
      .from('roadmaps')
      .select('completed_days')
      .eq('user_id', user.id)
      .single()

    if (fetchError || !roadmap) return NextResponse.json({ error: 'Roadmap not found' }, { status: 404 })

    const current: string[] = roadmap.completed_days ?? []
    const updated = completed
      ? Array.from(new Set([...current, date]))
      : current.filter((d: string) => d !== date)

    const { error: updateError } = await supabase
      .from('roadmaps')
      .update({ completed_days: updated })
      .eq('user_id', user.id)

    if (updateError) throw updateError

    return NextResponse.json({ success: true, completed_days: updated })
  } catch (err) {
    console.error('[Complete Day]', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
