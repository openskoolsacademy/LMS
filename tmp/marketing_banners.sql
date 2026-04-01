-- Create the marketing_banners table
CREATE TABLE public.marketing_banners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  subtitle text,
  cta_text text,
  cta_link text,
  image_url text,
  bg_color text DEFAULT 'var(--primary)',
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  display_locations text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT NOW()
);

-- Enable RLS for marketing_banners
ALTER TABLE public.marketing_banners ENABLE ROW LEVEL SECURITY;

-- Allow public read access to all banners (filtering by date/status is done in JS layer for simplicity, or we can enforce it here)
-- Enforcing status = 'active' in DB for extra security
CREATE POLICY "Public can view active banners" ON public.marketing_banners 
  FOR SELECT USING (status = 'active');

-- Allow admins full access
CREATE POLICY "Admins have full access to banners" ON public.marketing_banners 
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );
