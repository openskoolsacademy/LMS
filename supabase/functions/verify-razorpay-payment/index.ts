import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { createHmac } from "node:crypto"; // Deno supports node built-ins

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { razorpay_payment_id, razorpay_order_id, razorpay_signature, course_id, event_id, live_bootcamp_id, amount } = await req.json()

    // Need user context which is sent via Authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('No authorization header')

    const key_secret = Deno.env.get('RAZORPAY_KEY_SECRET')
    if (!key_secret) throw new Error('Missing Razorpay Key Secret')

    // 1. Verify Razorpay Signature
    console.log(`Verifying Payment: ${razorpay_payment_id} for Order: ${razorpay_order_id}`);
    const generated_signature = createHmac('sha256', key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (generated_signature !== razorpay_signature) {
      console.error('Signature mismatch:', { generated: generated_signature, received: razorpay_signature });
      throw new Error('Invalid payment signature');
    }

    // 2. Initialize Supabase Admin Client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Get the user from the JWT
    const { data: { user }, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid user token')

    if (event_id) {
      // ── Event Payment Flow ──
      // The frontend handles inserting the event_attendance record after this succeeds
      console.log(`Event payment verified for user ${user.id}, event ${event_id}`);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Event payment verified!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    if (live_bootcamp_id) {
      // ── Live Bootcamp Payment Flow ──
      // The frontend handles inserting the live_bootcamp_enrollments record after this succeeds
      console.log(`Bootcamp payment verified for user ${user.id}, bootcamp ${live_bootcamp_id}`);
      
      return new Response(
        JSON.stringify({ success: true, message: 'Bootcamp payment verified!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // ── Course Payment Flow (existing) ──
    // 3. Insert Payment Tracking
    const { error: paymentError } = await supabase.from('payments').insert([{
      user_id: user.id,
      course_id: course_id,
      amount: amount / 100, // convert paise to INR
      status: 'completed'
    }])
    if (paymentError) throw paymentError

    // 4. Enroll User automatically
    const { error: enrollError } = await supabase.from('enrollments').insert([{
      user_id: user.id,
      course_id: course_id
    }])
    // Ignore duplicate enrollments if they hit refresh
    if (enrollError && enrollError.code !== '23505') throw enrollError

    return new Response(
      JSON.stringify({ success: true, message: 'Payment verified and course unlocked!' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
