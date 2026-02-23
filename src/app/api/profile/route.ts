import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const [userRes, profileRes, badgesRes, xpRes] = await Promise.all([
      supabase.from('users').select('*').eq('id', user.id).single(),
      supabase.from('user_profiles').select('*').eq('user_id', user.id).single(),
      supabase.from('user_badges').select('badge_slug, earned_at').eq('user_id', user.id),
      supabase.from('xp_transactions').select('amount').eq('user_id', user.id),
    ])

    return NextResponse.json({
      user: userRes.data,
      profile: profileRes.data,
      badges: badgesRes.data || [],
      total_xp: xpRes.data?.reduce((sum, t) => sum + t.amount, 0) || 0,
    })
  } catch (err) {
    console.error('[Profile GET]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const { name, daily_hours, exam_date } = body

    const updates: Record<string, unknown> = {}
    if (name) updates.name = name

    if (Object.keys(updates).length > 0) {
      await supabase.from('users').update(updates).eq('id', user.id)
    }

    const profileUpdates: Record<string, unknown> = {}
    if (daily_hours) profileUpdates.daily_hours = daily_hours
    if (exam_date) profileUpdates.exam_date = exam_date

    if (Object.keys(profileUpdates).length > 0) {
      await supabase.from('user_profiles').update(profileUpdates).eq('user_id', user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Profile PATCH]', err)
    return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 })
  }
}
