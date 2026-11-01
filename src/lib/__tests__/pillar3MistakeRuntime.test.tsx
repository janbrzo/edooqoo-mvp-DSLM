import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHomeworkMistakeFlashcards } from '@/hooks/useHomeworkMistakeFlashcards';
import { CreateMistakeFlashcardsButton } from '@/components/homework/CreateMistakeFlashcardsButton';
import { HomeworkFeedbackModal } from '@/components/student-hub/HomeworkFeedbackModal';
import type { HomeworkFeedbackScope } from '@/hooks/useStudentHomeworkFeedback';
import type { MistakeScope } from '@/lib/homework/mistakeFlashcardsApi';
const boundary = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn(), demo: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: boundary.rpc, functions: { invoke: boundary.invoke } } }));
vi.mock('@/contexts/DemoContext', () => ({ useDemoContext: () => ({ isDemoMode: boundary.demo }) }));
// Only the portal container is replaced; feedback and conversion hooks/actions are real.
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));
const scope: MistakeScope = { homeworkId: '00000000-0000-4000-8000-000000000001', audience: 'student', revision: 'review-1', email: 'learner@example.test', shareToken: 'homework-proof' };
const saved = { set_id: '00000000-0000-4000-8000-000000000002', share_token: 'a'.repeat(64), created_count: 1, existing_count: 0 };
let renderer: ReactTestRenderer | undefined;
let hook: ReturnType<typeof useHomeworkMistakeFlashcards> | undefined;
function Probe({ value }: { value: MistakeScope | null }) { hook = useHomeworkMistakeFlashcards(value); return null; }
async function mount(node: React.ReactElement) { await act(async () => { renderer = create(node); }); }
function deferred() {
  let complete: ((value: unknown) => void) | undefined;
  return { promise: new Promise(resolve => { complete = resolve; }), resolve: (value: unknown) => { if (complete) complete(value); } };
}
beforeEach(() => {
  vi.clearAllMocks(); boundary.demo = false;
  const map = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key,value) });
  boundary.invoke.mockResolvedValue({ data: { count: 1 }, error: null }); hook = undefined;
  boundary.rpc.mockResolvedValue({ data: { comments: [], verdicts: {} }, error: null });
});

const feedbackScope: HomeworkFeedbackScope = {
  teacherToken: 'teacher-proof', email: scope.email ?? '',
  homework: { id: scope.homeworkId, title: 'Client requests', share_token: scope.shareToken ?? '',
    completed_at: '2026-10-31T10:00:00Z', reviewed_at: '2026-10-31T11:00:00Z',
    completed_by_teacher: false, deadline: null, created_at: '2026-10-30T10:00:00Z',
    source_worksheet_title: null, exercises_count: 1, completed_exercises_count: 1 },
};

