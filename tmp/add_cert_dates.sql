-- Add start_date and end_date columns to certificate_logs table
-- Run this in Supabase SQL Editor
ALTER TABLE public.certificate_logs ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE public.certificate_logs ADD COLUMN IF NOT EXISTS end_date DATE;
