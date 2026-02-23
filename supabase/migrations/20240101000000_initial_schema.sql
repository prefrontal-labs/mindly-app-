-- ============================================================
-- MINDLY — Complete Supabase PostgreSQL Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS TABLE (extends Supabase auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT UNIQUE,
  name TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'exam_pack')),
  plan_expiry TIMESTAMPTZ,
  streak_count INTEGER DEFAULT 0,
  last_active_date DATE,
  vertical TEXT DEFAULT 'competitive',
  onboarding_complete BOOLEAN DEFAULT FALSE,
  total_xp INTEGER DEFAULT 0
);

-- ============================================================
-- USER PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  exam TEXT NOT NULL,
  exam_date DATE,
  daily_hours INTEGER DEFAULT 3,
  level TEXT DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'appeared_before')),
  subject_assessments JSONB DEFAULT '[]',
  institution_code TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROADMAPS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.roadmaps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  exam TEXT NOT NULL,
  phases JSONB NOT NULL DEFAULT '[]',
  current_phase TEXT DEFAULT 'foundation',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FLASHCARDS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.flashcards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  exam TEXT NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  ease_factor FLOAT DEFAULT 2.5,
  interval INTEGER DEFAULT 0,
  next_review_date DATE DEFAULT CURRENT_DATE,
  repetitions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for efficient due card queries
CREATE INDEX IF NOT EXISTS idx_flashcards_user_review
  ON public.flashcards(user_id, next_review_date);

-- ============================================================
-- FLASHCARD SESSIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.flashcard_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  cards_reviewed INTEGER DEFAULT 0,
  retention_rate FLOAT DEFAULT 0,
  duration_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUIZ QUESTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  exam TEXT NOT NULL,
  difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUIZ ATTEMPTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quiz_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  mode TEXT NOT NULL,
  topic TEXT NOT NULL,
  exam TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 0,
  accuracy FLOAT DEFAULT 0,
  time_taken_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- QUIZ RESPONSES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.quiz_responses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  attempt_id UUID REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  selected_answer TEXT,
  is_correct BOOLEAN DEFAULT FALSE,
  time_taken_seconds INTEGER DEFAULT 0
);

-- ============================================================
-- CHAT MESSAGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_user
  ON public.chat_messages(user_id, created_at DESC);

-- ============================================================
-- USER BADGES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_badges (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  badge_slug TEXT NOT NULL,
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_slug)
);

-- ============================================================
-- XP TRANSACTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.xp_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STREAK DATA TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.streak_data (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_active_date DATE,
  freeze_used_this_week INTEGER DEFAULT 0,
  last_freeze_week INTEGER DEFAULT 0
);

-- ============================================================
-- PAYMENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  amount INTEGER NOT NULL,
  razorpay_order_id TEXT UNIQUE,
  razorpay_payment_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INSTITUTIONS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.institutions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  admin_user_id UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- INSTITUTION STUDENTS TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.institution_students (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  institution_id UUID REFERENCES public.institutions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(institution_id, user_id)
);

-- ============================================================
-- STUDY SESSIONS TABLE (for daily tracking)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.study_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  topic TEXT NOT NULL,
  duration_minutes INTEGER DEFAULT 0,
  session_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_sessions_user_date
  ON public.study_sessions(user_id, session_date DESC);

-- ============================================================
-- PUSH SUBSCRIPTIONS TABLE (Web Push notifications)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint TEXT UNIQUE NOT NULL,
  p256dh TEXT,
  auth TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- DAILY USAGE TRACKING (for plan limits)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.daily_usage (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  usage_date DATE DEFAULT CURRENT_DATE,
  flashcards_reviewed INTEGER DEFAULT 0,
  quiz_questions_answered INTEGER DEFAULT 0,
  ai_messages_sent INTEGER DEFAULT 0,
  UNIQUE(user_id, usage_date)
);

