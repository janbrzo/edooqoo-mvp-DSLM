import { assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { stub } from 'https://deno.land/std@0.224.0/testing/mock.ts';
import { handleRequest } from './index.ts';

// Actual HTTP adapter with synthetic network boundaries, never a hosted session.
const owner = '00000000-0000-4000-8000-000000000001';
const homeworkId = '00000000-0000-4000-8000-000000000002';
const studentId = '00000000-0000-4000-8000-000000000003';
const source = {
  homework: { id: homeworkId, teacher_id: owner, student_id: studentId, title: 'Requests',
    share_token: 'homework-proof', attempt: 1, reviewed_at: '2026-10-31T11:00:00Z',
    completed_at: '2026-10-31T10:00:00Z', completed_by_teacher: false,
    selected_exercises: [{ type: 'multiple-choice', questions: [{ question: 'Choose a polite request', options: [{ text: 'Send it!', correct: false }, { text: 'Could you send it?', correct: true }] }] }] },
  student: { id: studentId, teacher_id: owner, student_email: 'learner@example.test', deleted_at: null },
  answers: [{ exercise_index: 0, exercise_type: 'multiple-choice', answers: { 0: 'Send it!' }, is_submitted: true,
    eval_trigger: 'submit_homework', item_evaluations: [{ question_index: 0, hasValue: true, mastery: 0 }] }],
};
const saved = { set_id: studentId, share_token: 'a'.repeat(64), created_count: 1, existing_count: 0 };
const learnerBody = { mode: 'create', homework_id: homeworkId, share_token: 'homework-proof', student_email: 'learner@example.test' };

async function fixture(run: (call: (body: unknown, token?: string, method?: string) => Promise<Response>, calls: Array<{ path: string; body: unknown }>) => Promise<void>, options: { user?: string; anonymous?: boolean; review?: boolean; saveError?: string; loadError?: boolean } = {}) {
  const names = ['SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_SERVICE_ROLE_KEY'];
  const previous = names.map(name => Deno.env.get(name));
  Deno.env.set('SUPABASE_URL', 'https://fixture.example.test');
  Deno.env.set('SUPABASE_ANON_KEY', 'synthetic-public-key');
  Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'synthetic-service-key');
  const calls: Array<{ path: string; body: unknown }> = [];
  const fetchStub = stub(globalThis, 'fetch', async (input: string | URL | Request, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const path = new URL(req.url).pathname;
    const raw = req.method === 'POST' ? await req.text() : '';
    const body = raw ? JSON.parse(raw) : null;
    calls.push({ path, body });
    let value: unknown;
    let status = 200;
    if (path === '/auth/v1/user') value = { id: options.user ?? owner, is_anonymous: options.anonymous ?? false };
    else if (path === '/rest/v1/homework_assignments') value = source.homework;
    else if (path === '/rest/v1/students') value = source.student;
    else if (path === '/rest/v1/rpc/load_homework_mistake_source') {
      if (options.loadError) { value = { message: 'unavailable', code: 'XX000' }; status = 500; }
      else value = { ...source, homework: { ...source.homework, reviewed_at: options.review === false ? null : source.homework.reviewed_at } };
    } else if (path === '/rest/v1/rpc/save_homework_mistake_flashcards') {
      if (options.saveError) { value = { message: options.saveError, code: 'P0001' }; status = 409; }
      else value = saved;
    } else throw new Error(`Unexpected fixture request: ${path}`);
    return new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });
  });
  const call = (body: unknown, token = 'synthetic-public-key', method = 'POST') => handleRequest(new Request('https://fixture.example.test/functions/v1/homework-mistake-flashcards', {
    method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  }));
  try { await run(call, calls); }
  finally {
    fetchStub.restore();
    names.forEach((name, i) => { const value = previous[i]; if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value); });
  }
}

