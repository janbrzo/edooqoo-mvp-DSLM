
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Security utilities
function isValidEmail(email: string): boolean {
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return typeof email === 'string' && email.length <= 254 && EMAIL_REGEX.test(email);
}

function generateSecureToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const timestamp = Date.now().toString(36);
  const randomHex = Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  return `ds_${timestamp}_${randomHex}`;
}

// Rate limiting
class RateLimiter {
  private requests: Map<string, number[]> = new Map();
  
  isAllowed(key: string, maxRequests: number = 5, windowMs: number = 60000): boolean {
    const now = Date.now();
    const requests = this.requests.get(key) || [];
    
    const validRequests = requests.filter(time => now - time < windowMs);
    
    if (validRequests.length >= maxRequests) {
      return false;
    }
    
    validRequests.push(now);
    this.requests.set(key, validRequests);
    
    return true;
  }
}

const rateLimiter = new RateLimiter();

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { sessionId } = await req.json();
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || 'unknown';

    console.log('🔍 VERIFY PAYMENT START - Session ID:', sessionId?.substring(0, 20) + '...');

    // Input validation
    if (!sessionId || typeof sessionId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid session ID' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Rate limiting
    if (!rateLimiter.isAllowed(ip)) {
      console.warn(`Rate limit exceeded for IP: ${ip}`);
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Stripe
    const stripeSecretKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeSecretKey) {
      console.error('Missing Stripe_Secret_Key');
      return new Response(
        JSON.stringify({ error: 'Payment service configuration error' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });

    // Initialize Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Retrieve the session from Stripe
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return new Response(
        JSON.stringify({ error: 'Session not found' }),
        { 
          status: 404, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('💳 STRIPE SESSION STATUS:', session.payment_status);

    // Extract and validate customer email from session
    const customerEmail = session.customer_details?.email || session.customer_email;
    
    if (customerEmail && !isValidEmail(customerEmail)) {
      console.warn('Invalid email format received from Stripe:', customerEmail);
    }

    // Update payment status in database
    const { data: paymentData, error: updateError } = await supabase
      .from('export_payments')
      .update({
        status: session.payment_status === 'paid' ? 'paid' : 'failed',
        stripe_payment_intent_id: session.payment_intent as string,
        user_email: customerEmail && isValidEmail(customerEmail) ? customerEmail : null,
        updated_at: new Date().toISOString(),
      })
      .eq('stripe_session_id', sessionId)
      .select()
      .single();

    if (updateError) {
      console.error('❌ ERROR UPDATING PAYMENT:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update payment status' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('📊 PAYMENT DATA FROM DB:', {
      id: paymentData?.id,
      worksheet_id: paymentData?.worksheet_id,
      status: paymentData?.status,
      amount: paymentData?.amount
    });

    if (session.payment_status === 'paid') {
      // Generate secure download session token
      const sessionToken = generateSecureToken();
      
      const { data: downloadSession, error: sessionError } = await supabase
        .from('download_sessions')
        .insert({
          payment_id: paymentData.id,
          worksheet_id: paymentData.worksheet_id,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        })
        .select()
        .single();

      if (sessionError) {
        console.error('Error creating download session:', sessionError);
        return new Response(
          JSON.stringify({ error: 'Failed to create download session' }),
          { 
            status: 500, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Update worksheet table with customer email if payment successful and email is valid
      if (customerEmail && isValidEmail(customerEmail) && paymentData.worksheet_id) {
        await supabase
          .from('worksheets')
          .update({ 
            user_email: customerEmail,
            updated_at: new Date().toISOString() 
          })
          .eq('id', paymentData.worksheet_id);
      }
      // Track successful payment in user events table
try {
  console.log('Tracking successful payment event');
  await supabase.rpc('track_user_event', {
    p_user_identifier: paymentData.user_identifier || ip,
    p_event_type: 'stripe_payment_success',
    p_event_data: {
      worksheetId: paymentData.worksheet_id,
      sessionId: sessionId,
      amount: paymentData.amount,
      timestamp: new Date().toISOString()
    },
    p_ip_address: ip,
    p_user_agent: req.headers.get('user-agent') || 'unknown',
    p_session_id: null
  });
  console.log('Payment success event tracked successfully');
} catch (trackingError) {
  console.error('Failed to track payment success event:', trackingError);
  // Don't fail the whole request if tracking fails
}


      console.log('✅ DOWNLOAD SESSION CREATED SUCCESSFULLY');

      const responseData = { 
        status: 'paid',
        sessionToken: sessionToken,
        worksheetId: paymentData.worksheet_id,
        paymentId: paymentData.id,
        amount: paymentData.amount,
        expiresAt: downloadSession.expires_at
      };

      console.log('📤 RETURNING RESPONSE DATA:', responseData);

      return new Response(
        JSON.stringify(responseData),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const responseData = { 
      status: session.payment_status,
      worksheetId: paymentData.worksheet_id,
      paymentId: paymentData.id,
      amount: paymentData.amount
    };

    console.log('📤 RETURNING NON-PAID RESPONSE DATA:', responseData);

    return new Response(
      JSON.stringify(responseData),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 ERROR IN VERIFY PAYMENT:', error);
    
    // Sanitized error message
    const sanitizedError = typeof error === 'object' && error !== null ? 
      'Failed to verify payment' : 
      String(error).substring(0, 200);
      
    return new Response(
      JSON.stringify({ error: sanitizedError }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
