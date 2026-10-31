import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHomeworkMistakeFlashcards } from '@/hooks/useHomeworkMistakeFlashcards';
import { CreateMistakeFlashcardsButton } from '@/components/homework/CreateMistakeFlashcardsButton';
import type { MistakeScope } from '@/lib/homework/mistakeFlashcardsApi';
const boundary = vi.hoisted(() => ({ invoke: vi.fn(), demo: false }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: boundary.invoke } } }));
vi.mock('@/contexts/DemoContext', () => ({ useDemoContext: () => ({ isDemoMode: boundary.demo }) }));
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