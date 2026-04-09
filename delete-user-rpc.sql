-- Delete User RPC Function
-- This function allows admins to completely delete a user from both public.users and auth.users
-- It runs with SECURITY DEFINER so it executes with the function owner's privileges (superuser)

CREATE OR REPLACE FUNCTION delete_user_by_admin(target_user_id UUID)
RETURNS JSON AS $$
DECLARE
  caller_role TEXT;
  result JSON;
BEGIN
  -- Verify the caller is an admin
  SELECT role INTO caller_role FROM public.users WHERE id = auth.uid();
  IF caller_role IS NULL OR caller_role != 'admin' THEN
    RETURN json_build_object('error', 'Only admins can delete users');
  END IF;

  -- Prevent self-deletion
  IF auth.uid() = target_user_id THEN
    RETURN json_build_object('error', 'You cannot delete your own account');
  END IF;

  -- 1. Clean up all dependent records (tables WITHOUT ON DELETE CASCADE)

  -- Get course IDs owned by this user (if instructor)
  -- Delete course-dependent records first
  DELETE FROM assessment_attempts WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id);
  DELETE FROM assessment_questions WHERE assessment_id IN (SELECT id FROM assessments WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id));
  DELETE FROM assessments WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id);
  DELETE FROM lesson_completions WHERE lesson_id IN (SELECT id FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id));
  DELETE FROM lessons WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id);
  DELETE FROM payments WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id);
  DELETE FROM enrollments WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id);
  DELETE FROM course_reviews WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id);
  DELETE FROM certificates WHERE course_id IN (SELECT id FROM courses WHERE instructor_id = target_user_id);
  
  -- Delete user's own courses
  DELETE FROM courses WHERE instructor_id = target_user_id;

  -- Delete user-dependent records
  DELETE FROM payments WHERE user_id = target_user_id;
  DELETE FROM enrollments WHERE user_id = target_user_id;
  DELETE FROM lesson_completions WHERE user_id = target_user_id;
  DELETE FROM activity_log WHERE user_id = target_user_id;
  DELETE FROM instructor_requests WHERE user_id = target_user_id;
  DELETE FROM course_reviews WHERE user_id = target_user_id;
  DELETE FROM certificates WHERE user_id = target_user_id;
  DELETE FROM assessment_attempts WHERE user_id = target_user_id;
  
  -- Optional tables (may not exist, wrapped in exception handlers)
  BEGIN DELETE FROM notifications WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM saved_jobs WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM event_attendees WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM bootcamp_enrollments WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM quiz_attempts WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM quiz_scores WHERE user_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM blogs WHERE author_id = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;
  BEGIN DELETE FROM jobs WHERE created_by = target_user_id; EXCEPTION WHEN undefined_table THEN NULL; END;

  -- 2. Delete from public.users
  DELETE FROM public.users WHERE id = target_user_id;

  -- 3. Delete from auth.users (SECURITY DEFINER allows this)
  DELETE FROM auth.users WHERE id = target_user_id;

  RETURN json_build_object('success', true, 'message', 'User deleted from both auth and profile');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
