-- Migration: Add experience_level column to jobs table
-- Run this in Supabase SQL Editor

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_level TEXT DEFAULT 'Fresher';

-- Optional: Add a comment for documentation
COMMENT ON COLUMN jobs.experience_level IS 'Experience level: Fresher, Junior, Mid-Level, Senior, Lead, Expert';
