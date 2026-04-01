-- Add impressions and clicks columns to marketing_banners table
-- Run this in Supabase SQL Editor
ALTER TABLE public.marketing_banners ADD COLUMN IF NOT EXISTS impressions INTEGER DEFAULT 0;
ALTER TABLE public.marketing_banners ADD COLUMN IF NOT EXISTS clicks INTEGER DEFAULT 0;
