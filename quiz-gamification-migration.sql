-- ============================================================
-- Open Skools — Daily Quiz Challenge Gamification Migration
-- Run this entire script in the Supabase SQL Editor
-- ============================================================

-- 1. DAILY QUIZZES TABLE (one quiz per date, created by admin)
CREATE TABLE IF NOT EXISTS public.daily_quizzes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'Daily Quiz Challenge',
  quiz_date DATE NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.daily_quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view daily quizzes" ON public.daily_quizzes FOR SELECT USING (true);
CREATE POLICY "Admins can manage daily quizzes" ON public.daily_quizzes FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 2. DAILY QUIZ QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.daily_quiz_questions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  quiz_id UUID REFERENCES public.daily_quizzes(id) ON DELETE CASCADE NOT NULL,
  question_text TEXT NOT NULL,
  options TEXT[] NOT NULL,
  correct_option INT NOT NULL, -- 0-indexed
  order_index INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.daily_quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view quiz questions" ON public.daily_quiz_questions FOR SELECT USING (true);
CREATE POLICY "Admins can manage quiz questions" ON public.daily_quiz_questions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);

-- 3. USER POINTS TABLE
CREATE TABLE IF NOT EXISTS public.user_points (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  total_points INT DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all points for leaderboard" ON public.user_points FOR SELECT USING (true);
CREATE POLICY "Users can insert own points row" ON public.user_points FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own points" ON public.user_points FOR UPDATE USING (auth.uid() = user_id);

-- 4. DAILY QUIZ ATTEMPTS TABLE (one per user per day)
CREATE TABLE IF NOT EXISTS public.daily_quiz_attempts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  quiz_date DATE NOT NULL DEFAULT CURRENT_DATE,
  score INT DEFAULT 0,          -- percentage 0-100
  correct_count INT DEFAULT 0,
  total_questions INT DEFAULT 10,
  points_earned INT DEFAULT 0,
  streak_bonus INT DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, quiz_date)
);

ALTER TABLE public.daily_quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view all attempts for leaderboard" ON public.daily_quiz_attempts FOR SELECT USING (true);
CREATE POLICY "Users can insert own attempts" ON public.daily_quiz_attempts FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 5. USER STREAKS TABLE
CREATE TABLE IF NOT EXISTS public.user_streaks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  current_streak INT DEFAULT 0,
  longest_streak INT DEFAULT 0,
  last_quiz_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view streaks for leaderboard" ON public.user_streaks FOR SELECT USING (true);
CREATE POLICY "Users can insert own streak row" ON public.user_streaks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streak" ON public.user_streaks FOR UPDATE USING (auth.uid() = user_id);

-- 6. USER REWARDS TABLE
CREATE TABLE IF NOT EXISTS public.user_rewards (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  reward_type TEXT NOT NULL, -- 'bronze', 'silver', 'gold', 'platinum', 'legend', 'streak_3', 'streak_7', 'streak_30'
  reward_label TEXT NOT NULL,
  points_required INT DEFAULT 0,
  unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notified BOOLEAN DEFAULT false,
  UNIQUE(user_id, reward_type)
);

ALTER TABLE public.user_rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own rewards" ON public.user_rewards FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert rewards" ON public.user_rewards FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update rewards" ON public.user_rewards FOR UPDATE USING (true);

-- 7. LEADERBOARD PUBLIC VIEW (exposes name, points, streak — no PII)
CREATE OR REPLACE VIEW public.leaderboard_view AS
SELECT
  up.user_id,
  u.name,
  u.avatar_url,
  up.total_points,
  COALESCE(us.current_streak, 0) AS current_streak,
  COALESCE(us.longest_streak, 0) AS longest_streak,
  up.updated_at
FROM public.user_points up
JOIN public.users u ON u.id = up.user_id
LEFT JOIN public.user_streaks us ON us.user_id = up.user_id
ORDER BY up.total_points DESC;

-- 8. FUNCTION: Award points and update streak after quiz attempt
CREATE OR REPLACE FUNCTION public.process_quiz_attempt()
RETURNS TRIGGER AS $$
DECLARE
  v_streak INT := 0;
  v_bonus INT := 0;
  v_last_date DATE;
  v_new_streak INT := 1;
  v_longest INT := 0;
  v_total_points INT := 0;
  v_reward_unlocked TEXT := NULL;
