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

    // 1. Delete from public.users (profile) first
    const { error: profileError } = await supabase
      .from('users')
      .delete()
      .eq('id', user_id)

    if (profileError) {
      console.warn('Profile deletion warning:', profileError.message)
      // Continue even if profile doesn't exist - still need to delete auth
    }

    // 2. Delete from auth.users (this requires service role key)
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
