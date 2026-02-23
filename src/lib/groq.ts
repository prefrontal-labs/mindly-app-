import Groq from 'groq-sdk'

// Lazy singleton — only instantiated at runtime (not build time)
let _groq: Groq | null = null
function getGroq(): Groq {
  if (!_groq) {
    _groq = new Groq({ apiKey: process.env.GROQ_API_KEY! })
  }
  return _groq
}

export const MODEL = 'llama-3.3-70b-versatile'

export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  fallback: T
): Promise<T> {
  try {
    const response = await getGroq().chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    })

    const content = response.choices[0]?.message?.content ?? ''
    // Strip markdown code blocks if present
    const cleaned = content
      .replace(/^```json\n?/i, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/i, '')
      .trim()

    return JSON.parse(cleaned) as T
  } catch (err) {
    console.error('[Groq Error]', err)
    return fallback
  }
}

export async function streamChat(
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[]
) {
  return getGroq().chat.completions.create({
    model: MODEL,
    messages,
    temperature: 0.7,
    max_tokens: 1024,
    stream: true,
  })
}

export default getGroq
