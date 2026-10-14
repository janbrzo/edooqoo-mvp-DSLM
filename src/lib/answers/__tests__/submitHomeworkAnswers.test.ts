import { describe, it, expect, vi, beforeEach } from 'vitest';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));

import { submitHomeworkAnswers } from '@/lib/answers/studentAnswerRpc';

describe('submitHomeworkAnswers', () => {
  beforeEach(() => rpc.mockReset());

  it('calls the token-checked RPC with the share token', async () => {
    rpc.mockResolvedValueOnce({ data: true, error: null });
    const res = await submitHomeworkAnswers('hw-1', 'a@b.c', 'tok');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('submit_homework_answers_by_share_token', {
      p_share_token: 'tok', p_homework_id: 'hw-1', p_student_email: 'a@b.c',
    });
    expect(res.data).toBe(true);
  });

  it('returns a rejected token as an error, without falling back', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: '42501', message: 'Invalid share token for homework' } });
    const res = await submitHomeworkAnswers('hw-1', 'a@b.c', 'bad');
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(res.error?.code).toBe('42501');
  });

  it('falls back to the legacy RPC only while the token RPC is missing', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    await submitHomeworkAnswers('hw-1', 'a@b.c', 'tok');
    expect(rpc).toHaveBeenLastCalledWith('submit_homework_answers', { p_homework_id: 'hw-1', p_student_email: 'a@b.c' });
  });
});
