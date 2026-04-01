-- Migration: Role-Based Pricing & Coupon System
-- Run this in your Supabase SQL Editor

-- 1. Enhance Courses Table with advanced pricing and flags
ALTER TABLE public.courses 
ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS regular_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS offer_price NUMERIC DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_coupon_applicable BOOLEAN DEFAULT true;

-- Sync existing price data to regular_price (one-time migration)
UPDATE public.courses SET regular_price = price WHERE regular_price = 0 AND price > 0;

-- 2. Create Coupons Table
CREATE TABLE IF NOT EXISTS public.coupons (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('percentage', 'flat')),
  discount_value NUMERIC NOT NULL,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE, -- NULL means applicable to all
  expiry_date TIMESTAMP WITH TIME ZONE,
  usage_limit INT DEFAULT NULL,
  used_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

-- 4. Security Policies
-- Allow anyone (public/students) to read active coupons for application at checkout
DROP POLICY IF EXISTS "Anyone can check coupon validity" ON public.coupons;
CREATE POLICY "Anyone can check coupon validity" ON public.coupons 
FOR SELECT 
USING (is_active = true);

-- Restricted management (Admin only)
DROP POLICY IF EXISTS "Only admins can manage coupons" ON public.coupons;
CREATE POLICY "Only admins can manage coupons" ON public.coupons 
FOR ALL 
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
);
