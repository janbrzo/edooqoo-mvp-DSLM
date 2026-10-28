// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const updateWorksheetAPI = vi.fn(async () => ({ success: true }));
vi.mock('@/services/worksheetService/updateService', () => ({
  updateWorksheetAPI: (...args: unknown[]) => updateWorksheetAPI(...(args as [])),
  updateWorksheetStudentAPI: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', () => {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    is: () => chain,
    maybeSingle: async () => ({ data: null, error: null }),
    then: undefined,
  };
  return {
    supabase: {
      from: vi.fn(() => chain),
      rpc: vi.fn(async () => ({ data: [], error: null })),
      auth: {
        getSession: vi.fn(async () => ({ data: { session: null } })),
        getUser: vi.fn(async () => ({ data: { user: null } })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
      functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
      channel: vi.fn(() => ({ on: vi.fn().mockReturnThis(), subscribe: vi.fn() })),
      removeChannel: vi.fn(),
    },
  };
});
vi.mock('@/contexts/DemoContext', () => ({
  useDemoContext: () => ({ isDemoMode: false, showDemoBlockedToast: vi.fn() }),
}));

// Heavy surrounding UI is replaced by inert stubs; the media/autosave wiring under test is real.
vi.mock('@/components/worksheet/WorksheetHeader', () => ({
  default: ({ onTitleChange }: { onTitleChange: (t: string) => void }) => (
    <button data-testid="rename" onClick={() => onTitleChange('Typed in the header')} />
  ),
}));
vi.mock('@/components/worksheet/WorksheetContainer', () => ({
  default: ({ children, selectedImage, selectedAudio }: any) => (
    <div data-testid="container" data-image={selectedImage?.url ?? ''} data-audio={selectedAudio?.url ?? ''}>
      {children}
    </div>
  ),
}));
vi.mock('@/components/worksheet/WorksheetContent', () => ({
  default: ({ lessonMedia, editableWorksheet, setEditableWorksheet }: any) => (
    <div data-testid="content" data-image={lessonMedia?.selectedImage?.url ?? ''} data-audio={lessonMedia?.selectedAudio?.url ?? ''}>
      <button
        data-testid="edit-exercise"
        onClick={() =>
          setEditableWorksheet({ ...editableWorksheet, exercises: [{ ...editableWorksheet.exercises[0], content: 'Edited' }] })
        }
      />
    </div>
  ),
}));
vi.mock('@/components/WorksheetRating', () => ({ default: () => null }));
vi.mock('@/components/worksheet/InputParamsCard', () => ({ default: () => null }));
vi.mock('@/components/worksheet/WorksheetToolbar', () => ({ default: () => null }));
vi.mock('@/components/worksheet/WorksheetViewTracking', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/worksheet/LiveSessionQuickNotes', () => ({ LiveSessionQuickNotes: () => null }));
vi.mock('@/components/worksheet/DraftTeacherNotes', () => ({ DraftTeacherNotes: () => null }));
vi.mock('@/components/worksheet/AddExerciseModal', () => ({ AddExerciseModal: () => null }));
vi.mock('@/components/homework/CreateHomeworkModal', () => ({ CreateHomeworkModal: () => null }));
vi.mock('@/components/flashcards/QuickAddWordToFlashcardsModal', () => ({ QuickAddWordToFlashcardsModal: () => null }));
vi.mock('@/components/flashcards/ViewFlashcardSetsModal', () => ({ ViewFlashcardSetsModal: () => null }));
vi.mock('@/components/flashcards/FlashcardFABs', () => ({ SelectWordFAB: () => null, QuickAddWordFAB: () => null }));
vi.mock('@/components/worksheet/SelectWordMode', () => ({ SelectWordMode: () => null }));
vi.mock('@/components/drawing', () => ({ DrawingToolbar: () => null, DrawingOverlay: () => null }));
vi.mock('@/components/student-knowledge/StudentKnowledgeFAB', () => ({ StudentKnowledgeFAB: () => null }));
vi.mock('@/components/student-knowledge/StudentKnowledgeMiniList', () => ({ StudentKnowledgeMiniList: () => null }));
vi.mock('@/components/student-knowledge/StudentKnowledgeToggleButton', () => ({ StudentKnowledgeToggleButton: () => null }));
vi.mock('@/components/student-knowledge/StudentKnowledgeFloatingPanel', () => ({ StudentKnowledgeFloatingPanel: () => null }));
vi.mock('@/components/student-knowledge/StudentKnowledgeLessonIdeasButton', () => ({ StudentKnowledgeLessonIdeasButton: () => null }));
vi.mock('@/components/LoginRequiredModal', () => ({ LoginRequiredModal: () => null }));
vi.mock('@/components/StudentRequiredModal', () => ({ StudentRequiredModal: () => null }));
const STABLE = vi.hoisted(() => ({
  knowledge: { entries: [], suggestedTags: [], isLoading: false },
  students: { students: [] },
  sets: { sets: [] },
  live: { liveAnswers: {}, liveItemEvaluations: {}, liveAiEvaluations: {}, liveAudioAnswers: {}, studentEmail: null, isConnected: false },
  track: { trackDownloadAttempt: () => undefined },
  pay: { trackPaymentButtonClick: () => undefined },
  dl: { isDownloadUnlocked: true, userIp: null, handleDownloadUnlock: () => undefined, trackDownload: () => undefined, checkTokenGeneratedWorksheet: () => undefined },
}));
vi.mock('@/hooks/useStudentKnowledge', () => ({ useStudentKnowledge: () => STABLE.knowledge }));
vi.mock('@/hooks/useStudents', () => ({ useStudents: () => STABLE.students }));
vi.mock('@/hooks/useFlashcardSets', () => ({ useFlashcardSets: () => STABLE.sets }));
vi.mock('@/hooks/useLiveSessionAnswers', () => ({ useLiveSessionAnswers: () => STABLE.live }));
vi.mock('@/hooks/useDownloadTracking', () => ({ useDownloadTracking: () => STABLE.track }));
vi.mock('@/hooks/usePaymentTracking', () => ({ usePaymentTracking: () => STABLE.pay }));
vi.mock('@/hooks/useDownloadStatus', () => ({ useDownloadStatus: () => STABLE.dl }));
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/hooks/useHardLightSurface', () => ({ useHardLightSurface: () => undefined }));

import WorksheetDisplay from '../WorksheetDisplay';
import { TooltipProvider } from '@/components/ui/tooltip';
import { resolveLessonMedia, withColumnTitle } from '@/lib/worksheetEditor/lessonMedia';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

const image = { id: 'img-1', url: 'https://cdn.example.com/lesson-image.jpg', description: 'A busy market' };
const audio = { url: 'https://cdn.example.com/lesson-audio.mp3', transcript: 'Hello.' };

// What WorksheetPage does: the row columns hold the media, the JSON and form_data do not.
const row = {
  title: 'Renamed in the list',
  form_data: { lessonTopic: 'Markets' },
  selected_image: image,
  selected_audio: audio,
  audio_url: audio.url,
  audio_transcript: 'Hello.',
};
const loadedJson = {
  title: 'Old JSON title',
  subtitle: 'Sub',
  introduction: 'Intro',
  vocabulary_sheet: [],
  exercises: [{ type: 'reading', title: 'Exercise 1: Reading', icon: 'x', time: 5, instructions: 'Read', content: 'Text', teacher_tip: 't' }],
};

function Page() {
  const parsed = React.useMemo(() => withColumnTitle(loadedJson, row.title), []);
  const [editable, setEditable] = useState<any>(parsed);
  const lessonMedia = React.useMemo(
    () => resolveLessonMedia({ columns: row, formData: row.form_data, worksheetJson: parsed }),
    [parsed],
  );
  return (
    <TooltipProvider>
      <WorksheetDisplay
        worksheet={parsed}
        inputParams={row.form_data}
        generationTime={0}
        sourceCount={0}
        onBack={() => undefined}
        worksheetId="ws-1"
        editableWorksheet={editable}
        setEditableWorksheet={setEditable}
        userId="teacher-1"
        lessonMedia={lessonMedia}
        worksheetTitle={row.title}
      />
    </TooltipProvider>
  );
}

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.useFakeTimers();
  updateWorksheetAPI.mockClear();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

describe('WorksheetDisplay: no write on open (R37)', () => {
  it('shows media that exists only in columns and triggers no save within 5 s', async () => {
    await act(async () => {
      root.render(<Page />);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });

    expect(container.querySelector('[data-testid="container"]')!.getAttribute('data-image')).toBe(image.url);
    expect(container.querySelector('[data-testid="content"]')!.getAttribute('data-audio')).toBe(audio.url);
    expect(updateWorksheetAPI).not.toHaveBeenCalled();
  });

  it('saves once after a genuine edit and keeps the list rename, with no media keys in the JSON', async () => {
    await act(async () => {
      root.render(<Page />);
    });
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="edit-exercise"]')!.click();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2600);
    });

    expect(updateWorksheetAPI).toHaveBeenCalledTimes(1);
    const saved = (updateWorksheetAPI.mock.calls[0] as unknown as [string, any, string])[1];
    expect(saved.title).toBe('Renamed in the list');
    expect(saved.exercises[0].content).toBe('Edited');
    expect(saved).not.toHaveProperty('selected_image');
    expect(saved).not.toHaveProperty('selected_audio');
    expect(saved).not.toHaveProperty('audio_url');
  });
});
