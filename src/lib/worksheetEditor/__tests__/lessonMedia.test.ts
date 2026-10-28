import { describe, it, expect } from 'vitest';
import { resolveLessonMedia, withColumnTitle } from '../lessonMedia';

const image = { id: 'img-1', url: 'https://cdn.example.com/lesson.jpg', description: 'A busy market' };
const audio = {
  url: 'https://cdn.example.com/lesson.mp3',
  ai_generated_audio_url: 'https://cdn.example.com/lesson.mp3',
  transcript: 'Hello and welcome.',
  duration: 42,
  voice: 'alloy',
};

describe('resolveLessonMedia: three cohorts keep their media', () => {
  it('cohort 1: media only in the row columns', () => {
    const media = resolveLessonMedia({
      columns: { selected_image: image, selected_audio: audio, audio_url: audio.url },
      formData: { lessonTopic: 'Markets' },
      worksheetJson: { title: 'Markets', exercises: [] },
    });
    expect(media.selectedImage).toEqual(image);
    expect(media.selectedAudio).toMatchObject({ url: audio.url, transcript: 'Hello and welcome.' });
    expect(media.hasImage).toBe(true);
    expect(media.hasAudio).toBe(true);
    expect(media.audioUrl).toBe(audio.url);
  });

  it('cohort 2: media only in form_data (columns empty)', () => {
    const media = resolveLessonMedia({
      columns: { selected_image: null, selected_audio: null, audio_url: null },
      formData: { selectedImage: image, selectedAudio: audio },
      worksheetJson: { exercises: [] },
    });
    expect(media.selectedImage).toEqual(image);
    expect(media.selectedAudio).toMatchObject({ url: audio.url });
    expect(media.audioTranscript).toBe('Hello and welcome.');
  });

  it('cohort 3: legacy rows with media only as keys inside the JSON', () => {
    const media = resolveLessonMedia({
      columns: {},
      formData: {},
      worksheetJson: {
        selected_image: image,
        audio_url: audio.url,
        audio_transcript: 'Legacy transcript',
        audio_duration: 10,
        audio_voice: 'nova',
      },
    });
    expect(media.selectedImage).toEqual(image);
    expect(media.selectedAudio).toMatchObject({
      url: audio.url,
      ai_generated_audio_url: audio.url,
      transcript: 'Legacy transcript',
      duration: 10,
      voice: 'nova',
    });
  });

  it('reconstructs the audio object from audio_url when selected_audio is missing (19 prod rows)', () => {
    const media = resolveLessonMedia({
      columns: { audio_url: audio.url, audio_transcript: 'From column', audio_duration: 7, audio_voice: 'echo' },
    });
    expect(media.selectedAudio).toMatchObject({
      url: audio.url,
      ai_generated_audio_url: audio.url,
      transcript: 'From column',
      duration: 7,
      voice: 'echo',
      source: 'database-reconstructed',
    });
  });

  it('prefers columns over form_data over JSON keys', () => {
    const colImage = { ...image, url: 'https://cdn.example.com/column.jpg' };
    const formImage = { ...image, url: 'https://cdn.example.com/form.jpg' };
    const jsonImage = { ...image, url: 'https://cdn.example.com/json.jpg' };
    expect(
      resolveLessonMedia({
        columns: { selected_image: colImage },
        formData: { selectedImage: formImage },
        worksheetJson: { selected_image: jsonImage },
      }).selectedImage?.url,
    ).toBe(colImage.url);
    expect(
      resolveLessonMedia({ formData: { selectedImage: formImage }, worksheetJson: { selected_image: jsonImage } })
        .selectedImage?.url,
    ).toBe(formImage.url);
  });

  it('returns no media for a worksheet without any and ignores unusable objects', () => {
    const media = resolveLessonMedia({
      columns: { selected_image: {}, selected_audio: { transcript: 'no url' } },
      formData: null,
      worksheetJson: null,
    });
    expect(media.hasImage).toBe(false);
    expect(media.hasAudio).toBe(false);
    expect(media.selectedImage).toBeNull();
    expect(media.selectedAudio).toBeNull();
  });

  it('does not mutate its inputs', () => {
    const json = Object.freeze({ title: 'x', exercises: Object.freeze([]) });
    const columns = Object.freeze({ selected_image: Object.freeze({ ...image }), audio_url: audio.url });
    expect(() => resolveLessonMedia({ columns, worksheetJson: json })).not.toThrow();
    expect(Object.keys(json)).toEqual(['title', 'exercises']);
  });
});

describe('withColumnTitle', () => {
  it('starts the editor from the renamed column title', () => {
    const json = { title: 'Old JSON title', exercises: [] };
    expect(withColumnTitle(json, 'Renamed in the list').title).toBe('Renamed in the list');
    expect(json.title).toBe('Old JSON title');
  });

  it('keeps the same object when the titles already match or the column is empty', () => {
    const json = { title: 'Same', exercises: [] };
    expect(withColumnTitle(json, 'Same')).toBe(json);
    expect(withColumnTitle(json, '  ')).toBe(json);
    expect(withColumnTitle(json, null)).toBe(json);
    expect(withColumnTitle(null, 'x')).toBeNull();
  });
});
