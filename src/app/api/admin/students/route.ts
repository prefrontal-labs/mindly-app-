import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify admin (admin client bypasses RLS)
    const { data: institution } = await admin
      .from('institutions')
      .select('id, code')
      .eq('admin_user_id', user.id)
      .single()

    if (!institution) return NextResponse.json({ error: 'Not an admin' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = 20
    const offset = (page - 1) * limit

    // Get students in this institution (admin client bypasses RLS)
    const { data: profiles, count } = await admin
      .from('user_profiles')
      .select('user_id, exam, exam_date, level, daily_hours', { count: 'exact' })
      .eq('institution_code', institution.code)
      .range(offset, offset + limit - 1)

    if (!profiles?.length) return NextResponse.json({ students: [], total: 0 })

    const studentIds = profiles.map(p => p.user_id)

    const [usersRes, streaksRes, attemptsRes] = await Promise.all([
      admin.from('users').select('id, name, email, plan, streak_count, total_xp').in('id', studentIds),
      admin.from('streak_data').select('user_id, current_streak').in('user_id', studentIds),
      admin.from('quiz_attempts').select('user_id, accuracy')
        .in('user_id', studentIds)
        .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString()),
    ])

    const streakMap = Object.fromEntries((streaksRes.data || []).map(s => [s.user_id, s.current_streak]))
    const accuracyMap: Record<string, number[]> = {}
    ;(attemptsRes.data || []).forEach(a => {
      if (!accuracyMap[a.user_id]) accuracyMap[a.user_id] = []
      accuracyMap[a.user_id].push(a.accuracy)
    })

    const students = (usersRes.data || []).map(u => {
      const profile = profiles.find(p => p.user_id === u.id)
      const accs = accuracyMap[u.id] || []
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        plan: u.plan,
        exam: profile?.exam,
        exam_date: profile?.exam_date,
        level: profile?.level,
        streak: streakMap[u.id] || 0,
        total_xp: u.total_xp || 0,
        week_accuracy: accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : null,
      }
    })

    return NextResponse.json({ students, total: count || 0 })
  } catch (err) {
    console.error('[Admin Students]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
