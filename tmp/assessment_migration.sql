-- ============================================
-- Assessment-Based Certificate Unlock System
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Assessments Table (one per course)
CREATE TABLE IF NOT EXISTS public.assessments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT 'Course Assessment',
  pass_percentage INT NOT NULL DEFAULT 60 CHECK (pass_percentage >= 1 AND pass_percentage <= 100),
  time_limit_minutes INT,
  max_attempts INT DEFAULT 3,
  shuffle_questions BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active assessments" ON public.assessments
  FOR SELECT USING (true);

CREATE POLICY "Instructors can manage assessments for own courses" ON public.assessments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = assessments.course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "Admins can manage all assessments" ON public.assessments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- 2. Assessment Questions Table
CREATE TABLE IF NOT EXISTS public.assessment_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_option INT NOT NULL DEFAULT 0,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.assessment_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view questions for active assessments" ON public.assessment_questions
  FOR SELECT USING (true);

CREATE POLICY "Instructors can manage questions for own assessments" ON public.assessment_questions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assessment_questions.assessment_id AND c.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Admins can manage all questions" ON public.assessment_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- 3. Assessment Attempts Table
CREATE TABLE IF NOT EXISTS public.assessment_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  assessment_id UUID REFERENCES public.assessments(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  answers JSONB DEFAULT '{}'::jsonb,
  score INT NOT NULL DEFAULT 0,
  total_questions INT NOT NULL DEFAULT 0,
  correct_count INT NOT NULL DEFAULT 0,
  passed BOOLEAN NOT NULL DEFAULT false,
  time_taken_seconds INT,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.assessment_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own attempts" ON public.assessment_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own attempts" ON public.assessment_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Instructors can view attempts for own courses" ON public.assessment_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = assessment_attempts.course_id AND instructor_id = auth.uid())
  );

CREATE POLICY "Admins can view all attempts" ON public.assessment_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
