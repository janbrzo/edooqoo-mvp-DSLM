import { beforeEach, describe, expect, it, vi } from 'vitest';

const insertMock = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn(() => ({ insert: (...args: unknown[]) => insertMock(...args) })) },
}));

import {
  logClientError,
  logTokenChargeFailure,
  resetClientErrorLogDedupe,
} from '../clientErrorLogService';

describe('clientErrorLogService', () => {
  beforeEach(() => {
    insertMock.mockReset();
    insertMock.mockResolvedValue({ error: null });
    resetClientErrorLogDedupe();
  });

  it('inserts a source=client row with only ids and reasons', async () => {
    await logTokenChargeFailure({ worksheetId: 'ws-1', reason: 'rpc_returned_false', origin: 'generation_hook', userId: 'u-1' });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock.mock.calls[0][0]).toMatchObject({
      source: 'client',
      source_name: 'consume_token',
      component: 'worksheets',
      severity: 'error',
      user_id: 'u-1',
      context: { worksheet_id: 'ws-1', reason: 'rpc_returned_false', origin: 'generation_hook' },
    });
  });

  it('reports an identical failure once per page session', async () => {
    const args = { worksheetId: 'ws-1', reason: 'rpc_error', origin: 'job_poller', errorCode: '42501' } as const;
    await logTokenChargeFailure(args);
    await logTokenChargeFailure(args);
    await logTokenChargeFailure({ ...args, worksheetId: 'ws-2' });
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it('never throws when the insert is rejected or throws', async () => {
    insertMock.mockResolvedValueOnce({ error: { code: '42501' } });
    await expect(logClientError({ sourceName: 'x', component: 'other', message: 'a' })).resolves.toBeUndefined();
    insertMock.mockRejectedValueOnce(new Error('network'));
    await expect(logClientError({ sourceName: 'x', component: 'other', message: 'b' })).resolves.toBeUndefined();
  });

  it('clips long values', async () => {
    await logClientError({ sourceName: 'x', component: 'other', message: 'm'.repeat(1000), context: { k: 'v'.repeat(1000) } });
    const row = insertMock.mock.calls[0][0];
    expect(row.message.length).toBe(300);
    expect(row.context.k.length).toBe(200);
  });
});
