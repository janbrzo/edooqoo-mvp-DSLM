import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({ toast: { success: (...a: unknown[]) => toastSuccess(...a), error: (...a: unknown[]) => toastError(...a) } }));
vi.mock('@/lib/edgeFunctionHeaders', () => ({ edgeFunctionHeaders: async () => ({ 'Content-Type': 'application/json' }) }));

import { useHomeworkExerciseGeneration } from '../useHomeworkExerciseGeneration';

const formData = { lessonTopic: 'Delivery delays', lessonGoal: 'Chase an order', englishLevel: 'B1/B2' };

function getGenerate() {
  let fn: ReturnType<typeof useHomeworkExerciseGeneration>['generateSimilarExercises'] | null = null;
  const Probe = () => {
    fn = useHomeworkExerciseGeneration().generateSimilarExercises;
    return null;
  };
  renderToStaticMarkup(React.createElement(Probe));
  return fn as unknown as ReturnType<typeof useHomeworkExerciseGeneration>['generateSimilarExercises'];
}

describe('useHomeworkExerciseGeneration batch response', () => {
  const realFetch = globalThis.fetch;
  const respond = (payload: Record<string, unknown>) => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })) as unknown as typeof fetch;
  };
  beforeEach(() => {
    toastSuccess.mockReset();
    toastError.mockReset();
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('works without fullPrompt in the response (the engine no longer returns its system message)', async () => {
    respond({ exercises: [{ type: 'word-order', title: 'Word order', instructions: 'Order', content: 'x' }], success: true });
    await getGenerate()(formData, 'teacher-1', { targetTypes: ['word-order'], countPerType: 1 });
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith('Generated 1 exercise(s) successfully!');
  });

  it('still accepts a response from an older deployment that carries fullPrompt', async () => {
    respond({ exercises: [{ type: 'word-order', title: 't', instructions: 'i', content: 'c' }], fullPrompt: 'SYSTEM TEXT', success: true });
    await getGenerate()(formData, 'teacher-1', { targetTypes: ['word-order'], countPerType: 1 });
    expect(toastError).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });
});
