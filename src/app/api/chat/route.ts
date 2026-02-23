import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { PLAN_LIMITS } from '@/types'
import { getEffectivePlan } from '@/lib/plan'
import { getTutorGraph } from '@/lib/ai/graph'
import { loadStudentState, saveStudentState } from '@/lib/ai/student-state'
import Groq from 'groq-sdk'

export const runtime = 'nodejs'

let _groq: Groq | null = null
function getGroq() {
  if (!_groq) _groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  return _groq
}

const MODEL = 'llama-3.3-70b-versatile'

// Extract the question being asked and the concept being tested from the response
async function extractQuestionAndConcept(
  response: string
): Promise<{ question: string | null; concept: string | null }> {
  if (!response.includes('?')) return { question: null, concept: null }

  try {
    const resp = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: `From this tutor response, extract the question being asked and the concept/topic being tested.
Response: "${response.slice(0, 600)}"
Return ONLY JSON: {"question":"exact question text or null","concept":"topic or concept name or null"}`,
        },
      ],
      temperature: 0,
      max_tokens: 80,
      response_format: { type: 'json_object' },
    })
    return JSON.parse(resp.choices[0]?.message?.content || '{}')
  } catch {
    return { question: null, concept: null }
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { message } = await req.json()
    if (!message?.trim()) return NextResponse.json({ error: 'Empty message' }, { status: 400 })

    // ── Plan limit check ────────────────────────────────────────────────────
    const { data: userData } = await supabase
      .from('users')
      .select('plan, plan_expiry, exam')
      .eq('id', user.id)
      .single()

    const plan = getEffectivePlan(userData?.plan, userData?.plan_expiry)
    const limit = PLAN_LIMITS[plan].ai_tutor_messages_per_day

    if (limit !== Infinity) {
      const today = new Date().toISOString().split('T')[0]
      const { data: usage } = await supabase
        .from('daily_usage')
        .select('ai_messages_sent')
        .eq('user_id', user.id)
        .eq('usage_date', today)
        .single()

      if ((usage?.ai_messages_sent || 0) >= limit) {
        return NextResponse.json({ error: 'Daily limit reached', upgrade_required: true }, { status: 429 })
      }

      await supabase.from('daily_usage').upsert(
        {
          user_id: user.id,
          usage_date: today,
          ai_messages_sent: (usage?.ai_messages_sent || 0) + 1,
        },
        { onConflict: 'user_id,usage_date' }
      )
    }

    // ── Load student state + chat history ────────────────────────────────────
    const examDomain = userData?.exam || 'competitive exams'
    const [studentState, historyResult] = await Promise.all([
      loadStudentState(supabase, user.id, examDomain),
      supabase
        .from('chat_messages')
        .select('role, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8),
    ])

    const chatHistory = (historyResult.data || [])
      .reverse()
      .map((m) => ({ role: m.role, content: m.content }))

    // ── Save user message ────────────────────────────────────────────────────
    await supabase.from('chat_messages').insert({
      user_id: user.id,
      role: 'user',
      content: message.trim(),
    })

    // ── Run LangGraph tutor graph ────────────────────────────────────────────
    const graph = getTutorGraph()
    const graphResult = await graph.invoke({
      userMessage: message.trim(),
      studentState,
      chatHistory,
      messageType: 'general', // default, overridden by classify node
      assessmentResult: null,
      tutorAction: 'respond_general',
      updatedStudentState: studentState,
      systemPrompt: '',
    })

    const { systemPrompt, updatedStudentState } = graphResult

    // ── Stream Groq response ─────────────────────────────────────────────────
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...chatHistory.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: message.trim() },
    ]

    const stream = await getGroq().chat.completions.create({
      model: MODEL,
      messages,
      temperature: 0.7,
      max_tokens: 512,
      stream: true,
    })

    const encoder = new TextEncoder()
    let fullResponse = ''

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // First SSE event: metadata (phase, awaiting rating)
          const meta = {
            type: 'meta',
            phase: updatedStudentState.sessionPhase,
            awaitingRating: updatedStudentState.awaitingConfidenceRating,
            action: graphResult.tutorAction,
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(meta)}\n\n`))

          // Stream response tokens
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) {
              fullResponse += text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()

          // ── Post-stream: extract question, save state ──────────────────────
          if (fullResponse) {
            const [extracted] = await Promise.all([
              extractQuestionAndConcept(fullResponse),
            ])

            if (extracted.question) {
              updatedStudentState.pendingQuestion = extracted.question
              updatedStudentState.pendingConcept = extracted.concept || updatedStudentState.pendingConcept

              // Update interleaving tracker
              if (extracted.concept) {
                updatedStudentState.lastConceptsTested = [
                  ...updatedStudentState.lastConceptsTested.slice(-9),
                  extracted.concept,
                ]
              }
            }

            await Promise.all([
              supabase.from('chat_messages').insert({
                user_id: user.id,
                role: 'assistant',
                content: fullResponse,
              }),
              saveStudentState(supabase, updatedStudentState),
            ])
          }
        } catch (err) {
          console.error('[Tutor stream error]', err)
          controller.close()
        }
      },
    })

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (err) {
    console.error('[Chat API]', err)
    return NextResponse.json({ error: 'Chat failed' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')

    const { data: messages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(limit)

    return NextResponse.json({ messages: messages || [] })
  } catch (err) {
    console.error('[Chat GET]', err)
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }
}
