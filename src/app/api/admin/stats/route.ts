import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// Returns aggregate stats for the institution admin
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    // Verify this user is an institution admin (uses admin client to bypass RLS)
    const { data: institution } = await admin
      .from('institutions')
      .select('id, name, code')
      .eq('admin_user_id', user.id)
      .single()

    if (!institution) return NextResponse.json({ error: 'Not an admin' }, { status: 403 })

    // Get all students in this institution (admin client bypasses RLS)
    const { data: students } = await admin
      .from('user_profiles')
      .select('user_id, exam, level')
      .eq('institution_code', institution.code)

    const studentIds = students?.map(s => s.user_id) || []

    if (studentIds.length === 0) {
      return NextResponse.json({
        institution,
        total_students: 0,
        active_today: 0,
        avg_streak: 0,
        avg_accuracy: 0,
        exam_breakdown: {},
      })
    }

    const today = new Date().toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString()

    const [activeRes, streakRes, quizRes] = await Promise.all([
      admin.from('daily_usage').select('user_id').eq('usage_date', today).in('user_id', studentIds),
      admin.from('streak_data').select('current_streak').in('user_id', studentIds),
      admin.from('quiz_attempts').select('accuracy').in('user_id', studentIds).gte('created_at', weekAgo),
    ])

    const avgStreak = streakRes.data?.length
      ? Math.round(streakRes.data.reduce((s, r) => s + r.current_streak, 0) / streakRes.data.length)
      : 0

    const avgAccuracy = quizRes.data?.length
      ? Math.round(quizRes.data.reduce((s, r) => s + r.accuracy, 0) / quizRes.data.length)
      : 0

    const examBreakdown: Record<string, number> = {}
    students?.forEach(s => {
      examBreakdown[s.exam] = (examBreakdown[s.exam] || 0) + 1
    })

    return NextResponse.json({
      institution,
      total_students: studentIds.length,
      active_today: activeRes.data?.length || 0,
      avg_streak: avgStreak,
      avg_accuracy: avgAccuracy,
      exam_breakdown: examBreakdown,
    })
  } catch (err) {
    console.error('[Admin Stats]', err)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
