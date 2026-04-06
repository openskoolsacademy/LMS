-- Migration: Add event_id to coupons table for event-specific coupons
-- Run this in your Supabase SQL Editor

ALTER TABLE public.coupons 
ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES public.events(id) ON DELETE CASCADE;

-- Note: A coupon with both course_id and event_id as NULL applies globally.
-- A coupon with course_id set applies only to that course.
-- A coupon with event_id set applies only to that event.
