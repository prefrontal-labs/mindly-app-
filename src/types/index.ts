// ============================================================
// MINDLY — Core Type Definitions
// ============================================================

export type Plan = 'free' | 'pro' | 'exam_pack'
export type ExamType = 'UPSC_CSE' | 'GATE_CS' | 'GATE_ECE' | 'JEE_MAINS' | 'JEE_ADVANCED' | 'NEET' | 'CAT' | 'IBPS_PO' | 'SBI_PO' | 'SSC_CGL'
export type Level = 'beginner' | 'intermediate' | 'appeared_before'
export type SubjectStatus = 'not_started' | 'somewhat_done' | 'confident'
export type RoadmapPhase = 'foundation' | 'depth' | 'revision' | 'mock'
export type Difficulty = 'easy' | 'medium' | 'hard'
export type QuizMode = 'topic' | 'subject' | 'full_mock' | 'rapid_fire'

export interface User {
  id: string
  email: string
  name: string
  phone?: string
  created_at: string
  plan: Plan
  plan_expiry?: string
  streak_count: number
  last_active_date?: string
  vertical: 'competitive'
  onboarding_complete: boolean
}

export interface UserProfile {
  id: string
  user_id: string
  exam: ExamType
  exam_date: string
  daily_hours: number
  level: Level
  subject_assessments: SubjectAssessment[]
  institution_code?: string
  created_at: string
}

export interface SubjectAssessment {
  subject: string
  status: SubjectStatus
}

export interface RoadmapPhaseData {
  phase: RoadmapPhase
  start_date: string
  end_date: string
  daily_hours: number
  weeks: RoadmapWeek[]
}

export interface RoadmapWeek {
  week_number: number
  start_date: string
  end_date: string
  topics: string[]
  resources: Resource[]
}

export interface Resource {
  type: 'book' | 'youtube'
  title: string
  author?: string
  channel?: string
}

export interface Roadmap {
  id: string
  user_id: string
  exam: ExamType
  phases: RoadmapPhaseData[]
  created_at: string
  updated_at: string
}

export interface Flashcard {
  id: string
  user_id: string
  topic: string
  exam: ExamType
  front: string
  back: string
  ease_factor: number
  interval: number
  next_review_date: string
  repetitions: number
  created_at: string
}

export interface FlashcardSession {
  id: string
  user_id: string
  cards_reviewed: number
  retention_rate: number
  duration_seconds: number
  created_at: string
}

export interface QuizQuestion {
  id: string
  topic: string
  exam: ExamType
  difficulty: Difficulty
  question: string
  options: { A: string; B: string; C: string; D: string }
  correct_answer: 'A' | 'B' | 'C' | 'D'
  explanation: string
}

export interface QuizAttempt {
  id: string
  user_id: string
  mode: QuizMode
  topic: string
  exam: ExamType
  score: number
  accuracy: number
  time_taken_seconds: number
  created_at: string
}

export interface QuizResponse {
  id: string
  attempt_id: string
  question_id: string
  selected_answer: string
  is_correct: boolean
  time_taken_seconds: number
}

export interface ChatMessage {
  id: string
  user_id: string
  role: 'user' | 'assistant'
  content: string
  created_at: string
}

export interface Badge {
  id: string
  slug: string
  name: string
  description: string
  icon: string
  earned_at: string
}

export interface XPTransaction {
  id: string
  user_id: string
  amount: number
  reason: string
  created_at: string
}

export interface Payment {
  id: string
  user_id: string
  plan: Plan
  amount: number
  razorpay_order_id: string
  razorpay_payment_id?: string
  status: 'pending' | 'success' | 'failed'
  created_at: string
}

export interface Institution {
  id: string
  name: string
  code: string
  admin_user_id: string
  created_at: string
}

export interface DashboardStats {
  streak: number
  xp_total: number
  topics_this_week: number
  quiz_accuracy_this_week: number
  hours_today: number
  daily_goal_progress: number
  flashcards_due: number
}

export interface ExamConfig {
  id: ExamType
  name: string
  shortName: string
  color: string
  subjects: string[]
  totalQuestions?: number
  timeMinutes?: number
  nextExamDate?: string
}

