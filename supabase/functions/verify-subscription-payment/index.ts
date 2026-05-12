import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.18.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Helper function for detailed logging
const logStep = (step, details)=>{
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[${timestamp}] [VERIFY-SUBSCRIPTION] ${step}${detailsStr}`);
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    logStep("Function started");
    const { sessionId } = await req.json();
    logStep("Request data received", {
      sessionId
    });
    if (!sessionId) {
      logStep("ERROR: Missing sessionId");
      return new Response(JSON.stringify({
        error: 'Missing sessionId parameter'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Check Stripe configuration
    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeKey) {
      logStep("ERROR: Stripe secret key not configured");
      return new Response(JSON.stringify({
        error: 'Payment service not configured. Please contact support.'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    logStep("Stripe key verified");
    // Initialize Supabase with service role key
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep("ERROR: No authorization header");
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep("ERROR: User authentication failed", {
        error: userError.message
      });
      return new Response(JSON.stringify({
        error: 'Authentication failed'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const user = userData.user;
    if (!user) {
      logStep("ERROR: No user found");
      return new Response(JSON.stringify({
        error: 'User not found'
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    logStep("User authenticated successfully", {
      userId: user.id,
      email: user.email
    });
    // Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16'
    });
    logStep("Stripe initialized");
    // Retrieve checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Checkout session retrieved", {
      sessionId: session.id,
      paymentStatus: session.payment_status,
      customerId: session.customer
    });
    if (session.payment_status !== 'paid') {
      logStep("ERROR: Payment not completed", {
        paymentStatus: session.payment_status
      });
      return new Response(JSON.stringify({
        error: 'Payment not completed',
        status: session.payment_status
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Get subscription from session metadata
    const planType = session.metadata?.plan_type;
    const monthlyLimit = parseInt(session.metadata?.monthly_limit || '0');
    const price = parseInt(session.metadata?.price || '0');
    if (!planType || !monthlyLimit) {
      logStep("ERROR: Missing subscription metadata", {
        planType,
        monthlyLimit
      });
      return new Response(JSON.stringify({
        error: 'Invalid subscription data'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    logStep("Subscription metadata validated", {
      planType,
      monthlyLimit,
      price
    });
    // Get Stripe subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: session.customer,
      status: 'active',
      limit: 1
    });
    if (subscriptions.data.length === 0) {
      logStep("ERROR: No active subscription found");
      return new Response(JSON.stringify({
        error: 'No active subscription found'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const subscription = subscriptions.data[0];
    logStep("Stripe subscription found", {
      subscriptionId: subscription.id
    });
    // Check if subscription already exists in our database
    const { data: existingSubscription } = await supabaseClient.from('subscriptions').select('*').eq('stripe_subscription_id', subscription.id).single();
    if (existingSubscription) {
      logStep("Subscription already exists in database", {
        existingSubscriptionId: existingSubscription.id
      });
      return new Response(JSON.stringify({
        success: true,
        message: 'Subscription already active',
        subscription: existingSubscription
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // Insert subscription into database
    const { data: newSubscription, error: subscriptionError } = await supabaseClient.from('subscriptions').insert({
      teacher_id: user.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer,
      status: subscription.status,
      plan_type: planType,
      monthly_limit: monthlyLimit,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString()
    }).select().single();
    if (subscriptionError) {
      logStep("ERROR: Failed to insert subscription", {
        error: subscriptionError
      });
      throw subscriptionError;
    }
    logStep("Subscription inserted into database", {
      subscriptionId: newSubscription.id
    });
    // Update user profile
    const subscriptionType = planType === 'side-gig' ? 'Side-Gig Plan' : 'Full-Time Plan';
    const { error: profileError } = await supabaseClient.from('profiles').update({
      subscription_type: subscriptionType,
      subscription_status: 'active',
      subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
      monthly_worksheet_limit: monthlyLimit
    }).eq('id', user.id);
    if (profileError) {
      logStep("ERROR: Failed to update profile", {
        error: profileError
      });
      throw profileError;
    }
    logStep("Profile updated successfully");
    // Add tokens using the existing function
    const { error: tokenError } = await supabaseClient.rpc('add_tokens', {
      p_teacher_id: user.id,
      p_amount: monthlyLimit,
      p_description: `Initial tokens for ${subscriptionType}`,
      p_reference_id: newSubscription.id
    });
    if (tokenError) {
      logStep("ERROR: Failed to add tokens", {
        error: tokenError
      });
      throw tokenError;
    }
    logStep("Tokens added successfully", {
      tokensAdded: monthlyLimit
    });
    return new Response(JSON.stringify({
      success: true,
      message: 'Subscription activated successfully',
      subscription: newSubscription,
      tokensAdded: monthlyLimit
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    logStep("ERROR: Exception caught", {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    return new Response(JSON.stringify({
      error: 'Failed to verify subscription. Please contact support.',
      details: errorMessage
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
