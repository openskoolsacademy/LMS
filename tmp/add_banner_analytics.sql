-- Create RPC functions for atomic banner analytics increment
-- Run this in Supabase SQL Editor

CREATE OR REPLACE FUNCTION increment_banner_impressions(banner_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.marketing_banners 
  SET impressions = COALESCE(impressions, 0) + 1 
  WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION increment_banner_clicks(banner_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.marketing_banners 
  SET clicks = COALESCE(clicks, 0) + 1 
  WHERE id = banner_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
