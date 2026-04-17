-- Fix: Grant EXECUTE permission on increment_link_click to anon and authenticated roles
-- This is required for click tracking to work for all users (logged in or not)

GRANT EXECUTE ON FUNCTION public.increment_link_click(UUID) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_link_click(UUID) TO authenticated;
