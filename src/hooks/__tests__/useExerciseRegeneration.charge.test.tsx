import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const regenerateMock = vi.fn();
const updateDbMock = vi.fn();
const chargeMock = vi.fn();
let demo = false;

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/contexts/DemoContext', () => ({
  useDemoContext: () => ({ isDemoMode: demo, showDemoBlockedToast: vi.fn() }),
}));
vi.mock('@/services/exerciseRegenerationService', () => ({
  exerciseRegenerationService: {
    regenerateExercise: (...args: unknown[]) => regenerateMock(...args),
    updateWorksheetInDatabase: (...args: unknown[]) => updateDbMock(...args),
  },
}));
vi.mock('@/services/exerciseCreditService', () => ({
  chargeExerciseAction: (...args: unknown[]) => chargeMock(...args),
}));

import { useExerciseRegeneration } from '../useExerciseRegeneration';

function getRegenerate() {
  let fn: ReturnType<typeof useExerciseRegeneration>['regenerateExercise'] | null = null;
  const Probe = () => {
    fn = useExerciseRegeneration().regenerateExercise;
    return null;
  };
  renderToStaticMarkup(React.createElement(Probe));
  return fn as unknown as ReturnType<typeof useExerciseRegeneration>['regenerateExercise'];
}

const run = () =>
  getRegenerate()('ws-1', 0, {}, { type: 'matching' }, { exercises: [{}] }, vi.fn(), 'u-1');

describe('regeneration credit', () => {
  beforeEach(() => {
    demo = false;
    regenerateMock.mockReset();
    updateDbMock.mockReset();
    chargeMock.mockReset();
    chargeMock.mockResolvedValue({ status: 'charged' });
  });

  it('charges one regenerated exercise after generation and save succeeded', async () => {
    regenerateMock.mockResolvedValue({ type: 'matching' });
    updateDbMock.mockResolvedValue(undefined);
    await run();
    expect(chargeMock).toHaveBeenCalledTimes(1);
    expect(chargeMock).toHaveBeenCalledWith({ worksheetId: 'ws-1', action: 'regenerate_exercise', isDemo: false });
    expect(updateDbMock.mock.invocationCallOrder[0]).toBeLessThan(chargeMock.mock.invocationCallOrder[0]);
  });

  it('does not charge when generation fails', async () => {
    regenerateMock.mockRejectedValue(new Error('generation failed'));
    await run();
    expect(chargeMock).not.toHaveBeenCalled();
  });

  it('does not charge when saving fails', async () => {
    regenerateMock.mockResolvedValue({ type: 'matching' });
    updateDbMock.mockRejectedValue(new Error('save failed'));
    await run();
    expect(chargeMock).not.toHaveBeenCalled();
  });

  it('does nothing in demo mode', async () => {
    demo = true;
    await run();
    expect(regenerateMock).not.toHaveBeenCalled();
    expect(chargeMock).not.toHaveBeenCalled();
  });
});
