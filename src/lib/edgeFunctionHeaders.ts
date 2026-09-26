import { supabase } from '@/integrations/supabase/client';

/**
 * Headers for raw `fetch` calls to Supabase Edge Functions (streaming or
 * endpoints that bypass `supabase.functions.invoke`).
 *
 * Edge functions derive the caller from the bearer token, so it must be the
 * signed-in user's access token; without a session the publishable key keeps
 * anonymous requests working. Mirrors `formatPromptForAI` in promptFormatter.
 */
export async function edgeFunctionHeaders(): Promise<Record<string, string>> {
  const publishableKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ||
    '';
  let token = publishableKey;
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) token = data.session.access_token;
  } catch {
    /* fall back to the publishable key */
  }
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    apikey: publishableKey,
  };
}
