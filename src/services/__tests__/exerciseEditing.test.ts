import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { access_token: 't' } } })) },
    functions: { invoke: vi.fn() },
  },
}));
vi.mock('@/lib/edgeFunctionHeaders', () => ({ edgeFunctionHeaders: vi.fn(async () => ({})) }));

import { appendExercise, countActiveExercises, requestNewExercise } from '../exerciseAddService';
import { exerciseRegenerationService, resolveImageDescription, resolveTranscript } from '../exerciseRegenerationService';
import { resolveLessonMedia } from '@/lib/worksheetEditor/lessonMedia';
import { supabase } from '@/integrations/supabase/client';

describe('appendExercise', () => {
  const worksheet = {
    title: 'W',
    exercises: [{ title: 'Exercise 1: Reading' }, { title: 'Exercise 2: Gone', deleted: true }],
  };

  it('numbers after active exercises, keeps deleted ones and does not mutate', () => {
    const next = appendExercise(worksheet, { title: 'Exercise 9: Matching', type: 'matching' }, 'Matching');
    expect(next.exercises).toHaveLength(3);
    expect((next.exercises[2] as { title: string }).title).toBe('Exercise 2: Matching');
    expect(worksheet.exercises).toHaveLength(2);
    expect(countActiveExercises(next)).toBe(2);
  });

  it('falls back to the label when the generated title is empty', () => {
    const next = appendExercise({ exercises: [] }, { type: 'matching' }, 'Matching');
    expect((next.exercises[0] as { title: string }).title).toBe('Exercise 1: Matching');
  });
});

describe('requestNewExercise', () => {
  it('rejects ids that are not in the exercise taxonomy before any network call', async () => {
    await expect(
      requestNewExercise({ exerciseType: 'synonyms-antonyms', formData: {}, userId: 'u' }),
    ).rejects.toThrow(/Unknown exercise type/);
    expect(supabase.functions.invoke).not.toHaveBeenCalled();
  });

  it('truncates long instructions', async () => {
    (supabase.functions.invoke as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { exercises: [{ title: 'x' }] },
      error: null,
    });
    await requestNewExercise({ exerciseType: 'matching', additionalInstructions: 'a'.repeat(900), formData: {}, userId: 'u' });
    const body = (supabase.functions.invoke as ReturnType<typeof vi.fn>).mock.calls.at(-1)![1].body;
    expect(body.prompt.length).toBeLessThan(900);
  });
});

describe('regeneration media context (camelCase form_data)', () => {
  const image = { url: 'https://cdn.example.com/i.jpg', description: 'A busy market' };
  const audio = { url: 'https://cdn.example.com/a.mp3', transcript: 'Welcome to the show.' };

  it('reads the image description from form_data.selectedImage, not selected_image', () => {
    expect(resolveImageDescription({ selectedImage: image })).toBe('A busy market');
    expect(resolveImageDescription({ selected_image: image })).toBeNull();
  });

  it('reads the transcript from form_data.selectedAudio or the derived lesson media', () => {
    expect(resolveTranscript({ selectedAudio: audio })).toBe('Welcome to the show.');
    const media = resolveLessonMedia({ columns: { selected_image: image, selected_audio: audio }, formData: {} });
    expect(resolveImageDescription({}, media)).toBe('A busy market');
    expect(resolveTranscript({}, media)).toBe('Welcome to the show.');
  });

  it('puts the image description into the regeneration prompt of a picture exercise', () => {
    const prompt = (exerciseRegenerationService as unknown as {
      createRegenerationPrompt: (f: unknown, e: unknown, g: string) => string;
    }).createRegenerationPrompt({ selectedImage: image }, { type: 'describe-picture', title: 't', instructions: 'i' }, '');
    expect(prompt).toContain('A busy market');
  });
});
