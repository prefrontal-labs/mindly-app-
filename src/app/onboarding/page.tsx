'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { EXAM_CONFIGS, ExamType, SubjectStatus } from '@/types'
import { Loader2 } from 'lucide-react'

const STEPS = ['Choose Exam', 'Exam Date', 'Study Hours', 'Current Level', 'Subject Assessment']

interface SubjectAssessment {
  subject: string
  status: SubjectStatus
}

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Form state
  const [selectedExam, setSelectedExam] = useState<ExamType | null>(null)
  const [examDate, setExamDate] = useState('')
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null)
  const [dailyHours, setDailyHours] = useState(3)
  const [level, setLevel] = useState<'beginner' | 'intermediate' | 'appeared_before' | null>(null)
  const [subjects, setSubjects] = useState<SubjectAssessment[]>([])

  const supabase = createClient()

  const examList = Object.values(EXAM_CONFIGS)

  // Pre-fill exam dates
  const getDefaultExamDate = (exam: ExamType): string => {
    const now = new Date()
    const year = now.getFullYear()
    const dates: Partial<Record<ExamType, string>> = {
      UPSC_CSE: `${year}-05-26`,
      JEE_MAINS: `${year}-04-15`,
      JEE_ADVANCED: `${year}-05-18`,
      NEET: `${year}-05-04`,
      GATE_CS: `${year}-02-01`,
      GATE_ECE: `${year}-02-01`,
    }
    const d = dates[exam]
    if (!d) return ''
    const date = new Date(d)
    if (date < now) date.setFullYear(year + 1)
    return date.toISOString().split('T')[0]
  }

  useEffect(() => {
    if (examDate) {
      const days = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000)
      setDaysRemaining(days > 0 ? days : 0)
    }
  }, [examDate])

  useEffect(() => {
    if (selectedExam) {
      const defaultDate = getDefaultExamDate(selectedExam)
      if (defaultDate) setExamDate(defaultDate)
      setSubjects(EXAM_CONFIGS[selectedExam].subjects.map(s => ({ subject: s, status: 'not_started' as SubjectStatus })))
    }
  }, [selectedExam])

  const progress = ((step + 1) / STEPS.length) * 100

  function updateSubjectStatus(index: number, status: SubjectStatus) {
    setSubjects(prev => prev.map((s, i) => i === index ? { ...s, status } : s))
  }

  async function handleFinish() {
    if (!selectedExam || !examDate || !level) return

    setLoading(true)
    setGenerating(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Save profile
      await supabase.from('user_profiles').upsert({
        user_id: user.id,
        exam: selectedExam,
        exam_date: examDate,
        daily_hours: dailyHours,
        level,
        subject_assessments: subjects,
      })

      // Mark onboarding complete
      await supabase.from('users').update({ onboarding_complete: true }).eq('id', user.id)

      // Award first step badge
      await fetch('/api/gamification/badge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ badge_slug: 'first_step' }),
      })

      // Generate roadmap
      const res = await fetch('/api/roadmap/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exam: selectedExam, examDate, dailyHours, level, subjects }),
      })

      if (!res.ok) throw new Error('Roadmap generation failed')

      router.push('/dashboard')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
      setGenerating(false)
      setLoading(false)
    }
  }

  const hourLabel = (h: number) => {
    if (h <= 2) return 'Casual'
    if (h <= 4) return 'Serious'
    if (h <= 6) return 'Dedicated'
    return 'Full-time aspirant'
  }

  if (generating) {
    return (
      <div className="min-h-screen bg-[#0A0F1E] flex items-center justify-center px-4">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            className="w-20 h-20 border-4 border-[#4F8EF7]/20 border-t-[#4F8EF7] rounded-full mx-auto mb-6"
          />
          <h2 className="text-2xl font-bold text-white mb-2">Building your study plan…</h2>
          <p className="text-gray-400">Mindly is creating a personalised roadmap for your exam. This takes about 10 seconds.</p>
          <div className="mt-6 flex gap-1 justify-center">
            {[0,1,2].map(i => (
              <motion.div
                key={i}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 1.5, delay: i * 0.3, repeat: Infinity }}
                className="w-2 h-2 bg-[#4F8EF7] rounded-full"
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0A0F1E] px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[#4F8EF7] font-semibold text-sm">Mindly</span>
            <span className="text-gray-500 text-sm">Step {step + 1} of {STEPS.length}</span>
          </div>
          <div className="h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-[#4F8EF7] rounded-full"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.4 }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            {STEPS.map((s, i) => (
              <span key={s} className={`text-xs ${i <= step ? 'text-[#4F8EF7]' : 'text-gray-600'}`}>
                {i < step ? '✓' : i === step ? '●' : '○'}
              </span>
            ))}
          </div>
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
          >
            {/* STEP 1: Choose Exam */}
            {step === 0 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Which exam are you preparing for?</h2>
                <p className="text-gray-400 text-sm mb-6">We&apos;ll build everything around your specific exam</p>
                <div className="grid grid-cols-2 gap-3">
                  {examList.map(exam => (
                    <button
                      key={exam.id}
                      onClick={() => setSelectedExam(exam.id)}
                      className={`p-4 rounded-2xl border text-left transition-all ${selectedExam === exam.id
                        ? 'border-[#4F8EF7] bg-[#4F8EF7]/10 glow-blue'
                        : 'border-[#1F2937] bg-[#111827] hover:border-[#374151]'}`}
                    >
                      <div className="w-8 h-8 rounded-lg mb-2 flex items-center justify-center text-lg"
                        style={{ backgroundColor: exam.color + '20', color: exam.color }}>
                        {exam.shortName[0]}
                      </div>
                      <div className="font-semibold text-white text-sm">{exam.shortName}</div>
                      <div className="text-gray-500 text-xs mt-0.5 leading-tight">{exam.name}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 2: Exam Date */}
            {step === 1 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">When is your exam?</h2>
                <p className="text-gray-400 text-sm mb-6">We&apos;ve pre-filled the next scheduled date — adjust if needed</p>
                <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5 mb-4">
                  <label className="block text-sm text-gray-400 mb-2">Exam date</label>
                  <input
                    type="date"
                    value={examDate}
                    onChange={e => setExamDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    className="w-full bg-[#0A0F1E] border border-[#374151] text-white rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4F8EF7] transition-colors"
                  />
                </div>
                {daysRemaining !== null && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-[#4F8EF7]/10 border border-[#4F8EF7]/30 rounded-2xl p-4 text-center"
                  >
                    <div className="text-4xl font-bold text-[#4F8EF7] mb-1">{daysRemaining}</div>
                    <div className="text-gray-400 text-sm">days remaining to your exam</div>
                  </motion.div>
                )}
              </div>
            )}

            {/* STEP 3: Study Hours */}
            {step === 2 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">How many hours can you study daily?</h2>
                <p className="text-gray-400 text-sm mb-6">Be realistic — consistency beats intensity</p>
                <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 mb-6">
                  <div className="text-center mb-6">
                    <div className="text-5xl font-bold text-white mb-1">{dailyHours}</div>
                    <div className="text-[#4F8EF7] font-medium">{hourLabel(dailyHours)}</div>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={12}
                    value={dailyHours}
                    onChange={e => setDailyHours(Number(e.target.value))}
                    className="w-full accent-[#4F8EF7]"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1 hr</span>
                    <span>12 hrs</span>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { range: '1-2 hrs', label: 'Casual', desc: 'Side-by-side with college/work' },
                    { range: '3-4 hrs', label: 'Serious', desc: 'Consistent daily effort' },
                    { range: '5-6 hrs', label: 'Dedicated', desc: 'Exam is top priority' },
                    { range: '7+ hrs', label: 'Full-time', desc: 'Nothing else matters' },
                  ].map(item => (
                    <div key={item.label} className="bg-[#0A0F1E] border border-[#1F2937] rounded-xl p-3">
                      <div className="text-[#4F8EF7] text-xs font-medium">{item.range}</div>
                      <div className="text-white text-sm font-semibold">{item.label}</div>
                      <div className="text-gray-500 text-xs">{item.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 4: Current Level */}
            {step === 3 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">What&apos;s your current level?</h2>
                <p className="text-gray-400 text-sm mb-6">This helps us calibrate the difficulty of your roadmap</p>
                <div className="space-y-3">
                  {[
                    { value: 'beginner' as const, label: 'Beginner', desc: "Just starting out — haven't covered much of the syllabus yet", emoji: '🌱' },
                    { value: 'intermediate' as const, label: 'Intermediate', desc: 'Studied some topics, familiar with the exam pattern', emoji: '📚' },
                    { value: 'appeared_before' as const, label: 'Appeared Before', desc: 'Repeat attempt — know the syllabus, need focused improvement', emoji: '⚡' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setLevel(opt.value)}
                      className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start gap-4 ${level === opt.value
                        ? 'border-[#4F8EF7] bg-[#4F8EF7]/10'
                        : 'border-[#1F2937] bg-[#111827] hover:border-[#374151]'}`}
                    >
                      <span className="text-2xl">{opt.emoji}</span>
                      <div>
                        <div className="font-semibold text-white">{opt.label}</div>
                        <div className="text-gray-400 text-sm mt-0.5">{opt.desc}</div>
                      </div>
                      {level === opt.value && (
                        <div className="ml-auto w-5 h-5 bg-[#4F8EF7] rounded-full flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 5: Subject Assessment */}
            {step === 4 && (
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Where are you with each subject?</h2>
                <p className="text-gray-400 text-sm mb-6">Be honest — this directly shapes your study plan</p>
                <div className="space-y-3">
                  {subjects.map((s, i) => (
                    <div key={s.subject} className="bg-[#111827] border border-[#1F2937] rounded-xl p-4">
                      <div className="font-medium text-white mb-3">{s.subject}</div>
                      <div className="grid grid-cols-3 gap-2">
                        {([
                          { value: 'not_started', label: 'Not Started', color: '#6B7280' },
                          { value: 'somewhat_done', label: 'Somewhat Done', color: '#F59E0B' },
                          { value: 'confident', label: 'Confident', color: '#10B981' },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => updateSubjectStatus(i, opt.value)}
                            className={`py-2 px-2 rounded-lg text-xs font-medium transition-all border ${s.status === opt.value
                              ? 'border-transparent text-white'
                              : 'border-[#374151] text-gray-500 hover:text-gray-300'}`}
                            style={s.status === opt.value ? { backgroundColor: opt.color + '30', borderColor: opt.color, color: opt.color } : {}}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 bg-[#1F2937] text-white py-3.5 rounded-xl font-medium hover:bg-[#374151] transition-colors"
            >
              Back
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => {
                if (step === 0 && !selectedExam) { toast.error('Please select an exam'); return }
                if (step === 1 && !examDate) { toast.error('Please select a date'); return }
                if (step === 3 && !level) { toast.error('Please select your level'); return }
                setStep(s => s + 1)
              }}
              className="flex-1 bg-[#4F8EF7] text-white py-3.5 rounded-xl font-semibold hover:bg-[#3B7AE8] transition-colors"
            >
              Continue
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={loading}
              className="flex-1 bg-[#4F8EF7] text-white py-3.5 rounded-xl font-semibold hover:bg-[#3B7AE8] transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Build My Roadmap →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
