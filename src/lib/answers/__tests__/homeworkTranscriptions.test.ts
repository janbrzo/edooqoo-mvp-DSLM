import { describe, it, expect } from 'vitest';
import { missingTranscriptions } from '../../../../supabase/functions/process-pending-ai-evaluations/homeworkEval';

describe('missingTranscriptions', () => {
  it('lists recorded audio answers without a transcription', () => {
    const audio = { '0': 'https://x/a.webm', '2': 'https://x/b.webm', '3': '' };
    expect(missingTranscriptions(audio, { 0: { text: 'hi' } })).toEqual([2]);
  });
  it('is empty when every recording is transcribed or there is no audio', () => {
    expect(missingTranscriptions({ '1': 'https://x/a.webm' }, { 1: {} })).toEqual([]);
    expect(missingTranscriptions({}, {})).toEqual([]);
  });
});
