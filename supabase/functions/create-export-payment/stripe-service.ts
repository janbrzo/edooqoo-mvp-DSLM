
import Stripe from 'https://esm.sh/stripe@12.18.0';

export interface StripeSessionConfig {
  worksheetId: string;
  userId: string;
  successUrl: string;
  cancelUrl: string;
}

export async function createStripeSession(config: StripeSessionConfig): Promise<Stripe.Checkout.Session> {
  const stripeSecretKey = Deno.env.get('Stripe_Secret_Key');
  if (!stripeSecretKey) {
    throw new Error('Payment service configuration error');
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: '2023-10-16',
  });

  return await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    allow_promotion_codes: true, // Enable discount codes including 1CENT
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Worksheet Export Access',
            description: 'One-time payment for downloading HTML version of your worksheet',
          },
          unit_amount: 100, // $1.00 in cents
        },
        quantity: 1,
      },
    ],
    success_url: `${config.successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: config.cancelUrl,
    metadata: {
      worksheetId: config.worksheetId,
      userId: config.userId,
    },
    // Enable customer email collection in Stripe
    customer_creation: 'always',
    billing_address_collection: 'auto',
  });
}
