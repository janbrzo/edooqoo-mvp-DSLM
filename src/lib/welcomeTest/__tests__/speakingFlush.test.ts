import { describe, it, expect } from 'vitest';
import { flushSpeaking, registerSpeakingFlusher } from '../speakingFlush';

describe('speakingFlush', () => {
  it('resolves true without a recorder', async () => {
    expect(await flushSpeaking()).toBe(true);
  });
  it('delegates to the registered flusher and unregisters', async () => {
    const off = registerSpeakingFlusher(async () => false);
    expect(await flushSpeaking()).toBe(false);
    off();
    expect(await flushSpeaking()).toBe(true);
  });
  it('treats a throwing flusher as failure', async () => {
    const off = registerSpeakingFlusher(async () => { throw new Error('x'); });
    expect(await flushSpeaking()).toBe(false);
    off();
  });
});
