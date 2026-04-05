-- ============================================================
-- Quiz Advanced Analytics & Explanation Feature — Migration
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- 1. Add explanation column to questions table
ALTER TABLE daily_quiz_questions
  ADD COLUMN IF NOT EXISTS explanation TEXT;

-- 2. Add answers JSONB column to persist per-question selections
--    (maps questionId -> selectedOptionIndex)
ALTER TABLE daily_quiz_attempts
  ADD COLUMN IF NOT EXISTS answers JSONB;

-- 3. Add time_taken column (total seconds the student took)
ALTER TABLE daily_quiz_attempts
  ADD COLUMN IF NOT EXISTS time_taken INT;
