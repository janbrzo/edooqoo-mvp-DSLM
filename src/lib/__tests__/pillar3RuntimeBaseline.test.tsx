import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudentHomeworkFeedback, type HomeworkFeedbackScope } from '@/hooks/useStudentHomeworkFeedback';
import { useStudentHubData } from '@/hooks/useStudentHubData';
import { HomeworkFeedbackModal } from '@/components/student-hub/HomeworkFeedbackModal';
import { StudentHubHomeworkRow } from '@/components/student-hub/StudentHubHomeworkRow';

const boundary = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: boundary.rpc, functions: { invoke: boundary.invoke } } }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: { open: boolean; children: React.ReactNode }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

function storage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; }, getItem: key => map.get(key) ?? null,
    setItem: (key, value) => { map.set(key, value); }, removeItem: key => { map.delete(key); },
    clear: () => map.clear(), key: index => [...map.keys()][index] ?? null,
  };
}
function deferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>(resolve => { resolvePromise = resolve; });
  return { promise, resolve: (value: T) => { if (!resolvePromise) throw new Error('Not initialized'); resolvePromise(value); } };
}

const scope: HomeworkFeedbackScope = {
  teacherToken: 'test-teacher', email: 'learner@example.test',
  homework: {
    id: 'reviewed', title: 'Client negotiations', share_token: 'test-homework',
    completed_at: '2026-10-29T10:00:00Z', reviewed_at: '2026-10-29T12:00:00Z',
    deadline: null, created_at: '2026-10-28', source_worksheet_title: null,
    exercises_count: 2, completed_exercises_count: 2,
  },
};
const raw: { comments: Array<{ exercise_index: number; comment_text: string }>; verdicts: Record<string, Record<string, string>> } = {
  comments: [{ exercise_index: 0, comment_text: 'Use a clearer opening.' }], verdicts: { '0': { '1': 'wrong' } },
};
let renderer: ReactTestRenderer | undefined;
let feedback: ReturnType<typeof useStudentHomeworkFeedback> | undefined;
let hub: ReturnType<typeof useStudentHubData> | undefined;
function FeedbackProbe({ value }: { value: HomeworkFeedbackScope | null }) { feedback = useStudentHomeworkFeedback(value); return null; }
function HubProbe({ token = 'teacher-a', email = 'learner@example.test' }: { token?: string; email?: string }) { hub = useStudentHubData(token, email); return null; }
async function mount(child: React.ReactElement) { await act(async () => { renderer = create(child); }); }
async function update(child: React.ReactElement) { await act(async () => { renderer?.update(child); }); }

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', storage()); vi.stubGlobal('sessionStorage', storage());
  feedback = undefined; hub = undefined;
  boundary.rpc.mockResolvedValue({ data: raw, error: null });
  boundary.invoke.mockResolvedValue({ data: { studentName: 'Learner A', studentEmail: scope.email, homeworks: [scope.homework] }, error: null });
});
afterEach(async () => { await act(async () => renderer?.unmount()); renderer = undefined; vi.unstubAllGlobals(); });

