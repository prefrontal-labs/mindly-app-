import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateJSON } from '@/lib/groq'
import { ExamType, EXAM_CONFIGS, SubjectAssessment } from '@/types'

const FALLBACK_ROADMAP = {
  phases: [
    {
      phase: 'foundation',
      start_date: new Date().toISOString().split('T')[0],
      end_date: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      daily_hours: 3,
      weeks: [
        {
          week_number: 1,
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          topics: ['Introduction to subject basics', 'Core concepts overview', 'Foundation building'],
          resources: [{ type: 'book', title: 'NCERT Textbooks', author: 'NCERT' }],
        },
      ],
    },
  ],
}

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

    const systemPrompt = `You are an expert academic planner specializing in Indian competitive exams. Based on the user's exam selection, exam date, daily hours, current level, and subject-wise self-assessment, generate a detailed, phase-based study roadmap. Structure the roadmap into 4 phases: Foundation (build basics), Depth (go deep into each subject), Revision (rapid review), Mock Test Phase (only practice tests). For each phase, specify: start date, end date, daily hour allocation, list of topics per week, and suggested resources (books and free YouTube channels only — no paid resources). Return as structured JSON only, no other text. The JSON must have this exact structure: { "phases": [{ "phase": "foundation|depth|revision|mock", "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "daily_hours": number, "weeks": [{ "week_number": number, "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "topics": ["topic1", "topic2"], "resources": [{ "type": "book|youtube", "title": "...", "author": "..." }] }] }] }`

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
