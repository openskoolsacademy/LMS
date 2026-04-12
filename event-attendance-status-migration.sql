-- ============================================
-- Event Attendance Status Migration
-- Run this in Supabase SQL Editor
-- ============================================

-- ========================
-- 1. Add new columns to event_attendance
-- ========================
ALTER TABLE public.event_attendance
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'REGISTERED' CHECK (status IN ('REGISTERED', 'ENTERED', 'JOINED')),
ADD COLUMN IF NOT EXISTS entered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ;

-- ========================
-- 2. Data Backfill for historical records
-- ========================
-- For attendees who were already marked fully attended (now JOINED)
UPDATE public.event_attendance
SET status = 'JOINED',
    joined_at = COALESCE(joined_at, join_time, created_at),
    entered_at = COALESCE(entered_at, join_time, created_at)
WHERE attended = true AND (status = 'REGISTERED' OR status IS NULL);

-- For attendees who joined but aren't marked attended yet (now ENTERED)
UPDATE public.event_attendance
SET status = 'ENTERED',
    entered_at = COALESCE(entered_at, join_time, created_at)
WHERE attended = false AND join_time IS NOT NULL AND (status = 'REGISTERED' OR status IS NULL);

-- ========================
-- 3. Replace join_event RPC
-- ========================
CREATE OR REPLACE FUNCTION public.join_event(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_event RECORD;
  v_attendance RECORD;
  v_event_start TIMESTAMPTZ;
  v_event_end TIMESTAMPTZ;
  v_join_window_start TIMESTAMPTZ;
  v_now TIMESTAMPTZ;
  v_master_event_id TEXT;
  v_already_joined BOOLEAN;
BEGIN
  -- Get the authenticated user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
  END IF;

  -- Fetch event details
  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Event not found');
  END IF;

  -- Calculate time boundaries
  v_now := NOW();
  v_event_start := v_event.event_date;
  v_event_end := v_event.event_date + (COALESCE(v_event.duration_minutes, 60) * INTERVAL '1 minute');
  v_join_window_start := v_event_start - INTERVAL '10 minutes';
  v_master_event_id := v_event.master_event_id;

  -- 1. Check if too early
  IF v_now < v_join_window_start THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You can join 10 minutes before event start time',
      'code', 'TOO_EARLY'
    );
  END IF;

  -- 2. Check if event has ended
  IF v_now > v_event_end THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'This event has ended',
      'code', 'EVENT_ENDED'
    );
  END IF;

  -- 3. Check if user is registered for this event
  SELECT * INTO v_attendance
  FROM public.event_attendance
  WHERE user_id = v_user_id AND event_id = p_event_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'You must register for this event first',
      'code', 'NOT_REGISTERED'
    );
  END IF;

  -- 4. Check if user attended any event with the same master_event_id
  IF v_master_event_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.event_attendance ea
      JOIN public.events e ON ea.event_id = e.id
      WHERE ea.user_id = v_user_id
        AND ea.status = 'JOINED' 
        AND e.master_event_id = v_master_event_id
        AND ea.event_id != p_event_id
    ) INTO v_already_joined;

    IF v_already_joined THEN
      RETURN jsonb_build_object(
        'success', false,
        'error', 'You have already attended this event',
        'code', 'ALREADY_ATTENDED_MASTER'
      );
    END IF;
  END IF;

  -- 5. Mark ENTERED if they haven't already
  -- Note: If they are already ENTERED or JOINED, we DO NOT throw an error. 
  -- We just allow them to re-enter!
  IF v_attendance.status = 'REGISTERED' THEN
    UPDATE public.event_attendance
    SET status = 'ENTERED',
        entered_at = COALESCE(entered_at, v_now)
    WHERE user_id = v_user_id
      AND event_id = p_event_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully joined the event',
    'entered_at', COALESCE(v_attendance.entered_at, v_now)
  );
END;
$$;

-- ========================
-- 4. Replace check_master_event_attendance function
-- ========================
CREATE OR REPLACE FUNCTION public.check_master_event_attendance(
  p_event_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_master_event_id TEXT;
  v_already_joined BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('already_attended', false);
  END IF;

  -- Get master_event_id
  SELECT master_event_id INTO v_master_event_id
  FROM public.events WHERE id = p_event_id;

  IF v_master_event_id IS NULL THEN
    RETURN jsonb_build_object('already_attended', false);
  END IF;

  -- Check if user has JOINED any event with same master_event_id
  SELECT EXISTS (
    SELECT 1
    FROM public.event_attendance ea
    JOIN public.events e ON ea.event_id = e.id
    WHERE ea.user_id = v_user_id
      AND ea.status = 'JOINED'
      AND e.master_event_id = v_master_event_id
  ) INTO v_already_joined;

  RETURN jsonb_build_object('already_attended', v_already_joined);
END;
$$;