describe('Pillar 3 published feedback to real conversion integration', () => {
  it('waits for the authorized review before preview, creates from exact scope and hands off to study', async () => {
    const review = deferred(); boundary.rpc.mockReturnValueOnce(review.promise);
    await mount(<HomeworkFeedbackModal scope={feedbackScope} onClose={vi.fn()} />);
    expect(boundary.invoke).not.toHaveBeenCalled();
    await act(async () => review.resolve({ data: { comments: [], verdicts: {} }, error: null }));
    expect(boundary.rpc.mock.calls).toEqual([['get_homework_review_by_share_token', { p_share_token: scope.shareToken, p_student_email: scope.email }]]);
    expect(boundary.invoke.mock.calls[0]?.[1].body).toEqual({ mode: 'preview', homework_id: scope.homeworkId, share_token: scope.shareToken, student_email: scope.email });
    boundary.invoke.mockResolvedValueOnce({ data: saved, error: null });
    const button = renderer?.root.findAllByType('button').find(node => !node.props.asChild);
    await act(async () => button?.props.onClick());
    expect(boundary.invoke.mock.calls[1]?.[1].body).toEqual({ mode: 'create', homework_id: scope.homeworkId, share_token: scope.shareToken, student_email: scope.email });
    const anchor = renderer?.root.findAllByType('a').find(node => node.props.href.startsWith('/flashcards/'));
    const url = new URL(anchor?.props.href ?? '', 'http://localhost');
    expect(url.searchParams.get('mode')).toBe('study');
    expect(url.searchParams.get('email')).toBe(scope.email);
    expect(url.searchParams.get('returnTo')).toBe(`/my/teacher-proof/homework?feedback=${scope.homeworkId}`);
    expect(boundary.rpc).toHaveBeenCalledTimes(1);
  });
  it('server-null feedback cannot preview or create even if the listed timestamp is published', async () => {
    boundary.rpc.mockResolvedValueOnce({ data: null, error: null });
    await mount(<HomeworkFeedbackModal scope={feedbackScope} onClose={vi.fn()} />);
    expect(boundary.invoke).not.toHaveBeenCalled();
  });
  it('closing or reopening feedback removes the pending conversion result', async () => {
    const pending = deferred(); boundary.invoke.mockReturnValueOnce(pending.promise);
    await mount(<HomeworkFeedbackModal scope={feedbackScope} onClose={vi.fn()} />);
    await act(async () => renderer?.update(<HomeworkFeedbackModal scope={null} onClose={vi.fn()} />));
    await act(async () => pending.resolve({ data: { count: 7 }, error: null }));
    expect(boundary.invoke).toHaveBeenCalledTimes(1);
    await act(async () => renderer?.update(<HomeworkFeedbackModal scope={{ ...feedbackScope, homework: { ...feedbackScope.homework, completed_at: null, reviewed_at: null } }} onClose={vi.fn()} />));
    expect(boundary.invoke).toHaveBeenCalledTimes(1);
  });
  it('learner switch uses only the newly authorized token/email for conversion', async () => {
    await mount(<HomeworkFeedbackModal scope={feedbackScope} onClose={vi.fn()} />);
    const next = { ...feedbackScope, email: 'learner-b@example.test', homework: { ...feedbackScope.homework, id: saved.set_id, share_token: 'proof-b' } };
    await act(async () => renderer?.update(<HomeworkFeedbackModal scope={next} onClose={vi.fn()} />));
    expect(boundary.invoke.mock.calls.at(-1)?.[1].body).toEqual({ mode: 'preview', homework_id: saved.set_id, share_token: 'proof-b', student_email: 'learner-b@example.test' });
  });
});
afterEach(async () => { await act(async () => renderer?.unmount()); renderer = undefined; vi.unstubAllGlobals(); });
describe('Pillar 3 mistake action runtime, not hosted authorization certification', () => {
  it('reads count only with source identity, then creates without browser card content', async () => {
    await mount(<Probe value={scope} />);
    expect(boundary.invoke.mock.calls[0]).toEqual(['homework-mistake-flashcards', { body: { mode: 'preview', homework_id: scope.homeworkId, share_token: 'homework-proof', student_email: scope.email } }]);
    boundary.invoke.mockResolvedValueOnce({ data: saved, error: null });
    await act(async () => { await hook?.create(); });
    expect(boundary.invoke.mock.calls[1]?.[1].body).toEqual({ mode: 'create', homework_id: scope.homeworkId, share_token: 'homework-proof', student_email: scope.email });
    expect(hook?.result?.saved).toEqual(saved);
  });
  it('teacher sends only homework identity, not a claimed teacher id', async () => {
    await mount(<Probe value={{ homeworkId: scope.homeworkId, revision: '1', audience: 'teacher' }} />);
    expect(boundary.invoke.mock.calls[0]?.[1].body).toEqual({ mode: 'preview', homework_id: scope.homeworkId });
  });
  it.each(['true', 'pl'])('blocks all reads and writes for nonempty demo storage %s', async value => {
    localStorage.setItem('edooqoo_demo_mode', value); await mount(<Probe value={scope} />);
    await act(async () => { hook?.retry(); await hook?.create(); }); expect(boundary.invoke).not.toHaveBeenCalled();
  });
  it('context demo blocks reads without storage', async () => {
    boundary.demo = true; await mount(<Probe value={scope} />); expect(boundary.invoke).not.toHaveBeenCalled();
  });
  it('missing learner proof and malformed source cannot call the service', async () => {
    await mount(<Probe value={{ ...scope, email: undefined }} />); expect(boundary.invoke).not.toHaveBeenCalled(); expect(hook?.result?.status).toBe('error');
  });
  it('zero mistakes cannot create a set', async () => {
    boundary.invoke.mockResolvedValue({ data: { count: 0 }, error: null }); await mount(<Probe value={scope} />);
    await act(async () => { await hook?.create(); }); expect(boundary.invoke).toHaveBeenCalledTimes(1);
  });
  it('double-click emits one mutation while a save is pending', async () => {
    await mount(<Probe value={scope} />); const pending = deferred(); boundary.invoke.mockReturnValueOnce(pending.promise);
    let first: Promise<unknown> | undefined;
    await act(async () => { first = hook?.create(); await hook?.create(); });
    expect(boundary.invoke).toHaveBeenCalledTimes(2);
    await act(async () => { pending.resolve({ data: saved, error: null }); await first; });
    expect(hook?.result?.saved).toEqual(saved);
  });
  it('scope switch ignores a pending preview from another learner', async () => {
    const pending = deferred(); boundary.invoke.mockReturnValueOnce(pending.promise);
    await mount(<Probe value={scope} />);
    await act(async () => { renderer?.update(<Probe value={{ ...scope, email: 'other@example.test' }} />); });
    await act(async () => { pending.resolve({ data: { count: 9 }, error: null }); });
    expect(hook?.result?.count).toBe(1);
  });
  it('scope switch ignores the old successful mutation result', async () => {
    await mount(<Probe value={scope} />); const pending = deferred(); boundary.invoke.mockReturnValueOnce(pending.promise);
    let first: Promise<unknown> | undefined;
    await act(async () => { first = hook?.create(); });
    await act(async () => { renderer?.update(<Probe value={{ ...scope, revision: 'review-2' }} />); });
    await act(async () => { pending.resolve({ data: saved, error: null }); await first; });
    expect(hook?.result?.saved).toBeUndefined();
  });
  it('A to B to A cannot resurrect a save from the first A request', async () => {
    await mount(<Probe value={scope} />); const pending = deferred(); boundary.invoke.mockReturnValueOnce(pending.promise);
    let first: Promise<unknown> | undefined;
    await act(async () => { first = hook?.create(); });
    await act(async () => { renderer?.update(<Probe value={{ ...scope, email: 'other@example.test' }} />); });
    await act(async () => { renderer?.update(<Probe value={scope} />); });
    await act(async () => { pending.resolve({ data: saved, error: null }); await first; });
    expect(hook?.result?.status).toBe('ready');
    expect(hook?.result?.saved).toBeUndefined();
  });
  it('failed save offers a fresh preview retry without assuming success', async () => {
    await mount(<Probe value={scope} />); boundary.invoke.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await act(async () => { await hook?.create(); }); expect(hook?.result?.status).toBe('error');
    await act(async () => { hook?.retry(); }); expect(hook?.result?.status).toBe('ready'); expect(hook?.result?.saved).toBeUndefined();
  });
  it('the successful student action hands off to the existing study view', async () => {
    await mount(<CreateMistakeFlashcardsButton scope={scope} returnTo="/my/teacher/homework?feedback=hw" />);
    boundary.invoke.mockResolvedValueOnce({ data: saved, error: null });
    await act(async () => { await renderer?.root.findByType('button').props.onClick(); });
    const anchor = renderer?.root.findByType('a'); const url = new URL(anchor?.props.href, 'http://localhost');
    expect(url.pathname).toBe(`/flashcards/${saved.share_token}`); expect(url.searchParams.get('mode')).toBe('study');
    expect(url.searchParams.get('email')).toBe(scope.email); expect(url.searchParams.get('returnTo')).toBe('/my/teacher/homework?feedback=hw');
    expect(anchor?.props.rel).toBe('noopener noreferrer');
  });
});