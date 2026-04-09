import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { user_id } = await req.json()
    if (!user_id) throw new Error('user_id is required')

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get calling user from JWT
    const { data: { user: caller }, error: callerError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (callerError || !caller) throw new Error('Invalid user token')

    // Verify caller is admin
    const { data: callerProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      throw new Error('Only admins can delete users')
    }

    // Prevent self-deletion
    if (caller.id === user_id) {
      throw new Error('You cannot delete your own account')
    }

    console.log(`Admin ${caller.id} deleting user ${user_id}`)

    // 1. Clean up all dependent records that reference user_id
    // Tables with ON DELETE CASCADE will be handled automatically,
    // but we explicitly clean tables without CASCADE to avoid FK constraint errors
    const userDependentTables = [
      // Tables referencing users(id) WITHOUT ON DELETE CASCADE
      { table: 'payments', column: 'user_id' },
      { table: 'instructor_requests', column: 'user_id' },
      { table: 'notifications', column: 'user_id' },
      { table: 'course_reviews', column: 'user_id' },
      { table: 'certificates', column: 'user_id' },
      { table: 'assessment_attempts', column: 'user_id' },
      { table: 'saved_jobs', column: 'user_id' },
      { table: 'event_attendees', column: 'user_id' },
      { table: 'bootcamp_enrollments', column: 'user_id' },
      { table: 'quiz_attempts', column: 'user_id' },
      { table: 'blogs', column: 'author_id' },
      // Tables with ON DELETE CASCADE (cleaned explicitly for safety)
      { table: 'enrollments', column: 'user_id' },
      { table: 'lesson_completions', column: 'user_id' },
      { table: 'activity_log', column: 'user_id' },
    ]

    // First handle courses owned by this user (instructor)
    // Get their course IDs to clean up course-dependent records
    const { data: userCourses } = await supabase
      .from('courses')
      .select('id')
      .eq('instructor_id', user_id)

    if (userCourses && userCourses.length > 0) {
      const courseIds = userCourses.map((c: any) => c.id)
      console.log(`Cleaning up ${courseIds.length} courses owned by user`)

      // Clean up records that depend on these courses
      const courseDependentTables = [
        'assessment_attempts', 'payments', 'enrollments', 'lessons',
        'course_reviews', 'certificates', 'assessments', 'lesson_completions'
      ]
      for (const table of courseDependentTables) {
        try {
          await supabase.from(table).delete().in('course_id', courseIds)
        } catch (e) {
          console.warn(`Skipping ${table} course cleanup:`, e.message)
        }
      }

      // Now delete the courses themselves
      const { error: coursesError } = await supabase
        .from('courses')
        .delete()
        .eq('instructor_id', user_id)
      if (coursesError) console.warn('Courses deletion warning:', coursesError.message)
    }

    // Clean up jobs created by this user
    try {
      await supabase.from('jobs').delete().eq('created_by', user_id)
    } catch (e) {
      console.warn('Jobs cleanup skipped:', e.message)
    }

    // Clean up all user-dependent records
    for (const { table, column } of userDependentTables) {
      try {
        const { error } = await supabase.from(table).delete().eq(column, user_id)
        if (error) console.warn(`Warning cleaning ${table}:`, error.message)
      } catch (e) {
        console.warn(`Skipping ${table}:`, e.message)
      }
    }

    // 2. Delete from public.users (profile)
    const { error: profileError } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)

    if (profileError) {
      console.warn('Profile deletion warning:', profileError.message)
      // Continue even if profile doesn't exist - still need to delete auth
    }

    // 3. Delete from auth.users (this requires service role key)
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id)
    if (authError) throw authError

    console.log(`User ${user_id} fully deleted from both auth and profile tables`)

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted from both auth and profile' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Delete user error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
