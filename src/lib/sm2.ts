// SM-2 Spaced Repetition Algorithm
// Rating: 1=Again, 2=Hard, 3=Good, 4=Easy

export interface SM2Card {
  ease_factor: number   // default 2.5
  interval: number      // days until next review, starts at 0
  repetitions: number   // number of successful reviews
}

export function sm2Update(card: SM2Card, rating: 1 | 2 | 3 | 4): SM2Card & { next_review_date: string } {
  let { ease_factor, interval, repetitions } = card

  if (rating < 3) {
    // Failed — reset
    repetitions = 0
    interval = 1
  } else {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * ease_factor)
    }
    repetitions += 1
  }

  // Update ease factor (minimum 1.3)
  ease_factor = Math.max(1.3, ease_factor + (0.1 - (4 - rating) * (0.08 + (4 - rating) * 0.02)))

  const next = new Date()
  next.setDate(next.getDate() + interval)

  return {
    ease_factor,
    interval,
    repetitions,
    next_review_date: next.toISOString().split('T')[0],
  }
}

export function isDue(next_review_date: string): boolean {
  const today = new Date().toISOString().split('T')[0]
  return next_review_date <= today
}
