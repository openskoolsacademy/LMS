-- Add instructor bio and image columns to events table
-- Run this in Supabase SQL Editor
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS instructor_bio TEXT;
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS instructor_image TEXT;
