-- ============================================
-- Events & Attendance System Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ========================
-- Events Table
-- ========================
CREATE TABLE IF NOT EXISTS public.events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  instructor_name TEXT NOT NULL DEFAULT 'Open Skools',
  event_date TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 60,
  live_link TEXT,
  thumbnail_url TEXT,
  enable_certificate BOOLEAN DEFAULT false,
  price NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'live', 'completed')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for events
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Anyone can view events
CREATE POLICY "Anyone can view events" ON public.events FOR SELECT USING (true);

-- Only admins can insert events
CREATE POLICY "Admins can insert events" ON public.events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Only admins can update events
CREATE POLICY "Admins can update events" ON public.events FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Only admins can delete events
CREATE POLICY "Admins can delete events" ON public.events FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);


-- ========================
-- Event Attendance Table
-- ========================
CREATE TABLE IF NOT EXISTS public.event_attendance (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  registered BOOLEAN DEFAULT true,
  attended BOOLEAN DEFAULT false,
  join_time TIMESTAMP WITH TIME ZONE,
  payment_id TEXT,
  amount_paid NUMERIC DEFAULT 0,
  certificate_issued BOOLEAN DEFAULT false,
  certificate_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, event_id)
);

-- Enable RLS for event_attendance
ALTER TABLE public.event_attendance ENABLE ROW LEVEL SECURITY;

-- Users can view their own attendance records
CREATE POLICY "Users can view own attendance" ON public.event_attendance
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all attendance records
CREATE POLICY "Admins can view all attendance" ON public.event_attendance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Users can register themselves (insert)
CREATE POLICY "Users can register for events" ON public.event_attendance
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own attendance (for join tracking)
CREATE POLICY "Users can update own attendance" ON public.event_attendance
  FOR UPDATE USING (auth.uid() = user_id);

-- Admins can update any attendance record (manual marking)
CREATE POLICY "Admins can update any attendance" ON public.event_attendance
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Admins can delete attendance records
CREATE POLICY "Admins can delete attendance" ON public.event_attendance
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
