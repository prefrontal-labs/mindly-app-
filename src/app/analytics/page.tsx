'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, TrendingUp, Target, Flame, RefreshCw } from 'lucide-react'
import { BADGES } from '@/types'

interface ReadinessData {
  readiness: { score: number; label: string; summary: string }
  weak_topics: { topic: string; avg: number }[]
  avg_accuracy: number
  days_left: number
  streak: number
  total_attempts: number
}

interface BadgeData {
  badge_slug: string
  earned_at: string
}

const READINESS_COLOR: Record<string, string> = {
  'Not Ready': '#EF4444',
  'Building Up': '#F59E0B',
  'On Track': '#4F8EF7',
  'Ready': '#10B981',
}

function RadialScore({ score, color }: { score: number; color: string }) {
  const r = 54
  const circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ

  return (
    <svg width={128} height={128} className="rotate-[-90deg]">
      <circle cx={64} cy={64} r={r} fill="none" stroke="#1F2937" strokeWidth={10} />
      <circle
        cx={64} cy={64} r={r} fill="none"
        stroke={color} strokeWidth={10}
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
    </svg>
  )
}

export default function AnalyticsPage() {
  const [data, setData] = useState<ReadinessData | null>(null)
  const [badges, setBadges] = useState<BadgeData[]>([])
  const [xp, setXp] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const [readinessRes, profileRes] = await Promise.all([
          fetch('/api/analytics/readiness'),
          fetch('/api/profile'),
        ])
        if (readinessRes.ok) setData(await readinessRes.json())
        if (profileRes.ok) {
          const p = await profileRes.json()
          setBadges(p.badges || [])
          setXp(p.user?.total_xp || 0)
        }
      } catch { /* no-op */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 text-[#4F8EF7] animate-spin" />
        <p className="text-gray-500 text-sm">Loading your analytics...</p>
      </div>
    )
  }

  const color = data ? (READINESS_COLOR[data.readiness.label] || '#4F8EF7') : '#4F8EF7'
  const score = data?.readiness.score ?? 0
  const earnedSlugs = new Set(badges.map(b => b.badge_slug))

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Analytics</h1>
          <p className="text-gray-400 text-sm">Your exam readiness</p>
        </div>
        <BarChart2 className="w-6 h-6 text-[#4F8EF7]" />
      </div>

      {/* Readiness Score */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5"
      >
        <h2 className="text-white font-semibold mb-4">Exam Readiness</h2>
        <div className="flex items-center gap-5">
          <div className="relative flex-shrink-0">
            <RadialScore score={score} color={color} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-white">{score}</span>
              <span className="text-xs font-medium" style={{ color }}>{data?.readiness.label}</span>
            </div>
          </div>
          <div className="flex-1 space-y-3">
            <p className="text-gray-300 text-sm leading-relaxed">{data?.readiness.summary}</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[#0A0F1E] rounded-xl p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">Avg Accuracy</div>
                <div className="text-white font-bold">{Math.round(data?.avg_accuracy ?? 0)}%</div>
              </div>
              <div className="bg-[#0A0F1E] rounded-xl p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">Days Left</div>
                <div className="text-white font-bold">{data?.days_left ?? '—'}</div>
              </div>
              <div className="bg-[#0A0F1E] rounded-xl p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">Streak</div>
                <div className="text-[#F59E0B] font-bold flex items-center gap-1">
                  <Flame className="w-3.5 h-3.5" />
                  {data?.streak ?? 0}d
                </div>
              </div>
              <div className="bg-[#0A0F1E] rounded-xl p-2.5">
                <div className="text-xs text-gray-500 mb-0.5">Quizzes</div>
                <div className="text-white font-bold">{data?.total_attempts ?? 0}</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* XP Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-gradient-to-r from-[#4F8EF7]/10 to-[#A78BFA]/10 border border-[#4F8EF7]/20 rounded-2xl p-5 flex items-center gap-4"
      >
        <div className="text-3xl">⚡</div>
        <div>
          <div className="text-2xl font-black text-white">{xp.toLocaleString()} XP</div>
          <div className="text-gray-400 text-sm">Total experience points</div>
        </div>
        <TrendingUp className="w-5 h-5 text-[#4F8EF7] ml-auto" />
      </motion.div>

      {/* Weak Topics */}
      {(data?.weak_topics?.length ?? 0) > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5"
        >
          <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
            <Target className="w-4 h-4 text-[#EF4444]" />
            Topics to Improve
          </h2>
          <div className="space-y-2.5">
            {data!.weak_topics.map((t, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-gray-300 text-sm">{t.topic}</span>
                    <span className="text-[#EF4444] text-xs font-medium">{Math.round(t.avg)}%</span>
                  </div>
                  <div className="h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#EF4444]"
                      style={{ width: `${Math.round(t.avg)}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Badges */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5"
      >
        <h2 className="text-white font-semibold mb-3">Badges</h2>
        <div className="grid grid-cols-3 gap-3">
          {BADGES.map(badge => {
            const earned = earnedSlugs.has(badge.slug)
            return (
              <div
                key={badge.slug}
                className={`rounded-xl p-3 text-center transition-all ${
                  earned
                    ? 'bg-[#4F8EF7]/10 border border-[#4F8EF7]/30'
                    : 'bg-[#0A0F1E] border border-[#1F2937] opacity-40'
                }`}
              >
                <div className="text-2xl mb-1">{badge.icon}</div>
                <div className="text-white text-xs font-medium leading-tight">{badge.name}</div>
                {earned && (
                  <div className="text-[#4F8EF7] text-[10px] mt-0.5">Earned</div>
                )}
              </div>
            )
          })}
        </div>
      </motion.div>

      <p className="text-gray-600 text-xs text-center">
        ⚠️ AI readiness score is an estimate — not an official prediction
      </p>
    </div>
  )
}
