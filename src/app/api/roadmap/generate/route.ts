import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/groq'
import { ExamType, EXAM_CONFIGS, SubjectAssessment } from '@/types'

function makeFallbackRoadmap() {
  const today = new Date()
  const fmt = (d: Date) => d.toISOString().split('T')[0]
  const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000)

  const days = Array.from({ length: 7 }, (_, i) => ({
    date: fmt(addDays(today, i)),
    topics: ['Introduction to subject basics', 'Core concepts overview'],
  }))

  return {
    phases: [
      {
        phase: 'foundation',
        start_date: fmt(today),
        end_date: fmt(addDays(today, 30)),
        daily_hours: 3,
        weeks: [
          {
            week_number: 1,
            start_date: fmt(today),
            end_date: fmt(addDays(today, 6)),
            theme: 'Foundation Building',
            topics: ['Introduction to subject basics', 'Core concepts overview', 'Foundation building'],
            resources: [{ type: 'book', title: 'NCERT Textbooks', author: 'NCERT' }],
            days,
          },
        ],
      },
    ],
  }
}

const FALLBACK_ROADMAP = makeFallbackRoadmap()

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { exam, examDate, dailyHours, level, subjects } = await req.json()

    const examConfig = EXAM_CONFIGS[exam as ExamType]
    const daysLeft = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000)

    const weakSubjects = (subjects as SubjectAssessment[])
      .filter(s => s.status === 'not_started')
      .map(s => s.subject)
    const mediumSubjects = (subjects as SubjectAssessment[])
      .filter(s => s.status === 'somewhat_done')
      .map(s => s.subject)
    const strongSubjects = (subjects as SubjectAssessment[])
      .filter(s => s.status === 'confident')
      .map(s => s.subject)

    const systemPrompt = `You are an expert academic planner specializing in Indian competitive exams. Generate a detailed, phase-based daily study roadmap. Structure it into 4 phases: Foundation, Depth, Revision, Mock Test. For each phase provide weeks, and for each week provide an exact daily breakdown with one entry per day. Return ONLY valid JSON with no other text. Use this exact structure:
{
  "phases": [{
    "phase": "foundation|depth|revision|mock",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "daily_hours": number,
    "weeks": [{
      "week_number": number,
      "start_date": "YYYY-MM-DD",
      "end_date": "YYYY-MM-DD",
      "theme": "brief week theme",
      "topics": ["topic1", "topic2"],
      "resources": [{ "type": "book|youtube", "title": "...", "author": "..." }],
      "days": [
        { "date": "YYYY-MM-DD", "topics": ["specific topic for this day", "second topic"] },
        { "date": "YYYY-MM-DD", "topics": ["next day topic"] }
      ]
    }]
  }]
}
IMPORTANT: The "days" array must have exactly 7 entries per week with dates matching each day from week start_date to end_date. Each day's topics must be specific and actionable (2-3 topics per day). Keep weeks array to a reasonable size.`

    const userPrompt = `Exam: ${examConfig.name}
Exam Date: ${examDate} (${daysLeft} days from today)
Daily Study Hours: ${dailyHours}
Current Level: ${level}
Subjects NOT started: ${weakSubjects.join(', ') || 'none'}
Subjects somewhat done: ${mediumSubjects.join(', ') || 'none'}
Subjects confident in: ${strongSubjects.join(', ') || 'none'}

Generate a ${daysLeft}-day study roadmap starting from today. Allocate more time to not-started subjects. Confident subjects need only revision. Include all ${examConfig.subjects.join(', ')} subjects.`

    const roadmapData = await generateJSON(systemPrompt, userPrompt, FALLBACK_ROADMAP)

    // Save to DB
    const { data: roadmap, error } = await supabase
      .from('roadmaps')
      .upsert({
        user_id: user.id,
        exam,
        phases: roadmapData.phases || FALLBACK_ROADMAP.phases,
        current_phase: 'foundation',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ success: true, roadmap })
  } catch (err) {
    console.error('[Roadmap Generate]', err)
    return NextResponse.json({ error: 'Failed to generate roadmap' }, { status: 500 })
  }
}
