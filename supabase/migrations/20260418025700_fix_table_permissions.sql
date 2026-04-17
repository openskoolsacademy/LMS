-- Fix: Grant SELECT on short_links and link_tree tables to anon and authenticated roles
-- RLS policies define WHICH rows can be accessed, but the role still needs base table permissions

GRANT SELECT ON public.short_links TO anon;
GRANT SELECT ON public.short_links TO authenticated;

GRANT SELECT ON public.link_tree TO anon;
GRANT SELECT ON public.link_tree TO authenticated;