describe('Pillar 3 lazy feedback read, executable boundary', () => {
  it('fetches only the listed token and assigned email, with no table access', async () => {
    await mount(<FeedbackProbe value={scope} />);
    expect(boundary.rpc.mock.calls).toEqual([['get_homework_review_by_share_token', { p_share_token: 'test-homework', p_student_email: scope.email }]]);
    expect(feedback?.review).toEqual({ comments: { 0: 'Use a clearer opening.' }, verdicts: { 0: { 1: 'wrong' } } });
    expect(boundary.invoke).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { ...scope, homework: { ...scope.homework, completed_at: null } },
    { ...scope, homework: { ...scope.homework, reviewed_at: null } },
    { ...scope, homework: { ...scope.homework, completed_by_teacher: true } },
    { ...scope, email: '' }, { ...scope, teacherToken: '' },
  ])('never reads a closed panel or incomplete/non-reviewed scope %j', async value => {
    await mount(<FeedbackProbe value={value} />);
    expect(boundary.rpc).not.toHaveBeenCalled(); expect(feedback?.review).toBeNull();
  });
  it('blocks the real network read in demo, including retry', async () => {
    localStorage.setItem('edooqoo_demo_mode', 'true');
    await mount(<FeedbackProbe value={scope} />);
    await act(async () => feedback?.retry());
    expect(boundary.rpc).not.toHaveBeenCalled();
  });
  it('distinguishes server null from a published review without comments', async () => {
    boundary.rpc.mockResolvedValueOnce({ data: null, error: null });
    await mount(<FeedbackProbe value={scope} />);
    expect(feedback?.status).toBe('unavailable');
    await act(async () => feedback?.retry());
    expect(feedback?.status).toBe('ready');
    boundary.rpc.mockResolvedValueOnce({ data: { comments: [], verdicts: {} }, error: null });
    await act(async () => feedback?.retry());
    expect(feedback?.review).toEqual({ comments: {}, verdicts: {} });
  });
  it('removes feedback after read failure and restores it through retry', async () => {
    boundary.rpc.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await mount(<FeedbackProbe value={scope} />);
    expect(feedback?.status).toBe('error'); expect(feedback?.review).toBeNull();
    await act(async () => feedback?.retry());
    expect(feedback?.status).toBe('ready');
  });
  it('ignores an old response after switching homework and learner', async () => {
    const first = deferred<{ data: typeof raw; error: null }>();
    const second = deferred<{ data: typeof raw; error: null }>();
    boundary.rpc.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    await mount(<FeedbackProbe value={scope} />);
    const next = { ...scope, email: 'other@example.test', homework: { ...scope.homework, id: 'other', share_token: 'other-token' } };
    await update(<FeedbackProbe value={next} />);
    expect(feedback?.review).toBeNull();
    await act(async () => second.resolve({ data: { comments: [{ exercise_index: 1, comment_text: 'Current review' }], verdicts: {} }, error: null }));
    await act(async () => first.resolve({ data: raw, error: null }));
    expect(feedback?.review?.comments).toEqual({ 1: 'Current review' });
  });
  it('closing the panel cancels a pending read and clears its data', async () => {
    const pending = deferred<{ data: typeof raw; error: null }>();
    boundary.rpc.mockReturnValueOnce(pending.promise);
    await mount(<FeedbackProbe value={scope} />);
    await update(<FeedbackProbe value={null} />);
    await act(async () => pending.resolve({ data: raw, error: null }));
    expect(feedback?.review).toBeNull();
  });
  it('a reopened assignment does not retain the previous attempt feedback', async () => {
    await mount(<FeedbackProbe value={scope} />);
    await update(<FeedbackProbe value={{ ...scope, homework: { ...scope.homework, reviewed_at: null, completed_at: null } }} />);
    expect(feedback?.review).toBeNull(); expect(boundary.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('Pillar 3 feedback controls and read-only handoff', () => {
  it('opens the selected review without mutating or submitting homework', async () => {
    const open = vi.fn();
    await mount(<StudentHubHomeworkRow homework={scope.homework} now={Date.parse('2026-10-30')} onFeedback={open} />);
    const button = renderer?.root.findByType('button');
    await act(async () => button?.props.onClick());
    expect(open).toHaveBeenCalledWith('reviewed');
    const anchor = renderer?.root.findByType('a');
    expect(anchor?.props.href).toBe('/homework/test-homework');
    expect(anchor?.props.rel).toBe('noopener noreferrer');
    expect(boundary.rpc).not.toHaveBeenCalled(); expect(boundary.invoke).not.toHaveBeenCalled();
  });
  it('renders only teacher comments and decisions, never markup from comments', async () => {
    boundary.rpc.mockResolvedValueOnce({ data: { comments: [{ exercise_index: 0, comment_text: '<b>Literal comment</b>' }], verdicts: {} }, error: null });
    await mount(<HomeworkFeedbackModal scope={scope} onClose={vi.fn()} />);
    expect(renderer?.root.findAllByType('b')).toHaveLength(0);
    expect(renderer?.root.findAllByType('p').some(node => node.children.includes('<b>Literal comment</b>'))).toBe(true);
    expect(boundary.rpc.mock.calls.map(call => call[0])).toEqual(['get_homework_review_by_share_token']);
  });
});

describe('Pillar 3 Hub identity safety', () => {
  it('clears old learner data and rejects out-of-order Hub responses', async () => {
    await mount(<HubProbe />);
    expect(hub?.data?.studentName).toBe('Learner A');
    const old = deferred<{ data: { studentName: string }; error: null }>();
    const current = deferred<{ data: { studentName: string }; error: null }>();
    boundary.invoke.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    await update(<HubProbe token="teacher-b" />);
    expect(hub?.data).toBeNull();
    await update(<HubProbe token="teacher-c" />);
    await act(async () => current.resolve({ data: { studentName: 'Learner C' }, error: null }));
    await act(async () => old.resolve({ data: { studentName: 'Learner B' }, error: null }));
    expect(hub?.data?.studentName).toBe('Learner C');
  });
  it('failed password proof clears both data and stored session on refetch', async () => {
    sessionStorage.setItem('student_hub_session', 'synthetic-proof');
    await mount(<HubProbe />);
    expect(boundary.invoke.mock.calls[0]?.[1].body.hubSessionToken).toBe('synthetic-proof');
    boundary.invoke.mockResolvedValueOnce({ data: { requiresPassword: true }, error: null });
    await act(async () => { await hub?.refetch(); });
    expect(hub?.data).toBeNull(); expect(sessionStorage.getItem('student_hub_session')).toBeNull();
    expect(hub?.error).toBe('This Hub is password-protected. Please sign in again.');
  });
  it('removing email clears the previous identity without fetching', async () => {
    await mount(<HubProbe />);
    await update(<HubProbe email="" />);
    expect(hub?.data).toBeNull(); expect(boundary.invoke).toHaveBeenCalledTimes(1);
  });
  it('does not pass demo identifiers to the live Hub endpoint', async () => {
    localStorage.setItem('edooqoo_demo_mode', 'true');
    await mount(<HubProbe token="demo-teacher" />);
    await act(async () => { await hub?.refetch(); });
    expect(boundary.invoke).not.toHaveBeenCalled(); expect(hub?.data).toBeNull();
  });
});