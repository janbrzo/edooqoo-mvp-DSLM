// Pure guards for transcribe-audio (no Deno APIs, unit-testable with Vitest).
//
// transcribe-audio fetches a caller-supplied URL and forwards it to paid Whisper,
// so the URL must point at this project's own media hosts (SSRF + cost abuse) and
// the download must stay under the Whisper file limit.

/** OpenAI Whisper accepts files up to 25 MB. */
export const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

/** Default public R2 host used by upload-to-r2 when R2_PUBLIC_URL is not set. */
export const DEFAULT_R2_PUBLIC_URL = 'https://pub-1b974ada9ae240948229c52d927980ee.r2.dev';

function hostOf(value: string | null | undefined): string | null {
  const raw = (value ?? '').trim();
  if (!raw) return null;
  try {
    return new URL(raw.includes('://') ? raw : `https://${raw}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Hosts audio may be fetched from: Supabase project, R2 public URL and R2 custom domain. */
export function buildAllowedAudioHosts(env: {
  supabaseUrl?: string | null;
  r2PublicUrl?: string | null;
  r2CustomDomain?: string | null;
}): string[] {
  const hosts = new Set<string>();
  for (const v of [env.supabaseUrl, env.r2PublicUrl, DEFAULT_R2_PUBLIC_URL, env.r2CustomDomain]) {
    const h = hostOf(v);
    if (h) hosts.add(h);
  }
  return Array.from(hosts);
}

/** Returns the normalized URL when it is https, has no credentials and an allowed host, else null. */
export function validateAudioUrl(value: unknown, allowedHosts: readonly string[]): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return null;
    if (url.username || url.password) return null;
    if (url.port && url.port !== '443') return null;
    if (!allowedHosts.includes(url.hostname.toLowerCase())) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** True when a Content-Length header value already exceeds the cap (missing or invalid: false). */
export function exceedsDeclaredSize(contentLength: string | null | undefined, max = MAX_AUDIO_BYTES): boolean {
  if (!contentLength) return false;
  const n = Number(contentLength);
  return Number.isFinite(n) && n > max;
}

export class AudioTooLargeError extends Error {
  constructor() {
    super('Audio file is too large');
  }
}

/** Reads a response body fully, aborting as soon as more than `max` bytes arrive. */
export async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  max = MAX_AUDIO_BYTES,
): Promise<Uint8Array> {
  if (!body) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    total += value.byteLength;
    if (total > max) {
      try { await reader.cancel(); } catch { /* ignore */ }
      throw new AudioTooLargeError();
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.byteLength; }
  return out;
}
