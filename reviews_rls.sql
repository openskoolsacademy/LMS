-- ============================================================
-- UPDATE RLS Policies for course_reviews table
-- (Run AFTER the initial policies were already created)
-- This adds student self-edit/delete alongside admin access
-- ============================================================

-- Drop the old admin-only policies
DROP POLICY IF EXISTS "Admins can update reviews" ON public.course_reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON public.course_reviews;

-- Recreate: Users can update their own reviews OR admins can update any
CREATE POLICY "Users or admins can update reviews"
  ON public.course_reviews
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Recreate: Users can delete their own reviews OR admins can delete any
CREATE POLICY "Users or admins can delete reviews"
  ON public.course_reviews
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
