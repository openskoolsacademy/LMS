-- Run this script in your Supabase SQL Editor to add the company_logo column
-- It is required for the new "Company Logo" feature in the Job Creation form.

ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company_logo TEXT;
