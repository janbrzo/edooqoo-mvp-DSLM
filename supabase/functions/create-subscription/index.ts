import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-SUBSCRIPTION] ${step}${detailsStr}`);
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
    const { planType, monthlyLimit, price, planName, upgradeTokens, isUpgrade } = body;

    logStep('Request body parsed', { planType, monthlyLimit, price, planName, upgradeTokens, isUpgrade });

    // Initialize Stripe
    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeKey) {
      logStep('Stripe key not configured');
      throw new Error('Stripe key not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Find or create customer
    let customer;
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length > 0) {
      customer = customers.data[0];
      logStep('Found existing customer', { customerId: customer.id });
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          supabase_user_id: user.id
        }
      });
      logStep('Created new customer', { customerId: customer.id });
    }

    const origin = req.headers.get('origin') || req.headers.get('referer') || 'https://bvfrkzdlklyvnhlpleck.supabase.co';
    logStep('Origin determined', { origin });

    // Check for existing active subscriptions
    const existingStripeSubscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      status: 'active',
      limit: 1,
    });

    if (existingStripeSubscriptions.data.length > 0 && isUpgrade) {
      // FIXED: For upgrades, create a one-time payment checkout session for the upgrade price difference
      const existingSubscription = existingStripeSubscriptions.data[0];
      logStep('Creating upgrade checkout session', { 
        subscriptionId: existingSubscription.id,
        upgradePrice: price, // This is the difference price from frontend
        targetPlanPrice: price + (existingSubscription.items.data[0].price.unit_amount / 100) // Calculate full target price
      });

      const targetPlanPrice = price + (existingSubscription.items.data[0].price.unit_amount / 100);

      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Upgrade to ${planName}`,
                description: `One-time upgrade fee - difference between plans`,
              },
              unit_amount: price * 100, // Only the upgrade price difference
            },
            quantity: 1,
          },
        ],
        mode: 'payment', // FIXED: One-time payment, not subscription
        success_url: `${origin}/profile?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?canceled=true`,
        allow_promotion_codes: true, // FIXED: Enable promotion codes for upgrades
        metadata: {
          action: 'upgrade',
          supabase_user_id: user.id,
          subscription_id: existingSubscription.id,
          target_plan_type: planType,
          target_plan_name: planName,
          target_plan_price: targetPlanPrice.toString(), // Full target plan price
          target_monthly_limit: monthlyLimit.toString(),
          upgrade_tokens: upgradeTokens ? upgradeTokens.toString() : '0',
        },
      });

      logStep('Upgrade checkout session created with promotion codes enabled', { sessionId: checkoutSession.id, url: checkoutSession.url });

      return new Response(
        JSON.stringify({ url: checkoutSession.url }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );

    } else {
      // Create new subscription checkout session (existing logic)
      const sessionConfig: any = {
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: planName,
                description: `${monthlyLimit} worksheets per month`,
              },
              unit_amount: price * 100,
              recurring: {
                interval: 'month',
              },
            },
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${origin}/profile?success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/pricing?canceled=true`,
        allow_promotion_codes: true,
        metadata: {
          supabase_user_id: user.id,
          plan_type: planType,
          monthly_limit: monthlyLimit.toString(),
          is_upgrade: isUpgrade ? 'true' : 'false',
          upgrade_tokens: upgradeTokens ? upgradeTokens.toString() : '0',
        },
      };

      logStep('Checkout session configuration created');

      const session = await stripe.checkout.sessions.create(sessionConfig);

      logStep('Checkout session created', { sessionId: session.id, url: session.url });

      return new Response(
        JSON.stringify({ url: session.url }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error: any) {
    logStep('Error occurred', { 
      message: error.message, 
      stack: error.stack,
      type: error.type || 'unknown',
      code: error.code || 'unknown'
    });
    return new Response(
      JSON.stringify({ 
        error: error.message,
        type: error.type || 'unknown',
        code: error.code || 'unknown'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
