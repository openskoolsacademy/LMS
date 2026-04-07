-- ============================================
-- Live Bootcamps & Enrollments System Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ========================
-- Live Bootcamps Table
-- ========================
CREATE TABLE IF NOT EXISTS public.live_bootcamps (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Online Live Bootcamp',
  instructor_name TEXT NOT NULL DEFAULT 'Open Skools',
  instructor_bio TEXT,
  instructor_image TEXT,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  schedule_info TEXT, -- e.g. "Mon, Wed, Fri 7PM-8PM"
  total_sessions INT NOT NULL DEFAULT 1,
  live_link TEXT,
  thumbnail_url TEXT,
  enable_certificate BOOLEAN DEFAULT false,
  price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed')),
  learning_outcomes TEXT[] DEFAULT '{}',
  max_students INT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for live_bootcamps
ALTER TABLE public.live_bootcamps ENABLE ROW LEVEL SECURITY;

-- Anyone can view live bootcamps
CREATE POLICY "Anyone can view live bootcamps" ON public.live_bootcamps FOR SELECT USING (true);

-- Only admins can insert live bootcamps
CREATE POLICY "Admins can insert live bootcamps" ON public.live_bootcamps FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Only admins can update live bootcamps
CREATE POLICY "Admins can update live bootcamps" ON public.live_bootcamps FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Only admins can delete live bootcamps
CREATE POLICY "Admins can delete live bootcamps" ON public.live_bootcamps FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);


-- ========================
-- Live Bootcamp Enrollments Table
-- ========================
CREATE TABLE IF NOT EXISTS public.live_bootcamp_enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  live_bootcamp_id UUID REFERENCES public.live_bootcamps(id) ON DELETE CASCADE NOT NULL,
  registered BOOLEAN DEFAULT true,
  completed BOOLEAN DEFAULT false,
  payment_id TEXT,
  amount_paid NUMERIC DEFAULT 0,
  certificate_issued BOOLEAN DEFAULT false,
  certificate_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, live_bootcamp_id)
);

-- Enable RLS for live_bootcamp_enrollments
ALTER TABLE public.live_bootcamp_enrollments ENABLE ROW LEVEL SECURITY;

-- Users can view their own enrollment records
CREATE POLICY "Users can view own bootcamp enrollments" ON public.live_bootcamp_enrollments
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all enrollment records
CREATE POLICY "Admins can view all bootcamp enrollments" ON public.live_bootcamp_enrollments
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can enroll themselves (insert)
CREATE POLICY "Users can enroll in bootcamps" ON public.live_bootcamp_enrollments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own enrollment
CREATE POLICY "Users can update own bootcamp enrollment" ON public.live_bootcamp_enrollments
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can update any enrollment record (manual marking)
CREATE POLICY "Admins can update any bootcamp enrollment" ON public.live_bootcamp_enrollments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can delete enrollment records
CREATE POLICY "Admins can delete bootcamp enrollments" ON public.live_bootcamp_enrollments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- ========================
-- Add live_bootcamp_id to coupons (optional column)
-- ========================
ALTER TABLE public.coupons ADD COLUMN IF NOT EXISTS live_bootcamp_id UUID REFERENCES public.live_bootcamps(id);
