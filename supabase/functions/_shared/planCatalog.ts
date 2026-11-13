// Server-side subscription catalog. Prices and allowances are never taken
// from the request body (mirrors src/hooks/usePlanLogic plans).
export interface CatalogPlan { planType: 'side-gig' | 'full-time'; name: string; price: number; monthlyLimit: number }

export const PLAN_CATALOG: CatalogPlan[] = [
  { planType: 'side-gig', name: 'Side-Gig Plan', price: 9, monthlyLimit: 15 },
  { planType: 'full-time', name: 'Full-Time Plan (30 worksheets)', price: 19, monthlyLimit: 30 },
  { planType: 'full-time', name: 'Full-Time Plan (60 worksheets)', price: 39, monthlyLimit: 60 },
  { planType: 'full-time', name: 'Full-Time Plan (90 worksheets)', price: 59, monthlyLimit: 90 },
  { planType: 'full-time', name: 'Full-Time Plan (120 worksheets)', price: 79, monthlyLimit: 120 },
];

export function findPlan(planType: unknown, monthlyLimit: unknown): CatalogPlan | null {
  const limit = Number(monthlyLimit);
  if (planType === 'side-gig') return PLAN_CATALOG[0];
  return PLAN_CATALOG.find((p) => p.planType === planType && p.monthlyLimit === limit) ?? null;
}

export function planByPrice(price: number): CatalogPlan | null {
  return PLAN_CATALOG.find((p) => p.price === price) ?? null;
}

/**
 * Stripe customer that belongs to this account: the id stored in our
 * subscriptions row, or a customer whose metadata names this account id.
 * Never "the first customer with the same email", because Stripe emails are
 * not verified ownership.
 */
// deno-lint-ignore no-explicit-any
export async function findOwnedStripeCustomerId(stripe: any, admin: any, user: { id: string; email?: string | null; email_confirmed_at?: string | null }): Promise<string | null> {
  const { data: row } = await admin.from('subscriptions').select('stripe_customer_id').eq('teacher_id', user.id).maybeSingle();
  if (row?.stripe_customer_id) return row.stripe_customer_id as string;
  if (!user.email) return null;
  const customers = await stripe.customers.list({ email: user.email, limit: 10 });
  // deno-lint-ignore no-explicit-any
  const owned = customers.data.find((c: any) => c.metadata?.supabase_user_id === user.id);
  if (owned) return owned.id;
  // Legacy customers created without metadata: only for a verified email, and
  // only when the customer is not linked to a different account.
  if (!user.email_confirmed_at) return null;
  // deno-lint-ignore no-explicit-any
  const legacy = customers.data.find((c: any) => !c.metadata?.supabase_user_id);
  return legacy?.id ?? null;
}
