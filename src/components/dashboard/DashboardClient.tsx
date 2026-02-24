'use client'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { BookOpen, Zap, MessageCircle, ChevronRight, Flame } from 'lucide-react'
import { EXAM_CONFIGS, ExamType } from '@/types'

interface Props {
  user: Record<string, unknown> | null
  profile: Record<string, unknown> | null
  roadmap: Record<string, unknown> | null
  streak: number
  flashcardsDue: number
  weekAccuracy: number
  daysLeft: number | null
  dailyUsage: Record<string, unknown> | null
}

function GoalRing({ progress, size = 80 }: { progress: number; size?: number }) {
  const r = (size - 12) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (progress / 100) * circumference

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1F2937" strokeWidth="8" />
      <circle
        cx={size/2} cy={size/2} r={r} fill="none"
        stroke="#4F8EF7" strokeWidth="8"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-1000"
      />
    </svg>
  )
}

export default function DashboardClient({ user, profile, roadmap, streak, flashcardsDue, weekAccuracy, daysLeft, dailyUsage }: Props) {
  const name = (user?.name as string) || 'Aspirant'
  const exam = profile?.exam as ExamType
  const examConfig = exam ? EXAM_CONFIGS[exam] : null

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'

  // Get today's topics from roadmap
  type RoadmapDay = { date: string; topics: string[] }
  type RoadmapWeek = { topics: string[]; start_date: string; end_date: string; days?: RoadmapDay[] }
  type RoadmapPhase = { phase: string; weeks: RoadmapWeek[] }
  const phases = (roadmap?.phases as RoadmapPhase[]) || []
  const todayStr = new Date().toISOString().split('T')[0]
  let todayTopics: string[] = []

  // First pass: exact day match (new daily roadmaps)
  outer: for (const phase of phases) {
    for (const week of phase.weeks || []) {
      if (week.days) {
        const dayEntry = week.days.find(d => d.date === todayStr)
        if (dayEntry) {
          todayTopics = dayEntry.topics
          break outer
        }
      }
    }
  }

  // Second pass: week date range match (old weekly roadmaps, backward compat)
  if (todayTopics.length === 0) {
    outer2: for (const phase of phases) {
      for (const week of phase.weeks || []) {
        if (todayStr >= week.start_date && todayStr <= week.end_date) {
          todayTopics = week.topics
          break outer2
        }
      }
    }
  }

  // Fallback: no date match → closest week (handles stale or future-dated roadmaps)
  if (todayTopics.length === 0 && phases.length > 0) {
    let closestDiff = Infinity
    for (const phase of phases) {
      for (const week of phase.weeks || []) {
        const diff = Math.abs(new Date(week.start_date).getTime() - new Date(todayStr).getTime())
        if (diff < closestDiff) {
          closestDiff = diff
          todayTopics = week.days?.[0]?.topics || week.topics
        }
      }
    }
  }

  const dailyGoal = (profile?.daily_hours as number || 3) * 60 // minutes
  const minutesStudied = ((dailyUsage?.flashcards_reviewed as number || 0) * 2) +
    ((dailyUsage?.quiz_questions_answered as number || 0) * 1) +
    ((dailyUsage?.ai_messages_sent as number || 0) * 3)
  const goalProgress = Math.min(100, Math.round((minutesStudied / dailyGoal) * 100))

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-gray-400 text-sm">{greeting}</p>
            <h1 className="text-2xl font-bold text-white">{name.split(' ')[0]} 👋</h1>
            {daysLeft !== null && examConfig && (
              <p className="text-sm text-gray-400 mt-0.5">
                <span className="text-[#4F8EF7] font-semibold">{daysLeft}</span> days to {examConfig.shortName}
              </p>
            )}
          </div>
          <Link href="/profile" className="w-10 h-10 bg-[#4F8EF7]/20 rounded-full flex items-center justify-center text-[#4F8EF7] font-bold text-lg">
            {name[0]}
          </Link>
        </div>
      </motion.div>

      {/* Stats Row */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 flex items-center gap-4"
      >
        {/* Daily Ring */}
        <div className="relative flex-shrink-0">
          <GoalRing progress={goalProgress} size={80} />
          <div className="absolute inset-0 flex items-center justify-center rotate-0">
            <span className="text-xs font-bold text-white">{goalProgress}%</span>
          </div>
        </div>
        <div className="flex-1">
          <div className="text-white font-semibold text-sm mb-0.5">Daily goal</div>
          <div className="text-gray-400 text-xs mb-2">Keep studying to fill the ring</div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Flame className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-[#F59E0B] font-bold text-sm">{streak}</span>
              <span className="text-gray-500 text-xs">day streak</span>
            </div>
            {weekAccuracy > 0 && (
              <div className="text-gray-500 text-xs">
                <span className="text-white font-medium">{weekAccuracy}%</span> accuracy this week
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-3 gap-3"
      >
        <Link href="/flashcards" className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 flex flex-col items-center gap-1 hover:border-[#4F8EF7]/40 transition-colors">
          <BookOpen className="w-6 h-6 text-[#4F8EF7]" />
          <span className="text-white text-xs font-medium">Flashcards</span>
          {flashcardsDue > 0 && (
            <span className="bg-[#F59E0B] text-black text-[10px] font-bold px-1.5 rounded-full">{flashcardsDue} due</span>
          )}
        </Link>
        <Link href="/quiz" className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 flex flex-col items-center gap-1 hover:border-[#4F8EF7]/40 transition-colors">
          <Zap className="w-6 h-6 text-[#F59E0B]" />
          <span className="text-white text-xs font-medium">Quiz</span>
          <span className="text-gray-500 text-[10px]">Practice</span>
        </Link>
        <Link href="/chat" className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4 flex flex-col items-center gap-1 hover:border-[#4F8EF7]/40 transition-colors">
          <MessageCircle className="w-6 h-6 text-[#10B981]" />
          <span className="text-white text-xs font-medium">AI Tutor</span>
          <span className="text-gray-500 text-[10px]">Ask anything</span>
        </Link>
      </motion.div>

      {/* Today's Plan */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4"
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-white">Today&apos;s Plan</h2>
          <Link href="/roadmap" className="text-[#4F8EF7] text-xs flex items-center gap-0.5">
            Full roadmap <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
        {todayTopics.length > 0 ? (
          <div className="space-y-2">
            {todayTopics.slice(0, 4).map((topic, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 bg-[#0A0F1E] rounded-xl">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${i === 0 ? 'bg-[#4F8EF7]' : 'bg-[#374151]'}`} />
                <span className="text-sm text-gray-300 flex-1">{topic}</span>
                <Link
                  href={`/quiz?topic=${encodeURIComponent(topic)}&exam=${exam}`}
                  className="text-xs text-[#4F8EF7] font-medium"
                >
                  Practice →
                </Link>
              </div>
            ))}
          </div>
        ) : !roadmap ? (
          // No roadmap exists yet — prompt to generate one
          <div className="text-center py-5">
            <p className="text-gray-400 text-sm font-medium mb-1">No study plan yet</p>
            <p className="text-gray-600 text-xs mb-3">Generate your AI roadmap to see daily targets here.</p>
            <Link
              href="/roadmap"
              className="inline-block bg-[#4F8EF7] text-white text-xs font-semibold px-4 py-2 rounded-xl hover:bg-[#3B7AE8] transition-colors"
            >
              Generate AI Roadmap →
            </Link>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-gray-500 text-sm">Your roadmap is loading topics.</p>
            <Link href="/roadmap" className="text-[#4F8EF7] text-sm mt-1 block">View full roadmap →</Link>
          </div>
        )}
      </motion.div>

      {/* AI disclaimer */}
      <p className="text-gray-600 text-xs text-center pb-2">
        ⚠️ AI-generated content — verify critical facts from official sources
      </p>
    </div>
  )
}
