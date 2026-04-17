-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  Link Tree — Database Schema                                ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- 1. Create the link_tree table
CREATE TABLE IF NOT EXISTS public.link_tree (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon_name TEXT DEFAULT 'FiExternalLink',
  is_active BOOLEAN DEFAULT true,
  order_index INTEGER DEFAULT 0,
  clicks INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.link_tree ENABLE ROW LEVEL SECURITY;

-- 3. Public can read active links
CREATE POLICY "Anyone can read active links"
  ON public.link_tree FOR SELECT
  USING (is_active = true);

-- 4. Admins can do everything (uses the users table role)
CREATE POLICY "Admins can manage links"
  ON public.link_tree FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. RPC to atomically increment click count
CREATE OR REPLACE FUNCTION public.increment_link_click(link_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.link_tree
  SET clicks = clicks + 1
  WHERE id = link_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
