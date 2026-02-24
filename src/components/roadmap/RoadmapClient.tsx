'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, RefreshCw, ArrowRight, Sparkles, CheckCircle2, Circle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { EXAM_CONFIGS, ExamType } from '@/types'

interface RoadmapDay {
  date: string
  topics: string[]
}

interface RoadmapWeek {
  week_number: number
  start_date: string
  end_date: string
  theme?: string
  topics: string[]
  resources?: Array<{ type: string; title: string; author?: string; channel?: string }>
  days?: RoadmapDay[]
}

interface Phase {
  phase: string
  start_date: string
  end_date: string
  daily_hours: number
  weeks: RoadmapWeek[]
}

interface Props {
  roadmap: { exam: string; phases: Phase[] } | null
  profile: {
    exam: ExamType
    exam_date: string
    daily_hours?: number
    level?: string
    subject_assessments?: unknown[]
  } | null
  initialCompletedDays?: string[]
  initialCompletedTopics?: string[]
}

const PHASE_COLORS = {
  foundation: { bg: 'bg-[#4F8EF7]/10', border: 'border-[#4F8EF7]/30', text: 'text-[#4F8EF7]', dot: 'bg-[#4F8EF7]', label: 'Foundation' },
  depth:      { bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/30', text: 'text-[#8B5CF6]', dot: 'bg-[#8B5CF6]', label: 'Depth' },
  revision:   { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/30', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]', label: 'Revision' },
  mock:       { bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]/30', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]', label: 'Mock Tests' },
}

function formatDayLabel(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })
}

function findCurrentWeekKey(phases: Phase[], today: string): string | null {
  for (let pi = 0; pi < phases.length; pi++) {
    for (let wi = 0; wi < phases[pi].weeks.length; wi++) {
      const week = phases[pi].weeks[wi]
      if (today >= week.start_date && today <= week.end_date) return `${pi}-${wi}`
    }
  }
  return null
}

