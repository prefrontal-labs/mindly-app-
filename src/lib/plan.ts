import { PLAN_LIMITS } from '@/types'

/**
 * Returns the effective plan key, downgrading to 'free' if the subscription
 * has expired. All API routes should use this instead of reading plan directly.
 */
export function getEffectivePlan(
  plan: string | null | undefined,
  planExpiry: string | null | undefined
): keyof typeof PLAN_LIMITS {
  if (!plan || plan === 'free') return 'free'
  if (planExpiry && new Date(planExpiry) < new Date()) return 'free'
  if (plan === 'pro' || plan === 'exam_pack') return plan
  return 'free'
}