Deno.test('HTTP rejects malformed JSON, injected cards, invalid UUID and oversized body before any read', async () => {
  await fixture(async (call, calls) => {
    for (const body of ['{', { ...learnerBody, cards: [] }, { ...learnerBody, homework_id: 'not-a-uuid' }, ' '.repeat(2049)]) {
      const response = await call(body);
      assertEquals(response.status, 400); assertEquals(await response.json(), { error: 'invalid_request' });
    }
    assertEquals(calls.length, 0);
  });
});
Deno.test('HTTP preflight and unsupported method do not resolve callers or read source', async () => {
  await fixture(async (call, calls) => {
    assertEquals((await call(null, undefined, 'OPTIONS')).status, 200);
    assertEquals((await call(null, undefined, 'GET')).status, 405);
    assertEquals(calls.length, 0);
  });
});
Deno.test('HTTP anonymous missing proof is denied before privileged reads', async () => {
  await fixture(async (call, calls) => {
    const response = await call({ mode: 'preview', homework_id: homeworkId });
    assertEquals(response.status, 403); assertEquals(calls.length, 0);
  });
});
Deno.test('HTTP foreign teacher cannot load private answers without learner proof', async () => {
  await fixture(async (call, calls) => {
    const response = await call({ mode: 'preview', homework_id: homeworkId }, 'synthetic-user-token');
    assertEquals(response.status, 403);
    assertEquals(calls.filter(c => c.path.includes('/rpc/')).length, 0);
  }, { user: studentId });
});
Deno.test('HTTP anonymous auth account is not an owner teacher', async () => {
  await fixture(async (call, calls) => {
    assertEquals((await call({ mode: 'preview', homework_id: homeworkId }, 'synthetic-user-token')).status, 403);
    assertEquals(calls.filter(c => c.path.startsWith('/rest/')).length, 0);
  }, { anonymous: true });
});
Deno.test('HTTP owner preview exposes count only before publication and never saves', async () => {
  await fixture(async (call, calls) => {
    const response = await call({ mode: 'preview', homework_id: homeworkId }, 'synthetic-user-token');
    assertEquals(response.status, 200); assertEquals(await response.json(), { count: 1 });
    assertEquals(calls.filter(c => c.path.endsWith('/save_homework_mistake_flashcards')).length, 0);
  }, { review: false });
});
Deno.test('HTTP learner publication gate rejects before saving', async () => {
  await fixture(async (call, calls) => {
    const response = await call(learnerBody);
    assertEquals(response.status, 409); assertEquals(await response.json(), { error: 'not_reviewed' });
    assertEquals(calls.filter(c => c.path.endsWith('/save_homework_mistake_flashcards')).length, 0);
  }, { review: false });
});
for (const identity of ['owner','learner','foreign_with_learner_proof'] as const) {
  Deno.test(`HTTP ${identity} maps exact source snapshot and trusted caller to save`, async () => {
    await fixture(async (call, calls) => {
      const isOwner = identity === 'owner';
      const body = isOwner ? { mode: 'create', homework_id: homeworkId } : learnerBody;
      const response = await call(body, identity === 'learner' ? 'synthetic-public-key' : 'synthetic-user-token');
      assertEquals(response.status, 200); assertEquals(await response.json(), saved);
      const save = calls.find(c => c.path.endsWith('/save_homework_mistake_flashcards'));
      assertEquals(save?.body, {
        p_homework_id: homeworkId, p_teacher_id: isOwner ? owner : null,
        p_share_token: isOwner ? null : learnerBody.share_token, p_student_email: isOwner ? null : learnerBody.student_email,
        p_snapshot: { teacher_id: owner, student_id: studentId, attempt: 1, reviewed_at: source.homework.reviewed_at,
          completed_at: source.homework.completed_at, completed_by_teacher: false,
          selected_exercises: source.homework.selected_exercises, answers: source.answers },
        p_cards: [{ exercise_index: 0, question_index: 0, front_text: 'Choose a polite request\nOptions: Send it!; Could you send it?', back_text: 'Could you send it?', front_example: null }],
      });
    }, { user: identity === 'foreign_with_learner_proof' ? studentId : owner });
  });
}
for (const error of ['source_changed','not_reviewed','set_unavailable','card_unavailable','contributions_disabled','not_allowed','unrecognized_failure']) {
  Deno.test(`HTTP maps database ${error} without returning private source`, async () => {
    await fixture(async call => {
      const response = await call(learnerBody);
      assertEquals(response.status, 409);
      assertEquals(await response.json(), { error: error === 'unrecognized_failure' ? 'save_failed' : error });
    }, { saveError: error });
  });
}
Deno.test('HTTP load failure never reaches save or exposes source', async () => {
  await fixture(async (call, calls) => {
    const response = await call(learnerBody);
    assertEquals(response.status, 503); assertEquals(await response.json(), { error: 'service_unavailable' });
    assertEquals(calls.filter(c => c.path.endsWith('/save_homework_mistake_flashcards')).length, 0);
  }, { loadError: true });
});