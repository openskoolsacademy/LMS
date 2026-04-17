-- ╔═══════════════════════════════════════════════════════════════╗
-- ║  Short Links / Link Converter — Database Schema             ║
-- ╚═══════════════════════════════════════════════════════════════╝

-- 1. Create the short_links table
CREATE TABLE IF NOT EXISTS public.short_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  destination_url TEXT NOT NULL,
  title TEXT,
  clicks INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Enable RLS
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

-- 3. Public can read active short links (needed for redirect)
CREATE POLICY "Anyone can read active short links"
  ON public.short_links FOR SELECT
  USING (is_active = true);

-- 4. Admins can do everything
CREATE POLICY "Admins can manage short links"
  ON public.short_links FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. RPC to atomically increment click count
CREATE OR REPLACE FUNCTION public.increment_short_link_click(link_slug TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.short_links
  SET clicks = clicks + 1
  WHERE slug = link_slug;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Grant execute to all roles
GRANT EXECUTE ON FUNCTION public.increment_short_link_click(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.increment_short_link_click(TEXT) TO authenticated;
