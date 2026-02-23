import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/groq'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { type } = await req.json() // 'behind' or 'early'

    const { data: roadmap } = await supabase
      .from('roadmaps')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (!roadmap) return NextResponse.json({ error: 'No roadmap found' }, { status: 404 })

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('exam_date, daily_hours')
      .eq('user_id', user.id)
      .single()

    const daysLeft = Math.ceil((new Date(profile?.exam_date).getTime() - Date.now()) / 86400000)

    const systemPrompt = `You are an expert academic planner. You will receive a study roadmap and need to ${type === 'behind' ? 'compress and accelerate it' : 'advance to the next phase early'}. Return only the updated roadmap JSON in the same structure. No other text.`

    const userPrompt = `Current roadmap phases: ${JSON.stringify(roadmap.phases)}
Days left to exam: ${daysLeft}
Daily hours: ${profile?.daily_hours}
Action: User says they are ${type === 'behind' ? 'running behind — compress remaining roadmap to fit in fewer days' : 'ahead of schedule — advance to next phase now'}.
Return the complete updated roadmap JSON.`

    const updated = await generateJSON(systemPrompt, userPrompt, { phases: roadmap.phases })

    await supabase
      .from('roadmaps')
      .update({ phases: updated.phases, updated_at: new Date().toISOString() })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true, phases: updated.phases })
  } catch (err) {
    console.error('[Roadmap Adjust]', err)
    return NextResponse.json({ error: 'Failed to adjust roadmap' }, { status: 500 })
  }
}
