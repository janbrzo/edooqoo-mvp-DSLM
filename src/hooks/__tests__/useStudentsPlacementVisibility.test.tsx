// @vitest-environment jsdom
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const boundary = vi.hoisted(() => ({
  is: vi.fn(),
  order: vi.fn(),
  queryFn: undefined as undefined | (() => Promise<unknown>),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (options: { queryFn: () => Promise<unknown> }) => {
    boundary.queryFn = options.queryFn;
    return { data: [], isLoading: false, refetch: vi.fn() };
  },
}));
vi.mock('@/contexts/DemoContext', () => ({ useDemoContext: () => ({ isDemoMode: false, demoData: null }) }));
vi.mock('@/hooks/useAuthUser', () => ({ useAuthUser: () => ({ data: { id: 'teacher-id' } }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          is: (...args: unknown[]) => {
            boundary.is(...args);
            return { is: boundary.is, order: boundary.order };
          },
        }),
      }),
    }),
  },
}));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));

import { useStudents } from '../useStudents';

function Probe() {
  useStudents();
  return null;
}

describe('placement-pending student visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    boundary.is.mockImplementation(() => ({ is: boundary.is, order: boundary.order }));
    boundary.order.mockResolvedValue({ data: [], error: null });
  });

  it('excludes deleted and placement-pending learners from every useStudents list consumer', async () => {
    let renderer: ReactTestRenderer | undefined;
    await act(async () => { renderer = create(React.createElement(Probe)); });
    await boundary.queryFn?.();
    await act(async () => renderer?.unmount());
    expect(boundary.is).toHaveBeenCalledWith('deleted_at', null);
    expect(boundary.is).toHaveBeenCalledWith('placement_pending_at', null);
    expect(boundary.order).toHaveBeenCalledWith('updated_at', { ascending: false });
  });
});