export const EXAM_CONFIGS: Record<ExamType, ExamConfig> = {
  UPSC_CSE: {
    id: 'UPSC_CSE',
    name: 'UPSC Civil Services',
    shortName: 'UPSC CSE',
    color: '#4F8EF7',
    subjects: ['History', 'Geography', 'Polity', 'Economy', 'Science & Technology', 'Environment', 'Current Affairs', 'Ethics', 'Optional Subject'],
    totalQuestions: 100,
    timeMinutes: 120,
  },
  GATE_CS: {
    id: 'GATE_CS',
    name: 'GATE Computer Science',
    shortName: 'GATE CS',
    color: '#10B981',
    subjects: ['Data Structures', 'Algorithms', 'Operating Systems', 'DBMS', 'Computer Networks', 'Theory of Computation', 'Compiler Design', 'Digital Logic', 'Computer Organization', 'Discrete Mathematics', 'Linear Algebra', 'Probability'],
    totalQuestions: 65,
    timeMinutes: 180,
  },
  GATE_ECE: {
    id: 'GATE_ECE',
    name: 'GATE Electronics & Communication',
    shortName: 'GATE ECE',
    color: '#8B5CF6',
    subjects: ['Network Theory', 'Electronic Devices', 'Analog Circuits', 'Digital Circuits', 'Control Systems', 'Signals & Systems', 'Communications', 'Electromagnetics', 'Engineering Mathematics'],
    totalQuestions: 65,
    timeMinutes: 180,
  },
  JEE_MAINS: {
    id: 'JEE_MAINS',
    name: 'JEE Mains',
    shortName: 'JEE Mains',
    color: '#F59E0B',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    totalQuestions: 90,
    timeMinutes: 180,
  },
  JEE_ADVANCED: {
    id: 'JEE_ADVANCED',
    name: 'JEE Advanced',
    shortName: 'JEE Adv',
    color: '#EF4444',
    subjects: ['Physics', 'Chemistry', 'Mathematics'],
    totalQuestions: 54,
    timeMinutes: 180,
  },
  NEET: {
    id: 'NEET',
    name: 'NEET UG',
    shortName: 'NEET',
    color: '#EC4899',
    subjects: ['Physics', 'Chemistry', 'Biology (Botany)', 'Biology (Zoology)'],
    totalQuestions: 180,
    timeMinutes: 200,
  },
  CAT: {
    id: 'CAT',
    name: 'CAT MBA Entrance',
    shortName: 'CAT',
    color: '#06B6D4',
    subjects: ['Verbal Ability & Reading Comprehension', 'Data Interpretation & Logical Reasoning', 'Quantitative Aptitude'],
    totalQuestions: 66,
    timeMinutes: 120,
  },
  IBPS_PO: {
    id: 'IBPS_PO',
    name: 'IBPS Probationary Officer',
    shortName: 'IBPS PO',
    color: '#84CC16',
    subjects: ['English Language', 'Quantitative Aptitude', 'Reasoning Ability', 'General Awareness', 'Computer Knowledge'],
    totalQuestions: 100,
    timeMinutes: 60,
  },
  SBI_PO: {
    id: 'SBI_PO',
    name: 'SBI Probationary Officer',
    shortName: 'SBI PO',
    color: '#22D3EE',
    subjects: ['English Language', 'Quantitative Aptitude', 'Reasoning Ability', 'General Awareness'],
    totalQuestions: 100,
    timeMinutes: 60,
  },
  SSC_CGL: {
    id: 'SSC_CGL',
    name: 'SSC Combined Graduate Level',
    shortName: 'SSC CGL',
    color: '#FB923C',
    subjects: ['General Intelligence & Reasoning', 'General Awareness', 'Quantitative Aptitude', 'English Comprehension'],
    totalQuestions: 100,
    timeMinutes: 60,
  },
}

export const PLAN_LIMITS = {
  free: {
    flashcards_per_day: 20,
    quiz_questions_per_day: 5,
    ai_tutor_messages_per_day: 10,
    streak_freezes_per_week: 1,
    mock_tests: false,
    analytics_full: false,
    pdf_export: false,
  },
  pro: {
    flashcards_per_day: Infinity,
    quiz_questions_per_day: Infinity,
    ai_tutor_messages_per_day: Infinity,
    streak_freezes_per_week: 3,
    mock_tests: true,
    analytics_full: true,
    pdf_export: true,
  },
  exam_pack: {
    flashcards_per_day: Infinity,
    quiz_questions_per_day: Infinity,
    ai_tutor_messages_per_day: Infinity,
    streak_freezes_per_week: 3,
    mock_tests: true,
    analytics_full: true,
    pdf_export: true,
  },
}

export const BADGES = [
  { slug: 'first_step', name: 'First Step', description: 'Complete onboarding', icon: '🎯' },
  { slug: 'week_warrior', name: 'Week Warrior', description: 'Maintain a 7-day streak', icon: '⚔️' },
  { slug: 'quiz_champion', name: 'Quiz Champion', description: 'Score 100% on any quiz', icon: '🏆' },
  { slug: 'roadmap_runner', name: 'Roadmap Runner', description: 'Complete first roadmap phase', icon: '🗺️' },
  { slug: 'iron_will', name: 'Iron Will', description: 'Maintain a 30-day streak', icon: '🔥' },
]
