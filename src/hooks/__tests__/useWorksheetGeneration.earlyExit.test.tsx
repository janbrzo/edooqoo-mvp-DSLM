import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { installBrowserStubs } from '@/lib/worksheet/__tests__/browserStubs';

const toastMock = vi.fn();
const generateAudioMock = vi.fn();
const generateImageMock = vi.fn();
const formatPromptMock = vi.fn();
const streamMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastMock }) }));
vi.mock('@/hooks/useEventTracking', () => ({ useEventTracking: () => ({ trackEvent: vi.fn() }) }));
vi.mock('@/contexts/DemoContext', () => ({
  useDemoContext: () => ({ isDemoMode: false, showDemoBlockedToast: vi.fn() }),
}));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) },
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: vi.fn(),
  },
}));
vi.mock('@/services/mediaService', () => ({
  generateAudioForWorksheet: (...args: unknown[]) => generateAudioMock(...args),
  generateImageForWorksheet: (...args: unknown[]) => generateImageMock(...args),
}));
vi.mock('@/utils/promptFormatter', () => ({
  formatPromptForAI: (...args: unknown[]) => formatPromptMock(...args),
  createFormDataForStorage: (data: Record<string, unknown>) => ({ ...data }),
}));
vi.mock('@/services/worksheetStreamService', async () => {
  const actual = await vi.importActual<typeof import('@/services/worksheetStreamService')>(
    '@/services/worksheetStreamService',
  );
  return { ...actual, streamWorksheetGeneration: (...args: unknown[]) => streamMock(...args) };
});
vi.mock('@/services/worksheetService', () => ({ generateWorksheet: vi.fn() }));
vi.mock('@/hooks/useWorksheetClaim', () => ({ markWorksheetForClaim: vi.fn() }));
vi.mock('@/components/WorksheetForm', () => ({}));

import { useWorksheetGeneration } from '../useWorksheetGeneration';
import { PROMPT_HARD_LIMIT } from '@/components/WorksheetForm/constants';
import { getActiveGenerationJobs } from '@/lib/worksheet/generationJobRegistry';

type Handler = ReturnType<typeof useWorksheetGeneration>['generateWorksheetHandler'];

/** Renders the hook once on the server and hands back its handler. */
function getHandler(): Handler {
  let handler: Handler | null = null;
  const worksheetState = {
    clearWorksheetStorage: vi.fn(),
    setInputParams: vi.fn(),
  };
  function Probe() {
    handler = useWorksheetGeneration('teacher-1', worksheetState, null, {
      hasTokens: true,
      canGenerateWorksheet: true,
      isDemo: false,
      consumeToken: async () => true,
    }).generateWorksheetHandler;
    return null;
  }
  renderToStaticMarkup(React.createElement(Probe));
  return handler as unknown as Handler;
}

const baseForm = {
  lessonTime: '60min',
  lessonTopic: 'Ordering food',
  lessonGoal: '',
  teachingPreferences: '',
  selectedExercises: ['reading', 'true-false', 'matching', 'fill-in-blanks', 'categorize', 'odd-one-out', 'multiple-choice', 'discussion'],
} as never;

function expectEndedJob(messagePattern: RegExp) {
  const jobs = getActiveGenerationJobs();
  expect(jobs).toHaveLength(1);
  expect(jobs[0].status).toBe('failed');
  expect(jobs[0].errorMessage).toMatch(messagePattern);
  // Never reached the backend: no recovery window, so the modal closes now.
  expect(jobs[0].recoveryDeadlineAt).toBeNull();
  expect(streamMock).not.toHaveBeenCalled();
  expect(toastMock).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
}

describe('useWorksheetGeneration: exits before the stream starts end the job', () => {
  beforeEach(() => {
    installBrowserStubs();
    toastMock.mockReset();
    generateAudioMock.mockReset();
    generateImageMock.mockReset();
    formatPromptMock.mockReset();
    streamMock.mockReset();
    formatPromptMock.mockResolvedValue('prompt');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('audio pre-generation failure', async () => {
    generateAudioMock.mockRejectedValue(new Error('tts down'));
    const handler = getHandler();
    await handler({
      ...(baseForm as object),
      selectedExercises: ['listening-comprehension', 'reading', 'matching', 'true-false', 'fill-in-blanks', 'categorize'],
    } as never);
    expectEndedJob(/couldn't generate the audio/);
  });

  it('image pre-generation failure', async () => {
    generateImageMock.mockRejectedValue(new Error('image down'));
    const handler = getHandler();
    await handler({
      ...(baseForm as object),
      selectedExercises: ['describe-picture', 'reading', 'matching', 'true-false', 'fill-in-blanks', 'categorize'],
    } as never);
    expectEndedJob(/couldn't generate the image/);
  });

  it('prompt over the character budget', async () => {
    formatPromptMock.mockResolvedValue('x'.repeat(PROMPT_HARD_LIMIT + 1));
    const handler = getHandler();
    await handler(baseForm);
    expectEndedJob(/too long/);
  });

  it('prompt formatting service failure', async () => {
    formatPromptMock.mockRejectedValue(new Error('Prompt service unavailable'));
    const handler = getHandler();
    await handler(baseForm);
    const jobs = getActiveGenerationJobs();
    expect(jobs).toHaveLength(1);
    expect(jobs[0].status).toBe('failed');
    expect(jobs[0].errorMessage).toMatch(/Prompt service unavailable/);
    expect(jobs[0].recoveryDeadlineAt).toBeNull();
    expect(streamMock).not.toHaveBeenCalled();
  });
});
