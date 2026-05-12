import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[CHECK-SUBSCRIPTION] Function started');

    // Initialize Supabase with anon key for user auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[CHECK-SUBSCRIPTION] No authorization header - user not authenticated');
      return new Response(
        JSON.stringify({ 
          subscribed: false, 
          subscription_type: 'Free Demo',
          subscription_status: 'active',
          message: 'No authorization provided' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData?.user) {
      console.log('[CHECK-SUBSCRIPTION] Failed to get user:', userError?.message);
      return new Response(
        JSON.stringify({ 
          subscribed: false, 
          subscription_type: 'Free Demo',
          subscription_status: 'active',
          message: 'User authentication failed' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const user = userData.user;
    
    // FIXED: Handle anonymous users gracefully - don't throw error
    if (!user?.email) {
      console.log('[CHECK-SUBSCRIPTION] Anonymous user detected - returning Free Demo status');
      return new Response(
        JSON.stringify({ 
          subscribed: false, 
          subscription_type: 'Free Demo',
          subscription_status: 'active',
          message: 'Anonymous user - Free Demo access' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('[CHECK-SUBSCRIPTION] User:', user.email);

    // Initialize Stripe
    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeKey) throw new Error('Stripe key not configured');

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Use service role to get existing subscription record
    const supabaseService = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Check if user ever had a subscription (exists in subscriptions table)
    const { data: hasSubscriptionHistory } = await supabaseService
      .from('subscriptions')
      .select('id')
      .eq('teacher_id', user.id)
      .limit(1);

    const userHasSubscriptionHistory = hasSubscriptionHistory && hasSubscriptionHistory.length > 0;
    
    console.log('[CHECK-SUBSCRIPTION] User has subscription history:', userHasSubscriptionHistory);

    // Find customer in Stripe
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      console.log('[CHECK-SUBSCRIPTION] No Stripe customer found');
      
      // FIXED: For users without Stripe customer, set appropriate status based on subscription history
      const subscriptionType = userHasSubscriptionHistory ? 'Inactive' : 'Free Demo';
      const subscriptionStatus = userHasSubscriptionHistory ? 'cancelled' : 'active';
      const isTokensFrozen = userHasSubscriptionHistory; // Only freeze if they had subscription before
      
      console.log('[CHECK-SUBSCRIPTION] Setting subscription type to:', subscriptionType, 'status:', subscriptionStatus, 'frozen:', isTokensFrozen);

      await supabaseService
        .from('profiles')
        .update({
          subscription_type: subscriptionType,
          subscription_status: subscriptionStatus,
          is_tokens_frozen: isTokensFrozen,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      return new Response(
        JSON.stringify({ 
          subscribed: false, 
          subscription_type: subscriptionType,
          subscription_status: subscriptionStatus,
          message: 'No subscription found' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerId = customers.data[0].id;
    console.log('[CHECK-SUBSCRIPTION] Found customer:', customerId);

    // Get stored subscription record to find stripe_subscription_id
    const { data: storedSubscription } = await supabaseService
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('teacher_id', user.id)
      .single();

    let subscription = null;
    let shouldUpdateStoredId = false;

    // Try to fetch the stored subscription by ID first, but prioritize active ones
    if (storedSubscription?.stripe_subscription_id) {
      try {
        const storedSub = await stripe.subscriptions.retrieve(storedSubscription.stripe_subscription_id);
        console.log('[CHECK-SUBSCRIPTION] Found stored subscription:', storedSub.id, 'status:', storedSub.status);
        
        // If stored subscription is active, use it
        if (storedSub.status === 'active') {
          subscription = storedSub;
          console.log('[CHECK-SUBSCRIPTION] Using stored active subscription');
        } else {
          console.log('[CHECK-SUBSCRIPTION] Stored subscription not active, searching for active ones');
          shouldUpdateStoredId = true; // We'll update to the active one if found
        }
      } catch (error) {
        console.log('[CHECK-SUBSCRIPTION] Stored subscription not found in Stripe, searching all');
        shouldUpdateStoredId = true;
      }
    } else {
      shouldUpdateStoredId = true; // No stored ID, need to find and store one
    }

    // Get ALL subscriptions (active, canceled, past_due, etc.) and pick the best one
    if (!subscription) {
      const allSubscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 20, // Increased to get more history
      });

      console.log('[CHECK-SUBSCRIPTION] Found subscriptions:', allSubscriptions.data.length);
      
      if (allSubscriptions.data.length === 0) {
        console.log('[CHECK-SUBSCRIPTION] No subscriptions found at all');
        
        // FIXED: Determine subscription type based on subscription history
        const subscriptionType = userHasSubscriptionHistory ? 'Inactive' : 'Free Demo';
        const subscriptionStatus = userHasSubscriptionHistory ? 'cancelled' : 'active';
        const isTokensFrozen = userHasSubscriptionHistory;
        
        console.log('[CHECK-SUBSCRIPTION] Setting subscription type to:', subscriptionType, 'status:', subscriptionStatus, 'frozen:', isTokensFrozen);

        await supabaseService
          .from('profiles')
          .update({
            subscription_type: subscriptionType,
            subscription_status: subscriptionStatus,
            is_tokens_frozen: isTokensFrozen,
            updated_at: new Date().toISOString()
          })
          .eq('id', user.id);

        return new Response(
          JSON.stringify({ 
            subscribed: false, 
            subscription_type: subscriptionType,
            subscription_status: subscriptionStatus,
            message: 'No subscriptions found' 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // ENHANCED PRIORITY LOGIC: Find the most relevant subscription
      // 1. Active subscriptions with cancel_at_period_end (being cancelled)
      // 2. Active subscriptions without cancel
      // 3. Recently cancelled subscriptions (within last 30 days)
      // 4. Any other subscription by most recent period end
      
      const activeSubs = allSubscriptions.data.filter((sub: any) => sub.status === 'active');
      const cancelledSubs = allSubscriptions.data.filter((sub: any) => sub.status === 'canceled');
      const recentlyCancelledSubs = cancelledSubs.filter((sub: any) => {
        const endDate = new Date(sub.current_period_end * 1000);
        const now = new Date();
        const daysDiff = (now.getTime() - endDate.getTime()) / (1000 * 3600 * 24);
        return daysDiff <= 30; // Within last 30 days
      });
      
      console.log('[CHECK-SUBSCRIPTION] Subscription breakdown:', {
        active: activeSubs.length,
        cancelled: cancelledSubs.length,
        recentlyCancelled: recentlyCancelledSubs.length
      });

      if (activeSubs.length > 0) {
        // Priority to active with cancel_at_period_end
        const activeCancelledSubs = activeSubs.filter((sub: any) => sub.cancel_at_period_end);
        if (activeCancelledSubs.length > 0) {
          subscription = activeCancelledSubs.sort((a: any, b: any) => b.current_period_end - a.current_period_end)[0];
          console.log('[CHECK-SUBSCRIPTION] Using active subscription marked for cancellation');
        } else {
          subscription = activeSubs.sort((a: any, b: any) => b.current_period_end - a.current_period_end)[0];
          console.log('[CHECK-SUBSCRIPTION] Using most recent active subscription');
        }
      } else if (recentlyCancelledSubs.length > 0) {
        subscription = recentlyCancelledSubs.sort((a: any, b: any) => b.current_period_end - a.current_period_end)[0];
        console.log('[CHECK-SUBSCRIPTION] Using recently cancelled subscription');
      } else {
        subscription = allSubscriptions.data.sort((a: any, b: any) => b.current_period_end - a.current_period_end)[0];
        console.log('[CHECK-SUBSCRIPTION] Using most recent subscription of any status');
      }
      
      shouldUpdateStoredId = true; // Always update since we selected a different subscription
    }

    console.log('[CHECK-SUBSCRIPTION] Using subscription:', subscription.id, 'status:', subscription.status, 'cancel_at_period_end:', subscription.cancel_at_period_end);

    // Get subscription details
    const amount = subscription.items.data[0].price.unit_amount || 0;
    
    let planType = 'unknown';
    let subscriptionType = 'Unknown Plan';
    let monthlyLimit = 0;

    if (amount === 900) {
      planType = 'side-gig';
      subscriptionType = 'Side-Gig';
      monthlyLimit = 15;
    } else if (amount >= 1900) {
      planType = 'full-time';
      if (amount === 1900) {
        monthlyLimit = 30;
        subscriptionType = 'Full-Time 30';
      } else if (amount === 3900) {
        monthlyLimit = 60;
        subscriptionType = 'Full-Time 60';
      } else if (amount === 5900) {
        monthlyLimit = 90;
        subscriptionType = 'Full-Time 90';
      } else if (amount === 7900) {
        monthlyLimit = 120;
        subscriptionType = 'Full-Time 120';
      } else {
        monthlyLimit = 30;
        subscriptionType = 'Full-Time 30';
      }
    }

    // CRITICAL ADDITION: Detect expired subscriptions (active with cancel_at_period_end past current_period_end)
    const currentTime = new Date();
    const subscriptionEndTime = new Date(subscription.current_period_end * 1000);
    const isExpired = subscription.status === 'active' && 
                     subscription.cancel_at_period_end && 
                     currentTime > subscriptionEndTime;

    console.log('[CHECK-SUBSCRIPTION] Expiry check:', {
      status: subscription.status,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_time: currentTime.toISOString(),
      period_end: subscriptionEndTime.toISOString(),
      is_expired: isExpired
    });

    // ENHANCED: Determine normalized subscription status with consistent "cancelled" spelling
    let newSubscriptionStatus: string;
    let finalSubscriptionType = subscriptionType; // Default to computed type
    
    if (isExpired) {
      // CRITICAL: Treat expired subscriptions as cancelled
      newSubscriptionStatus = 'cancelled';
      finalSubscriptionType = 'Inactive';
      console.log('[CHECK-SUBSCRIPTION] Subscription detected as EXPIRED - treating as cancelled');
    } else if (subscription.status === 'active') {
      newSubscriptionStatus = subscription.cancel_at_period_end ? 'active_cancelled' : 'active';
    } else if (subscription.status === 'canceled') {
      // Convert Stripe's "canceled" to our "cancelled" for consistency
      newSubscriptionStatus = 'cancelled';
      finalSubscriptionType = 'Inactive'; // Override type for cancelled subscriptions
    } else if (subscription.status === 'past_due' || subscription.status === 'unpaid') {
      newSubscriptionStatus = 'past_due';
    } else {
      newSubscriptionStatus = subscription.status;
      if (['incomplete', 'incomplete_expired', 'trialing'].includes(subscription.status)) {
        finalSubscriptionType = 'Inactive';
      }
    }
    
    console.log('[CHECK-SUBSCRIPTION] Computed status:', { 
      stripeStatus: subscription.status, 
      cancelAtPeriodEnd: subscription.cancel_at_period_end, 
      newSubscriptionStatus,
      finalSubscriptionType
    });

    // CREATE OR UPDATE MISSING SUBSCRIPTION EVENTS
    await createMissingSubscriptionEvents(supabaseService, user, subscription, customerId, finalSubscriptionType, userHasSubscriptionHistory || false);

    // Always update subscription record, and update stored ID if needed
    const subscriptionUpsertData = {
      teacher_id: user.id,
      email: user.email,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: customerId,
      subscription_status: newSubscriptionStatus,
      subscription_type: finalSubscriptionType, // Use finalSubscriptionType which handles cancelled case             
      monthly_limit: newSubscriptionStatus === 'cancelled' ? 0 : monthlyLimit, // Zero limit for cancelled
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: subError } = await supabaseService
      .from('subscriptions')
      .upsert(subscriptionUpsertData, { 
        onConflict: 'teacher_id',
        ignoreDuplicates: false 
      });

    if (subError) {
      console.error('[CHECK-SUBSCRIPTION] Error updating subscription:', subError);
    } else {
      console.log('[CHECK-SUBSCRIPTION] Subscriptions table updated with status:', newSubscriptionStatus, 'and type:', finalSubscriptionType);
      if (shouldUpdateStoredId) {
        console.log('[CHECK-SUBSCRIPTION] Updated stored stripe_subscription_id from', storedSubscription?.stripe_subscription_id, 'to', subscription.id);
      }
    }

    // Update profile - synchronize subscription data with proper token freezing logic
    const shouldFreezeTokens = ['cancelled', 'past_due', 'unpaid'].includes(newSubscriptionStatus);
    const effectiveMonthlyLimit = shouldFreezeTokens ? 0 : monthlyLimit;
    
    const { error: profileError } = await supabaseService
      .from('profiles')
      .update({
        subscription_type: finalSubscriptionType,
        subscription_status: newSubscriptionStatus, 
        subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
        monthly_worksheet_limit: effectiveMonthlyLimit,
        is_tokens_frozen: shouldFreezeTokens,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (profileError) {
      console.error('[CHECK-SUBSCRIPTION] Error updating profile:', profileError);
    }

    console.log('[CHECK-SUBSCRIPTION] Successfully synced subscription data');

    const isActiveSubscription = ['active', 'active_cancelled'].includes(newSubscriptionStatus);
    
    return new Response(
      JSON.stringify({
        subscribed: isActiveSubscription,
        subscription_type: finalSubscriptionType,
        subscription_status: newSubscriptionStatus,
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        monthly_limit: effectiveMonthlyLimit,
        message: 'Subscription status synchronized'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[CHECK-SUBSCRIPTION] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
})

// HELPER FUNCTION: Create missing subscription events based on current Stripe state
async function createMissingSubscriptionEvents(supabaseService: any, user: any, subscription: any, customerId: string, finalSubscriptionType: string, userHasSubscriptionHistory: boolean) {
  console.log('[CHECK-SUBSCRIPTION] Creating missing subscription events...');
  
  try {
    // CRITICAL: Check if subscription is expired (active with cancel_at_period_end past current_period_end)
    const currentTime = new Date();
    const subscriptionEndTime = new Date(subscription.current_period_end * 1000);
    const isExpired = subscription.status === 'active' && 
                     subscription.cancel_at_period_end && 
                     currentTime > subscriptionEndTime;

    // Check existing events for this subscription
    const { data: existingEvents } = await supabaseService
      .from('subscription_events')
      .select('event_type, stripe_event_id')
      .eq('teacher_id', user.id)
      .eq('event_data->>subscription_id', subscription.id);

    const eventTypes = existingEvents?.map((e: any) => e.event_type) || [];
    console.log('[CHECK-SUBSCRIPTION] Existing events:', eventTypes);

    const amount = subscription.items.data[0].price.unit_amount || 0;
    
    // Always ensure there's a subscription.created event
    const hasCreatedEvent = eventTypes.includes('customer.subscription.created') || 
                           existingEvents?.some((e: any) => e.stripe_event_id?.includes('fallback_'));
    
    if (!hasCreatedEvent) {
      console.log('[CHECK-SUBSCRIPTION] Adding missing subscription.created event');
      await supabaseService
        .from('subscription_events')
        .insert({
          teacher_id: user.id,
          email: user.email,
          event_type: 'customer.subscription.created',
          old_plan_type: userHasSubscriptionHistory ? 'Free Demo' : 'Free Demo',
          new_plan_type: finalSubscriptionType,
          tokens_added: 0,
          stripe_event_id: `sync_created_${subscription.id}_${Date.now()}`,
          event_data: {
            subscription_id: subscription.id,
            customer_id: customerId,
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            amount: amount,
            plan_name: finalSubscriptionType,
            sync_generated: true
          }
        });
    }

    // Check for state changes requiring events
    const hasUpdatedEvent = eventTypes.includes('customer.subscription.updated');
    const hasDeletedEvent = eventTypes.includes('customer.subscription.deleted');
    
    // CRITICAL: Handle expired subscriptions - create deleted event if missing
    if (isExpired && !hasDeletedEvent) {
      console.log('[CHECK-SUBSCRIPTION] EXPIRED SUBSCRIPTION DETECTED - Adding missing subscription.deleted event');
      await supabaseService
        .from('subscription_events')
        .insert({
          teacher_id: user.id,
          email: user.email,
          event_type: 'customer.subscription.deleted',
          old_plan_type: finalSubscriptionType + '_cancelled', // Was cancelled before expiry
          new_plan_type: 'Inactive',
          tokens_added: 0,
          stripe_event_id: `sync_expired_${subscription.id}_${Date.now()}`,
          event_data: {
            subscription_id: subscription.id,
            customer_id: customerId,
            status: 'canceled', // Treat as canceled after expiry
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            amount: amount,
            plan_name: 'Inactive',
            sync_generated: true,
            auto_expired: true
          }
        });
      console.log('[CHECK-SUBSCRIPTION] Created subscription.deleted event for expired subscription');
    }
    
    // ENHANCED: Handle cancellation and renewal operations with proper _cancelled suffix
    if (subscription.cancel_at_period_end && !hasUpdatedEvent && !isExpired) {
      console.log('[CHECK-SUBSCRIPTION] Adding missing subscription.updated (cancellation) event');
      await supabaseService
        .from('subscription_events')
        .insert({
          teacher_id: user.id,
          email: user.email,
          event_type: 'customer.subscription.updated',
          old_plan_type: finalSubscriptionType, // Original plan type
          new_plan_type: finalSubscriptionType + '_cancelled', // Add _cancelled suffix
          tokens_added: 0,
          stripe_event_id: `sync_updated_${subscription.id}_${Date.now()}`,
          event_data: {
            subscription_id: subscription.id,
            customer_id: customerId,
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            amount: amount,
            plan_name: finalSubscriptionType + '_cancelled',
            sync_generated: true
          }
        });
    }
    
    // ENHANCED: Detect renewal operations (when cancel_at_period_end changes from true to false)
    // This requires checking stored subscription state vs current state
    if (!subscription.cancel_at_period_end && subscription.status === 'active') {
      // Check if we have a stored subscription that was previously marked for cancellation
      const { data: storedSub } = await supabaseService
        .from('subscriptions')
        .select('subscription_status')
        .eq('teacher_id', user.id)
        .single();
        
      if (storedSub?.subscription_status === 'active_cancelled') {
        console.log('[CHECK-SUBSCRIPTION] Adding missing subscription.updated (renewal) event');
        await supabaseService
          .from('subscription_events')
          .insert({
            teacher_id: user.id,
            email: user.email,
            event_type: 'customer.subscription.updated',
            old_plan_type: finalSubscriptionType + '_cancelled', // Previous cancelled state
            new_plan_type: finalSubscriptionType, // Renewed plan
            tokens_added: 0,
            stripe_event_id: `sync_renewed_${subscription.id}_${Date.now()}`,
            event_data: {
              subscription_id: subscription.id,
              customer_id: customerId,
              status: subscription.status,
              cancel_at_period_end: subscription.cancel_at_period_end,
              current_period_start: subscription.current_period_start,
              current_period_end: subscription.current_period_end,
              amount: amount,
              plan_name: finalSubscriptionType,
              sync_generated: true
            }
          });
      }
    }

    // If subscription is cancelled, add subscription.deleted event
    if (subscription.status === 'canceled' && !hasDeletedEvent) {
      console.log('[CHECK-SUBSCRIPTION] Adding missing subscription.deleted event');
      await supabaseService
        .from('subscription_events')
        .insert({
          teacher_id: user.id,
          email: user.email,
          event_type: 'customer.subscription.deleted',
          old_plan_type: finalSubscriptionType + '_cancelled', // Was cancelled before deletion
          new_plan_type: 'Inactive',
          tokens_added: 0,
          stripe_event_id: `sync_deleted_${subscription.id}_${Date.now()}`,
          event_data: {
            subscription_id: subscription.id,
            customer_id: customerId,
            status: subscription.status,
            cancel_at_period_end: subscription.cancel_at_period_end,
            current_period_start: subscription.current_period_start,
            current_period_end: subscription.current_period_end,
            amount: amount,
            plan_name: 'Inactive',
            sync_generated: true
          }
        });
    }

    console.log('[CHECK-SUBSCRIPTION] Finished creating missing subscription events');
    
  } catch (error) {
    console.error('[CHECK-SUBSCRIPTION] Error creating missing events:', error);
  }
}