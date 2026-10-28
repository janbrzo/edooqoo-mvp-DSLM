// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: { getSession: vi.fn(async () => ({ data: { session: null } })) },
    functions: { invoke: vi.fn() },
    channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
    removeChannel: vi.fn(),
  },
}));
vi.mock('@/contexts/DemoContext', () => ({
  useDemoContext: () => ({ isDemoMode: false, showDemoBlockedToast: vi.fn() }),
}));

import WorksheetContent from '../WorksheetContent';
import { resolveLessonMedia } from '@/lib/worksheetEditor/lessonMedia';

const image = { id: 'img-1', url: 'https://cdn.example.com/lesson-image.jpg', description: 'A busy market' };
const audio = {
  url: 'https://cdn.example.com/lesson-audio.mp3',
  ai_generated_audio_url: 'https://cdn.example.com/lesson-audio.mp3',
  transcript: 'Hello and welcome.',
};

const baseWorksheet = () => ({
  title: 'Markets',
  subtitle: 'Talking about shopping',
  introduction: 'Intro',
  exercises: [
    {
      type: 'reading',
      title: 'Exercise 1: Reading',
      icon: 'x',
      time: 5,
      instructions: 'Read it',
      content: 'A text',
      questions: [],
      teacher_tip: 'tip',
    },
    {
      type: 'answer-questions',
      title: 'Exercise 2: Answer questions',
      icon: 'x',
      time: 5,
      instructions: 'Answer',
      media_url: 'https://cdn.example.com/exercise-own-image.jpg',
      media_type: 'image',
      questions: [{ question: 'What do you see?', answer: 'A market' }],
      teacher_tip: 'tip',
    },
  ],
});

const renderOwnerView = (media: ReturnType<typeof resolveLessonMedia>, worksheet: any, inputParams: any) =>
  renderToStaticMarkup(
    <WorksheetContent
      editableWorksheet={worksheet}
      isEditing={false}
      viewMode="teacher"
      setEditableWorksheet={() => undefined}
      worksheetId="ws-1"
      isDownloadUnlocked
      inputParams={inputParams}
      lessonMedia={media}
      userId="teacher-1"
    />,
  );

describe('owner view renders lesson media for every cohort', () => {
  it('cohort 1: media only in the row columns (JSON and form_data empty)', () => {
    const media = resolveLessonMedia({
      columns: { selected_image: image, selected_audio: audio, audio_url: audio.url },
      formData: { lessonTopic: 'Markets' },
      worksheetJson: baseWorksheet(),
    });
    const html = renderOwnerView(media, baseWorksheet(), { lessonTopic: 'Markets' });
    expect(html).toContain('>Lesson Media</h2>');
    expect(html).toContain(image.url);
    expect(html).toContain(audio.url);
    // The lesson image replaces the per-exercise image.
    expect(html).not.toContain('exercise-own-image.jpg');
  });

  it('cohort 2: media only in form_data', () => {
    const inputParams = { lessonTopic: 'Markets', selectedImage: image, selectedAudio: audio };
    const media = resolveLessonMedia({ columns: {}, formData: inputParams, worksheetJson: baseWorksheet() });
    const html = renderOwnerView(media, baseWorksheet(), inputParams);
    expect(html).toContain('>Lesson Media</h2>');
    expect(html).toContain(image.url);
    expect(html).toContain(audio.url);
  });

  it('cohort 3: legacy rows with media only as JSON keys', () => {
    const worksheet = { ...baseWorksheet(), selected_image: image, audio_url: audio.url, audio_transcript: audio.transcript };
    const media = resolveLessonMedia({ columns: {}, formData: {}, worksheetJson: worksheet });
    const html = renderOwnerView(media, worksheet, {});
    expect(html).toContain('>Lesson Media</h2>');
    expect(html).toContain(image.url);
    expect(html).toContain(audio.url);
  });

  it('a worksheet without lesson media renders no Lesson Media block and keeps exercise images', () => {
    const media = resolveLessonMedia({ columns: {}, formData: {}, worksheetJson: baseWorksheet() });
    const html = renderOwnerView(media, baseWorksheet(), {});
    expect(html).not.toContain('>Lesson Media</h2>');
    expect(html).toContain('exercise-own-image.jpg');
  });

  it('derives the same media when the prop is omitted (inline view after generation)', () => {
    const worksheet = { ...baseWorksheet(), selected_image: image };
    const html = renderToStaticMarkup(
      <WorksheetContent
        editableWorksheet={worksheet}
        isEditing={false}
        viewMode="teacher"
        setEditableWorksheet={() => undefined}
        worksheetId="ws-1"
        isDownloadUnlocked
        inputParams={{ selectedImage: image }}
        userId="teacher-1"
      />,
    );
    expect(html).toContain(image.url);
  });
});
