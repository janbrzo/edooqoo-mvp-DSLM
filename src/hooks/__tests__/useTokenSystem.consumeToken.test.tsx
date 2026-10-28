import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const rpcMock = vi.fn();
const fromMock = vi.fn();
const logMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock('@/contexts/DemoContext', () => ({ useDemoContext: () => ({ isDemoMode: false, demoData: null }) }));
vi.mock('@/utils/promoUtils', () => ({ isFreeCustomDemoWeek: () => false }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: unknown[]) => rpcMock(...args),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
    from: (...args: unknown[]) => fromMock(...args),
  },
}));
vi.mock('@/services/clientErrorLogService', () => ({
  logTokenChargeFailure: (...args: unknown[]) => logMock(...args),
}));

import { useTokenSystem } from '../useTokenSystem';

function getConsumeToken(userId: string | null) {
  let consume: ((id: string) => Promise<boolean>) | null = null;
  const Probe = () => {
    consume = useTokenSystem(userId).consumeToken;
    return null;
  };
  renderToStaticMarkup(React.createElement(Probe));
  return consume as unknown as (id: string) => Promise<boolean>;
}

describe('consumeToken failure logging', () => {
  beforeEach(() => {
    rpcMock.mockReset();
    fromMock.mockReset();
    logMock.mockReset();
  });

  it('logs an rpc error and still resolves false', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: '42501', message: 'denied' } });
    await expect(getConsumeToken('u-1')('ws-1')).resolves.toBe(false);
    expect(logMock).toHaveBeenCalledWith(
      expect.objectContaining({ worksheetId: 'ws-1', reason: 'rpc_error', errorCode: '42501', userId: 'u-1' }),
    );
  });

  it('logs a false result', async () => {
    rpcMock.mockResolvedValue({ data: false, error: null });
    await expect(getConsumeToken('u-1')('ws-2')).resolves.toBe(false);
    expect(logMock).toHaveBeenCalledWith(expect.objectContaining({ worksheetId: 'ws-2', reason: 'rpc_returned_false' }));
  });

  it('logs a thrown rpc', async () => {
    rpcMock.mockRejectedValue(new Error('network'));
    await expect(getConsumeToken('u-1')('ws-3')).resolves.toBe(false);
    expect(logMock).toHaveBeenCalledWith(expect.objectContaining({ worksheetId: 'ws-3', reason: 'rpc_threw' }));
  });

  it('does not log a successful charge', async () => {
    rpcMock.mockResolvedValue({ data: true, error: null });
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { available_tokens: 3 }, error: null }) }) }),
    });
    await expect(getConsumeToken('u-1')('ws-4')).resolves.toBe(true);
    expect(logMock).not.toHaveBeenCalled();
  });
});
