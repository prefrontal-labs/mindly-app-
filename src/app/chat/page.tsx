'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, MessageCircle, RefreshCw, Lock, Brain } from 'lucide-react'
import Link from 'next/link'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
}

type SessionPhase = 'warmup' | 'new_concept' | 'practice' | 'metacognitive' | 'preview'

const PHASE_LABELS: Record<SessionPhase, { label: string; color: string }> = {
  warmup: { label: 'Warm-up', color: 'text-[#F59E0B] bg-[#F59E0B]/10' },
  new_concept: { label: 'New Concept', color: 'text-[#8B5CF6] bg-[#8B5CF6]/10' },
  practice: { label: 'Practice', color: 'text-[#10B981] bg-[#10B981]/10' },
  metacognitive: { label: 'Self-Check', color: 'text-[#4F8EF7] bg-[#4F8EF7]/10' },
  preview: { label: 'Preview', color: 'text-[#F97316] bg-[#F97316]/10' },
}

const QUICK_PROMPTS = [
  "I'm confused, explain differently",
  'Give me a hint',
  'Quiz me on this',
  'I know this topic',
]

function PhaseBadge({ phase }: { phase: SessionPhase }) {
  const { label, color } = PHASE_LABELS[phase] || PHASE_LABELS.warmup
  return (
    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
      {label}
    </span>
  )
}

