-- =====================================================
-- Quiz Scheduling Migration
-- Run this once in your Supabase SQL editor
-- =====================================================

-- 1. Add scheduled_at column to daily_quizzes
ALTER TABLE daily_quizzes
  ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 2. Backfill existing rows so scheduled_at is not null
UPDATE daily_quizzes
SET scheduled_at = (quiz_date::TIMESTAMP AT TIME ZONE 'Asia/Kolkata')
WHERE scheduled_at IS NULL;
