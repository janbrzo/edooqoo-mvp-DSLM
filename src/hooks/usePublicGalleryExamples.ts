import { useEffect, useState } from 'react';
import { selectPublishedExamples, type PublishedExample } from '@/lib/gallery/publicExamples';
import { devWarn } from '@/utils/logger';

type ExampleState = {
  status: 'deferred' | 'loading' | 'ready' | 'empty' | 'error';
  items: PublishedExample[];
};

export function usePublicGalleryExamples() {
  const [state, setState] = useState<ExampleState>({ status: 'deferred', items: [] });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    // Public worksheet content must never be copied into permanent SEO snapshots.
    if (document.documentElement.hasAttribute('data-seo-prerender')) return;
    try {
      if (localStorage.getItem('edooqoo_demo_mode') === 'true') {
        setState({ status: 'empty', items: [] });
        return;
      }
    } catch {
      // Fail closed when the demo/read-only status cannot be established.
      setState({ status: 'error', items: [] });
      return;
    }
    const controller = new AbortController();
    let cancelled = false;
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    setState({ status: 'loading', items: [] });

    async function load() {
      try {
        const url = import.meta.env.VITE_SUPABASE_URL;
        const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        if (!url || !key) throw new Error('Public gallery configuration unavailable');
        // Use public credentials only, never a stored teacher session or detail RPC.
        const response = await fetch(`${url}/rest/v1/rpc/list_public_worksheets`, {
          method: 'POST',
          credentials: 'omit',
          cache: 'no-store',
          headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ p_limit: 100, p_offset: 0 }),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error('Public gallery request failed');
        const items = selectPublishedExamples(await response.json());
        if (!cancelled) setState({ status: items.length ? 'ready' : 'empty', items });
      } catch {
        if (!cancelled) {
          devWarn('Public gallery examples unavailable');
          setState({ status: 'error', items: [] });
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [attempt]);

  return { ...state, retry: () => setAttempt((value) => value + 1) };
}