export default function RoadmapClient({ roadmap, profile, initialCompletedDays = [], initialCompletedTopics = [] }: Props) {
  const today = new Date().toISOString().split('T')[0]
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => {
    if (!roadmap) return new Set()
    const key = findCurrentWeekKey(roadmap.phases, today)
    return key ? new Set([key]) : new Set()
  })
  // completed_days: Set<"YYYY-MM-DD"> — derived, kept in sync by complete-topic API
  const [completedDays, setCompletedDays] = useState<Set<string>>(new Set(initialCompletedDays))
  // completed_topics: Set<"YYYY-MM-DD:topicIndex">
  const [completedTopics, setCompletedTopics] = useState<Set<string>>(new Set(initialCompletedTopics))
  const [togglingTopic, setTogglingTopic] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState(false)
  const [regenerating, setRegenerating] = useState(false)

  function toggleWeek(key: string) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }

  function expandPhase(pi: number, weeks: RoadmapWeek[]) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      weeks.forEach((_, wi) => next.add(`${pi}-${wi}`))
      return next
    })
  }

  function collapsePhase(pi: number, weeks: RoadmapWeek[]) {
    setExpandedWeeks(prev => {
      const next = new Set(prev)
      weeks.forEach((_, wi) => next.delete(`${pi}-${wi}`))
      return next
    })
  }

  async function toggleTopicComplete(date: string, topicIndex: number, totalTopicsForDay: number) {
    const key = `${date}:${topicIndex}`
    if (togglingTopic === key) return
    const nowDone = !completedTopics.has(key)

    // Optimistic update
    setCompletedTopics(prev => {
      const next = new Set(prev)
      if (nowDone) next.add(key); else next.delete(key)
      return next
    })

    // Derive day completion optimistically
    setCompletedDays(prev => {
      const next = new Set(prev)
      const doneCount = [...completedTopics].filter(k => k.startsWith(`${date}:`)).length + (nowDone ? 1 : -1)
      if (doneCount >= totalTopicsForDay) next.add(date); else next.delete(date)
      return next
    })

    setTogglingTopic(key)
    try {
      const res = await fetch('/api/roadmap/complete-topic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, topicIndex, completed: nowDone, totalTopicsForDay }),
      })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      // Sync server state
      setCompletedTopics(new Set(data.completed_topics ?? []))
      setCompletedDays(new Set(data.completed_days ?? []))
    } catch {
      // Revert
      setCompletedTopics(prev => {
        const next = new Set(prev)
        if (nowDone) next.delete(key); else next.add(key)
        return next
      })
      toast.error('Failed to save')
    } finally {
      setTogglingTopic(null)
    }
  }

  const examConfig = profile?.exam ? EXAM_CONFIGS[profile.exam] : null
  const daysLeft = profile?.exam_date
    ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000)
    : null

  async function adjustRoadmap(type: 'behind' | 'early') {
    setAdjusting(true)
    try {
      const res = await fetch('/api/roadmap/adjust', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }) })
      if (res.ok) { toast.success(type === 'behind' ? 'Roadmap compressed!' : 'Advanced to next phase!'); window.location.reload() }
      else toast.error('Failed to adjust roadmap')
    } catch { toast.error('Network error') }
    finally { setAdjusting(false) }
  }

  async function regenerateRoadmap() {
    if (!profile) { toast.error('Profile not found'); return }
    setRegenerating(true)
    try {
      const res = await fetch('/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exam: profile.exam,
          examDate: profile.exam_date,
          dailyHours: profile.daily_hours || 3,
          level: profile.level || 'beginner',
          subjects: profile.subject_assessments || [],
        }),
      })
      if (res.ok) { toast.success('Roadmap regenerated!'); window.location.reload() }
      else { const d = await res.json(); toast.error(d.error || 'Failed to regenerate') }
    } catch { toast.error('Network error') }
    finally { setRegenerating(false) }
  }

  if (!roadmap) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-8 text-center">
        <div className="text-5xl mb-4">🗺️</div>
        <h2 className="text-xl font-bold text-white mb-2">No roadmap yet</h2>
        <p className="text-gray-400 mb-6">Complete onboarding to generate your personalized study roadmap.</p>
        <Link href="/onboarding" className="bg-[#4F8EF7] text-white px-6 py-3 rounded-xl font-semibold inline-block">Complete Onboarding</Link>
      </div>
    )
  }

  // Count total weeks
  const totalWeeks = roadmap.phases.reduce((sum, p) => sum + p.weeks.length, 0)

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-28">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">Your Roadmap</h1>
        <p className="text-gray-400 text-sm">
          {examConfig?.shortName}{daysLeft !== null && ` — ${daysLeft} days remaining`}
          {totalWeeks > 0 && <span className="text-gray-600"> · {totalWeeks} weeks total</span>}
        </p>
      </div>

      {/* Regenerate — shown prominently when only 1 week (stale data) */}
      {totalWeeks <= 2 && (
        <div className="mb-4 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded-2xl p-4">
          <p className="text-[#F59E0B] text-sm font-semibold mb-1">⚠️ Roadmap incomplete</p>
          <p className="text-gray-400 text-xs mb-3">Your roadmap only has {totalWeeks} week(s). Regenerate to get the full {daysLeft}-day plan with all weeks.</p>
          <button
            onClick={regenerateRoadmap}
            disabled={regenerating}
            className="w-full bg-[#4F8EF7] text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 hover:bg-[#3B7AE8] transition-colors disabled:opacity-50"
          >
            {regenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />Regenerating...</> : <><Sparkles className="w-4 h-4" />Regenerate Full Roadmap</>}
          </button>
        </div>
      )}

      {/* Adjust buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button onClick={() => adjustRoadmap('behind')} disabled={adjusting}
          className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-50">
          <RefreshCw className="w-4 h-4" />Running behind
        </button>
        <button onClick={() => adjustRoadmap('early')} disabled={adjusting}
          className="bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#10B981]/20 transition-colors disabled:opacity-50">
          <ArrowRight className="w-4 h-4" />Finished early
        </button>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {roadmap.phases.map((phase, pi) => {
          const colors = PHASE_COLORS[phase.phase as keyof typeof PHASE_COLORS] || PHASE_COLORS.foundation
          const isCurrentPhase = today >= phase.start_date && today <= phase.end_date
          const allExpanded = phase.weeks.every((_, wi) => expandedWeeks.has(`${pi}-${wi}`))

          return (
            <div key={pi} className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden`}>
              {/* Phase header */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0`} />
                <div className="flex-1">
                  <div className={`font-semibold ${colors.text} flex items-center gap-2`}>
                    {colors.label}
                    {isCurrentPhase && <span className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full">Current</span>}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {new Date(phase.start_date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} –{' '}
                    {new Date(phase.end_date + 'T00:00:00').toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    {' · '}{phase.daily_hours}h/day
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-600 text-xs">{phase.weeks.length}w</span>
                  <button
                    onClick={() => allExpanded ? collapsePhase(pi, phase.weeks) : expandPhase(pi, phase.weeks)}
                    className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${colors.text} border-current opacity-60 hover:opacity-100`}
                  >
                    {allExpanded ? 'Collapse' : 'Expand all'}
                  </button>
                </div>
              </div>

              {/* Weeks */}
              <div className="space-y-1 pb-2 px-2">
                {phase.weeks.map((week, wi) => {
                  const key = `${pi}-${wi}`
                  const isCurrentWeek = today >= week.start_date && today <= week.end_date
                  const isPastWeek = today > week.end_date
                  const expanded = expandedWeeks.has(key)
                  const hasDays = week.days && week.days.length > 0
                  const weekDays = hasDays ? week.days! : []
                  const doneDays = weekDays.filter(d => completedDays.has(d.date)).length
                  const totalDays = weekDays.length
                  const weekComplete = totalDays > 0 && doneDays === totalDays

                  return (
                    <div key={wi} className={`rounded-xl ${weekComplete ? 'bg-[#10B981]/5' : 'bg-[#0A0F1E]/40'}`}>
                      <button onClick={() => toggleWeek(key)} className="w-full flex items-center gap-3 px-3 py-2.5 text-left">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${weekComplete ? 'bg-[#10B981]' : isCurrentWeek ? colors.dot : isPastWeek ? 'bg-gray-700' : 'bg-gray-600'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm ${weekComplete ? 'text-[#10B981]' : isCurrentWeek ? 'text-white font-medium' : isPastWeek ? 'text-gray-600' : 'text-gray-400'}`}>
                              Week {week.week_number}
                            </span>
                            {isCurrentWeek && !weekComplete && <span className="text-[9px] text-[#4F8EF7] font-bold bg-[#4F8EF7]/10 px-1.5 py-0.5 rounded-full">THIS WEEK</span>}
                            {weekComplete && <span className="text-[9px] text-[#10B981] font-bold bg-[#10B981]/10 px-1.5 py-0.5 rounded-full">COMPLETE</span>}
                          </div>
                          {week.theme && <p className={`text-[11px] truncate mt-0.5 ${weekComplete ? 'text-[#10B981]/60' : isPastWeek ? 'text-gray-700' : 'text-gray-500'}`}>{week.theme}</p>}
                        </div>
                        {totalDays > 0 && (
                          <span className={`text-[11px] flex-shrink-0 ${doneDays === totalDays ? 'text-[#10B981]' : 'text-gray-600'}`}>
                            {doneDays}/{totalDays}
                          </span>
                        )}
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                      </button>

                      <AnimatePresence>
                        {expanded && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }} className="overflow-hidden">
                            <div className="px-2 pb-3 space-y-1.5">
                              {hasDays ? (
                                week.days!.map((day, di) => {
                                  const isToday = day.date === today
                                  const isPastDay = day.date < today
                                  const total = day.topics.length
                                  const doneCount = day.topics.filter((_, ti) => completedTopics.has(`${day.date}:${ti}`)).length
                                  const isDayDone = total > 0 && doneCount === total

                                  let borderClass = 'border-white/5 bg-[#0A0F1E]/50'
                                  if (isDayDone) borderClass = 'border-[#10B981]/40 bg-[#10B981]/5'
                                  else if (isToday) borderClass = 'border-[#4F8EF7]/60 bg-[#4F8EF7]/8'

                                  return (
                                    <div key={di} className={`rounded-xl p-3 border ${borderClass} ${isPastDay && !isDayDone && !isToday ? 'opacity-50' : ''}`}>
                                      {/* Day header */}
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className={`text-[11px] font-semibold ${isDayDone ? 'text-[#10B981]' : isToday ? 'text-[#4F8EF7]' : isPastDay ? 'text-gray-600' : 'text-gray-500'}`}>
                                            {formatDayLabel(day.date)}
                                          </span>
                                          {isToday && !isDayDone && <span className="bg-[#4F8EF7] text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold tracking-wide">TODAY</span>}
                                          {isDayDone && <span className="bg-[#10B981] text-black text-[8px] px-1.5 py-0.5 rounded-full font-bold tracking-wide">DONE</span>}
                                        </div>
                                        <span className={`text-[10px] font-medium ${isDayDone ? 'text-[#10B981]' : 'text-gray-600'}`}>{doneCount}/{total}</span>
                                      </div>
                                      {/* Per-topic checkboxes */}
                                      <div className="space-y-1.5">
                                        {day.topics.map((topic, ti) => {
                                          const topicKey = `${day.date}:${ti}`
                                          const isTopicDone = completedTopics.has(topicKey)
                                          const isToggling = togglingTopic === topicKey
                                          return (
                                            <div key={ti} className="flex items-start gap-2">
                                              <button
                                                onClick={e => { e.stopPropagation(); toggleTopicComplete(day.date, ti, total) }}
                                                disabled={isToggling}
                                                className="flex-shrink-0 mt-0.5 transition-transform active:scale-90 disabled:opacity-40"
                                              >
                                                {isTopicDone
                                                  ? <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981]" />
                                                  : <Circle className={`w-3.5 h-3.5 ${isToday ? 'text-[#4F8EF7]/60' : 'text-gray-700'}`} />
                                                }
                                              </button>
                                              <span className={`text-xs leading-relaxed flex-1 ${isTopicDone ? 'text-gray-600 line-through decoration-gray-700' : isToday ? 'text-gray-200' : isPastDay ? 'text-gray-600' : 'text-gray-400'}`}>
                                                {topic}
                                              </span>
                                              <Link
                                                href={`/quiz?topic=${encodeURIComponent(topic)}&exam=${roadmap.exam}`}
                                                className="text-[10px] text-[#4F8EF7] font-medium flex-shrink-0 hover:text-[#3B7AE8]"
                                                onClick={e => e.stopPropagation()}
                                              >
                                                Quiz
                                              </Link>
                                            </div>
                                          )
                                        })}
                                      </div>
                                    </div>
                                  )
                                })
                              ) : (
                                <div className="space-y-1 px-1">
                                  {week.topics.map((topic, ti) => (
                                    <div key={ti} className="flex items-center gap-2 text-sm text-gray-300">
                                      <span className="text-gray-600">·</span>
                                      <span className="flex-1">{topic}</span>
                                      <Link href={`/quiz?topic=${encodeURIComponent(topic)}&exam=${roadmap.exam}`} className="text-[10px] text-[#4F8EF7] font-medium">Quiz</Link>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {week.resources && week.resources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-white/5 px-1">
                                  <p className="text-gray-600 text-[10px] mb-1 uppercase tracking-wide">Resources</p>
                                  {week.resources.map((r, ri) => (
                                    <div key={ri} className="text-xs text-gray-500 flex items-start gap-1.5 mb-0.5">
                                      <span>{r.type === 'youtube' ? '▶️' : '📖'}</span>
                                      <span>{r.title}{r.author ? ` — ${r.author}` : r.channel ? ` — ${r.channel}` : ''}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Regenerate (always available at bottom) */}
      <button
        onClick={regenerateRoadmap}
        disabled={regenerating}
        className="w-full mt-5 bg-[#1F2937] border border-[#374151] text-gray-400 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:border-[#4F8EF7]/30 hover:text-[#4F8EF7] transition-colors disabled:opacity-50"
      >
        {regenerating ? <><RefreshCw className="w-4 h-4 animate-spin" />Regenerating...</> : <><Sparkles className="w-4 h-4" />Regenerate Roadmap with AI</>}
      </button>

      <p className="text-gray-600 text-xs text-center mt-4">
        ⚠️ AI-generated roadmap — verify topics against official syllabus
      </p>
    </div>
  )
}
