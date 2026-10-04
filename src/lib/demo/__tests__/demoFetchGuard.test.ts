import { describe, it, expect } from 'vitest';
import { isDemoRestRead, buildDemoEmptyResponse } from '../demoFetchGuard';

const base = 'https://x.supabase.co/rest/v1';

describe('isDemoRestRead', () => {
  it('matches reads that filter by a demo id', () => {
    expect(isDemoRestRead('GET', `${base}/student_tests?select=*&student_id=eq.demo-student-1`)).toBe(true);
    expect(isDemoRestRead('HEAD', `${base}/flashcard_sets?teacher_id=eq.demo-teacher`)).toBe(true);
  });

  it('never matches mutations, rpc, or real UUID reads', () => {
    expect(isDemoRestRead('POST', `${base}/student_tests?student_id=eq.demo-student-1`)).toBe(false);
    expect(isDemoRestRead('PATCH', `${base}/students?id=eq.demo-student-1`)).toBe(false);
    expect(isDemoRestRead('GET', `${base}/rpc/get_student_tags?student_id=eq.demo-student-1`)).toBe(false);
    expect(
      isDemoRestRead('GET', `${base}/student_tests?student_id=eq.3f2b1c7e-0000-4000-8000-000000000000`),
    ).toBe(false);
    expect(isDemoRestRead('GET', 'https://x.supabase.co/functions/v1/foo?a=eq.demo-1')).toBe(false);
  });
});

describe('buildDemoEmptyResponse', () => {
  it('returns an empty list with a zero count', async () => {
    const res = buildDemoEmptyResponse('GET', false);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Range')).toBe('*/0');
    expect(await res.json()).toEqual([]);
  });

  it('returns PGRST116 for single-object requests so maybeSingle() resolves to null', async () => {
    const res = buildDemoEmptyResponse('GET', true);
    expect(res.status).toBe(406);
    expect((await res.json()).code).toBe('PGRST116');
  });
});