-- ============================================================
-- FUNCTION: Auto-create user record on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, name)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ============================================================
-- FUNCTION: Update user total XP
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_user_xp()
RETURNS trigger AS $$
BEGIN
  UPDATE public.users
  SET total_xp = total_xp + NEW.amount
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_xp_transaction
  AFTER INSERT ON public.xp_transactions
  FOR EACH ROW EXECUTE PROCEDURE public.update_user_xp();

-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roadmaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flashcard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streak_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.institution_students ENABLE ROW LEVEL SECURITY;

-- Users: can read/update own record
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- User profiles: own data only
CREATE POLICY "Users can CRUD own profile" ON public.user_profiles
  FOR ALL USING (auth.uid() = user_id);

-- Roadmaps: own data only
CREATE POLICY "Users can CRUD own roadmaps" ON public.roadmaps
  FOR ALL USING (auth.uid() = user_id);

-- Flashcards: own data only
CREATE POLICY "Users can CRUD own flashcards" ON public.flashcards
  FOR ALL USING (auth.uid() = user_id);

-- Flashcard sessions: own data only
CREATE POLICY "Users can CRUD own flashcard sessions" ON public.flashcard_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Quiz questions: own data only
CREATE POLICY "Users can CRUD own quiz questions" ON public.quiz_questions
  FOR ALL USING (auth.uid() = user_id);

-- Quiz attempts: own data only
CREATE POLICY "Users can CRUD own quiz attempts" ON public.quiz_attempts
  FOR ALL USING (auth.uid() = user_id);

-- Quiz responses: own data only
CREATE POLICY "Users can CRUD own quiz responses" ON public.quiz_responses
  FOR ALL USING (auth.uid() = user_id);

-- Chat messages: own data only
CREATE POLICY "Users can CRUD own chat messages" ON public.chat_messages
  FOR ALL USING (auth.uid() = user_id);

-- Badges: own data only
CREATE POLICY "Users can view own badges" ON public.user_badges
  FOR ALL USING (auth.uid() = user_id);

-- XP: own data only
CREATE POLICY "Users can view own XP" ON public.xp_transactions
  FOR ALL USING (auth.uid() = user_id);

-- Streak: own data only
CREATE POLICY "Users can CRUD own streak" ON public.streak_data
  FOR ALL USING (auth.uid() = user_id);

-- Payments: own data only
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Study sessions: own data only
CREATE POLICY "Users can CRUD own study sessions" ON public.study_sessions
  FOR ALL USING (auth.uid() = user_id);

-- Daily usage: own data only
CREATE POLICY "Users can CRUD own daily usage" ON public.daily_usage
  FOR ALL USING (auth.uid() = user_id);

-- Push subscriptions: own data only
CREATE POLICY "Users can CRUD own push subscriptions" ON public.push_subscriptions
  FOR ALL USING (auth.uid() = user_id);

-- Institutions: admin can manage
CREATE POLICY "Institution admins can manage" ON public.institutions
  FOR ALL USING (auth.uid() = admin_user_id);

-- Institution students: admin can view
CREATE POLICY "Institution admins can view students" ON public.institution_students
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.institutions i
      WHERE i.id = institution_id AND i.admin_user_id = auth.uid()
    )
  );

-- Leaderboard: users can see others in same exam (read-only)
CREATE POLICY "Users can read leaderboard data" ON public.users
  FOR SELECT USING (true);

-- ============================================================
-- FUNCTION: Increment flashcard usage counter atomically
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_flashcard_usage(p_user_id UUID, p_date DATE)
RETURNS void AS $$
BEGIN
  INSERT INTO public.daily_usage (user_id, usage_date, flashcards_reviewed)
  VALUES (p_user_id, p_date, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET flashcards_reviewed = public.daily_usage.flashcards_reviewed + 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- LEADERBOARD VIEW
-- ============================================================
CREATE OR REPLACE VIEW public.leaderboard AS
SELECT
  u.id,
  u.name,
  u.total_xp,
  u.streak_count,
  up.exam,
  RANK() OVER (PARTITION BY up.exam ORDER BY u.total_xp DESC) as rank
FROM public.users u
JOIN public.user_profiles up ON up.user_id = u.id
WHERE u.onboarding_complete = true;
