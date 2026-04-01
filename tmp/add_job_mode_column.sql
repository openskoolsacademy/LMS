-- Migration to add job_mode column to support Flexible Optional Fields for Careers
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS job_mode text;
