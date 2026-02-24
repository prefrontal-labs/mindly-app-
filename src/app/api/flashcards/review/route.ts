import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sm2Update } from '@/lib/sm2'
import { awardXP, XP_REWARDS, updateStreak } from '@/lib/xp'
import { PLAN_LIMITS } from '@/types'
import { getEffectivePlan } from '@/lib/plan'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { card_id, rating, session_complete, cards_reviewed, retention_rate, duration_seconds } = await req.json()

    if (card_id && rating) {
      // Update card with SM-2
      const { data: card } = await supabase
        .from('flashcards')
        .select('ease_factor, interval, repetitions')
        .eq('id', card_id)
        .eq('user_id', user.id)
        .single()

      if (card) {
        const updated = sm2Update(card, rating)
        await supabase
          .from('flashcards')
          .update({
            ease_factor: updated.ease_factor,
            interval: updated.interval,
            repetitions: updated.repetitions,
            next_review_date: updated.next_review_date,
          })
          .eq('id', card_id)

        // Track daily usage
        const today = new Date().toISOString().split('T')[0]
        await supabase
          .from('daily_usage')
          .upsert(
            { user_id: user.id, usage_date: today, flashcards_reviewed: 1 },
            { onConflict: 'user_id,usage_date' }
          )

        // Increment flashcards_reviewed
        await supabase.rpc('increment_flashcard_usage', { p_user_id: user.id, p_date: today })
      }
    }

    if (session_complete) {
      // Save session
      await supabase.from('flashcard_sessions').insert({
        user_id: user.id,
        cards_reviewed: cards_reviewed || 0,
        retention_rate: retention_rate || 0,
        duration_seconds: duration_seconds || 0,
      })

      // Award XP
      await awardXP(user.id, XP_REWARDS.flashcard_session, 'Completed flashcard session')
      await updateStreak(user.id)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[Flashcard Review]', err)
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const topic = searchParams.get('topic')

    const today = new Date().toISOString().split('T')[0]

    // Enforce daily review limit for free users
    const [userDataRes, profileRes] = await Promise.all([
      supabase.from('users').select('plan, plan_expiry').eq('id', user.id).single(),
      supabase.from('user_profiles').select('exam').eq('user_id', user.id).single(),
    ])

    const plan = getEffectivePlan(userDataRes.data?.plan, userDataRes.data?.plan_expiry)
    const limit = PLAN_LIMITS[plan].flashcards_per_day
    const userExam = profileRes.data?.exam

    let reviewedToday = 0
    if (limit !== Infinity) {
      const { data: usage } = await supabase
        .from('daily_usage')
        .select('flashcards_reviewed')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .single()
      reviewedToday = usage?.flashcards_reviewed || 0
    }

    const remaining = limit === Infinity ? 200 : Math.max(0, limit - reviewedToday)

    if (remaining === 0) {
      return NextResponse.json({ error: 'Daily limit reached', upgrade_required: true, cards: [] }, { status: 429 })
    }

    let query = supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .lte('next_review_date', today)
      .order('next_review_date', { ascending: true })
      .limit(remaining)

    if (topic) {
      query = query.eq('topic', topic)
    } else if (userExam) {
      // Only surface cards matching the user's current exam — prevents old test cards from other subjects showing up
      query = query.eq('exam', userExam)
    }

    const { data: cards } = await query

    return NextResponse.json({ cards: cards || [], remaining, limit: limit === Infinity ? null : limit })
  } catch (err) {
    console.error('[Flashcard GET]', err)
    return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 })
  }
}
