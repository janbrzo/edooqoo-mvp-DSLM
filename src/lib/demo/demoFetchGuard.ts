/**
 * Demo-mode safety net for Supabase REST reads.
 *
 * Demo ids (`demo-student-1`, `demo-teacher`) are not UUIDs, so any hook that
 * forgets its demo early-return makes PostgREST answer 400 (22P02). This guard
 * answers such reads locally with an empty result, so a missing guard degrades
 * to "no data" instead of a failed request. Mutations are never intercepted.
 */
const DEMO_STORAGE_KEY = 'edooqoo_demo_mode';

export function isDemoRestRead(method: string, url: string): boolean {
  const m = method.toUpperCase();
  if (m !== 'GET' && m !== 'HEAD') return false;
  if (!url.includes('/rest/v1/') || url.includes('/rest/v1/rpc/')) return false;
  return /=eq\.demo-/.test(url) || /=in\.\(?%?2?8?demo-/.test(url);
}

export function buildDemoEmptyResponse(method: string, wantsSingleObject: boolean): Response {
  if (wantsSingleObject) {
    return new Response(
      JSON.stringify({
        code: 'PGRST116',
        details: 'The result contains 0 rows',
        hint: null,
        message: 'JSON object requested, multiple (or no) rows returned',
      }),
      { status: 406, headers: { 'Content-Type': 'application/json' } },
    );
  }
  return new Response(method.toUpperCase() === 'HEAD' ? null : '[]', {
    status: 200,
    headers: { 'Content-Type': 'application/json', 'Content-Range': '*/0' },
  });
}

function isDemoActive(): boolean {
  try {
    // DemoContext stores the demo locale code (any non-empty value), not the literal 'true'.
    return typeof window !== 'undefined' && !!window.localStorage.getItem(DEMO_STORAGE_KEY);
  } catch {
    return false;
  }
}

export function installDemoFetchGuard(): void {
  if (typeof window === 'undefined') return;
  const original = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      if (isDemoActive()) {
        const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
        const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
        if (isDemoRestRead(method, url)) {
          const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
          const wantsSingle = (headers.get('Accept') ?? '').includes('vnd.pgrst.object');
          return Promise.resolve(buildDemoEmptyResponse(method, wantsSingle));
        }
      }
    } catch {
      // fall through to the real fetch
    }
    return original(input, init);
  };
}