function ConfidenceRating({ onRate }: { onRate: (n: number) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-2 my-2"
    >
      <p className="text-gray-400 text-xs">How confident are you? (1 = unsure, 5 = very sure)</p>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => onRate(n)}
            className="w-9 h-9 rounded-full bg-[#111827] border border-[#374151] text-white text-sm font-bold hover:border-[#10B981] hover:text-[#10B981] transition-colors"
          >
            {n}
          </button>
        ))}
      </div>
    </motion.div>
  )
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-[#10B981]/20 flex items-center justify-center mr-2 mt-1 flex-shrink-0">
          <Brain className="w-3.5 h-3.5 text-[#10B981]" />
        </div>
      )}
      <div
        className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
          isUser
            ? 'bg-[#4F8EF7] text-white rounded-br-sm'
            : 'bg-[#111827] border border-[#1F2937] text-gray-200 rounded-bl-sm'
        }`}
      >
        {message.content}
      </div>
    </motion.div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="w-7 h-7 rounded-full bg-[#10B981]/20 flex items-center justify-center mr-2 flex-shrink-0">
        <Brain className="w-3.5 h-3.5 text-[#10B981]" />
      </div>
      <div className="bg-[#111827] border border-[#1F2937] rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 bg-[#10B981] rounded-full"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [limitReached, setLimitReached] = useState(false)
  const [loading, setLoading] = useState(true)
  const [sessionPhase, setSessionPhase] = useState<SessionPhase>('warmup')
  const [awaitingRating, setAwaitingRating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    fetch('/api/chat?limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (data.messages) {
          setMessages(
            data.messages.map((m: { id: string; role: string; content: string }) => ({
              id: m.id,
              role: m.role,
              content: m.content,
            }))
          )
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streaming, awaitingRating])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return
      setInput('')
      setAwaitingRating(false)

      const userMsg: Message = { id: Date.now().toString(), role: 'user', content: text.trim() }
      setMessages((prev) => [...prev, userMsg])
      setStreaming(true)

      const assistantId = (Date.now() + 1).toString()
      setMessages((prev) => [...prev, { id: assistantId, role: 'assistant', content: '' }])

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: text.trim() }),
        })

        if (res.status === 429) {
          setLimitReached(true)
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          setStreaming(false)
          return
        }

        if (!res.ok || !res.body) throw new Error('Failed')

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let accumulated = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value, { stream: true })
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)

              // Handle metadata event
              if (parsed.type === 'meta') {
                if (parsed.phase) setSessionPhase(parsed.phase as SessionPhase)
                if (parsed.awaitingRating !== undefined) setAwaitingRating(parsed.awaitingRating)
                continue
              }

              if (parsed.text) {
                accumulated += parsed.text
                setMessages((prev) =>
                  prev.map((m) => (m.id === assistantId ? { ...m, content: accumulated } : m))
                )
              }
            } catch {
              /* skip bad chunk */
            }
          }
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Something went wrong. Please try again.' }
              : m
          )
        )
      } finally {
        setStreaming(false)
        inputRef.current?.focus()
      }
    },
    [streaming]
  )

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  return (
    <div className="max-w-lg mx-auto flex flex-col h-[100dvh]">
      {/* Header */}
      <div className="flex-shrink-0 px-4 pt-5 pb-3 border-b border-[#1F2937]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#10B981]/20 flex items-center justify-center">
            <Brain className="w-4.5 h-4.5 text-[#10B981]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-white font-bold text-base">Mindly AI Tutor</h1>
              <PhaseBadge phase={sessionPhase} />
            </div>
            <p className="text-[#10B981] text-xs">
              {streaming ? 'Thinking...' : 'Adaptive learning mode'}
            </p>
          </div>
          <MessageCircle className="w-5 h-5 text-[#10B981] flex-shrink-0" />
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="w-5 h-5 text-gray-600 animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-8"
          >
            <div className="w-16 h-16 rounded-2xl bg-[#10B981]/20 flex items-center justify-center mx-auto mb-4">
              <Brain className="w-8 h-8 text-[#10B981]" />
            </div>
            <h2 className="text-white font-semibold mb-1">Your adaptive tutor is ready</h2>
            <p className="text-gray-500 text-sm mb-1">
              I adapt to your knowledge gaps in real time — testing, hinting, and escalating based on how you perform.
            </p>
            <p className="text-gray-600 text-xs mb-5">Say &quot;hi&quot; to start a session, or ask about any topic.</p>
            <div className="grid grid-cols-2 gap-2">
              {['Hi, let\'s start', 'Quiz me on UPSC Polity', 'Explain photosynthesis', 'I want to practice GATE DS'].map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="bg-[#111827] border border-[#1F2937] rounded-xl px-3 py-2.5 text-gray-400 text-xs text-left hover:border-[#10B981]/40 hover:text-white transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </motion.div>
        ) : (
          <>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
            {streaming && messages[messages.length - 1]?.content === '' && <TypingIndicator />}

            {/* Confidence rating widget */}
            <AnimatePresence>
              {awaitingRating && !streaming && (
                <ConfidenceRating
                  onRate={(n) => {
                    setAwaitingRating(false)
                    sendMessage(String(n))
                  }}
                />
              )}
            </AnimatePresence>
          </>
        )}

        {limitReached && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-[#111827] border border-[#F59E0B]/30 rounded-2xl p-4 text-center"
          >
            <Lock className="w-5 h-5 text-[#F59E0B] mx-auto mb-2" />
            <p className="text-white font-medium text-sm mb-1">Daily limit reached</p>
            <p className="text-gray-400 text-xs mb-3">Upgrade to Pro for unlimited AI tutoring.</p>
            <Link
              href="/upgrade"
              className="bg-[#F59E0B] text-black text-xs font-bold px-4 py-2 rounded-lg inline-block hover:bg-[#D97706] transition-colors"
            >
              Upgrade to Pro
            </Link>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        className="flex-shrink-0 px-4 pt-3 border-t border-[#1F2937]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 80px)' }}
      >
        {/* Quick prompts */}
        {messages.length > 0 && !limitReached && !awaitingRating && (
          <div className="flex gap-2 mb-2 overflow-x-auto scrollbar-hide">
            {QUICK_PROMPTS.map((p) => (
              <button
                key={p}
                onClick={() => sendMessage(p)}
                disabled={streaming}
                className="flex-shrink-0 bg-[#111827] border border-[#1F2937] rounded-full px-3 py-1 text-gray-400 text-xs hover:border-[#10B981]/40 hover:text-white transition-colors disabled:opacity-40"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={awaitingRating ? 'Or type your confidence (1-5)...' : 'Answer or ask anything...'}
            disabled={streaming || limitReached}
            rows={1}
            className="flex-1 bg-[#111827] border border-[#1F2937] rounded-2xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-[#10B981]/50 resize-none disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ lineHeight: '1.4' }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming || limitReached}
            className="w-10 h-10 bg-[#10B981] rounded-full flex items-center justify-center flex-shrink-0 hover:bg-[#059669] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {streaming ? (
              <RefreshCw className="w-4 h-4 text-white animate-spin" />
            ) : (
              <Send className="w-4 h-4 text-white" />
            )}
          </button>
        </div>
        <p className="text-gray-700 text-[10px] text-center mt-2">
          Adaptive tutor · difficulty adjusts to your performance
        </p>
      </div>
    </div>
  )
}
