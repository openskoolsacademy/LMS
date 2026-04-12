import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { course_id, coupon_code, event_id, live_bootcamp_id, amount: requestedAmount } = await req.json()
    console.log(`Order Request: course=${course_id}, event=${event_id}, bootcamp=${live_bootcamp_id}, coupon=${coupon_code}`);

    // Retrieve Razorpay keys from environment variables
    // Fallback to the public ID from the frontend if the environment variable is missing
    const key_id = Deno.env.get('RAZORPAY_KEY_ID') || 'rzp_live_SXsCOJNHFUtIJA'
    const key_secret = Deno.env.get('RAZORPAY_KEY_SECRET')

    if (!key_id || !key_secret) {
      console.error('RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is missing.');
      const missing = !key_id ? 'ID' : (!key_secret ? 'Secret' : 'Both');
      throw new Error(`Razorpay ${missing} is missing. Use "npx supabase secrets set RAZORPAY_KEY_SECRET=..."`);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseAnonKey)

    let finalPrice = 0;
    let receiptId = '';

    if (event_id) {
      // ── Event Payment Flow ──
      const { data: event, error: eventError } = await supabase
        .from('events')
        .select('id, title, price')
        .eq('id', event_id)
        .single()

      if (eventError || !event) {
        console.error('Event fetch error:', eventError);
        throw new Error(`Event not found: ${eventError?.message || 'unknown'}`);
      }

      console.log(`Event found: "${event.title}" | Price: ${event.price} | Requested: ${requestedAmount}`);
      // Use the amount from the frontend (already coupon-adjusted) if provided,
      // but never allow it to exceed the actual event price (security check)
      const dbPrice = Math.round(Number(event.price ?? 0));
      const requestedPrice = requestedAmount ? Math.round(requestedAmount / 100) : null;
      if (requestedPrice !== null && requestedPrice <= dbPrice) {
        finalPrice = requestedPrice;
      } else {
        finalPrice = dbPrice;
      }
      receiptId = `rcpt_evt_${event_id.substring(0, 8)}_${Date.now().toString().slice(-6)}`;

    } else if (live_bootcamp_id) {
      // ── Live Bootcamp Payment Flow ──
      const { data: bootcamp, error: bootcampError } = await supabase
        .from('live_bootcamps')
        .select('id, title, price')
        .eq('id', live_bootcamp_id)
        .single()

      if (bootcampError || !bootcamp) {
        console.error('Bootcamp fetch error:', bootcampError);
        throw new Error(`Bootcamp not found: ${bootcampError?.message || 'unknown'}`);
      }

      console.log(`Bootcamp found: "${bootcamp.title}" | Price: ${bootcamp.price} | Requested: ${requestedAmount}`);
      const dbPrice = Math.round(Number(bootcamp.price ?? 0));
      const requestedPrice = requestedAmount ? Math.round(requestedAmount / 100) : null;
      if (requestedPrice !== null && requestedPrice <= dbPrice) {
        finalPrice = requestedPrice;
      } else {
        finalPrice = dbPrice;
      }
      receiptId = `rcpt_bc_${live_bootcamp_id.substring(0, 8)}_${Date.now().toString().slice(-6)}`;

    } else if (course_id) {
      // ── Course Payment Flow (existing) ──
      const { data: course, error: courseError } = await supabase
        .from('courses')
        .select('id, title, regular_price, offer_price, is_coupon_applicable')
        .eq('id', course_id)
        .single()

      if (courseError || !course) {
        console.error('Course fetch error:', courseError);
        throw new Error(`Course not found: ${courseError?.message || 'unknown'}`);
      }

      console.log(`Course found: "${course.title}" | Regular: ${course.regular_price} | Offer: ${course.offer_price}`);

      let basePrice = Number(course.offer_price ?? course.regular_price ?? 0);
      finalPrice = basePrice;

      // Apply coupon logic
      if (coupon_code && course.is_coupon_applicable !== false) {
          const { data: coupon, error: couponError } = await supabase
              .from('coupons')
              .select('*')
              .eq('code', coupon_code.toUpperCase())
              .eq('is_active', true)
              .single()

          if (!couponError && coupon) {
              console.log('Valid coupon found:', coupon.code, 'Value:', coupon.discount_value);
              const isNotExpired = !coupon.expiry_date || new Date(coupon.expiry_date) > new Date();
              const isUnderLimit = !coupon.usage_limit || coupon.used_count < coupon.usage_limit;
              const isCourseMatch = !coupon.course_id || coupon.course_id === course_id;

              if (isNotExpired && isUnderLimit && isCourseMatch) {
                  if (coupon.discount_type === 'percentage') {
                      finalPrice = Math.round(basePrice * (1 - coupon.discount_value / 100));
                  } else {
                      finalPrice = Math.max(0, basePrice - coupon.discount_value);
                  }
                  console.log('New final price after coupon:', finalPrice);
              } else {
                  console.warn('Coupon applied but validation failed:', { isNotExpired, isUnderLimit, isCourseMatch });
              }
          } else if (couponError) {
              console.warn('Coupon fetch error (non-fatal):', couponError.message);
          }
      }

      receiptId = `rcpt_${course_id.substring(0, 8)}_${Date.now().toString().slice(-6)}`;
    } else {
      throw new Error('Either course_id, event_id, or live_bootcamp_id is required');
    }

    if (finalPrice <= 0) finalPrice = 1; 
    const amountInPaise = Math.round(finalPrice * 100);

    // Create order
    const auth = btoa(`${key_id}:${key_secret}`);
    console.log(`Calling Razorpay API: Amount: ${amountInPaise} | Receipt: ${receiptId}`);
    
    let razorpayResponse;
    try {
      razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInPaise,
          currency: 'INR',
          receipt: receiptId
        })
      });
    } catch (fetchErr) {
      console.error('Network Error calling Razorpay:', fetchErr);
      throw new Error(`Failed to connect to Razorpay: ${fetchErr.message}`);
    }

    const order = await razorpayResponse.json();

    if (!razorpayResponse.ok || order.error) {
      console.error('Razorpay API Error:', order.error || order);
      const errorMsg = order.error?.description || order.message || 'Razorpay Order Creation Failed';
      throw new Error(`Razorpay Error: ${errorMsg}`);
    }

    console.log('Order created successfully:', order.id);
    return new Response(
      JSON.stringify(order),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Edge Function Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})


