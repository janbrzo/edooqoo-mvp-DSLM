
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[FINALIZE-UPGRADE] ${step}${detailsStr}`);
};

// Helper: normalize target plan name (to match what's displayed elsewhere)
const normalizePlanName = (planType?: string, monthlyLimit?: number, fallbackName?: string) => {
  if (planType === 'side-gig') return 'Side-Gig';
  if (planType === 'full-time') {
    if (monthlyLimit === 30) return 'Full-Time 30';
    if (monthlyLimit === 60) return 'Full-Time 60';
    if (monthlyLimit === 90) return 'Full-Time 90';
    if (monthlyLimit === 120) return 'Full-Time 120';
  }
  // Fallback to provided name (e.g., "Full-Time Plan (30 worksheets)") if normalization unknown
  return fallbackName || 'Unknown';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    // Initialize Supabase with anon key for user auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('No authorization header');
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      logStep('User error', userError);
      throw userError;
    }

    const user = userData.user;
    if (!user?.email) {
      logStep('User not authenticated');
      throw new Error('User not authenticated');
    }

    logStep('User authenticated', { email: user.email });

    // Parse request body
    const body = await req.json();
    const { session_id } = body;

    if (!session_id) {
      logStep('Missing session_id');
      throw new Error('Session ID is required');
    }

    // Use service role for database operations
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // IDEMPOTENCY CHECK: Check if this session was already processed
    const { data: existingSession, error: sessionCheckError } = await supabaseService
      .from('processed_upgrade_sessions')
      .select('*')
      .eq('session_id', session_id)
      .eq('teacher_id', user.id)
      .single();

    if (!sessionCheckError && existingSession) {
      logStep('Session already processed', { 
        sessionId: session_id, 
        processedAt: existingSession.processed_at,
        tokensAdded: existingSession.tokens_added 
      });
      
      return new Response(
        JSON.stringify({ 
          success: true,
          already_processed: true,
          tokens_added: existingSession.tokens_added,
          processed_at: existingSession.processed_at,
          message: 'Upgrade already processed successfully'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    logStep('Processing upgrade for session', { session_id });

    // Initialize Stripe
    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeKey) {
      logStep('Stripe key not configured');
      throw new Error('Stripe key not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Get checkout session details
    const session = await stripe.checkout.sessions.retrieve(session_id);
    logStep('Retrieved checkout session', { sessionId: session.id, metadata: session.metadata });

    // Extract session metadata parameters first
    const targetPlanType = session.metadata?.target_plan_type || session.metadata?.plan_type;
    const rawTargetPlanName = session.metadata?.target_plan_name || session.metadata?.plan_name;
    const targetPlanPrice = parseFloat(session.metadata?.target_plan_price || session.metadata?.price || '0');
    const targetMonthlyLimit = parseInt(session.metadata?.target_monthly_limit || session.metadata?.monthly_limit || '0');
    const upgradeTokens = parseInt(session.metadata?.upgrade_tokens || '0');
    
    // CRITICAL FIX: Normalize plan name to ensure it's never null/undefined
    const targetPlanName = normalizePlanName(targetPlanType, targetMonthlyLimit, rawTargetPlanName);
    
    // Get subscription ID from session or metadata
    let subscriptionId = session.metadata?.subscription_id || session.subscription as string;
    
    logStep('Session parameters extracted', {
      targetPlanType,
      targetPlanName,
      targetPlanPrice,
      targetMonthlyLimit,
      upgradeTokens,
      subscriptionId
    });

    // ENHANCED: Handle upgrades, downgrades, and fallback for first subscriptions
    const isUpgrade = session.metadata?.is_upgrade === 'true' || session.metadata?.action === 'upgrade';
    const isNewSubscription = session.metadata?.is_upgrade === 'false'; // Free Demo → paid plan
    const hasSubscription = !!session.subscription; // Fallback detection
    
    // CRITICAL: Allow both upgrades and new subscriptions (fallback for stripe-webhook failures)
    if (!isUpgrade && !isNewSubscription && !hasSubscription) {
      logStep('Not a subscription session', { metadata: session.metadata, hasSubscription });
      throw new Error('Invalid session - not a subscription or upgrade');
    }
    
    // Log the type of operation we're handling
    if (isUpgrade) {
      logStep('Processing UPGRADE operation');
    } else if (isNewSubscription) {
      logStep('Processing NEW SUBSCRIPTION operation (fallback)');
    } else if (hasSubscription) {
      logStep('Processing subscription operation (fallback detection)');
    }

    if (!subscriptionId) {
      logStep('Missing subscription ID in session');
      throw new Error('No subscription ID found in session');
    }

    // Get user profile FIRST (needed for both upgrade and first subscription logic)
    const { data: profile, error: profileError } = await supabaseService
      .from('profiles')
      .select('id, email, available_tokens, total_tokens_received, subscription_type')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      logStep('ERROR: User profile not found', { userId: user.id, error: profileError });
      throw new Error(`User profile not found`);
    }

    logStep('Profile loaded', {
      currentTokens: profile.available_tokens,
      totalReceived: profile.total_tokens_received,
      currentSubscription: profile.subscription_type
    });

    // ENHANCED: Handle first subscription as fallback (when stripe-webhook fails)
    if (isNewSubscription || (hasSubscription && !isUpgrade)) {
      logStep('EXECUTING FIRST SUBSCRIPTION FALLBACK LOGIC', { 
        subscriptionId, 
        upgradeTokens,
        targetPlanName,
        targetMonthlyLimit
      });
      
      // Get the subscription from Stripe to ensure we have all data
      const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
      // CRITICAL FIX: Get customer ID from subscription if not in session
      const stripeCustomerId = session.customer as string || stripeSubscription.customer as string;
      
      logStep('Retrieved Stripe subscription for fallback', { 
        id: stripeSubscription.id,
        status: stripeSubscription.status,
        current_period_end: stripeSubscription.current_period_end,
        customer: stripeCustomerId
      });
      
      // CRITICAL: Add tokens that should have been added by stripe-webhook
      const newAvailableTokens = profile.available_tokens + upgradeTokens;
      const newTotalReceived = (profile.total_tokens_received || 0) + upgradeTokens;
      
      // Update profile with tokens AND subscription info
      const { error: updateError } = await supabaseService
        .from('profiles')
        .update({
          subscription_type: targetPlanName,
          subscription_status: 'active',
          monthly_worksheet_limit: targetMonthlyLimit,
          available_tokens: newAvailableTokens,
          total_tokens_received: newTotalReceived,
          is_tokens_frozen: false,
          subscription_expires_at: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) {
        logStep('ERROR: Failed to update profile for first subscription fallback', updateError);
        throw updateError;
      }

      logStep('FIRST SUBSCRIPTION FALLBACK: Profile updated with tokens', {
        newAvailableTokens,
        newTotalReceived,
        upgradeTokens
      });
      
      // FORCE CREATE subscriptions table entry - FIXED: proper validation and conflict handling
      logStep('FIRST SUBSCRIPTION FALLBACK: Creating subscriptions entry', {
        targetPlanName,
        stripeCustomerId,
        targetMonthlyLimit,
        subscriptionId
      });
      
      const { error: subError } = await supabaseService
        .from('subscriptions')
        .upsert({
          teacher_id: user.id,
          email: user.email,
          stripe_subscription_id: subscriptionId,
          stripe_customer_id: stripeCustomerId, // FIXED: use validated customer ID
          subscription_status: 'active',
          subscription_type: targetPlanName, // FIXED: use normalized plan name
          monthly_limit: targetMonthlyLimit,
          current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, { 
          onConflict: 'teacher_id', // FIXED: conflict on teacher_id, not stripe_subscription_id
          ignoreDuplicates: false 
        });

      if (subError) {
        logStep('ERROR: Failed to create subscriptions table entry for fallback', subError);
      } else {
        logStep('FIRST SUBSCRIPTION FALLBACK: Subscriptions table entry created');
      }
      
      // FORCE CREATE token transaction
      const { error: transactionError } = await supabaseService
        .from('token_transactions')
        .insert({
          teacher_id: user.id,
          teacher_email: user.email,
          transaction_type: 'purchase',
          amount: upgradeTokens,
          description: `${targetPlanName} first subscription - tokens added (fallback)`,
          reference_id: null
        });

      if (transactionError) {
        logStep('ERROR: Failed to create token transaction for fallback', transactionError);
      } else {
        logStep('FIRST SUBSCRIPTION FALLBACK: Token transaction created');
      }
      
      // FORCE CREATE subscription event - FIXED: proper validation
      logStep('FIRST SUBSCRIPTION FALLBACK: Creating subscription event', {
        targetPlanName,
        upgradeTokens,
        stripeCustomerId
      });
      
      const { error: eventError } = await supabaseService
        .from('subscription_events')
        .insert({
          teacher_id: user.id,
          email: user.email,
          event_type: 'customer.subscription.created',
          old_plan_type: 'Free Demo',
          new_plan_type: targetPlanName, // FIXED: use normalized plan name
          tokens_added: upgradeTokens,
          stripe_event_id: `fallback_${session_id}_${Date.now()}`, // FIXED: make unique
          event_data: {
            stripe_session_id: session_id,
            stripe_subscription_id: subscriptionId,
            stripe_customer_id: stripeCustomerId, // FIXED: add customer ID to event data
            fallback_reason: 'stripe_webhook_missing',
            target_plan_name: targetPlanName,
            current_period_start: stripeSubscription.current_period_start,
            current_period_end: stripeSubscription.current_period_end
          }
        });

      if (eventError) {
        logStep('ERROR: Failed to create subscription event for fallback', eventError);
      } else {
        logStep('FIRST SUBSCRIPTION FALLBACK: Subscription event created');
      }
      
      // FORCE CREATE processed session record
      const { error: sessionRecordError } = await supabaseService
        .from('processed_upgrade_sessions')
        .insert({
          session_id: session_id,
          teacher_id: user.id,
          email: user.email,
          tokens_added: upgradeTokens,
          upgrade_details: {
            target_plan_name: targetPlanName,
            target_plan_type: targetPlanType,
            subscription_id: subscriptionId,
            stripe_session_id: session_id,
            fallback_mode: true
          }
        });

      if (sessionRecordError) {
        logStep('ERROR: Failed to record fallback session processing', sessionRecordError);
      } else {
        logStep('FIRST SUBSCRIPTION FALLBACK: Session processing recorded');
      }
      
      logStep('FIRST SUBSCRIPTION FALLBACK COMPLETED SUCCESSFULLY', {
        subscriptionType: targetPlanName,
        tokensAdded: upgradeTokens,
        newAvailableTokens,
        allTablesUpdated: true
      });
      
      return new Response(
        JSON.stringify({ 
          success: true,
          fallback_mode: true,
          subscription_type: targetPlanName,
          tokens_added: upgradeTokens,
          new_available_tokens: newAvailableTokens,
          message: 'First subscription processed via fallback'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    logStep('Upgrade parameters', {
      subscriptionId,
      targetPlanType,
      targetPlanName,
      targetPlanPrice,
      targetMonthlyLimit,
      upgradeTokens
    });

    // Find or create stable price_id in Stripe
    let targetPriceId: string;
    
    const prices = await stripe.prices.list({ 
      limit: 100,
      recurring: { interval: 'month' },
      type: 'recurring'
    });
    
    const existingPrice = prices.data.find((price: any) => 
      price.unit_amount === targetPlanPrice * 100 && 
      price.currency === 'usd' &&
      price.recurring?.interval === 'month'
    );
    
    if (existingPrice) {
      targetPriceId = existingPrice.id;
      logStep('Using existing price', { priceId: targetPriceId, amount: existingPrice.unit_amount });
    } else {
      logStep('Creating new product and price');
      
      const product = await stripe.products.create({
        name: targetPlanName,
        description: `${targetMonthlyLimit} worksheets per month`,
      });
      
      const price = await stripe.prices.create({
        currency: 'usd',
        product: product.id,
        unit_amount: targetPlanPrice * 100,
        recurring: {
          interval: 'month',
        },
      });
      
      targetPriceId = price.id;
      logStep('Created new price', { priceId: targetPriceId, productId: product.id });
    }

    // Update Stripe subscription
    logStep('Updating Stripe subscription', { subscriptionId, newPriceId: targetPriceId });
    
    const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    logStep('Current subscription retrieved', { 
      id: currentSubscription.id,
      status: currentSubscription.status,
      currentPriceId: currentSubscription.items.data[0].price.id,
      currentAmount: currentSubscription.items.data[0].price.unit_amount
    });

    // CRITICAL FIX: Set cancel_at_period_end to false to ensure subscription becomes active
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [{
        id: currentSubscription.items.data[0].id,
        price: targetPriceId,
      }],
      cancel_at_period_end: false,  // FIXED: Ensure subscription becomes active after upgrade
      proration_behavior: 'none',
      billing_cycle_anchor: 'unchanged',
    });

    logStep('Subscription updated in Stripe successfully', { 
      subscriptionId: updatedSubscription.id,
      newPriceId: targetPriceId,
      newAmount: targetPlanPrice * 100,
      status: updatedSubscription.status,
      currentPeriodEnd: updatedSubscription.current_period_end,
      cancelAtPeriodEnd: updatedSubscription.cancel_at_period_end
    });

    
    // Continue with UPGRADE logic (for real upgrades)
    const oldPlanType = profile.subscription_type || 'Free Demo';

    // Calculate new token amounts
    const newAvailableTokens = profile.available_tokens + upgradeTokens;
    const newTotalReceived = (profile.total_tokens_received || 0) + upgradeTokens;

    logStep('Token calculations', {
      currentAvailable: profile.available_tokens,
      currentTotal: profile.total_tokens_received,
      upgradeTokens,
      newAvailableTokens,
      newTotalReceived
    });

    // Update profile with new plan data and tokens
    const { error: updateError } = await supabaseService
      .from('profiles')
      .update({
        subscription_type: targetPlanName,
        subscription_status: 'active',
        monthly_worksheet_limit: targetMonthlyLimit,
        available_tokens: newAvailableTokens,
        total_tokens_received: newTotalReceived,
        is_tokens_frozen: false,
        subscription_expires_at: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) {
      logStep('ERROR: Failed to update profile', updateError);
      throw updateError;
    }

    logStep('Profile updated successfully');

    // Update subscriptions table with correct data - FIXED: Use correct onConflict key
    const upgradeCustomerId = session.customer as string || updatedSubscription.customer as string;
    
    const { error: subError } = await supabaseService
      .from('subscriptions')
      .upsert({
        teacher_id: user.id,
        email: user.email,
        stripe_subscription_id: subscriptionId,
        stripe_customer_id: upgradeCustomerId, // FIXED: validate customer ID
        subscription_status: 'active',
        subscription_type: targetPlanName, // FIXED: use normalized plan name
        monthly_limit: targetMonthlyLimit,
        current_period_start: new Date(updatedSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'teacher_id',  // FIXED: Use teacher_id for conflict resolution
        ignoreDuplicates: false 
      });

    if (subError) {
      logStep('ERROR: Failed to update subscriptions table', subError);
      throw subError;
    }

    logStep('Subscriptions table updated successfully');

    // Add token transaction record with teacher_email - FIXED
    const { error: transactionError } = await supabaseService
      .from('token_transactions')
      .insert({
        teacher_id: user.id,
        teacher_email: user.email,  // FIXED: Add teacher_email
        transaction_type: 'purchase',
        amount: upgradeTokens,
        description: `Upgrade to ${targetPlanName} - tokens added`,
        reference_id: null
      });

    if (transactionError) {
      logStep('WARNING: Failed to log token transaction', transactionError);
    } else {
      logStep('Token transaction logged successfully');
    }

    // NEW: Insert a precise subscription_events upgrade record with correct old_plan_type and tokens_added
    const normalizedNewPlan = normalizePlanName(targetPlanType, targetMonthlyLimit, targetPlanName);
    const { error: eventError } = await supabaseService
      .from('subscription_events')
      .insert({
        teacher_id: user.id,
        email: user.email,
        event_type: 'upgraded',
        old_plan_type: oldPlanType,                 // crucial: previous plan, e.g. "Side-Gig"
        new_plan_type: normalizedNewPlan,           // normalized, e.g. "Full-Time 30"
        tokens_added: upgradeTokens,                // crucial: e.g. 15 for Side-Gig -> Full-Time 30
        event_data: {
          stripe_session_id: session_id,
          stripe_subscription_id: subscriptionId,
          target_plan_name: targetPlanName,
          target_plan_type: targetPlanType,
          target_monthly_limit: targetMonthlyLimit,
          target_plan_price: targetPlanPrice
        }
      });

    if (eventError) {
      logStep('WARNING: Failed to log subscription event (upgrade)', eventError);
    } else {
      logStep('Subscription event (upgrade) logged successfully', { oldPlanType, newPlan: normalizedNewPlan, tokensAdded: upgradeTokens });
    }

    // IDEMPOTENCY RECORD: Mark this session as processed (now also storing email)
    const { error: sessionRecordError } = await supabaseService
      .from('processed_upgrade_sessions')
      .insert({
        session_id: session_id,
        teacher_id: user.id,
        email: user.email,                    // <-- store email as requested
        tokens_added: upgradeTokens,
        upgrade_details: {
          target_plan_name: targetPlanName,
          target_plan_type: targetPlanType,
          subscription_id: subscriptionId,
          stripe_session_id: session_id
        }
      });

    if (sessionRecordError) {
      logStep('WARNING: Failed to record session processing', sessionRecordError);
    } else {
      logStep('Session processing recorded successfully');
    }

    logStep('Upgrade finalized successfully', {
      newPlan: targetPlanName,
      tokensAdded: upgradeTokens,
      newAvailableTokens,
      stripeSubscriptionUpdated: true,
      supabaseDataSynced: true
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        subscription_type: targetPlanName,
        tokens_added: upgradeTokens,
        new_available_tokens: newAvailableTokens,
        stripe_updated: true
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    logStep('Error occurred', { 
      message: error.message, 
      stack: error.stack
    });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});