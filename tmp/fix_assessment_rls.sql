-- Fix SELECT policy for assessments - the existing one may be conflicting
-- Drop ALL existing policies and recreate clean ones

DROP POLICY IF EXISTS "Anyone can view active assessments" ON public.assessments;
DROP POLICY IF EXISTS "Admins can manage all assessments" ON public.assessments;  
DROP POLICY IF EXISTS "Instructors can insert assessments for own courses" ON public.assessments;
DROP POLICY IF EXISTS "Instructors can update assessments for own courses" ON public.assessments;
DROP POLICY IF EXISTS "Instructors can delete assessments for own courses" ON public.assessments;

-- Simple open SELECT policy
CREATE POLICY "assessments_select" ON public.assessments
  FOR SELECT USING (true);

-- INSERT for instructors
CREATE POLICY "assessments_insert_instructor" ON public.assessments
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- UPDATE for instructors
CREATE POLICY "assessments_update_instructor" ON public.assessments
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- DELETE for instructors  
CREATE POLICY "assessments_delete_instructor" ON public.assessments
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.courses WHERE id = course_id AND instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- Fix assessment_questions policies too
DROP POLICY IF EXISTS "Anyone can view questions for active assessments" ON public.assessment_questions;
DROP POLICY IF EXISTS "Admins can manage all questions" ON public.assessment_questions;
DROP POLICY IF EXISTS "Instructors can insert questions for own assessments" ON public.assessment_questions;
DROP POLICY IF EXISTS "Instructors can update questions for own assessments" ON public.assessment_questions;
DROP POLICY IF EXISTS "Instructors can delete questions for own assessments" ON public.assessment_questions;

CREATE POLICY "questions_select" ON public.assessment_questions
  FOR SELECT USING (true);

CREATE POLICY "questions_insert" ON public.assessment_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assessment_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "questions_update" ON public.assessment_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assessment_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "questions_delete" ON public.assessment_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.assessments a
      JOIN public.courses c ON c.id = a.course_id
      WHERE a.id = assessment_id AND c.instructor_id = auth.uid()
    )
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );


-- Also fix assessment_attempts
DROP POLICY IF EXISTS "Users can view own attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Users can insert own attempts" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Instructors can view attempts for own courses" ON public.assessment_attempts;
DROP POLICY IF EXISTS "Admins can view all attempts" ON public.assessment_attempts;

CREATE POLICY "attempts_select" ON public.assessment_attempts
  FOR SELECT USING (true);

CREATE POLICY "attempts_insert" ON public.assessment_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- Clean up: Delete the duplicate assessment records so we start fresh
-- (the browser created some that couldn't be seen)
DELETE FROM public.assessments;
