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
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: 'user_id is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get calling user from JWT
    const { data: { user: caller }, error: callerError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (callerError || !caller) {
      return new Response(
        JSON.stringify({ error: 'Invalid user token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Verify caller is admin
    const { data: callerProfile } = await supabase
      .from('users')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Only admins can delete users' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Prevent self-deletion
    if (caller.id === user_id) {
      return new Response(
        JSON.stringify({ error: 'You cannot delete your own account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`Admin ${caller.id} deleting user ${user_id}`)
    const warnings: string[] = []

    // 1. Clean up all dependent records that reference user_id
    // Handle courses owned by this user (instructor) first
    const { data: userCourses } = await supabase
      .from('courses')
      .select('id')
      .eq('instructor_id', user_id)

    if (userCourses && userCourses.length > 0) {
      const courseIds = userCourses.map((c: any) => c.id)
      console.log(`Cleaning up ${courseIds.length} courses owned by user`)

      // Clean up records that depend on these courses
      const courseDependentTables = [
        'assessment_attempts', 'assessment_questions', 'assessments',
        'payments', 'enrollments', 'lesson_completions', 'lessons',
        'course_reviews', 'certificates'
      ]
      for (const table of courseDependentTables) {
        try {
          const { error } = await supabase.from(table).delete().in('course_id', courseIds)
          if (error) warnings.push(`${table} (course): ${error.message}`)
        } catch (e) {
          warnings.push(`${table} (course): ${e.message}`)
        }
      }

      // Delete the courses themselves
      try {
        const { error } = await supabase.from('courses').delete().eq('instructor_id', user_id)
        if (error) warnings.push(`courses: ${error.message}`)
      } catch (e) {
        warnings.push(`courses: ${e.message}`)
      }
    }

    // Clean up all user-dependent records across all tables
    const userDependentTables = [
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
      { table: 'quiz_scores', column: 'user_id' },
      { table: 'blogs', column: 'author_id' },
      { table: 'jobs', column: 'created_by' },
      { table: 'enrollments', column: 'user_id' },
      { table: 'lesson_completions', column: 'user_id' },
      { table: 'activity_log', column: 'user_id' },
    ]

    for (const { table, column } of userDependentTables) {
      try {
        const { error } = await supabase.from(table).delete().eq(column, user_id)
        if (error) {
          warnings.push(`${table}: ${error.message}`)
          console.warn(`Warning cleaning ${table}:`, error.message)
        }
      } catch (e) {
        warnings.push(`${table}: ${e.message}`)
      }
    }

    // 2. Delete from public.users (profile)
    const { error: profileError } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)

    if (profileError) {
      console.error('Profile deletion failed:', profileError.message)
      return new Response(
        JSON.stringify({ error: `Failed to delete user profile: ${profileError.message}`, warnings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 3. Delete from auth.users (this requires service role key)
    const { error: authError } = await supabase.auth.admin.deleteUser(user_id)
    if (authError) {
      console.error('Auth deletion failed:', authError.message)
      return new Response(
        JSON.stringify({ error: `Profile deleted but failed to delete from auth: ${authError.message}`, warnings }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    console.log(`User ${user_id} fully deleted from both auth and profile tables`)

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted from both auth and profile', warnings }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Delete user unexpected error:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
