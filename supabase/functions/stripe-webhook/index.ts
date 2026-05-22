import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${timestamp} ${step}${detailsStr}`);
};

const safeTimestamp = (timestamp: number | null | undefined): string => {
  if (!timestamp) {
    console.warn('[STRIPE-WEBHOOK] Missing timestamp, using current time');
    return new Date().toISOString();
  }
  try {
    const date = new Date(timestamp * 1000);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid timestamp: ${timestamp}`);
    }
    return date.toISOString();
  } catch (error) {
    console.error('[STRIPE-WEBHOOK] Timestamp parsing error:', { timestamp, error });
    return new Date().toISOString();
  }
};

// Map amount to plan details
const getPlanDetails = (amount: number): { type: string; limit: number } => {
  switch (amount) {
    case 900: return { type: 'Side-Gig', limit: 15 };
    case 1900: return { type: 'Full-Time 30', limit: 30 };
    case 3900: return { type: 'Full-Time 60', limit: 60 };
    case 5900: return { type: 'Full-Time 90', limit: 90 };
    case 7900: return { type: 'Full-Time 120', limit: 120 };
    default: return { type: 'Unknown', limit: 0 };
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('=== WEBHOOK RECEIVED ===', {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });

    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeKey) {
      logStep('ERROR: Missing Stripe secret key');
      throw new Error('Stripe secret key not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body = await req.text();
    const signature = req.headers.get('stripe-signature');
    
    if (!signature) {
      logStep('ERROR: Missing Stripe signature');
      throw new Error('Missing stripe signature');
    }

    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      logStep('ERROR: Missing webhook secret');
      throw new Error('Missing webhook secret');
    }

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep('Event verified successfully', { type: event.type, id: event.id });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      logStep('ERROR: Webhook signature verification failed', { error: errorMessage });
      throw new Error(`Webhook signature verification failed: ${errorMessage}`);
    }

    // Only process subscription events
    if (!event.type.startsWith('customer.subscription.')) {
      logStep('Ignoring non-subscription event', { eventType: event.type });
      return new Response(JSON.stringify({ received: true, skipped: 'non_subscription_event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // DUPLICATE CHECK: Prevent processing the same Stripe event twice
    const { data: existingEvent } = await supabaseService
      .from('subscription_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .maybeSingle();

    if (existingEvent) {
      logStep('DUPLICATE: Event already processed, skipping', { stripeEventId: event.id });
      return new Response(JSON.stringify({ received: true, skipped: 'duplicate_event' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Get subscription object
    const subscription = event.data.object as Stripe.Subscription;
    
    logStep('Processing subscription event', { 
      subscriptionId: subscription.id,
      customerId: subscription.customer,
      status: subscription.status,
      eventType: event.type,
      cancelAtPeriodEnd: subscription.cancel_at_period_end
    });

    // Get customer details
    const customer = await stripe.customers.retrieve(subscription.customer as string) as Stripe.Customer;
    const email = customer.email;

    if (!email) {
      logStep('ERROR: No email found for customer');
      throw new Error('No email found for customer');
    }

    logStep('Customer found', { email, customerId: customer.id });

    // Find user profile by email
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('id, subscription_type')
      .eq('email', email)
      .single();

    if (profileError || !profile) {
      logStep('ERROR: User profile not found', { email, error: profileError });
      throw new Error(`User profile not found for email: ${email}`);
    }

    logStep('Profile found', { userId: profile.id, currentType: profile.subscription_type });

    // Determine plan type from amount
    const priceId = subscription.items.data[0].price.id;
    const price = await stripe.prices.retrieve(priceId);
    const amount = price.unit_amount || 0;
    const { type: subscriptionType, limit: monthlyLimit } = getPlanDetails(amount);

    logStep('Plan determined', { subscriptionType, monthlyLimit, priceAmount: amount });

    // Determine old and new plan types
    const oldPlanType = profile.subscription_type || 'Free Demo';
    let newPlanType = subscriptionType;
    
    if (event.type === 'customer.subscription.deleted') {
      newPlanType = 'Inactive';
    }

    // RENEWAL DETECTION: Check if this is a subscription renewal
    let isRenewal = false;
    let renewalTokens = 0;
    let finalEventType = event.type;

    if (
      event.type === 'customer.subscription.updated' &&
      oldPlanType === newPlanType &&
      !subscription.cancel_at_period_end &&
      subscription.status === 'active'
    ) {
      // Potential renewal - check it's not an upgrade echo or first-day duplicate
      const { data: recentUpgrade } = await supabaseService
        .from('subscription_events')
        .select('id')
        .eq('teacher_id', profile.id)
        .eq('event_type', 'upgraded')
        .gte('created_at', new Date(Date.now() - 120 * 1000).toISOString()) // 2 minutes
        .limit(1);

      const { data: recentRenewal } = await supabaseService
        .from('subscription_events')
        .select('id')
        .eq('teacher_id', profile.id)
        .eq('event_type', 'subscription_renewed')
        .gte('created_at', new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString()) // 25 days
        .limit(1);

      // Also check for first-day echo: if subscription was created very recently
      const { data: recentCreated } = await supabaseService
        .from('subscription_events')
        .select('id')
        .eq('teacher_id', profile.id)
        .in('event_type', ['customer.subscription.created', 'upgraded', 'downgraded'])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // 24 hours
        .limit(1);

      if (recentUpgrade && recentUpgrade.length > 0) {
        logStep('NOT a renewal: recent upgrade detected within 2 minutes');
      } else if (recentRenewal && recentRenewal.length > 0) {
        logStep('NOT a renewal: already renewed within 25 days');
      } else if (recentCreated && recentCreated.length > 0) {
        logStep('NOT a renewal: subscription created/changed within 24 hours (first-day echo)');
      } else {
        isRenewal = true;
        renewalTokens = monthlyLimit;
        finalEventType = 'subscription_renewed';
        logStep('✓ RENEWAL DETECTED', { plan: subscriptionType, tokens: renewalTokens });
      }
    }

    // If renewal, add tokens via RPC
    if (isRenewal && renewalTokens > 0) {
      const { error: addTokensError } = await supabaseService.rpc('add_tokens', {
        p_teacher_id: profile.id,
        p_amount: renewalTokens,
        p_description: `Monthly renewal - ${subscriptionType}`,
        p_reference_id: null
      });

      if (addTokensError) {
        logStep('ERROR: Failed to add renewal tokens', addTokensError);
        // Don't throw - still log the event, but with 0 tokens
        renewalTokens = 0;
      } else {
        logStep('✓ Renewal tokens added successfully', { amount: renewalTokens });
      }
    }

    // Insert into subscription_events
    const eventInsertResult = await supabaseService
      .from('subscription_events')
      .insert({
        teacher_id: profile.id,
        email: email,
        event_type: finalEventType,
        old_plan_type: oldPlanType,
        new_plan_type: newPlanType,
        tokens_added: renewalTokens,
        stripe_event_id: event.id,
        event_data: {
          subscription_id: subscription.id,
          customer_id: customer.id,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          current_period_start: subscription.current_period_start,
          current_period_end: subscription.current_period_end,
          amount: amount,
          plan_name: subscriptionType
        }
      });

    if (eventInsertResult.error) {
      logStep('CRITICAL ERROR: Failed to insert subscription_events', eventInsertResult.error);
      return new Response(JSON.stringify({ 
        error: 'Failed to log subscription event', 
        details: eventInsertResult.error 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    logStep('✓ Subscription event logged successfully', { 
      eventType: finalEventType, 
      oldPlan: oldPlanType, 
      newPlan: newPlanType,
      tokensAdded: renewalTokens
    });

    // Update profiles and subscriptions tables
    let subscriptionStatus = 'active';
    let finalSubscriptionType = subscriptionType;
    
    if (event.type === 'customer.subscription.updated' && subscription.cancel_at_period_end) {
      subscriptionStatus = 'active_cancelled';
    } else if (event.type === 'customer.subscription.deleted') {
      subscriptionStatus = 'cancelled';
      finalSubscriptionType = 'Inactive';
    }

    // Update profiles table
    const { error: profileUpdateError } = await supabaseService
      .from('profiles')
      .update({
        subscription_type: finalSubscriptionType,
        subscription_status: subscriptionStatus,
        monthly_worksheet_limit: event.type === 'customer.subscription.deleted' ? 0 : monthlyLimit,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (profileUpdateError) {
      logStep('WARNING: Failed to update profiles table', profileUpdateError);
    } else {
      logStep('✓ Profiles table updated', { 
        subscriptionType: finalSubscriptionType, 
        subscriptionStatus 
      });
    }

    // Update subscriptions table
    const subscriptionUpsertData = {
      teacher_id: profile.id,
      email: email,
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      subscription_type: finalSubscriptionType,
      subscription_status: subscriptionStatus,
      monthly_limit: event.type === 'customer.subscription.deleted' ? 0 : monthlyLimit,
      current_period_start: safeTimestamp(subscription.current_period_start),
      current_period_end: safeTimestamp(subscription.current_period_end),
      updated_at: new Date().toISOString()
    };

    const { error: subscriptionUpdateError } = await supabaseService
      .from('subscriptions')
      .upsert(subscriptionUpsertData, { 
        onConflict: 'stripe_subscription_id',
        ignoreDuplicates: false 
      });

    if (subscriptionUpdateError) {
      logStep('WARNING: Failed to update subscriptions table', subscriptionUpdateError);
    } else {
      logStep('✓ Subscriptions table updated', { 
        subscriptionType: finalSubscriptionType, 
        subscriptionStatus,
        subscriptionId: subscription.id
      });
    }

    logStep('Webhook processing completed successfully', {
      eventType: finalEventType,
      subscriptionId: subscription.id,
      email: email,
      isRenewal,
      tokensAdded: renewalTokens
    });

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    logStep('WEBHOOK ERROR', { 
      message: error.message, 
      stack: error.stack?.split('\n').slice(0, 3) 
    });
    
    return new Response(JSON.stringify({ 
      error: 'Webhook processing failed', 
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
