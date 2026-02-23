'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, Timer as TimerIcon, ChevronRight, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import { EXAM_CONFIGS, ExamType, Difficulty } from '@/types'

interface QuizQuestion {
  id: string
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
  topic: string
  exam: ExamType
}

interface Response {
  question_id: string
  selected_answer: string
  is_correct: boolean
  time_taken_seconds: number
}

const OPTION_COLORS = {
  default: 'bg-[#111827] border-[#1F2937] text-gray-300 hover:border-[#4F8EF7]/40',
  selected: 'bg-[#4F8EF7]/10 border-[#4F8EF7] text-white',
  correct: 'bg-[#10B981]/10 border-[#10B981] text-[#10B981]',
  wrong: 'bg-[#EF4444]/10 border-[#EF4444] text-[#EF4444]',
}

function SetupScreen({ onStart }: { onStart: (topic: string, exam: ExamType, difficulty: Difficulty, count: number) => void }) {
  const params = useSearchParams()
  const [topic, setTopic] = useState(params.get('topic') || '')
  const [exam, setExam] = useState<ExamType>((params.get('exam') as ExamType) || 'UPSC_CSE')
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [count, setCount] = useState(10)

  return (
    <div className="space-y-4">
      <div>
        <label className="text-gray-400 text-sm block mb-2">Topic</label>
        <input
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          placeholder="e.g. Indian Constitution, Sorting Algorithms..."
          className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#4F8EF7]/50"
        />
      </div>
      <div>
        <label className="text-gray-400 text-sm block mb-2">Exam</label>
        <select
          value={exam}
          onChange={e => setExam(e.target.value as ExamType)}
          className="w-full bg-[#111827] border border-[#1F2937] rounded-xl px-4 py-3 text-white text-sm focus:outline-none"
        >
          {Object.values(EXAM_CONFIGS).map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="text-gray-400 text-sm block mb-2">Difficulty</label>
        <div className="grid grid-cols-3 gap-2">
          {(['easy', 'medium', 'hard'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              className={`py-2.5 rounded-xl text-sm font-medium border transition-colors capitalize ${
                difficulty === d
                  ? 'bg-[#4F8EF7]/10 border-[#4F8EF7] text-[#4F8EF7]'
                  : 'bg-[#111827] border-[#1F2937] text-gray-400 hover:border-gray-600'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="text-gray-400 text-sm block mb-2">Number of Questions: {count}</label>
        <input
          type="range" min={5} max={20} step={5}
          value={count}
          onChange={e => setCount(Number(e.target.value))}
          className="w-full accent-[#4F8EF7]"
        />
        <div className="flex justify-between text-gray-600 text-xs mt-1">
          <span>5</span><span>10</span><span>15</span><span>20</span>
        </div>
      </div>
      <button
        onClick={() => { if (!topic.trim()) { toast.error('Enter a topic'); return } onStart(topic.trim(), exam, difficulty, count) }}
        className="w-full bg-[#F59E0B] text-black py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#D97706] transition-colors"
      >
        <Zap className="w-4 h-4" />
        Start Quiz
      </button>
    </div>
  )
}

function QuizSession({
  questions,
  onComplete,
}: {
  questions: QuizQuestion[]
  onComplete: (responses: Response[], timeTaken: number) => void
}) {
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<string | null>(null)
  const [revealed, setRevealed] = useState(false)
  const [responses, setResponses] = useState<Response[]>([])
  const [startTime] = useState(Date.now())
  const [questionStartTime, setQuestionStartTime] = useState(Date.now())
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [startTime])

  const question = questions[index]
  const progress = Math.round((index / questions.length) * 100)

  function handleSelect(option: string) {
    if (revealed) return
    setSelected(option)
    setRevealed(true)

    const timeTaken = Math.round((Date.now() - questionStartTime) / 1000)
    const isCorrect = option === question.correct_answer

    setResponses(prev => [...prev, {
      question_id: question.id,
      selected_answer: option,
      is_correct: isCorrect,
      time_taken_seconds: timeTaken,
    }])
  }

  function handleNext() {
    const finalResponses = responses
    if (index + 1 >= questions.length) {
      const timeTaken = Math.round((Date.now() - startTime) / 1000)
      onComplete(finalResponses, timeTaken)
    } else {
      setIndex(i => i + 1)
      setSelected(null)
      setRevealed(false)
      setQuestionStartTime(Date.now())
    }
  }

  function getOptionClass(option: string) {
    if (!revealed) return selected === option ? OPTION_COLORS.selected : OPTION_COLORS.default
    if (option === question.correct_answer) return OPTION_COLORS.correct
    if (option === selected && option !== question.correct_answer) return OPTION_COLORS.wrong
    return OPTION_COLORS.default
  }

  return (
    <div className="space-y-5">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 bg-[#1F2937] rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-[#F59E0B] rounded-full"
            animate={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-gray-500 text-xs whitespace-nowrap">{index + 1}/{questions.length}</span>
        <div className="flex items-center gap-1 text-gray-400 text-xs font-mono">
          <TimerIcon className="w-3.5 h-3.5" />
          {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
        </div>
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="space-y-4"
        >
          <div className="bg-[#111827] border border-[#1F2937] rounded-2xl p-5">
            <p className="text-xs text-[#F59E0B] font-medium mb-2 uppercase tracking-wide">{question.topic}</p>
            <p className="text-white text-base leading-relaxed">{question.question}</p>
          </div>

          {/* Options */}
          <div className="space-y-2.5">
            {(Object.entries(question.options) as [string, string][]).map(([key, value]) => (
              <button
                key={key}
                onClick={() => handleSelect(key)}
                className={`w-full text-left border rounded-xl px-4 py-3 text-sm transition-all ${getOptionClass(key)}`}
              >
                <span className="font-bold mr-3">{key}.</span>{value}
              </button>
            ))}
          </div>

          {/* Explanation */}
          <AnimatePresence>
            {revealed && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="bg-[#111827] border border-[#1F2937] rounded-xl p-4"
              >
                <p className="text-xs text-gray-500 font-medium mb-1 uppercase">Explanation</p>
                <p className="text-gray-300 text-sm leading-relaxed">{question.explanation}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {revealed && (
            <button
              onClick={handleNext}
              className="w-full bg-[#4F8EF7] text-white py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            >
              {index + 1 >= questions.length ? 'View Results' : 'Next Question'}
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function ResultsScreen({
  questions,
  responses,
  timeTaken,
  onRetry,
}: {
  questions: QuizQuestion[]
  responses: Response[]
  timeTaken: number
  onRetry: () => void
}) {
  const correct = responses.filter(r => r.is_correct).length
  const accuracy = Math.round((correct / responses.length) * 100)
  const color = accuracy >= 80 ? 'text-[#10B981]' : accuracy >= 50 ? 'text-[#F59E0B]' : 'text-[#EF4444]'

  return (
    <div className="space-y-5">
      {/* Score card */}
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[#111827] border border-[#1F2937] rounded-2xl p-6 text-center"
      >
        <div className="text-5xl font-black mb-1">
          <span className={color}>{accuracy}%</span>
        </div>
        <p className="text-gray-400 text-sm">{correct}/{responses.length} correct</p>
        <div className="flex items-center justify-center gap-4 mt-3 text-xs text-gray-500">
          <span>⏱ {Math.floor(timeTaken / 60)}m {timeTaken % 60}s</span>
          {accuracy >= 80 && <span className="text-[#F59E0B]">+{accuracy === 100 ? 30 : 10} bonus XP</span>}
        </div>
      </motion.div>

      {/* Answer review */}
      <div>
        <h3 className="text-white font-semibold mb-3">Answer Review</h3>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const resp = responses[i]
            const isCorrect = resp?.is_correct
            return (
              <div key={q.id} className={`rounded-xl border p-4 ${isCorrect ? 'border-[#10B981]/30 bg-[#10B981]/5' : 'border-[#EF4444]/30 bg-[#EF4444]/5'}`}>
                <div className="flex items-start gap-2">
                  <span className="text-lg">{isCorrect ? '✅' : '❌'}</span>
                  <div className="flex-1">
                    <p className="text-white text-sm font-medium leading-snug">{q.question}</p>
                    {!isCorrect && (
                      <p className="text-xs mt-1">
                        <span className="text-gray-500">Your answer: </span>
                        <span className="text-[#EF4444]">{resp?.selected_answer}. {q.options[resp?.selected_answer as keyof typeof q.options]}</span>
                      </p>
                    )}
                    <p className="text-xs mt-1">
                      <span className="text-gray-500">Correct: </span>
                      <span className="text-[#10B981]">{q.correct_answer}. {q.options[q.correct_answer]}</span>
                    </p>
                    <p className="text-gray-500 text-xs mt-1.5 leading-relaxed">{q.explanation}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <button
        onClick={onRetry}
        className="w-full bg-[#111827] border border-[#1F2937] text-gray-300 py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 hover:border-gray-600 transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        Try Another Quiz
      </button>
    </div>
  )
}

function QuizPageInner() {
  const [mode, setMode] = useState<'setup' | 'loading' | 'quiz' | 'results'>('setup')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [responses, setResponses] = useState<Response[]>([])
  const [timeTaken, setTimeTaken] = useState(0)
  const [quizParams, setQuizParams] = useState<{ topic: string; exam: ExamType; difficulty: Difficulty; count: number } | null>(null)

  async function startQuiz(topic: string, exam: ExamType, difficulty: Difficulty, count: number) {
    setQuizParams({ topic, exam, difficulty, count })
    setMode('loading')
    try {
      const res = await fetch('/api/quiz/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, exam, difficulty, count, mode: 'topic' }),
      })
      const data = await res.json()
      if (res.status === 429) {
        toast.error('Daily limit reached. Upgrade to Pro for unlimited quizzes!')
        setMode('setup')
        return
      }
      if (!res.ok) throw new Error(data.error)
      setQuestions(data.questions)
      setMode('quiz')
    } catch {
      toast.error('Failed to generate quiz')
      setMode('setup')
    }
  }

  async function handleComplete(finalResponses: Response[], time: number) {
    setResponses(finalResponses)
    setTimeTaken(time)
    setMode('results')

    // Submit in background
    if (quizParams) {
      try {
        await fetch('/api/quiz/submit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mode: 'topic',
            topic: quizParams.topic,
            exam: quizParams.exam,
            responses: finalResponses,
            time_taken_seconds: time,
          }),
        })
      } catch { /* best effort */ }
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 pt-5 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        {mode !== 'setup' && (
          <button
            onClick={() => setMode('setup')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold text-white">Quiz</h1>
          <p className="text-gray-400 text-sm">AI-generated practice questions</p>
        </div>
        <Zap className="w-5 h-5 text-[#F59E0B] ml-auto" />
      </div>

      {mode === 'setup' && <SetupScreen onStart={startQuiz} />}

      {mode === 'loading' && (
        <div className="flex flex-col items-center py-20 gap-4">
          <RefreshCw className="w-8 h-8 text-[#4F8EF7] animate-spin" />
          <p className="text-gray-400 text-sm">Generating {quizParams?.count} questions...</p>
        </div>
      )}

      {mode === 'quiz' && questions.length > 0 && (
        <QuizSession questions={questions} onComplete={handleComplete} />
      )}

      {mode === 'results' && (
        <ResultsScreen
          questions={questions}
          responses={responses}
          timeTaken={timeTaken}
          onRetry={() => setMode('setup')}
        />
      )}

      {mode === 'setup' && (
        <p className="text-gray-600 text-xs text-center mt-6">
          ⚠️ AI-generated questions — verify from official sources
        </p>
      )}
    </div>
  )
}

export default function QuizPage() {
  return (
    <Suspense>
      <QuizPageInner />
    </Suspense>
  )
}
