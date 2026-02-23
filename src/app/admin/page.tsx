'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, TrendingUp, Flame, Target, RefreshCw, ChevronRight } from 'lucide-react'
import { EXAM_CONFIGS, ExamType } from '@/types'

interface AdminStats {
  institution: { name: string; code: string }
  total_students: number
  active_today: number
  avg_streak: number
  avg_accuracy: number
  exam_breakdown: Record<string, number>
}

interface Student {
  id: string
  name: string
  email: string
  plan: string
  exam: ExamType
  exam_date: string
  level: string
  streak: number
  total_xp: number
  week_accuracy: number | null
}

const PLAN_BADGE: Record<string, string> = {
  free: 'bg-gray-700 text-gray-300',
  pro: 'bg-[#4F8EF7]/20 text-[#4F8EF7]',
  exam_pack: 'bg-[#F59E0B]/20 text-[#F59E0B]',
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [studentsLoading, setStudentsLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [notAdmin, setNotAdmin] = useState(false)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/stats')
        if (res.status === 403) { setNotAdmin(true); return }
        if (res.ok) setStats(await res.json())
      } catch { /* no-op */ }
      finally { setLoading(false) }
    }
    load()
  }, [])

  useEffect(() => {
    if (notAdmin || !stats) return
    async function loadStudents() {
      setStudentsLoading(true)
      try {
        const res = await fetch(`/api/admin/students?page=${page}`)
        if (res.ok) {
          const d = await res.json()
          setStudents(d.students || [])
          setTotal(d.total || 0)
        }
      } catch { /* no-op */ }
      finally { setStudentsLoading(false) }
    }
    loadStudents()
  }, [page, notAdmin, stats])

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-12 flex flex-col items-center gap-3">
        <RefreshCw className="w-6 h-6 text-[#4F8EF7] animate-spin" />
        <p className="text-gray-500 text-sm">Loading admin panel...</p>
      </div>
    )
  }

  if (notAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 pt-16 text-center">
        <div className="text-5xl mb-4">🔒</div>
        <h2 className="text-xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-gray-400 text-sm">This page is only for institution administrators.</p>
        <p className="text-gray-500 text-xs mt-2">Contact support to set up your institution account.</p>
      </div>
    )
  }

  if (!stats) return null

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-24 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{stats.institution.name}</h1>
        <p className="text-gray-400 text-sm">Institution Code: <span className="text-[#4F8EF7] font-mono font-bold">{stats.institution.code}</span></p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Students', value: stats.total_students, icon: <Users className="w-4 h-4" />, color: 'text-[#4F8EF7]' },
          { label: 'Active Today', value: stats.active_today, icon: <TrendingUp className="w-4 h-4" />, color: 'text-[#10B981]' },
          { label: 'Avg Streak', value: `${stats.avg_streak}d`, icon: <Flame className="w-4 h-4" />, color: 'text-[#F59E0B]' },
          { label: 'Avg Accuracy', value: `${stats.avg_accuracy}%`, icon: <Target className="w-4 h-4" />, color: 'text-[#A78BFA]' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4"
          >
            <div className={`mb-2 ${s.color}`}>{s.icon}</div>
            <div className="text-2xl font-black text-white">{s.value}</div>
            <div className="text-gray-500 text-xs mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Exam breakdown */}
      {Object.keys(stats.exam_breakdown).length > 0 && (
        <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-4">
          <h2 className="text-white font-semibold text-sm mb-3">Exam Breakdown</h2>
          <div className="space-y-2">
            {Object.entries(stats.exam_breakdown)
              .sort((a, b) => b[1] - a[1])
              .map(([exam, count]) => {
                const config = EXAM_CONFIGS[exam as ExamType]
                const pct = stats.total_students > 0 ? Math.round((count / stats.total_students) * 100) : 0
                return (
                  <div key={exam} className="flex items-center gap-3">
                    <span className="text-gray-400 text-xs w-20 flex-shrink-0">{config?.shortName || exam}</span>
                    <div className="flex-1 h-2 bg-[#1F2937] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#4F8EF7]"
                        style={{ width: `${pct}%`, background: config?.color }}
                      />
                    </div>
                    <span className="text-white text-xs font-bold w-6 text-right">{count}</span>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {/* Students list */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Students ({total})</h2>
          {studentsLoading && <RefreshCw className="w-4 h-4 text-gray-500 animate-spin" />}
        </div>

        <div className="space-y-2">
          {students.map(student => (
            <div key={student.id} className="bg-[#111827] border border-[#1F2937] rounded-xl p-3">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-[#4F8EF7]/20 rounded-full flex items-center justify-center text-[#4F8EF7] font-bold text-sm flex-shrink-0">
                  {student.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium text-sm">{student.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${PLAN_BADGE[student.plan] || 'bg-gray-700 text-gray-300'}`}>
                      {student.plan}
                    </span>
                  </div>
                  <p className="text-gray-500 text-xs truncate">{student.email}</p>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-gray-400 text-xs">{EXAM_CONFIGS[student.exam]?.shortName || student.exam}</span>
                    <span className="text-[#F59E0B] text-xs flex items-center gap-0.5">
                      <Flame className="w-3 h-3" />{student.streak}d
                    </span>
                    {student.week_accuracy !== null && (
                      <span className={`text-xs font-medium ${student.week_accuracy >= 70 ? 'text-[#10B981]' : student.week_accuracy >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
                        {student.week_accuracy}% acc
                      </span>
                    )}
                    <span className="text-gray-600 text-xs">{student.total_xp.toLocaleString()} XP</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="text-gray-400 text-sm disabled:opacity-30 flex items-center gap-1"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
              Previous
            </button>
            <span className="text-gray-500 text-sm">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="text-[#4F8EF7] text-sm disabled:opacity-30 flex items-center gap-1"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
