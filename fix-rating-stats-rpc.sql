-- CORRECTED VERSION: Resolves column ambiguity
-- Run this in your Supabase SQL Editor (SQL Tools tab)

CREATE OR REPLACE FUNCTION public.get_all_course_stats()
RETURNS TABLE(
  rpc_course_id UUID,
  student_count BIGINT,
  review_count BIGINT,
  average_rating NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    c.id as rpc_course_id,
    COALESCE(e.count, 0)::BIGINT as student_count,
    COALESCE(r.count, 0)::BIGINT as review_count,
    COALESCE(r.avg_rating, 0.0)::NUMERIC as average_rating
  FROM public.courses c
  LEFT JOIN (
    SELECT enrollments.course_id, COUNT(*) as count 
    FROM public.enrollments 
    GROUP BY enrollments.course_id
  ) e ON c.id = e.course_id
  LEFT JOIN (
    SELECT course_reviews.course_id, COUNT(*) as count, AVG(rating) as avg_rating 
    FROM public.course_reviews 
    GROUP BY course_reviews.course_id
  ) r ON c.id = r.course_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
