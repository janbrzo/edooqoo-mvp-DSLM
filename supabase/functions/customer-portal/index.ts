
import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@12.18.0'
import { findOwnedStripeCustomerId } from '../_shared/planCatalog.ts'

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
    if (!user?.email || user.is_anonymous || !user.email_confirmed_at) {
      console.error('[CUSTOMER-PORTAL] User not authenticated');
      throw new Error('User not authenticated');
    }



    // Initialize Stripe
    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    if (!stripeKey) {
      console.error('[CUSTOMER-PORTAL] Stripe key not configured');
      throw new Error('Stripe key not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2023-10-16' });

    // Find customer
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const ownedCustomerId = await findOwnedStripeCustomerId(stripe, admin, user);
    if (!ownedCustomerId) {
      throw new Error('No Stripe customer found. Please contact support.');
    }

    const customerId = ownedCustomerId;
    console.log('[CUSTOMER-PORTAL] Found customer:', customerId);

    // Create portal session with configuration
    const origin = (Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com').replace(/\/+$/, '');
    
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
    console.error('[CUSTOMER-PORTAL] Error:', error?.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
