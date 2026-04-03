-- Enable Row Level Security (just in case it wasn't)
ALTER TABLE public.bulk_certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificate_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing public policies if any
DROP POLICY IF EXISTS "Anyone can view bulk_certificates for verification" ON public.bulk_certificates;
DROP POLICY IF EXISTS "Anyone can view certificate_logs for verification" ON public.certificate_logs;

-- Create policies to allow public (unauthenticated) SELECT access
CREATE POLICY "Anyone can view bulk_certificates for verification" ON public.bulk_certificates FOR SELECT USING (true);
CREATE POLICY "Anyone can view certificate_logs for verification" ON public.certificate_logs FOR SELECT USING (true);
