import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import Stripe from 'https://esm.sh/stripe@12.18.0';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
const logStep = (step, details)=>{
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[REPAIR-SUBSCRIPTIONS] ${step}${detailsStr}`);
};
serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  try {
    logStep('Repair function started');
    // Use service role key for administrative operations
    const supabaseService = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', {
      auth: {
        persistSession: false
      }
    });
    // Initialize Stripe
    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeKey) throw new Error('Stripe key not configured');
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2023-10-16'
    });
    // Find all profiles with "Unknown Plan" or problematic subscription types
    const { data: problematicProfiles, error: fetchError } = await supabaseService.from('profiles').select('id, email, subscription_type, monthly_worksheet_limit, token_balance').or('subscription_type.eq.Unknown Plan,monthly_worksheet_limit.eq.0,subscription_type.is.null').not('email', 'is', null);
    if (fetchError) {
      throw new Error(`Failed to fetch problematic profiles: ${fetchError.message}`);
    }
    logStep('Found problematic profiles', {
      count: problematicProfiles?.length || 0
    });
    const repairs = [];
    for (const profile of problematicProfiles || []){
      try {
        logStep('Processing profile', {
          email: profile.email,
          currentType: profile.subscription_type
        });
        // Find customer in Stripe
        const customers = await stripe.customers.list({
          email: profile.email,
          limit: 1
        });
        if (customers.data.length === 0) {
          logStep('No Stripe customer found, skipping', {
            email: profile.email
          });
          continue;
        }
        const customer = customers.data[0];
        // Get active subscriptions
        const subscriptions = await stripe.subscriptions.list({
          customer: customer.id,
          status: 'active',
          limit: 1
        });
        if (subscriptions.data.length === 0) {
          logStep('No active subscription found, skipping', {
            email: profile.email
          });
          continue;
        }
        const subscription = subscriptions.data[0];
        const amount = subscription.items.data[0].price.unit_amount || 0;
        logStep('Found subscription to repair', {
          email: profile.email,
          subscriptionId: subscription.id,
          amount: amount
        });
        // Determine correct plan based on metadata or price
        let planType = 'unknown';
        let subscriptionType = 'Unknown Plan';
        let monthlyLimit = 0;
        let tokensToAdd = 0;
        // Check metadata first
        if (subscription.metadata?.plan_type && subscription.metadata?.monthly_limit) {
          planType = subscription.metadata.plan_type;
          monthlyLimit = parseInt(subscription.metadata.monthly_limit);
          if (planType === 'side-gig') {
            subscriptionType = 'Side-Gig';
          } else if (planType === 'full-time') {
            subscriptionType = `Full-Time ${monthlyLimit}`;
          }
        } else {
          // Fallback to price detection
          if (amount === 900) {
            planType = 'side-gig';
            subscriptionType = 'Side-Gig';
            monthlyLimit = 15;
          } else if (amount === 1000 || amount === 1900) {
            planType = 'full-time';
            subscriptionType = 'Full-Time 30';
            monthlyLimit = 30;
          } else if (amount === 2000 || amount === 3000 || amount === 3900) {
            planType = 'full-time';
            subscriptionType = 'Full-Time 60';
            monthlyLimit = 60;
          } else if (amount === 5900) {
            planType = 'full-time';
            subscriptionType = 'Full-Time 90';
            monthlyLimit = 90;
          } else if (amount === 7900) {
            planType = 'full-time';
            subscriptionType = 'Full-Time 120';
            monthlyLimit = 120;
          }
        }
        if (subscriptionType === 'Unknown Plan') {
          logStep('Could not determine plan type, skipping', {
            email: profile.email,
            amount
          });
          continue;
        }
        // Calculate tokens to add if this is a plan with higher limit than current
        const currentLimit = profile.monthly_worksheet_limit || 0;
        if (monthlyLimit > currentLimit) {
          tokensToAdd = monthlyLimit - currentLimit;
        }
        // Update subscription record
        const { error: subError } = await supabaseService.from('subscriptions').upsert({
          teacher_id: profile.id,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customer.id,
          status: subscription.status,
          plan_type: planType,
          monthly_limit: monthlyLimit,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'stripe_subscription_id',
          ignoreDuplicates: false
        });
        if (subError) {
          logStep('Error updating subscription record', {
            email: profile.email,
            error: subError
          });
        }
        // Update profile
        const profileUpdate = {
          subscription_type: subscriptionType,
          subscription_status: subscription.status,
          subscription_expires_at: new Date(subscription.current_period_end * 1000).toISOString(),
          monthly_worksheet_limit: monthlyLimit,
          updated_at: new Date().toISOString()
        };
        // Add tokens if needed
        if (tokensToAdd > 0) {
          profileUpdate.token_balance = (profile.token_balance || 0) + tokensToAdd;
          logStep('Adding missing tokens', {
            email: profile.email,
            currentTokens: profile.token_balance,
            adding: tokensToAdd,
            newBalance: profileUpdate.token_balance
          });
        }
        const { error: profileError } = await supabaseService.from('profiles').update(profileUpdate).eq('id', profile.id);
        if (profileError) {
          logStep('Error updating profile', {
            email: profile.email,
            error: profileError
          });
        }
        // Log token transaction if tokens were added
        if (tokensToAdd > 0) {
          const { error: tokenError } = await supabaseService.from('token_transactions').insert({
            teacher_id: profile.id,
            transaction_type: 'repair',
            amount: tokensToAdd,
            description: `Repair: Added missing tokens for ${subscriptionType}`
          });
          if (tokenError) {
            logStep('Error logging token transaction', {
              email: profile.email,
              error: tokenError
            });
          }
        }
        repairs.push({
          email: profile.email,
          oldType: profile.subscription_type,
          newType: subscriptionType,
          oldLimit: profile.monthly_worksheet_limit,
          newLimit: monthlyLimit,
          tokensAdded: tokensToAdd,
          success: !profileError && !subError
        });
        logStep('Profile repaired successfully', {
          email: profile.email,
          from: profile.subscription_type,
          to: subscriptionType,
          tokensAdded: tokensToAdd
        });
      } catch (error) {
        logStep('Error processing profile', {
          email: profile.email,
          error: error.message
        });
        repairs.push({
          email: profile.email,
          error: error.message,
          success: false
        });
      }
    }
    logStep('Repair process completed', {
      totalProcessed: repairs.length
    });
    return new Response(JSON.stringify({
      success: true,
      message: `Repaired ${repairs.filter((r)=>r.success).length} out of ${repairs.length} profiles`,
      repairs: repairs
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    logStep('Error in repair function', {
      message: error.message
    });
    return new Response(JSON.stringify({
      error: error.message
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
