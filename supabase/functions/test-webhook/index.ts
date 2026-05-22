import { serve } from "https://deno.land/std@0.208.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const logStep = (step: string, details?: any) => {
  const timestamp = new Date().toISOString();
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[TEST-WEBHOOK] ${timestamp} ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('=== TEST WEBHOOK RECEIVED ===', {
      method: req.method,
      url: req.url,
      timestamp: new Date().toISOString()
    });

    // Log all headers
    const headers: { [key: string]: string } = {};
    req.headers.forEach((value, key) => {
      headers[key] = value;
    });
    logStep('Request headers', headers);

    // Log body
    const body = await req.text();
    logStep('Request body preview', { 
      bodyLength: body.length,
      bodyStart: body.substring(0, 200) + (body.length > 200 ? '...' : '')
    });

    // Check environment variables
    const stripeKey = Deno.env.get('Stripe_Secret_Key');
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    
    logStep('Environment check', {
      hasStripeKey: !!stripeKey,
      stripeKeyLength: stripeKey?.length || 0,
      hasWebhookSecret: !!webhookSecret,
      webhookSecretLength: webhookSecret?.length || 0,
      supabaseUrl: supabaseUrl
    });

    // Check signature verification
    const signature = req.headers.get('stripe-signature');
    logStep('Stripe signature', {
      hasSignature: !!signature,
      signatureStart: signature?.substring(0, 50) + '...' || 'none'
    });

    return new Response(JSON.stringify({ 
      received: true,
      timestamp: new Date().toISOString(),
      message: 'Test webhook endpoint working correctly',
      environment: {
        hasStripeKey: !!stripeKey,
        hasWebhookSecret: !!webhookSecret,
        hasSignature: !!signature
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    logStep('TEST WEBHOOK ERROR', { 
      message: error.message, 
      stack: error.stack?.split('\n').slice(0, 3) 
    });
    
    return new Response(JSON.stringify({ 
      error: 'Test webhook failed', 
      message: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
})