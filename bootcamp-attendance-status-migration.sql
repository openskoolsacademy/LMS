-- ============================================
-- Bootcamp Attendance & Duplication Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ========================
-- 1. Add master_bootcamp_id to live_bootcamps
-- ========================
ALTER TABLE public.live_bootcamps
ADD COLUMN IF NOT EXISTS master_bootcamp_id TEXT;

-- ========================
-- 2. Add attendance logic to live_bootcamp_enrollments
-- ========================
ALTER TABLE public.live_bootcamp_enrollments
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'ENTERED', 'JOINED')),
ADD COLUMN IF NOT EXISTS entered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ;

-- ========================
-- 3. Data Backfill for historical records
-- ========================
-- For enrollees who were marked completed (now JOINED)
UPDATE public.live_bootcamp_enrollments
SET status = 'JOINED',
    joined_at = COALESCE(joined_at, created_at),
    entered_at = COALESCE(entered_at, created_at)
WHERE completed = true AND (status = 'REGISTERED' OR status IS NULL);

-- ========================
-- 4. Create join_bootcamp RPC
-- ========================
CREATE OR REPLACE FUNCTION public.join_bootcamp(
  p_live_bootcamp_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_bootcamp RECORD;
  v_enrollment RECORD;
  v_master_id TEXT;
  v_already_joined BOOLEAN;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Fetch bootcamp details
  SELECT * INTO v_bootcamp FROM public.live_bootcamps WHERE id = p_live_bootcamp_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Bootcamp not found');
  END IF;

  v_master_id := v_bootcamp.master_bootcamp_id;

  -- 1. Check if user is registered for this bootcamp
  SELECT * INTO v_enrollment
  FROM public.live_bootcamp_enrollments
  WHERE user_id = v_user_id AND live_bootcamp_id = p_live_bootcamp_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You must enroll in this bootcamp first',
      'code', 'NOT_REGISTERED'
    );
  END IF;

  -- 2. Check if user joined any bootcamp with the same master_bootcamp_id
  IF v_master_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.live_bootcamp_enrollments be
      JOIN public.live_bootcamps b ON be.live_bootcamp_id = b.id
      WHERE be.user_id = v_user_id
        AND be.status = 'JOINED' 
        AND b.master_bootcamp_id = v_master_id
        AND be.live_bootcamp_id != p_live_bootcamp_id
    ) INTO v_already_joined;

    IF v_already_joined THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'You have already completed this bootcamp',
        'code', 'ALREADY_ATTENDED_MASTER'
      );
    END IF;
  END IF;

  -- 3. Mark ENTERED if they haven't already (or update time)
  IF v_enrollment.status = 'REGISTERED' THEN
    UPDATE public.live_bootcamp_enrollments
    SET status = 'ENTERED',
        entered_at = COALESCE(entered_at, NOW())
    WHERE user_id = v_user_id
      AND live_bootcamp_id = p_live_bootcamp_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully joined the bootcamp session',
    'entered_at', COALESCE(v_enrollment.entered_at, NOW())
  );
END;
$$;

-- ========================
-- 5. Create check_master_bootcamp_attendance RPC
-- ========================
CREATE OR REPLACE FUNCTION public.check_master_bootcamp_attendance(
  p_live_bootcamp_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_master_bootcamp_id TEXT;
  v_already_joined BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('already_attended', false);
  END IF;

  -- Get master_bootcamp_id
  SELECT master_bootcamp_id INTO v_master_bootcamp_id
  FROM public.live_bootcamps WHERE id = p_live_bootcamp_id;

  IF v_master_bootcamp_id IS NULL THEN
    RETURN jsonb_build_object('already_attended', false);
  END IF;

  -- Check if user has JOINED any bootcamp with same master_bootcamp_id
  SELECT EXISTS (
    SELECT 1
    FROM public.live_bootcamp_enrollments be
    JOIN public.live_bootcamps b ON be.live_bootcamp_id = b.id
    WHERE be.user_id = v_user_id
      AND be.status = 'JOINED'
      AND b.master_bootcamp_id = v_master_bootcamp_id
  ) INTO v_already_joined;

  RETURN jsonb_build_object('already_attended', v_already_joined);
END;
$$;
