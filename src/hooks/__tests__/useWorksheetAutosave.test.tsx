// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const updateWorksheetAPI = vi.fn(async () => ({ success: true }));
vi.mock('@/services/worksheetService/updateService', () => ({
  updateWorksheetAPI: (...args: unknown[]) => updateWorksheetAPI(...(args as [])),
}));

import { useWorksheetAutosave } from '../useWorksheetAutosave';
import { resolveLessonMedia, withColumnTitle } from '@/lib/worksheetEditor/lessonMedia';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Api = ReturnType<typeof useWorksheetAutosave> & {
  edit: (title: string) => void;
  editExercise: (text: string) => void;
  editWithoutFlag: (title: string) => void;
  media: ReturnType<typeof resolveLessonMedia>;
};

let api: Api;

// Mirrors how WorksheetDisplay wires the hook: media is derived from the row
// columns (never written into the worksheet state) and edits go through a
// setter that flags the autosave first.
function Harness({ columns, loadedTitle, columnTitle }: { columns: Record<string, unknown>; loadedTitle: string; columnTitle: string }) {
  const [worksheet, setWorksheet] = useState<any>(() => withColumnTitle({ title: loadedTitle, exercises: [{ type: 'reading' }] }, columnTitle));
  const autosave = useWorksheetAutosave({ worksheetId: 'ws-1', userId: 'teacher-1', worksheet });
  const media = resolveLessonMedia({ columns, formData: {}, worksheetJson: worksheet });
  api = {
    ...autosave,
    media,
    edit: (title: string) => {
      autosave.markUserEdited();
      setWorksheet((prev: any) => ({ ...prev, title }));
    },
    editExercise: (text: string) => {
      autosave.markUserEdited();
      setWorksheet((prev: any) => ({ ...prev, exercises: [{ ...prev.exercises[0], content: text }] }));
    },
    editWithoutFlag: (title: string) => setWorksheet((prev: any) => ({ ...prev, title })),
  };
  return null;
}

let container: HTMLDivElement;
let root: Root;

const mount = (props: React.ComponentProps<typeof Harness>) => {
  act(() => {
    root.render(<Harness {...props} />);
  });
};

beforeEach(() => {
  vi.useFakeTimers();
  updateWorksheetAPI.mockClear();
  container = document.createElement('div');
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  vi.useRealTimers();
});

const audioColumns = {
  selected_audio: { url: 'https://cdn.example.com/a.mp3', transcript: 'Hi' },
  audio_url: 'https://cdn.example.com/a.mp3',
  audio_transcript: 'Hi',
};

describe('opening a worksheet never writes it (R37)', () => {
  it('media only in columns: no updateWorksheetAPI call within 5 s, media still derived', async () => {
    mount({ columns: audioColumns, loadedTitle: 'Markets', columnTitle: 'Markets' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(updateWorksheetAPI).not.toHaveBeenCalled();
    expect(api.media.hasAudio).toBe(true);
    expect(api.status).toBe('idle');
    expect(api.hasUnsavedChanges).toBe(false);
  });

  it('a state change that is not a user edit is never persisted', async () => {
    mount({ columns: audioColumns, loadedTitle: 'Markets', columnTitle: 'Markets' });
    act(() => api.editWithoutFlag('Hydrated by some effect'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10000);
    });
    expect(updateWorksheetAPI).not.toHaveBeenCalled();
    expect(api.hasUnsavedChanges).toBe(false);
  });

  it('a real edit is saved once after the debounce', async () => {
    mount({ columns: audioColumns, loadedTitle: 'Markets', columnTitle: 'Markets' });
    act(() => api.edit('Markets at night'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });
    expect(updateWorksheetAPI).toHaveBeenCalledTimes(1);
    const [worksheetId, saved, userId] = updateWorksheetAPI.mock.calls[0] as unknown as [string, any, string];
    expect(worksheetId).toBe('ws-1');
    expect(userId).toBe('teacher-1');
    expect(saved.title).toBe('Markets at night');
    // Lesson media is derived at read time and never written into the JSON.
    expect(saved).not.toHaveProperty('selected_audio');
    expect(saved).not.toHaveProperty('audio_url');
  });

  it('a rename from the list is not reverted by the first real edit', async () => {
    // Row column title was renamed from the list; the JSON still has the old one.
    mount({ columns: {}, loadedTitle: 'Old JSON title', columnTitle: 'Renamed in the list' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(updateWorksheetAPI).not.toHaveBeenCalled();

    act(() => api.editExercise('A corrected passage'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });
    expect(updateWorksheetAPI).toHaveBeenCalledTimes(1);
    const saved = (updateWorksheetAPI.mock.calls[0] as unknown as [string, any, string])[1];
    expect(saved.title).toBe('Renamed in the list');
    expect(saved.exercises[0].content).toBe('A corrected passage');
  });
});
