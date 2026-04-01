ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_course_id_fkey;
ALTER TABLE public.payments ADD CONSTRAINT payments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;
