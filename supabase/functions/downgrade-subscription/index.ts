
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@12.18.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[DOWNGRADE-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("Stripe_Secret_Key");
    if (!stripeKey) throw new Error("Stripe_Secret_Key is not set");
    logStep("Stripe key verified");

    // Initialize Supabase client with service role for DB operations
    const supabaseServiceRole = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Initialize Supabase client with anon key for auth
    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { planType, monthlyLimit, price, planName } = await req.json();
    if (!planType || !monthlyLimit || !price || !planName) {
      throw new Error("Missing required parameters: planType, monthlyLimit, price, planName");
    }
    logStep("Request parameters", { planType, monthlyLimit, price, planName });

    // Get current profile
    const { data: profile, error: profileError } = await supabaseServiceRole
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError) throw new Error(`Failed to fetch profile: ${profileError.message}`);
    if (!profile) throw new Error("Profile not found");
    logStep("Current profile fetched", { currentPlan: profile.subscription_type });

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
    } else {
      throw new Error("No Stripe customer found for this user");
    }

    // Get current subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      throw new Error("No active subscription found");
    }

    const currentSubscription = subscriptions.data[0];
    logStep("Current subscription found", { subscriptionId: currentSubscription.id });

    // Find or create price for the downgrade plan
    const priceAmount = price * 100; // Convert to cents
    let targetPriceId: string;

    const existingPrices = await stripe.prices.list({
      unit_amount: priceAmount,
      currency: 'usd',
      recurring: { interval: 'month' },
      active: true,
      limit: 10
    });

    const matchingPrice = existingPrices.data.find((p: any) => 
      p.unit_amount === priceAmount && 
      p.recurring?.interval === 'month' &&
      p.active
    );

    if (matchingPrice) {
      targetPriceId = matchingPrice.id;
      logStep("Found existing price", { priceId: targetPriceId, amount: priceAmount });
    } else {
      // Create new price
      const newPrice = await stripe.prices.create({
        unit_amount: priceAmount,
        currency: 'usd',
        recurring: { interval: 'month' },
        product_data: { name: planName },
      });
      targetPriceId = newPrice.id;
      logStep("Created new price", { priceId: targetPriceId, amount: priceAmount });
    }

    // Update subscription to downgrade
    logStep("Updating subscription for downgrade", { 
      subscriptionId: currentSubscription.id, 
      targetPriceId,
      planType,
      monthlyLimit 
    });

    const updatedSubscription = await stripe.subscriptions.update(currentSubscription.id, {
      items: [{
        id: currentSubscription.items.data[0].id,
        price: targetPriceId,
      }],
      proration_behavior: 'none',
      billing_cycle_anchor: 'unchanged',
      cancel_at_period_end: false,
      metadata: {
        planType: planType,
        monthlyLimit: monthlyLimit.toString(),
        isDowngrade: 'true'
      }
    });

    logStep("Subscription updated successfully", { 
      subscriptionId: updatedSubscription.id,
      currentPeriodEnd: updatedSubscription.current_period_end 
    });

    // Update profiles table
    const { error: profileUpdateError } = await supabaseServiceRole
      .from('profiles')
      .update({
        subscription_type: planName,
        subscription_status: 'active',
        monthly_worksheet_limit: monthlyLimit,
        subscription_expires_at: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        is_tokens_frozen: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (profileUpdateError) {
      logStep("Error updating profile", { error: profileUpdateError });
      throw new Error(`Failed to update profile: ${profileUpdateError.message}`);
    }
    logStep("Profile updated successfully");

    // Update subscriptions table
    const { error: subscriptionUpdateError } = await supabaseServiceRole
      .from('subscriptions')
      .upsert({
        teacher_id: user.id,
        email: user.email,
        stripe_subscription_id: updatedSubscription.id,
        stripe_customer_id: customerId,
        subscription_status: updatedSubscription.status,
        subscription_type: planName,
        monthly_limit: monthlyLimit,
        current_period_start: new Date(updatedSubscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        updated_at: new Date().toISOString()
      }, { 
        onConflict: 'stripe_subscription_id',
        ignoreDuplicates: false 
      });

    if (subscriptionUpdateError) {
      logStep("Error updating subscriptions table", { error: subscriptionUpdateError });
      throw new Error(`Failed to update subscriptions table: ${subscriptionUpdateError.message}`);
    }
    logStep("Subscriptions table updated successfully");

    // Log downgrade event
    const { error: eventError } = await supabaseServiceRole
      .from('subscription_events')
      .insert({
        teacher_id: user.id,
        email: user.email,
        event_type: 'downgraded',
        old_plan_type: profile.subscription_type,
        new_plan_type: planName,
        tokens_added: 0,
        event_data: {
          from_plan: profile.subscription_type,
          to_plan: planName,
          subscription_id: updatedSubscription.id,
          price_amount: priceAmount
        },
        stripe_event_id: null
      });

    if (eventError) {
      logStep("Error logging subscription event", { error: eventError });
      // Don't throw here, as the main operation succeeded
    } else {
      logStep("Subscription event logged successfully");
    }

    logStep("Downgrade completed successfully", { 
      oldPlan: profile.subscription_type,
      newPlan: planName,
      monthlyLimit 
    });

    return new Response(JSON.stringify({ 
      success: true,
      oldPlan: profile.subscription_type,
      newPlan: planName,
      monthlyLimit,
      message: "Subscription downgraded successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in downgrade-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ 
      error: errorMessage,
      success: false 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
