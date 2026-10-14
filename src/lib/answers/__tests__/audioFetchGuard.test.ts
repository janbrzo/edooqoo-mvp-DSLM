import { describe, it, expect } from 'vitest';
import {
  MAX_AUDIO_BYTES,
  AudioTooLargeError,
  buildAllowedAudioHosts,
  validateAudioUrl,
  exceedsDeclaredSize,
  readBodyWithLimit,
} from '../../../../supabase/functions/_shared/audioFetchGuard';

const hosts = buildAllowedAudioHosts({
  supabaseUrl: 'https://abc.supabase.co',
  r2PublicUrl: 'https://pub-xyz.r2.dev',
  r2CustomDomain: 'media.edooqoo.com',
});

describe('buildAllowedAudioHosts', () => {
  it('derives hosts from env and always includes the default R2 host', () => {
    expect(hosts).toContain('abc.supabase.co');
    expect(hosts).toContain('pub-xyz.r2.dev');
    expect(hosts).toContain('media.edooqoo.com');
    expect(buildAllowedAudioHosts({}).some((h) => h.endsWith('.r2.dev'))).toBe(true);
  });
});

describe('validateAudioUrl', () => {
  it('accepts https URLs on allowed hosts', () => {
    expect(validateAudioUrl('https://abc.supabase.co/storage/v1/object/public/a.webm', hosts)).not.toBeNull();
    expect(validateAudioUrl('https://pub-xyz.r2.dev/audio/a.webm', hosts)).not.toBeNull();
  });
  it('rejects http, other hosts, credentials, odd ports and junk', () => {
    expect(validateAudioUrl('http://abc.supabase.co/a.webm', hosts)).toBeNull();
    expect(validateAudioUrl('https://evil.com/a.webm', hosts)).toBeNull();
    expect(validateAudioUrl('https://abc.supabase.co.evil.com/a.webm', hosts)).toBeNull();
    expect(validateAudioUrl('https://abc.supabase.co@evil.com/a.webm', hosts)).toBeNull();
    expect(validateAudioUrl('https://user:pw@abc.supabase.co/a.webm', hosts)).toBeNull();
    expect(validateAudioUrl('https://abc.supabase.co:8443/a.webm', hosts)).toBeNull();
    expect(validateAudioUrl('https://169.254.169.254/latest', hosts)).toBeNull();
    expect(validateAudioUrl('file:///etc/passwd', hosts)).toBeNull();
    expect(validateAudioUrl('', hosts)).toBeNull();
    expect(validateAudioUrl(undefined, hosts)).toBeNull();
    expect(validateAudioUrl(42, hosts)).toBeNull();
  });
});

describe('size cap', () => {
  it('flags a declared size over the cap only', () => {
    expect(exceedsDeclaredSize(String(MAX_AUDIO_BYTES + 1))).toBe(true);
    expect(exceedsDeclaredSize(String(MAX_AUDIO_BYTES))).toBe(false);
    expect(exceedsDeclaredSize(null)).toBe(false);
    expect(exceedsDeclaredSize('abc')).toBe(false);
  });
  const streamOf = (sizes: number[]) =>
    new ReadableStream<Uint8Array>({
      start(c) { sizes.forEach((n) => c.enqueue(new Uint8Array(n))); c.close(); },
    });
  it('reads a body within the limit', async () => {
    const out = await readBodyWithLimit(streamOf([3, 4]), 10);
    expect(out.byteLength).toBe(7);
  });
  it('aborts a streamed body over the limit', async () => {
    await expect(readBodyWithLimit(streamOf([6, 6]), 10)).rejects.toBeInstanceOf(AudioTooLargeError);
  });
  it('handles a null body', async () => {
    expect((await readBodyWithLimit(null)).byteLength).toBe(0);
  });
});
