import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/groq'
import { PLAN_LIMITS } from '@/types'
import { getEffectivePlan } from '@/lib/plan'

interface FlashcardData {
  front: string
  back: string
}

const FALLBACK_CARDS: FlashcardData[] = Array.from({ length: 5 }, (_, i) => ({
  front: `Key concept ${i + 1} — tap to see answer`,
  back: 'AI-generated content unavailable. Please try again.',
}))

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { topic, exam } = await req.json()

    // Check plan limits
    const { data: userData } = await supabase
      .from('users')
      .select('plan, plan_expiry')
      .eq('id', user.id)
      .single()

    const plan = getEffectivePlan(userData?.plan, userData?.plan_expiry)
    const limit = PLAN_LIMITS[plan].flashcards_per_day

    if (limit !== Infinity) {
      const today = new Date().toISOString().split('T')[0]
      const { data: usage } = await supabase
        .from('daily_usage')
        .select('flashcards_reviewed')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .single()

      if ((usage?.flashcards_reviewed || 0) >= limit) {
        return NextResponse.json({ error: 'Daily limit reached', upgrade_required: true }, { status: 429 })
      }
    }

    const systemPrompt = `Generate 20 high-quality flashcards for exam preparation. Return only a JSON array, no other text. Each item must have exactly "front" and "back" keys.`

    const userPrompt = `Topic: ${topic}
Exam: ${exam}
Generate 20 exam-focused flashcards. Include factual cards, conceptual cards, and date/formula cards where relevant.
front: question or term (max 20 words)
back: answer or definition (max 60 words)
Ensure factual accuracy. Make them exam-pattern aligned for ${exam}.`

    const rawCards = await generateJSON<FlashcardData[] | Record<string, FlashcardData[]>>(systemPrompt, userPrompt, FALLBACK_CARDS)

    // Handle cases where the model wraps the array in an object: {"cards": [...]} or {"flashcards": [...]}
    let cards: FlashcardData[]
    if (Array.isArray(rawCards)) {
      cards = rawCards
    } else if (rawCards && typeof rawCards === 'object') {
      const nested = Object.values(rawCards).find(v => Array.isArray(v))
      cards = (nested as FlashcardData[] | undefined) ?? FALLBACK_CARDS
    } else {
      cards = FALLBACK_CARDS
    }

    const validCards = cards.filter(c => c?.front && c?.back).slice(0, 20)
    const finalCards = validCards.length >= 3 ? validCards : FALLBACK_CARDS

    const today = new Date().toISOString().split('T')[0]

    // Insert all cards
    const { data: inserted, error } = await supabase
      .from('flashcards')
      .insert(
        finalCards.map(card => ({
          user_id: user.id,
          topic,
          exam,
          front: card.front || 'Question',
          back: card.back || 'Answer',
          ease_factor: 2.5,
          interval: 0,
          next_review_date: today,
          repetitions: 0,
        }))
      )
      .select()

    if (error) throw error

    return NextResponse.json({ success: true, cards: inserted })
  } catch (err) {
    console.error('[Flashcard Generate]', err)
    return NextResponse.json({ error: 'Failed to generate flashcards' }, { status: 500 })
  }
}
