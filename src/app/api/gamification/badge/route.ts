import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { badge_slug } = await req.json()

    const { data: existing } = await supabase
      .from('user_badges')
      .select('id')
      .eq('user_id', user.id)
      .eq('badge_slug', badge_slug)
      .single()

    if (!existing) {
      await supabase.from('user_badges').insert({ user_id: user.id, badge_slug })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Badge]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
