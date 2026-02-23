'use client'
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, BookOpen, Plus, ChevronRight, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { EXAM_CONFIGS, ExamType } from '@/types'

interface Flashcard {
  id: string
  front: string
  back: string
  topic: string
  exam: ExamType
  ease_factor: number
  interval: number
  repetitions: number
  next_review_date: string
}

type Rating = 1 | 2 | 3 | 4

const RATING_LABELS: Record<Rating, { label: string; color: string; bg: string }> = {
  1: { label: 'Again', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30 hover:bg-red-500/20' },
  2: { label: 'Hard', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20' },
  3: { label: 'Good', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20' },
  4: { label: 'Easy', color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30 hover:bg-green-500/20' },
}

function FlipCard({ card, onRate }: { card: Flashcard; onRate: (rating: Rating) => void }) {
  const [flipped, setFlipped] = useState(false)

  useEffect(() => { setFlipped(false) }, [card.id])

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Card */}
      <div
        className="card-container w-full cursor-pointer select-none"
        style={{ height: 260 }}
        onClick={() => setFlipped(f => !f)}
      >
        <div className={`card-inner w-full h-full ${flipped ? 'flipped' : ''}`}>
          {/* Front */}
          <div className="card-face w-full h-full bg-[#111827] border border-[#1F2937] rounded-2xl flex flex-col items-center justify-center p-6 text-center">
            <div className="text-xs text-[#4F8EF7] font-medium mb-3 uppercase tracking-wide">Question</div>
            <p className="text-white text-lg font-medium leading-relaxed">{card.front}</p>
            <p className="text-gray-600 text-xs mt-4">Tap to reveal answer</p>
          </div>
          {/* Back */}
          <div className="card-face card-back w-full h-full bg-[#0A1628] border border-[#4F8EF7]/30 rounded-2xl flex flex-col items-center justify-center p-6 text-center">
            <div className="text-xs text-[#10B981] font-medium mb-3 uppercase tracking-wide">Answer</div>
            <p className="text-gray-100 text-base leading-relaxed">{card.back}</p>
          </div>
        </div>
      </div>

      {/* Rating buttons — only visible when flipped */}
      <AnimatePresence>
        {flipped && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="w-full"
          >
            <p className="text-gray-500 text-xs text-center mb-3">How well did you know this?</p>
            <div className="grid grid-cols-4 gap-2">
              {([1, 2, 3, 4] as Rating[]).map(r => (
                <button
                  key={r}
                  onClick={() => onRate(r)}
                  className={`border rounded-xl py-3 text-sm font-medium transition-colors ${RATING_LABELS[r].bg} ${RATING_LABELS[r].color}`}
                >
                  {RATING_LABELS[r].label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!flipped && (
        <p className="text-gray-600 text-xs">Tap card to flip</p>
      )}
    </div>
  )
}

function GenerateForm({ onGenerate }: { onGenerate: () => void }) {
  const [topic, setTopic] = useState('')
  const [exam, setExam] = useState<ExamType>('UPSC_CSE')
  const [loading, setLoading] = useState(false)

  async function handleGenerate() {
    if (!topic.trim()) { toast.error('Enter a topic'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/flashcards/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), exam }),
      })
      const data = await res.json()
      if (res.status === 429) {
        toast.error('Daily limit reached. Upgrade to Pro for unlimited flashcards!')
        return
      }
      if (!res.ok) throw new Error(data.error)
      onGenerate()
      toast.success(`${data.cards.length} flashcards generated!`)
    } catch {
      toast.error('Failed to generate flashcards')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-gray-400 text-sm block mb-2">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleGenerate()}
          placeholder="e.g. Fundamental Rights, Sorting Algorithms..."
          className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4F8EF7]/50"
        />
      </div>
      <div>
        <label className="text-gray-400 text-sm block mb-2">Exam</label>
        <select
          value={exam}
          onChange={e => setExam(e.target.value as ExamType)}
          className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-[#4F8EF7]/50"
        >
          {Object.values(EXAM_CONFIGS).map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="w-full bg-[#4F8EF7] text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3B7DE8] transition-colors disabled:opacity-50"
      >
        {loading ? (
          <><RotateCcw className="w-4 h-4 animate-spin" />Generating 20 cards...</>
        ) : (
          <><Plus className="w-4 h-4" />Generate 20 Flashcards</>
        )}
      </button>
    </div>
  )
}

export default function FlashcardsPage() {
  const [cards, setCards] = useState<Flashcard[]>([])
  const [index, setIndex] = useState(0)
  const [mode, setMode] = useState<'home' | 'review' | 'generate'>('home')
  const [dueCards, setDueCards] = useState<Flashcard[]>([])
  const [reviewed, setReviewed] = useState(0)
  const [loadingDue, setLoadingDue] = useState(true)
  const [sessionComplete, setSessionComplete] = useState(false)

  const fetchDueCards = useCallback(async () => {
    setLoadingDue(true)
    try {
      const res = await fetch('/api/flashcards/review')
      if (res.ok) {
        const data = await res.json()
        setDueCards(data.cards || [])
      }
    } catch {
      // no-op
    } finally {
      setLoadingDue(false)
    }
  }, [])

  useEffect(() => { fetchDueCards() }, [fetchDueCards])

  async function handleRate(rating: Rating) {
    const card = cards[index]
    const isLast = index + 1 >= cards.length
    const newReviewed = reviewed + 1

    try {
      await fetch('/api/flashcards/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          card_id: card.id,
          rating,
          session_complete: isLast,
          cards_reviewed: newReviewed,
          retention_rate: Math.round((newReviewed > 0 ? newReviewed / cards.length : 0) * 100),
          duration_seconds: 0,
        }),
      })
    } catch { /* best effort */ }

    setReviewed(newReviewed)
    if (isLast) {
      setSessionComplete(true)
    } else {
      setIndex(i => i + 1)
    }
  }

  function startDueReview() {
    setCards(dueCards)
    setIndex(0)
    setReviewed(0)
    setSessionComplete(false)
    setMode('review')
  }

  function onGenerate() {
    // After generating, fetch due cards and return home
    fetchDueCards().then(() => {
      setMode('home')
    })
  }

  // Session complete screen
  if (mode === 'review' && sessionComplete) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 text-center">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="text-6xl mb-4">🎉</motion.div>
        <h2 className="text-2xl font-bold text-white mb-2">Session Complete!</h2>
        <p className="text-gray-400 mb-2">You reviewed <span className="text-[#4F8EF7] font-bold">{reviewed}</span> cards.</p>
        <p className="text-gray-500 text-sm mb-8">+10 XP earned for this session</p>
        <div className="space-y-3">
          <button
            onClick={() => { setMode('home'); fetchDueCards() }}
            className="w-full bg-[#4F8EF7] text-white py-3.5 rounded-xl font-semibold"
          >
            Back to Home
          </button>
          <button
            onClick={() => setMode('generate')}
            className="w-full bg-[#111827] border border-[#1F2937] text-gray-300 py-3.5 rounded-xl font-medium text-sm"
          >
            Generate More Cards
          </button>
        </div>
      </div>
    )
  }

  // Review mode
  if (mode === 'review' && cards.length > 0) {
    const card = cards[index]
    const progress = Math.round((index / cards.length) * 100)

    return (
      <div className="max-w-lg mx-auto px-4 pt-5 pb-28">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setMode('home')} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <span className="text-white text-sm font-medium">{card.topic}</span>
              <span className="text-gray-500 text-xs">{index + 1}/{cards.length}</span>
            </div>
            <div className="h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-[#4F8EF7] rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        </div>

        <FlipCard card={card} onRate={handleRate} />
      </div>
    )
  }

  // Generate mode
  if (mode === 'generate') {
    return (
      <div className="max-w-lg mx-auto px-4 pt-5 pb-28">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setMode('home')} className="text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold text-white">Generate Flashcards</h1>
        </div>
        <GenerateForm onGenerate={onGenerate} />
      </div>
    )
  }

  // Home screen
  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Flashcards</h1>
          <p className="text-gray-400 text-sm">Spaced repetition review</p>
        </div>
        <BookOpen className="w-6 h-6 text-[#4F8EF7]" />
      </div>

      {/* Due cards */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 mb-4">
        {loadingDue ? (
          <div className="space-y-2">
            <div className="skeleton h-5 w-32 rounded-lg" />
            <div className="skeleton h-4 w-48 rounded-lg" />
          </div>
        ) : dueCards.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-1">
              <span className="text-white font-semibold">{dueCards.length} cards due</span>
              <span className="bg-[#F59E0B] text-black text-xs font-bold px-2 py-0.5 rounded-full">Review now</span>
            </div>
            <p className="text-gray-400 text-sm mb-4">These cards are scheduled for today&apos;s review.</p>
            <button
              onClick={startDueReview}
              className="w-full bg-[#4F8EF7] text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 hover:bg-[#3B7DE8] transition-colors"
            >
              Start Review <ChevronRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <div className="text-center py-2">
              <div className="text-3xl mb-2">✅</div>
              <p className="text-white font-medium">All caught up!</p>
              <p className="text-gray-400 text-sm mt-1">No cards due for review today.</p>
            </div>
          </>
        )}
      </div>

      {/* Generate new */}
      <button
        onClick={() => setMode('generate')}
        className="w-full bg-[#111827] border border-[#1F2937] rounded-2xl p-5 text-left hover:border-[#4F8EF7]/30 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#4F8EF7]/10 rounded-xl flex items-center justify-center">
            <Plus className="w-5 h-5 text-[#4F8EF7]" />
          </div>
          <div>
            <p className="text-white font-medium text-sm">Generate New Cards</p>
            <p className="text-gray-500 text-xs">AI creates 20 cards for any topic</p>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-600 ml-auto" />
        </div>
      </button>

      <p className="text-gray-600 text-xs text-center mt-6">
        ⚠️ AI-generated — verify facts from official sources
      </p>
    </div>
  )
}
