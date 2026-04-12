-- Run this in your Supabase SQL Editor to fix any floating-point price issues 
-- on existing events and bootcamps. It rounds the prices to the nearest integer.

-- Fix prices in events
UPDATE public.events
SET price = ROUND(price::numeric, 2)
WHERE price IS NOT NULL;

-- Fix prices in live_bootcamps
UPDATE public.live_bootcamps
SET price = ROUND(price::numeric, 2)
WHERE price IS NOT NULL;

-- Fix prices in courses
UPDATE public.courses
SET regular_price = ROUND(regular_price::numeric, 2),
    offer_price = ROUND(offer_price::numeric, 2)
WHERE regular_price IS NOT NULL OR offer_price IS NOT NULL;
