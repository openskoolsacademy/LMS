-- ============================================================
-- Points-to-Discount: Add support for Recorded Courses
-- Run this AFTER points-redemption-migration.sql
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Make live_bootcamp_id nullable and add course_id column
ALTER TABLE public.point_redemptions 
  ALTER COLUMN live_bootcamp_id DROP NOT NULL;

ALTER TABLE public.point_redemptions
  ADD COLUMN IF NOT EXISTS course_id UUID REFERENCES public.courses(id);

-- 2. Update the redeem_points function to accept course_id as well
-- The p_live_bootcamp_id parameter now serves as a generic product_id
-- We keep the same function signature for backward compatibility
CREATE OR REPLACE FUNCTION public.redeem_points(
  p_user_id UUID,
  p_live_bootcamp_id UUID,
  p_points INT,
  p_bootcamp_price INT
)
RETURNS JSONB AS $$
DECLARE
  v_current_points INT;
  v_actual_points INT;
  v_discount INT;
  v_redemption_id UUID;
  v_pending_count INT;
BEGIN
  -- Check for existing pending redemptions for this user + product
  SELECT COUNT(*) INTO v_pending_count 
  FROM public.point_redemptions 
  WHERE user_id = p_user_id 
    AND (live_bootcamp_id = p_live_bootcamp_id OR course_id = p_live_bootcamp_id)
    AND status = 'pending';
  
  IF v_pending_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending redemption.');
  END IF;

  -- Get current points
  SELECT total_points INTO v_current_points 
  FROM public.user_points 
  WHERE user_id = p_user_id;

  IF v_current_points IS NULL OR v_current_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have no points to redeem.');
  END IF;

  -- Cap at requested points and available balance
  -- The max limit (3000 for bootcamps, 100 for courses) is enforced client-side
  v_actual_points := LEAST(p_points, v_current_points);

  -- Cap so final price is at least 1
  IF v_actual_points >= p_bootcamp_price THEN
    v_actual_points := p_bootcamp_price - 1;
  END IF;

  IF v_actual_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot redeem points. Minimum payment of ₹1 required.');
  END IF;

  v_discount := v_actual_points;

  -- Atomically deduct points
  UPDATE public.user_points 
  SET total_points = total_points - v_actual_points, updated_at = NOW()
  WHERE user_id = p_user_id AND total_points >= v_actual_points;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points balance.');
  END IF;

  -- Check if product is a bootcamp or a course, insert accordingly
  -- Try bootcamp first, fallback to course_id
  IF EXISTS (SELECT 1 FROM public.live_bootcamps WHERE id = p_live_bootcamp_id) THEN
    INSERT INTO public.point_redemptions (user_id, live_bootcamp_id, points_used, discount_amount, status)
    VALUES (p_user_id, p_live_bootcamp_id, v_actual_points, v_discount, 'pending')
    RETURNING id INTO v_redemption_id;
  ELSE
    INSERT INTO public.point_redemptions (user_id, course_id, points_used, discount_amount, status)
    VALUES (p_user_id, p_live_bootcamp_id, v_actual_points, v_discount, 'pending')
    RETURNING id INTO v_redemption_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'redemption_id', v_redemption_id, 
    'points_used', v_actual_points, 
    'discount', v_discount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
