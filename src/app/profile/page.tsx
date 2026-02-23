'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Flame, Zap, ChevronRight, RefreshCw, Check } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { EXAM_CONFIGS, ExamType, BADGES } from '@/types'

interface ProfileData {
  user: { name: string; email: string; plan: string; streak_count: number; total_xp: number }
  profile: { exam: ExamType; exam_date: string; daily_hours: number; level: string }
  badges: { badge_slug: string; earned_at: string }[]
  total_xp: number
}

const PLAN_COLORS: Record<string, string> = {
  free: 'text-gray-400',
  pro: 'text-[#4F8EF7]',
  exam_pack: 'text-[#F59E0B]',
}

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  exam_pack: 'Exam Pack',
}

export default function ProfilePage() {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [dailyHours, setDailyHours] = useState(3)
  const [examDate, setExamDate] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(d => {
        setData(d)
        setName(d.user?.name || '')
        setDailyHours(d.profile?.daily_hours || 3)
        setExamDate(d.profile?.exam_date?.split('T')[0] || '')
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, daily_hours: dailyHours, exam_date: examDate }),
      })
      if (!res.ok) throw new Error()
      toast.success('Profile updated!')
      setEditing(false)
      // Refresh
      const updated = await fetch('/api/profile').then(r => r.json())
      setData(updated)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 text-[#4F8EF7] animate-spin" />
        <p className="text-gray-500 text-sm">Loading profile...</p>
      </div>
    )
  }

  if (!data) return null

  const { user, profile, badges } = data
  const earnedSlugs = new Set(badges.map(b => b.badge_slug))
  const examConfig = profile?.exam ? EXAM_CONFIGS[profile.exam] : null
  const daysLeft = profile?.exam_date
    ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000)
    : null

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-4">
      {/* Avatar + name */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-4"
      >
        <div className="w-16 h-16 bg-[#4F8EF7]/20 rounded-full flex items-center justify-center text-[#4F8EF7] text-3xl font-bold">
          {user.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">{user.name}</h1>
          <p className="text-gray-400 text-sm">{user.email}</p>
          <span className={`text-xs font-bold uppercase ${PLAN_COLORS[user.plan] || 'text-gray-400'}`}>
            {PLAN_LABELS[user.plan] || user.plan} Plan
          </span>
        </div>
        <button
          onClick={() => setEditing(e => !e)}
          className="text-[#4F8EF7] text-sm font-medium"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </motion.div>

      {/* Edit form */}
      {editing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 space-y-3"
        >
          <div>
            <label className="text-gray-400 text-xs block mb-1.5">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-[#0A0F1E] border border-[#1F2937] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#4F8EF7]/50"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1.5">Daily Study Hours: {dailyHours}h</label>
            <input
              type="range" min={1} max={12}
              value={dailyHours}
              onChange={e => setDailyHours(Number(e.target.value))}
              className="w-full accent-[#4F8EF7]"
            />
          </div>
          <div>
            <label className="text-gray-400 text-xs block mb-1.5">Exam Date</label>
            <input
              type="date"
              value={examDate}
              onChange={e => setExamDate(e.target.value)}
              className="w-full bg-[#0A0F1E] border border-[#1F2937] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-[#4F8EF7]/50"
            />
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-[#4F8EF7] text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Save Changes
          </button>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 text-center">
          <Flame className="w-5 h-5 text-[#F59E0B] mx-auto mb-1" />
          <div className="text-white font-bold text-lg">{user.streak_count || 0}</div>
          <div className="text-gray-500 text-[10px]">Day streak</div>
        </div>
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 text-center">
          <Zap className="w-5 h-5 text-[#4F8EF7] mx-auto mb-1" />
          <div className="text-white font-bold text-lg">{(data.total_xp || 0).toLocaleString()}</div>
          <div className="text-gray-500 text-[10px]">Total XP</div>
        </div>
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-3 text-center">
          <div className="text-xl mb-1">🏅</div>
          <div className="text-white font-bold text-lg">{badges.length}</div>
          <div className="text-gray-500 text-[10px]">Badges</div>
        </div>
      </div>

      {/* Exam info */}
      {examConfig && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4">
          <h2 className="text-white font-semibold text-sm mb-3">Exam Details</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Target exam</span>
              <span className="text-white font-medium">{examConfig.shortName}</span>
            </div>
            {daysLeft !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Days remaining</span>
                <span className="text-[#4F8EF7] font-bold">{daysLeft}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Daily goal</span>
              <span className="text-white">{profile.daily_hours}h / day</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Level</span>
              <span className="text-white capitalize">{profile.level?.replace('_', ' ')}</span>
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4">
        <h2 className="text-white font-semibold text-sm mb-3">Badges</h2>
        <div className="grid grid-cols-3 gap-2">
          {BADGES.map(badge => {
            const earned = earnedSlugs.has(badge.slug)
            return (
              <div
                key={badge.slug}
                className={`rounded-xl p-3 text-center ${
                  earned
                    ? 'bg-[#4F8EF7]/10 border border-[#4F8EF7]/30'
                    : 'bg-[#0A0F1E] border border-[#1F2937] opacity-40'
                }`}
              >
                <div className="text-2xl mb-1">{badge.icon}</div>
                <div className="text-white text-xs font-medium leading-tight">{badge.name}</div>
                <div className="text-gray-500 text-[10px] mt-0.5">{badge.description}</div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Upgrade CTA for free users */}
      {user.plan === 'free' && (
        <Link
          href="/upgrade"
          className="block bg-gradient-to-r from-[#4F8EF7]/10 to-[#A78BFA]/10 border border-[#4F8EF7]/30 rounded-2xl p-4"
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-semibold text-sm">Upgrade to Pro</p>
              <p className="text-gray-400 text-xs mt-0.5">Unlimited flashcards, quizzes & AI tutor</p>
            </div>
            <ChevronRight className="w-5 h-5 text-[#4F8EF7]" />
          </div>
        </Link>
      )}
    </div>
  )
}