BEGIN
  -- ── Step 1: Update / create streak ──────────────────────
  SELECT current_streak, longest_streak, last_quiz_date
  INTO v_streak, v_longest, v_last_date
  FROM public.user_streaks WHERE user_id = NEW.user_id;

  IF NOT FOUND THEN
    -- First time
    v_new_streak := 1;
    v_longest := 1;
    INSERT INTO public.user_streaks (user_id, current_streak, longest_streak, last_quiz_date)
    VALUES (NEW.user_id, 1, 1, NEW.quiz_date);
  ELSE
    IF v_last_date = NEW.quiz_date - INTERVAL '1 day' THEN
      -- Consecutive day
      v_new_streak := v_streak + 1;
    ELSIF v_last_date = NEW.quiz_date THEN
      -- Same day, already counted
      v_new_streak := v_streak;
    ELSE
      -- Streak broken
      v_new_streak := 1;
    END IF;
    v_longest := GREATEST(v_longest, v_new_streak);
    UPDATE public.user_streaks
    SET current_streak = v_new_streak, longest_streak = v_longest, last_quiz_date = NEW.quiz_date, updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;

  -- ── Step 2: Calculate streak bonus ──────────────────────
  v_bonus := 0;
  IF v_new_streak = 3 THEN v_bonus := 20; END IF;
  IF v_new_streak = 7 THEN v_bonus := 50; END IF;
  IF v_new_streak = 30 THEN v_bonus := 200; END IF;

  -- ── Step 3: Update the attempt with streak bonus ─────────
  UPDATE public.daily_quiz_attempts
  SET streak_bonus = v_bonus
  WHERE id = NEW.id;

  -- ── Step 4: Upsert user_points ───────────────────────────
  INSERT INTO public.user_points (user_id, total_points, updated_at)
  VALUES (NEW.user_id, NEW.points_earned + v_bonus, NOW())
  ON CONFLICT (user_id) DO UPDATE
  SET total_points = public.user_points.total_points + NEW.points_earned + v_bonus,
      updated_at = NOW();

  -- ── Step 5: Check reward milestones ──────────────────────
  SELECT total_points INTO v_total_points FROM public.user_points WHERE user_id = NEW.user_id;

  IF v_total_points >= 100 THEN
    INSERT INTO public.user_rewards (user_id, reward_type, reward_label, points_required) 
    VALUES (NEW.user_id, 'bronze', 'Bronze Learner', 100)
    ON CONFLICT (user_id, reward_type) DO NOTHING;
  END IF;
  IF v_total_points >= 300 THEN
    INSERT INTO public.user_rewards (user_id, reward_type, reward_label, points_required) 
    VALUES (NEW.user_id, 'silver', 'Silver Scholar', 300)
    ON CONFLICT (user_id, reward_type) DO NOTHING;
  END IF;
  IF v_total_points >= 700 THEN
    INSERT INTO public.user_rewards (user_id, reward_type, reward_label, points_required) 
    VALUES (NEW.user_id, 'gold', 'Gold Champion', 700)
    ON CONFLICT (user_id, reward_type) DO NOTHING;
  END IF;
  IF v_total_points >= 1500 THEN
    INSERT INTO public.user_rewards (user_id, reward_type, reward_label, points_required) 
    VALUES (NEW.user_id, 'platinum', 'Platinum Elite', 1500)
    ON CONFLICT (user_id, reward_type) DO NOTHING;
  END IF;
  IF v_total_points >= 3000 THEN
    INSERT INTO public.user_rewards (user_id, reward_type, reward_label, points_required) 
    VALUES (NEW.user_id, 'legend', 'Legend', 3000)
    ON CONFLICT (user_id, reward_type) DO NOTHING;
  END IF;

  -- Streak milestone rewards
  IF v_new_streak >= 3 THEN
    INSERT INTO public.user_rewards (user_id, reward_type, reward_label, points_required) 
    VALUES (NEW.user_id, 'streak_3', '3-Day Streak', 0)
    ON CONFLICT (user_id, reward_type) DO NOTHING;
  END IF;
  IF v_new_streak >= 7 THEN
    INSERT INTO public.user_rewards (user_id, reward_type, reward_label, points_required) 
    VALUES (NEW.user_id, 'streak_7', '7-Day Streak', 0)
    ON CONFLICT (user_id, reward_type) DO NOTHING;
  END IF;
  IF v_new_streak >= 30 THEN
    INSERT INTO public.user_rewards (user_id, reward_type, reward_label, points_required) 
    VALUES (NEW.user_id, 'streak_30', '30-Day Streak', 0)
    ON CONFLICT (user_id, reward_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach trigger
DROP TRIGGER IF EXISTS on_quiz_attempt_inserted ON public.daily_quiz_attempts;
CREATE TRIGGER on_quiz_attempt_inserted
  AFTER INSERT ON public.daily_quiz_attempts
  FOR EACH ROW EXECUTE PROCEDURE public.process_quiz_attempt();

-- ============================================================
-- DONE — 6 tables + 1 view + 1 trigger function created
-- ============================================================

-- ============================================================
-- ADDENDUM: Quiz Referral System
-- ============================================================

-- 9. QUIZ REFERRALS TABLE — tracks who invited whom
CREATE TABLE IF NOT EXISTS public.quiz_referrals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  referrer_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  referred_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  quiz_date DATE NOT NULL DEFAULT CURRENT_DATE,
  referral_token TEXT NOT NULL, -- = referrer_id for simplicity (can be hashed later)
  status TEXT NOT NULL DEFAULT 'clicked', -- clicked | attempted | completed
  clicked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  attempted_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(referrer_id, referred_user_id, quiz_date)
);

ALTER TABLE public.quiz_referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Referrers can view own referrals" ON public.quiz_referrals
  FOR SELECT USING (auth.uid() = referrer_id);
CREATE POLICY "Anyone can insert referral click" ON public.quiz_referrals
  FOR INSERT WITH CHECK (true);
CREATE POLICY "System can update referral status" ON public.quiz_referrals
  FOR UPDATE USING (true);

-- ============================================================
-- END OF MIGRATION
-- ============================================================
