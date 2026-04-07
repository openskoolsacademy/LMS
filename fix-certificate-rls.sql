-- ==============================================================
-- Fix Certificate Deletion RLS Policies
-- Copy and run this in your Supabase SQL Editor!
-- ==============================================================

-- Enable RLS just in case it isn't enabled
ALTER TABLE public.certificate_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bulk_certificates ENABLE ROW LEVEL SECURITY;

-- 1. Policies for certificate_logs
DROP POLICY IF EXISTS "Admins can manage certificate_logs" ON public.certificate_logs;
CREATE POLICY "Admins can manage certificate_logs" ON public.certificate_logs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );

-- Also ensure students can see their own
DROP POLICY IF EXISTS "Students can view own certificate_logs" ON public.certificate_logs;
CREATE POLICY "Students can view own certificate_logs" ON public.certificate_logs
  FOR SELECT USING (auth.uid() = user_id);

-- Also ensure students can insert their own (if any legacy flow still does it)
DROP POLICY IF EXISTS "Students can insert own certificate_logs" ON public.certificate_logs;
CREATE POLICY "Students can insert own certificate_logs" ON public.certificate_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- 2. Policies for bulk_certificates
DROP POLICY IF EXISTS "Admins can manage bulk_certificates" ON public.bulk_certificates;
CREATE POLICY "Admins can manage bulk_certificates" ON public.bulk_certificates
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin')
  );
