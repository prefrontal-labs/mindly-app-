import { createClient } from '@/lib/supabase/server'

export const XP_REWARDS = {
  flashcard_session: 10,
  quiz_complete: 20,
  quiz_above_80: 10,
  daily_plan_complete: 50,
  seven_day_streak: 100,
} as const

export async function awardXP(userId: string, amount: number, reason: string) {
  const supabase = await createClient()

  await supabase.from('xp_transactions').insert({
    user_id: userId,
    amount,
    reason,
  })
}

export async function checkAndAwardBadge(userId: string, badgeSlug: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('user_badges')
    .select('id')
    .eq('user_id', userId)
    .eq('badge_slug', badgeSlug)
    .single()

  if (!existing) {
    await supabase.from('user_badges').insert({
      user_id: userId,
      badge_slug: badgeSlug,
    })
  }
}

export async function updateStreak(userId: string) {
  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: streakData } = await supabase
    .from('streak_data')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (!streakData) {
    await supabase.from('streak_data').insert({
      user_id: userId,
      current_streak: 1,
      longest_streak: 1,
      last_active_date: today,
    })
    return 1
  }

  const lastActive = streakData.last_active_date
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().split('T')[0]

  let newStreak = streakData.current_streak

  if (lastActive === today) {
    return newStreak // Already counted today
  } else if (lastActive === yesterdayStr) {
    newStreak += 1
  } else {
    newStreak = 1 // Streak broken
  }

  const longestStreak = Math.max(newStreak, streakData.longest_streak)

  await supabase
    .from('streak_data')
    .update({
      current_streak: newStreak,
      longest_streak: longestStreak,
      last_active_date: today,
    })
    .eq('user_id', userId)

  // Award XP for 7-day streak
  if (newStreak % 7 === 0) {
    await awardXP(userId, XP_REWARDS.seven_day_streak, '7-day streak bonus')
    await checkAndAwardBadge(userId, 'week_warrior')
  }

  if (newStreak >= 30) {
    await checkAndAwardBadge(userId, 'iron_will')
  }

  // Update users table
  await supabase
    .from('users')
    .update({ streak_count: newStreak, last_active_date: today })
    .eq('id', userId)

  return newStreak
}
