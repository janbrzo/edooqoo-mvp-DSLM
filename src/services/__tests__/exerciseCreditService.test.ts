// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

const rpcMock = vi.fn();
const toastInfo = vi.fn();
const logMock = vi.fn();
const updateMock = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: (...args: unknown[]) => rpcMock(...args) },
}));
vi.mock('sonner', () => ({ toast: { info: (...args: unknown[]) => toastInfo(...args) } }));
vi.mock('@/services/clientErrorLogService', () => ({
  logClientError: (...args: unknown[]) => logMock(...args),
}));
vi.mock('@/services/worksheetService/updateService', () => ({
  updateWorksheetAPI: (...args: unknown[]) => updateMock(...args),
}));

import {
  NOT_CHARGED_TOAST_DESCRIPTION,
  chargeExerciseAction,
  newActionRef,
} from '../exerciseCreditService';
import { persistAddedExercise } from '../exerciseAddService';
import { TOKEN_BALANCE_CHANGED_EVENT } from '@/lib/worksheet/tokenBalanceEvents';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('chargeExerciseAction', () => {
  let balanceEvents: number;
  const onBalance = () => { balanceEvents += 1; };

  beforeEach(() => {
    rpcMock.mockReset();
    toastInfo.mockReset();
    logMock.mockReset();
    updateMock.mockReset();
    balanceEvents = 0;
    window.addEventListener(TOKEN_BALANCE_CHANGED_EVENT, onBalance);
    localStorage.removeItem('edooqoo_demo_mode');
    return () => window.removeEventListener(TOKEN_BALANCE_CHANGED_EVENT, onBalance);
  });

  it('calls the RPC with a fresh uuid, the action and the count, and refreshes the balance', async () => {
    rpcMock.mockResolvedValue({
      data: { charged: true, tokens_charged: 0.1, remaining_credit: 0.4, reason: null },
      error: null,
    });
    const out = await chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise' });

    expect(rpcMock).toHaveBeenCalledTimes(1);
    const [fn, args] = rpcMock.mock.calls[0];
    expect(fn).toBe('consume_exercise_credit');
    expect(args).toMatchObject({ p_worksheet_id: 'ws-1', p_action: 'add_exercise', p_count: 1 });
    expect(args.p_action_ref).toMatch(UUID);
    expect(out).toEqual({ status: 'charged', charged: true, tokensCharged: 0.1, remainingCredit: 0.4, reason: null });
    expect(balanceEvents).toBe(1);
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('uses a different action ref per call and honours count', async () => {
    rpcMock.mockResolvedValue({ data: { charged: true, tokens_charged: 0.2, remaining_credit: 0, reason: null }, error: null });
    await chargeExerciseAction({ worksheetId: 'ws-1', action: 'regenerate_exercise', count: 2 });
    await chargeExerciseAction({ worksheetId: 'ws-1', action: 'regenerate_exercise', count: 2 });
    expect(rpcMock.mock.calls[0][1].p_count).toBe(2);
    expect(rpcMock.mock.calls[0][1].p_action_ref).not.toBe(rpcMock.mock.calls[1][1].p_action_ref);
    expect(newActionRef()).toMatch(UUID);
  });

  it('shows a calm toast and no balance refresh when charged is false', async () => {
    rpcMock.mockResolvedValue({
      data: { charged: false, tokens_charged: 0, remaining_credit: 0, reason: 'insufficient_credit' },
      error: null,
    });
    const out = await chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise' });
    expect(out).toMatchObject({ status: 'not_charged', charged: false, reason: 'insufficient_credit' });
    expect(toastInfo).toHaveBeenCalledWith(expect.any(String), { description: NOT_CHARGED_TOAST_DESCRIPTION });
    expect(balanceEvents).toBe(0);
  });

  it('stays quiet when the action was already settled', async () => {
    rpcMock.mockResolvedValue({ data: { charged: false, tokens_charged: 0, remaining_credit: 1, reason: 'already_charged' }, error: null });
    await chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise' });
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it.each(['PGRST202', '42883'])('treats a missing function (%s) as a silent no-op', async (code) => {
    rpcMock.mockResolvedValue({ data: null, error: { code, message: 'Could not find the function' } });
    const out = await chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise' });
    expect(out).toMatchObject({ status: 'unavailable', charged: false, reason: 'function_missing' });
    expect(toastInfo).not.toHaveBeenCalled();
    expect(logMock).not.toHaveBeenCalled();
    expect(balanceEvents).toBe(0);
  });

  it('logs other rpc errors and never blocks', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'permission denied' } });
    const out = await chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise' });
    expect(out).toMatchObject({ status: 'unavailable', reason: 'rpc_error' });
    expect(logMock).toHaveBeenCalledWith(expect.objectContaining({ sourceName: 'consume_exercise_credit', errorCode: '42501' }));
    expect(toastInfo).not.toHaveBeenCalled();
  });

  it('never throws when the rpc throws or answers with junk', async () => {
    rpcMock.mockRejectedValueOnce(new Error('network'));
    await expect(chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise' })).resolves.toMatchObject({ status: 'unavailable', reason: 'rpc_threw' });
    rpcMock.mockResolvedValueOnce({ data: 'nope', error: null });
    await expect(chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise' })).resolves.toMatchObject({ status: 'unavailable', reason: 'unexpected_payload' });
  });

  it('makes no RPC call in demo mode or without a worksheet id', async () => {
    localStorage.setItem('edooqoo_demo_mode', 'true');
    await expect(chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise' })).resolves.toMatchObject({ status: 'skipped' });
    localStorage.removeItem('edooqoo_demo_mode');
    await expect(chargeExerciseAction({ worksheetId: 'ws-1', action: 'add_exercise', isDemo: true })).resolves.toMatchObject({ status: 'skipped' });
    await expect(chargeExerciseAction({ worksheetId: null, action: 'add_exercise' })).resolves.toMatchObject({ status: 'skipped' });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe('persistAddedExercise charging', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    updateMock.mockReset();
    localStorage.removeItem('edooqoo_demo_mode');
  });

  it('charges one exercise after a successful save', async () => {
    updateMock.mockResolvedValue({ success: true, data: { id: 'ws-1' } });
    rpcMock.mockResolvedValue({ data: { charged: true, tokens_charged: 0.1, remaining_credit: 0, reason: null }, error: null });
    const saved = await persistAddedExercise('ws-1', { exercises: [] }, 'u-1');
    expect(saved).toEqual({ success: true, data: { id: 'ws-1' } });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock.mock.calls[0][1]).toMatchObject({ p_worksheet_id: 'ws-1', p_action: 'add_exercise', p_count: 1 });
  });

  it('does not charge when saving fails', async () => {
    updateMock.mockRejectedValue(new Error('save failed'));
    await expect(persistAddedExercise('ws-1', { exercises: [] }, 'u-1')).rejects.toThrow('save failed');
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it('still resolves when the credit function is not deployed', async () => {
    updateMock.mockResolvedValue({ success: true, data: { id: 'ws-1' } });
    rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing' } });
    await expect(persistAddedExercise('ws-1', { exercises: [] }, 'u-1')).resolves.toEqual({ success: true, data: { id: 'ws-1' } });
  });
});
