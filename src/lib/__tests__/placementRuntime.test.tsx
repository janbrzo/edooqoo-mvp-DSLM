import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PublicPlacementResult } from '@/components/welcome-test/PublicPlacementResult';
import { usePendingPlacementClaim } from '@/hooks/usePendingPlacementClaim';
import type { PublicPlacementResult as Result } from '@/lib/welcomeTest/publicPlacementTest';

const boundary = vi.hoisted(() => ({ invite: vi.fn(), submit: vi.fn(), clear: vi.fn(), claim: vi.fn(), take: vi.fn(), remember: vi.fn(), navigate: vi.fn() }));
vi.mock('@/lib/welcomeTest/placementReportApi', () => ({ getPlacementInvite: boundary.invite, submitPlacementReport: boundary.submit,
  clearPlacementInviteToken: boundary.clear, claimPlacementReport: boundary.claim, takePendingClaim: boundary.take, rememberPendingClaim: boundary.remember }));
vi.mock('react-router-dom', () => ({ useNavigate: () => boundary.navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/welcome-test/PlacementReportBody', () => ({ PlacementReportBody: () => null }));
const now = Date.now();
const result: Result = { version: 1, completedAt: new Date(now).toISOString(), expiresAt: new Date(now + 7 * 86400_000).toISOString(),
  answeredCount: 40, totalQuestions: 58, level: 'A2', levelConfidence: null, skills: {}, traits: {}, divergences: [],
  selfAwarenessScore: null, openResponseCount: 2, recordingCount: 1 };
let renderer: ReactTestRenderer | undefined;
async function mount(child: React.ReactElement) { await act(async () => { renderer = create(child); }); }
function ClaimProbe({ registered, demo }: { registered: boolean; demo: boolean }) { usePendingPlacementClaim(registered, demo); return null; }
beforeEach(() => {
  vi.clearAllMocks();
  boundary.invite.mockResolvedValue({ studentName: 'Marta', completed: false });
  boundary.submit.mockResolvedValue({ studentUrl: 'https://app.example.test/placement-report/student', studentSent: true });
  boundary.take.mockReturnValue('teacher_abcdefghijklmnopqrstuvwx');
  boundary.claim.mockResolvedValue({ studentId: 'student-id' });
});
afterEach(async () => { await act(async () => renderer?.unmount()); renderer = undefined; });

describe('public placement runtime boundaries', () => {
  it('automatically submits invited results once without browser-authored email addresses', async () => {
    const child = <PublicPlacementResult result={result} shareStatus="none" storageError={null} onReset={vi.fn()} inviteToken="invite_abcdefghijklmnopqrstuvwx" />;
    await mount(child);
    await act(async () => renderer?.update(child));
    expect(boundary.submit).toHaveBeenCalledTimes(1);
    expect(boundary.submit.mock.calls[0][0]).toEqual({ result, studentName: 'Marta', studentEmail: '', teacherEmail: '', inviteToken: 'invite_abcdefghijklmnopqrstuvwx' });
    expect(boundary.clear).toHaveBeenCalledTimes(1);
  });
  it('never submits an already completed invite or a shared read-only result', async () => {
    boundary.invite.mockResolvedValue({ studentName: 'Marta', completed: true });
    await mount(<PublicPlacementResult result={result} shareStatus="none" storageError={null} onReset={vi.fn()} inviteToken="invite_abcdefghijklmnopqrstuvwx" />);
    expect(boundary.submit).not.toHaveBeenCalled();
    boundary.invite.mockResolvedValue({ studentName: 'Marta', completed: false });
    await act(async () => renderer?.update(<PublicPlacementResult result={result} shareStatus="valid" storageError={null} onReset={vi.fn()} inviteToken="invite_otherabcdefghijklmnopqrstuvwx" />));
    expect(boundary.submit).not.toHaveBeenCalled();
  });
  it('keeps the invitation when delivery fails so a retry remains possible', async () => {
    boundary.submit.mockRejectedValue(new Error('Delivery unavailable'));
    await mount(<PublicPlacementResult result={result} shareStatus="none" storageError={null} onReset={vi.fn()} inviteToken="invite_abcdefghijklmnopqrstuvwx" />);
    expect(boundary.clear).not.toHaveBeenCalled();
    boundary.submit.mockResolvedValue({ studentUrl: 'https://app.example.test/student', studentSent: true });
    const retry = renderer?.root.findAllByType('button').find(b => b.children.includes('Try again'));
    if (!retry) throw new Error('Retry control unavailable');
    await act(async () => retry.props.onClick());
    expect(boundary.submit).toHaveBeenCalledTimes(2); expect(boundary.clear).toHaveBeenCalledTimes(1);
  });
  it.each([[false, false], [true, true]])('does not claim while signed out or in demo (%s, %s)', async (registered, demo) => {
    await mount(<ClaimProbe registered={registered} demo={demo} />);
    expect(boundary.take).not.toHaveBeenCalled(); expect(boundary.claim).not.toHaveBeenCalled();
  });
  it('claims once after real auth and navigates to the learner profile', async () => {
    await mount(<ClaimProbe registered={true} demo={false} />);
    await act(async () => renderer?.update(<ClaimProbe registered={true} demo={false} />));
    expect(boundary.claim).toHaveBeenCalledTimes(1);
    expect(boundary.navigate).toHaveBeenCalledWith('/student/student-id?tab=model&view=profile');
  });
  it('retains the pending teacher claim if the request fails', async () => {
    boundary.claim.mockRejectedValue(new Error('Request unavailable'));
    await mount(<ClaimProbe registered={true} demo={false} />);
    expect(boundary.remember).toHaveBeenCalledWith('teacher_abcdefghijklmnopqrstuvwx');
    expect(boundary.navigate).not.toHaveBeenCalled();
  });
});