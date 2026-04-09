-- Supabase Schema for Open Skools Platform

-- Users Table (Extends auth.users)
CREATE TABLE public.users (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student', 'instructor', 'admin')),
  avatar_url TEXT,
  bio TEXT,
  dob DATE,
  gender TEXT,
  qualification TEXT,
  experience TEXT,
  location TEXT,
  contact_number TEXT,
  linkedin_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own profile, instructors/admins can read all profiles
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Anyone can view profiles for course info" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Trigger to create user automatically on auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create the public.users record after the email is confirmed.
  -- This fires on INSERT (e.g., Google login where email is auto-confirmed)
  -- and on UPDATE (when a user clicks the email confirmation link).
  IF NEW.email_confirmed_at IS NOT NULL THEN
    -- Only insert if going from unconfirmed → confirmed, or if it's a new confirmed user
    IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.email_confirmed_at IS NULL)) THEN
      INSERT INTO public.users (id, email, name, role, contact_number)
      VALUES (
        NEW.id, 
        NEW.email, 
        INITCAP(COALESCE(NEW.raw_user_meta_data->>'full_name', 'Student')), 
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        NEW.raw_user_meta_data->>'phone'
      )
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT OR UPDATE ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- Courses Table
CREATE TABLE public.courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  instructor_id UUID REFERENCES public.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  price NUMERIC NOT NULL DEFAULT 0,
  level TEXT NOT NULL DEFAULT 'Beginner',
  thumbnail_url TEXT,
  learning_outcomes TEXT[] DEFAULT '{}',
  requirements TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for courses
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view published courses" ON public.courses FOR SELECT USING (true);
CREATE POLICY "Instructors can create courses" ON public.courses FOR INSERT WITH CHECK (auth.uid() = instructor_id);
CREATE POLICY "Instructors can update own courses" ON public.courses FOR UPDATE USING (auth.uid() = instructor_id);
CREATE POLICY "Instructors can delete own courses" ON public.courses FOR DELETE USING (auth.uid() = instructor_id);


-- Lessons Table
CREATE TABLE public.lessons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  section_title TEXT NOT NULL DEFAULT 'General',
  video_url TEXT,
  duration INT DEFAULT 0, -- in minutes
  order_index INT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for lessons
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view lesson metadata" ON public.lessons FOR SELECT USING (true);
-- Video content could be locked behind enrollments, but for MVP we assume SELECT is fine for UI listing, frontend handles locking video player
CREATE POLICY "Instructors can manage lessons for their courses" ON public.lessons 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = lessons.course_id AND instructor_id = auth.uid())
  );


-- Enrollments Table
CREATE TABLE public.enrollments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE NOT NULL,
  progress INT DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed')),
  notes TEXT,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, course_id)
);

-- Enable RLS for enrollments
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own enrollments" ON public.enrollments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Instructors can view course enrollments" ON public.enrollments 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = enrollments.course_id AND instructor_id = auth.uid())
  );
CREATE POLICY "Users can enroll themselves" ON public.enrollments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own progress" ON public.enrollments FOR UPDATE USING (auth.uid() = user_id);


-- Payments Table
CREATE TABLE public.instructor_requests (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  id_proof TEXT,
  expertise TEXT NOT NULL,
  experience TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.payments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) NOT NULL,
  course_id UUID REFERENCES public.courses(id) NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create payments" ON public.payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Instructors can view payments for their courses" ON public.payments 
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = payments.course_id AND instructor_id = auth.uid())
  );

-- lesson_completions Table
CREATE TABLE public.lesson_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, lesson_id)
);

-- Enable RLS for lesson_completions
ALTER TABLE public.lesson_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own completions" ON public.lesson_completions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own completions" ON public.lesson_completions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own completions" ON public.lesson_completions FOR DELETE USING (auth.uid() = user_id);


-- activity_log Table for Learning Streak
CREATE TABLE public.activity_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  activity_type TEXT NOT NULL, -- 'login', 'lesson_complete'
  activity_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, activity_date)
);

-- Enable RLS for activity_log
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own activity" ON public.activity_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activity" ON public.activity_log FOR INSERT WITH CHECK (auth.uid() = user_id);


-- Function and Trigger to update enrollment progress automatically
CREATE OR REPLACE FUNCTION public.update_enrollment_progress()
RETURNS TRIGGER AS $$
DECLARE
  count_completed INT;
  count_total INT;
  v_course_id UUID;
BEGIN
  -- Determine course_id from lesson which was completed
  SELECT course_id INTO v_course_id FROM public.lessons WHERE id = NEW.lesson_id;

  -- Count completed lessons for this user in this course
  SELECT COUNT(*) INTO count_completed 
  FROM public.lesson_completions lc
  JOIN public.lessons l ON lc.lesson_id = l.id
  WHERE lc.user_id = NEW.user_id AND l.course_id = v_course_id;

  -- Count total lessons in this course
  SELECT COUNT(*) INTO count_total FROM public.lessons WHERE course_id = v_course_id;

  -- Update enrollment
  IF count_total > 0 THEN
    UPDATE public.enrollments 
    SET progress = (count_completed * 100 / count_total),
        status = CASE WHEN (count_completed * 100 / count_total) = 100 THEN 'completed' ELSE 'active' END,
        updated_at = NOW()
    WHERE user_id = NEW.user_id AND course_id = v_course_id;
  END IF;

  -- Log activity (upsert handles duplicates on same date)
  INSERT INTO public.activity_log (user_id, activity_type, activity_date)
  VALUES (NEW.user_id, 'lesson_complete', CURRENT_DATE)
  ON CONFLICT (user_id, activity_date) DO UPDATE SET created_at = NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_lesson_completed
  AFTER INSERT ON public.lesson_completions
  FOR EACH ROW EXECUTE PROCEDURE public.update_enrollment_progress();


-- Add updated_at column to enrollments if not exists
ALTER TABLE public.enrollments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();


-- ========================
-- Jobs Table (Careers Hub)
-- ========================
CREATE TABLE public.jobs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  company_name TEXT NOT NULL,
  role TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Freshers' CHECK (category IN ('Walkin', 'Online', 'Work From Home', 'Freshers')),
  qualification TEXT,
  vacancies INT,
  salary TEXT,
  location TEXT,
  job_type TEXT DEFAULT 'Full-time' CHECK (job_type IN ('Full-time', 'Part-time', 'Contract', 'Internship')),
  description TEXT,
  venue TEXT,
  contact_details TEXT,
  date_time TEXT,
  apply_link TEXT,
  expiry_date DATE,
  is_urgent BOOLEAN DEFAULT false,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for jobs
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;

-- Anyone can view jobs
CREATE POLICY "Anyone can view jobs" ON public.jobs FOR SELECT USING (true);

-- Only admins can insert jobs
CREATE POLICY "Admins can insert jobs" ON public.jobs FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Only admins can update jobs
CREATE POLICY "Admins can update jobs" ON public.jobs FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- Only admins can delete jobs
CREATE POLICY "Admins can delete jobs" ON public.jobs FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- ========================
-- Contact Messages Table
-- ========================
CREATE TABLE public.contact_messages (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'replied')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for contact_messages
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Anyone can insert messages
CREATE POLICY "Anyone can insert contact messages" ON public.contact_messages FOR INSERT WITH CHECK (true);

-- Only admins can view and manage messages
CREATE POLICY "Admins can view and manage contact messages" ON public.contact_messages 
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
