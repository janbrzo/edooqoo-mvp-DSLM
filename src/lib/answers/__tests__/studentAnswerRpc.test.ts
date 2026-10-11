import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args) } }));

const load = async () => {
  vi.resetModules();
  return import('../studentAnswerRpc');
};

describe('callStudentAnswerRpc', () => {
  beforeEach(() => rpc.mockReset());

  it('calls the token RPC with the share token', async () => {
    const { callStudentAnswerRpc } = await load();
    rpc.mockResolvedValueOnce({ data: 'id-1', error: null });
    const res = await callStudentAnswerRpc('save_homework_answer', { p_homework_id: 'h' }, 'tok');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('save_homework_answer_by_share_token', { p_share_token: 'tok', p_homework_id: 'h' });
    expect(res.data).toBe('id-1');
  });

  it('falls back to the legacy RPC only when the token RPC does not exist yet', async () => {
    const { callStudentAnswerRpc, studentAnswerRpcName } = await load();
    rpc
      .mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } })
      .mockResolvedValueOnce({ data: [], error: null });
    const res = await callStudentAnswerRpc('get_worksheet_student_answers', { p_worksheet_id: 'w' }, 'tok');
    expect(rpc).toHaveBeenNthCalledWith(2, 'get_worksheet_student_answers', { p_worksheet_id: 'w' });
    expect(res.error).toBeNull();
    expect(studentAnswerRpcName('save_worksheet_answer', 'tok')).toBe('save_worksheet_answer');
  });

  it('never falls back when the server rejects the token', async () => {
    const { callStudentAnswerRpc, studentAnswerRpcName } = await load();
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Invalid share token for homework' } });
    const res = await callStudentAnswerRpc('save_homework_answer', {}, 'bad');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(res.error.code).toBe('42501');
    expect(studentAnswerRpcName('save_homework_answer', 'bad')).toBe('save_homework_answer_by_share_token');
  });

  it('uses the legacy RPC when there is no token', async () => {
    const { callStudentAnswerRpc } = await load();
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await callStudentAnswerRpc('save_homework_answer', { a: 1 }, '');
    expect(rpc).toHaveBeenCalledWith('save_homework_answer', { a: 1 });
  });
});
