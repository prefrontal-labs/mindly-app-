'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, ChevronUp, Download, RefreshCw, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { EXAM_CONFIGS, ExamType } from '@/types'

interface RoadmapWeek {
  week_number: number
  start_date: string
  end_date: string
  topics: string[]
  resources: Array<{ type: string; title: string; author?: string; channel?: string }>
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
  profile: { exam: ExamType; exam_date: string } | null
}

const PHASE_COLORS = {
  foundation: { bg: 'bg-[#4F8EF7]/10', border: 'border-[#4F8EF7]/30', text: 'text-[#4F8EF7]', dot: 'bg-[#4F8EF7]', label: 'Foundation' },
  depth: { bg: 'bg-[#8B5CF6]/10', border: 'border-[#8B5CF6]/30', text: 'text-[#8B5CF6]', dot: 'bg-[#8B5CF6]', label: 'Depth' },
  revision: { bg: 'bg-[#F59E0B]/10', border: 'border-[#F59E0B]/30', text: 'text-[#F59E0B]', dot: 'bg-[#F59E0B]', label: 'Revision' },
  mock: { bg: 'bg-[#EF4444]/10', border: 'border-[#EF4444]/30', text: 'text-[#EF4444]', dot: 'bg-[#EF4444]', label: 'Mock Tests' },
}

export default function RoadmapClient({ roadmap, profile }: Props) {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null)
  const [adjusting, setAdjusting] = useState(false)

  const examConfig = profile?.exam ? EXAM_CONFIGS[profile.exam] : null
  const daysLeft = profile?.exam_date
    ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000)
    : null

  const today = new Date().toISOString().split('T')[0]

  async function adjustRoadmap(type: 'behind' | 'early') {
    setAdjusting(true)
    try {
      const res = await fetch('/api/roadmap/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type }),
      })
      if (res.ok) {
        toast.success(type === 'behind' ? 'Roadmap compressed!' : 'Advanced to next phase!')
        window.location.reload()
      } else {
        toast.error('Failed to adjust roadmap')
      }
    } catch {
      toast.error('Network error')
    } finally {
      setAdjusting(false)
    }
  }

  if (!roadmap) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-8 text-center">
        <div className="text-5xl mb-4">🗺️</div>
        <h2 className="text-xl font-bold text-white mb-2">No roadmap yet</h2>
        <p className="text-gray-400 mb-6">Complete onboarding to generate your personalized study roadmap.</p>
        <Link href="/onboarding" className="bg-[#4F8EF7] text-white px-6 py-3 rounded-xl font-semibold inline-block">
          Complete Onboarding
        </Link>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-8">
      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-white">Your Roadmap</h1>
        <p className="text-gray-400 text-sm">
          {examConfig?.shortName} {daysLeft !== null && `— ${daysLeft} days remaining`}
        </p>
      </div>

      {/* Adjust buttons */}
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => adjustRoadmap('behind')}
          disabled={adjusting}
          className="bg-[#F59E0B]/10 border border-[#F59E0B]/30 text-[#F59E0B] py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#F59E0B]/20 transition-colors disabled:opacity-50"
        >
          <RefreshCw className="w-4 h-4" />
          Running behind
        </button>
        <button
          onClick={() => adjustRoadmap('early')}
          disabled={adjusting}
          className="bg-[#10B981]/10 border border-[#10B981]/30 text-[#10B981] py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#10B981]/20 transition-colors disabled:opacity-50"
        >
          <ArrowRight className="w-4 h-4" />
          Finished early
        </button>
      </div>

      {/* Phases */}
      <div className="space-y-4">
        {roadmap.phases.map((phase, pi) => {
          const colors = PHASE_COLORS[phase.phase as keyof typeof PHASE_COLORS] || PHASE_COLORS.foundation
          const isCurrentPhase = today >= phase.start_date && today <= phase.end_date

          return (
            <div key={pi} className={`rounded-2xl border ${colors.border} ${colors.bg} overflow-hidden`}>
              {/* Phase header */}
              <div className="px-4 py-3 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${colors.dot} flex-shrink-0`} />
                <div className="flex-1">
                  <div className={`font-semibold ${colors.text} flex items-center gap-2`}>
                    {colors.label}
                    {isCurrentPhase && (
                      <span className="bg-white/10 text-white text-[10px] px-2 py-0.5 rounded-full">Current</span>
                    )}
                  </div>
                  <div className="text-gray-500 text-xs">
                    {new Date(phase.start_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} –{' '}
                    {new Date(phase.end_date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                    {' · '}{phase.daily_hours}h/day
                  </div>
                </div>
                <span className="text-gray-500 text-xs">{phase.weeks.length}w</span>
              </div>

              {/* Weeks */}
              <div className="space-y-1 pb-2 px-2">
                {phase.weeks.map((week, wi) => {
                  const key = `${pi}-${wi}`
                  const isCurrentWeek = today >= week.start_date && today <= week.end_date
                  const expanded = expandedWeek === key

                  return (
                    <div key={wi} className="bg-[#0A0F1E]/40 rounded-xl">
                      <button
                        onClick={() => setExpandedWeek(expanded ? null : key)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isCurrentWeek ? colors.dot : 'bg-gray-600'}`} />
                        <span className={`text-sm flex-1 ${isCurrentWeek ? 'text-white font-medium' : 'text-gray-400'}`}>
                          Week {week.week_number}
                          {isCurrentWeek && ' (This week)'}
                        </span>
                        <span className="text-gray-600 text-xs">{week.topics.length} topics</span>
                        {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                      </button>

                      <AnimatePresence>
                        {expanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 space-y-2">
                              {/* Topics */}
                              <div className="space-y-1">
                                {week.topics.map((topic, ti) => (
                                  <div key={ti} className="flex items-center gap-2 text-sm text-gray-300">
                                    <span className="text-gray-600">·</span>
                                    <span className="flex-1">{topic}</span>
                                    <Link
                                      href={`/quiz?topic=${encodeURIComponent(topic)}&exam=${roadmap.exam}`}
                                      className="text-[10px] text-[#4F8EF7] font-medium"
                                    >
                                      Quiz
                                    </Link>
                                  </div>
                                ))}
                              </div>

                              {/* Resources */}
                              {week.resources && week.resources.length > 0 && (
                                <div className="mt-2 pt-2 border-t border-white/5">
                                  <p className="text-gray-500 text-xs mb-1">Resources</p>
                                  {week.resources.map((r, ri) => (
                                    <div key={ri} className="text-xs text-gray-400 flex items-start gap-1">
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

      {/* Export PDF */}
      <button
        onClick={() => toast('PDF export requires Pro plan', { icon: '🔒' })}
        className="w-full mt-5 bg-[#1F2937] border border-[#374151] text-gray-400 py-3 rounded-xl text-sm font-medium flex items-center justify-center gap-2 hover:bg-[#374151] transition-colors"
      >
        <Download className="w-4 h-4" />
        Export as PDF (Pro)
      </button>

      <p className="text-gray-600 text-xs text-center mt-4">
        ⚠️ AI-generated roadmap — verify topics against official syllabus
      </p>
    </div>
  )
}
