// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
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

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub);

import WorksheetContent from '../WorksheetContent';
import ExerciseRegenerateModal from '../ExerciseRegenerateModal';
import { MOVE_BLOCKED_REASON, REGENERATE_WARNING } from '@/lib/worksheetEditor/answerProtection';

const worksheet = {
  title: 'W',
  subtitle: 's',
  introduction: 'i',
  exercises: [
    { type: 'reading', title: 'Exercise 1: Reading', icon: 'x', time: 5, instructions: 'a', content: 'text', questions: [], teacher_tip: 't' },
    { type: 'matching', title: 'Exercise 2: Matching', icon: 'x', time: 5, instructions: 'b', items: [], teacher_tip: 't' },
    { type: 'gap-text', title: 'Exercise 3: Gap', icon: 'x', time: 5, instructions: 'c', teacher_tip: 't' },
  ],
};

const render = (answered?: ReadonlySet<number>) =>
  renderToStaticMarkup(
    <WorksheetContent
      editableWorksheet={worksheet}
      isEditing={false}
      viewMode="teacher"
      setEditableWorksheet={() => undefined}
      worksheetId="ws-1"
      isDownloadUnlocked
      inputParams={{}}
      userId="teacher-1"
      answeredExerciseIndexes={answered}
    />,
  );

const buttons = (html: string, title: string) => html.split('<button').filter((chunk) => chunk.includes(`title="${title}`));
const enabled = (html: string, title: string) =>
  buttons(html, title).filter((chunk) => !/\sdisabled(=|\s|>)/.test(chunk.split('>')[0]));

describe('Move up/down on worksheets with answers (R39)', () => {
  it('keeps the usable moves when nothing was answered (first cannot go up, last cannot go down)', () => {
    const html = render(new Set());
    expect(html).not.toContain(MOVE_BLOCKED_REASON);
    expect(enabled(html, 'Move down')).toHaveLength(2);
    expect(enabled(html, 'Move up')).toHaveLength(2);
  });

  it('locks every move that would touch the answered exercise and explains why', () => {
    // exercise 2 (index 1) answered: 1<->2 and 2<->3 are both blocked
    const html = render(new Set([1]));
    expect(html).toContain(MOVE_BLOCKED_REASON);
    expect(enabled(html, 'Move down')).toHaveLength(0);
    expect(enabled(html, 'Move up')).toHaveLength(0);
  });

  it('answers on one exercise leave moves between the others available', () => {
    // exercise 3 (index 2) answered: only reading <-> matching remains
    const html = render(new Set([2]));
    expect(enabled(html, 'Move down')).toHaveLength(1);
    expect(enabled(html, 'Move up')).toHaveLength(1);
  });
});

describe('Regenerate on an exercise with answers', () => {
  const props = {
    isOpen: true,
    onClose: () => undefined,
    onConfirm: () => undefined,
    guidelines: '',
    onGuidelinesChange: () => undefined,
    exerciseType: 'matching',
    exerciseTitle: 'Exercise 2: Matching',
  };

  const mountModal = async (answersWarning?: string) => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<ExerciseRegenerateModal {...props} answersWarning={answersWarning} />);
    });
    const submit = () => document.body.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    const text = () => document.body.textContent ?? '';
    const cleanup = async () => {
      await act(async () => root.unmount());
    };
    return { submit, text, cleanup };
  };

  it('shows the reason and keeps the submit button disabled until acknowledged', async () => {
    const { submit, text, cleanup } = await mountModal(REGENERATE_WARNING);
    expect(text()).toContain('already answered');
    expect(submit().disabled).toBe(true);

    await act(async () => {
      document.body.querySelector<HTMLButtonElement>('#regenerate-ack')!.click();
    });
    expect(submit().disabled).toBe(false);
    await cleanup();
  });

  it('is a plain confirmation when there are no answers', async () => {
    const { submit, text, cleanup } = await mountModal(undefined);
    expect(text()).not.toContain('already answered');
    expect(submit().disabled).toBe(false);
    await cleanup();
  });
});
