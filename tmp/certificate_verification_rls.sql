-- Run this script in your Supabase SQL Editor to allow students to generate verifiable certificates

-- Enable RLS and allow students to insert their generated certificates into the public verification table
ALTER TABLE public.bulk_certificates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Students can insert own bulk_certificates" ON public.bulk_certificates;
CREATE POLICY "Students can insert own bulk_certificates" ON public.bulk_certificates 
  FOR INSERT WITH CHECK (true);
