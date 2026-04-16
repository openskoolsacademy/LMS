-- ============================================================
-- Points-to-Discount System Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. POINT REDEMPTIONS TABLE — logs every redemption transaction
CREATE TABLE IF NOT EXISTS public.point_redemptions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  live_bootcamp_id UUID REFERENCES public.live_bootcamps(id) NOT NULL,
  points_used INT NOT NULL CHECK (points_used > 0),
  discount_amount INT NOT NULL CHECK (discount_amount > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE public.point_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own redemptions" ON public.point_redemptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert redemptions" ON public.point_redemptions FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update redemptions" ON public.point_redemptions FOR UPDATE USING (true);

-- 2. ADD points_used COLUMN to live_bootcamp_enrollments
ALTER TABLE public.live_bootcamp_enrollments
  ADD COLUMN IF NOT EXISTS points_used INT DEFAULT 0;

-- 3. FUNCTION: Redeem points (atomic — deducts points and creates pending record)
-- Returns: { success: boolean, redemption_id: uuid, error: text }
CREATE OR REPLACE FUNCTION public.redeem_points(
  p_user_id UUID,
  p_live_bootcamp_id UUID,
  p_points INT,
  p_bootcamp_price INT
)
RETURNS JSONB AS $$
DECLARE
  v_current_points INT;
  v_max_redeemable INT := 3000;
  v_actual_points INT;
  v_discount INT;
  v_redemption_id UUID;
  v_pending_count INT;
BEGIN
  -- Check for existing pending redemptions for this user+bootcamp
  SELECT COUNT(*) INTO v_pending_count 
  FROM public.point_redemptions 
  WHERE user_id = p_user_id 
    AND live_bootcamp_id = p_live_bootcamp_id 
    AND status = 'pending';
  
  IF v_pending_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending redemption for this bootcamp.');
  END IF;

  -- Get current points
  SELECT total_points INTO v_current_points 
  FROM public.user_points 
  WHERE user_id = p_user_id;

  IF v_current_points IS NULL OR v_current_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have no points to redeem.');
  END IF;

  -- Cap at max redeemable (3000)
  v_actual_points := LEAST(p_points, v_current_points, v_max_redeemable);

  -- Cap so final price is at least ₹1
  IF v_actual_points >= p_bootcamp_price THEN
    v_actual_points := p_bootcamp_price - 1;
  END IF;

  IF v_actual_points <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot redeem points. Minimum payment of ₹1 required.');
  END IF;

  -- Discount = points used (1 point = ₹1)
  v_discount := v_actual_points;

  -- Atomically deduct points
  UPDATE public.user_points 
  SET total_points = total_points - v_actual_points, updated_at = NOW()
  WHERE user_id = p_user_id AND total_points >= v_actual_points;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient points balance.');
  END IF;

  -- Create pending redemption record
  INSERT INTO public.point_redemptions (user_id, live_bootcamp_id, points_used, discount_amount, status)
  VALUES (p_user_id, p_live_bootcamp_id, v_actual_points, v_discount, 'pending')
  RETURNING id INTO v_redemption_id;

  RETURN jsonb_build_object(
    'success', true, 
    'redemption_id', v_redemption_id, 
    'points_used', v_actual_points, 
    'discount', v_discount
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FUNCTION: Cancel a pending redemption (restores points)
CREATE OR REPLACE FUNCTION public.cancel_point_redemption(
  p_redemption_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user_id UUID;
  v_points INT;
  v_status TEXT;
BEGIN
  SELECT user_id, points_used, status INTO v_user_id, v_points, v_status
  FROM public.point_redemptions
  WHERE id = p_redemption_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption not found.');
  END IF;

  IF v_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption is not pending.');
  END IF;

  -- Restore points
  UPDATE public.user_points
  SET total_points = total_points + v_points, updated_at = NOW()
  WHERE user_id = v_user_id;

  -- Mark cancellation
  UPDATE public.point_redemptions
  SET status = 'cancelled'
  WHERE id = p_redemption_id;

  RETURN jsonb_build_object('success', true, 'points_restored', v_points);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. FUNCTION: Complete a pending redemption (after successful payment)
CREATE OR REPLACE FUNCTION public.complete_point_redemption(
  p_redemption_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM public.point_redemptions
  WHERE id = p_redemption_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption not found.');
  END IF;

  IF v_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption is not pending.');
  END IF;

  UPDATE public.point_redemptions
  SET status = 'completed', completed_at = NOW()
  WHERE id = p_redemption_id;

  RETURN jsonb_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- END OF MIGRATION
-- ============================================================
