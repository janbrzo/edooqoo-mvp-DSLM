
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
    console.log('[CUSTOMER-PORTAL] Function started');

    // Initialize Supabase with anon key for user auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[CUSTOMER-PORTAL] No authorization header');
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) {
      console.error('[CUSTOMER-PORTAL] User error:', userError);
      throw userError;
    }

    const user = userData.user;
    if (!user?.email) {
      console.error('[CUSTOMER-PORTAL] User not authenticated');
      throw new Error('User not authenticated');
    }

    console.log('[CUSTOMER-PORTAL] User authenticated:', user.email);

    // Initialize Stripe
    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeKey) {
      console.error('[CUSTOMER-PORTAL] Stripe key not configured');
      throw new Error('Stripe key not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Find customer
    console.log('[CUSTOMER-PORTAL] Looking for customer:', user.email);
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    if (customers.data.length === 0) {
      console.error('[CUSTOMER-PORTAL] No Stripe customer found for:', user.email);
      throw new Error('No Stripe customer found. Please contact support.');
    }

    const customerId = customers.data[0].id;
    console.log('[CUSTOMER-PORTAL] Found customer:', customerId);

    // Create portal session with configuration
    const origin = req.headers.get('origin') || 'https://bvfrkzdlklyvnhlpleck.supabase.co';
    
    try {
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${origin}/profile`,
        configuration: undefined // Let Stripe use default configuration
      });

      console.log('[CUSTOMER-PORTAL] Portal session created:', portalSession.id);

      return new Response(
        JSON.stringify({ url: portalSession.url }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    } catch (stripeError: any) {
      console.error('[CUSTOMER-PORTAL] Stripe portal error:', stripeError);
      
      if (stripeError.message?.includes('configuration')) {
        throw new Error('Customer portal not configured. Please contact support to manage your subscription.');
      }
      
      throw new Error('Failed to create customer portal session. Please try again or contact support.');
    }

  } catch (error: any) {
    console.error('[CUSTOMER-PORTAL] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
