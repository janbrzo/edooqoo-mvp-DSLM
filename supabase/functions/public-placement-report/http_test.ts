import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";
import { handleRequest } from "./index.ts";
import { UNCLAIMED_PLACEMENT_TEACHER_ID } from "./claim.ts";

// These execute the real HTTP adapter with synthetic network boundaries, not hosted auth.
const teacherToken = "teacher_abcdefghijklmnopqrstuvwx";
const studentToken = "student_abcdefghijklmnopqrstuvwx";
const inviteToken = "invite_abcdefghijklmnopqrstuvwx";
const now = new Date();
const result = {
  version: 1, completedAt: now.toISOString(), expiresAt: new Date(+now + 7 * 86400_000).toISOString(),
  answeredCount: 40, totalQuestions: 58, level: "A2", levelConfidence: "accurate",
  skills: { grammar: { score: 27, correct: 3, answered: 11, total: 11 }, vocabulary: { score: 9, correct: 1, answered: 11, total: 11 },
    reading: { score: 25, correct: 1, answered: 4, total: 4 }, listening: { score: 67, correct: 2, answered: 3, total: 3 } },
  traits: { motivation_type: "career" }, divergences: [{ declared: "confident", observed: "needs support" }],
  selfAwarenessScore: 30, openResponseCount: 2, recordingCount: 1,
};
type Call = { path: string; method: string; body: Record<string, unknown> | null };
type Options = { failTable?: string; expired?: boolean; claimed?: boolean; claimedTestMissing?: boolean; unauthorized?: boolean; anonymous?: boolean; differentTeacher?: boolean; registeredTeacher?: boolean; existingStudent?: boolean; pendingStudent?: boolean; forwardCount?: number; completedInvite?: boolean; failEmail?: boolean; failFinish?: boolean; reservationBusy?: boolean; reportAnswers?: Record<string, unknown> | null; unclaimedStudentId?: string | null; unclaimedTestId?: string | null; unclaimedTestStatus?: string; claimRpcResult?: boolean; nextSteps?: Record<string, unknown>; nextStepsNotReady?: boolean; gatewayStatus?: number; gatewayCount?: number };

const wireLessons = [1, 2, 3].map(n => ({ topic: `Workplace lesson ${n}`, goal: 'Address a placement gap', additionalInfo: null, grammarFocus: 'Past Simple', rationale: 'Observed past tense gap', difficulty: 'B1', targetQuestionIds: [], exercises: ['reading', 'fill-in-blanks', 'matching', 'dialogue', 'discussion', 'multiple-choice', 'true-false', 'error-correction'].map(id => ({ id, focus: 'grammar' })) }));
function gatewayStream(count = 3) {
  const text = JSON.stringify({ suggestions: wireLessons.slice(0, count) });
  const item = { id: 'msg-fixture', type: 'message', status: 'completed', role: 'assistant', content: [{ type: 'output_text', text, annotations: [] }] };
  const response = { id: 'response-fixture', object: 'response', created_at: 1, model: 'fixture-model', status: 'completed', output: [item], usage: { input_tokens: 100, output_tokens: 100, total_tokens: 200 } };
  const events = [
    { type: 'response.created', response: { ...response, status: 'in_progress', output: [] } },
    { type: 'response.output_item.added', output_index: 0, item: { ...item, status: 'in_progress', content: [] } },
    { type: 'response.content_part.added', item_id: item.id, output_index: 0, content_index: 0, part: { type: 'output_text', text: '', annotations: [] } },
    { type: 'response.output_text.delta', item_id: item.id, output_index: 0, content_index: 0, delta: text },
    { type: 'response.output_text.done', item_id: item.id, output_index: 0, content_index: 0, text },
    { type: 'response.output_item.done', output_index: 0, item },
    { type: 'response.completed', response },
  ];
  return new Response(events.map(event => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`).join(''), { headers: { 'Content-Type': 'text/event-stream' } });
}

async function fixture(run: (call: (body: unknown, token?: string, method?: string) => Promise<Response>, calls: Call[]) => Promise<void>, options: Options = {}) {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APP_BASE_URL", "RESEND_API_KEY", "LOVABLE_API_KEY"];
  const previous = names.map(name => Deno.env.get(name));
  names.forEach((name, i) => Deno.env.set(name, ["https://fixture.example.test", "synthetic-service", "https://app.example.test", "synthetic-mail", "synthetic-gateway"][i]));
  const calls: Call[] = [];
  const report = { id: "report-id", report_token: teacherToken, student_report_token: studentToken, result,
    answers: options.reportAnswers ?? null,
    student_name: "Marta", student_email: "student@example.test", teacher_email: "teacher@example.test", invite_id: options.pendingStudent ? "invite-id" : null,
    expires_at: new Date(Date.now() + (options.expired ? -1 : 7 * 86400_000)).toISOString(),
    claimed_by: options.claimed ? "owner-id" : null, claimed_student_id: options.claimed ? "student-id" : null,
    unclaimed_student_id: options.unclaimedStudentId ?? null,
    unclaimed_test_id: options.unclaimedTestId ?? null,
    placement_next_steps: options.nextSteps ?? null,
    forward_count: options.forwardCount ?? 0 };
  const invite = { id: "invite-id", teacher_email: "teacher@example.test", student_email: "student@example.test", student_name: "Marta",
    teacher_id: options.registeredTeacher ? "owner-id" : null,
    student_id: options.existingStudent || options.pendingStudent ? "student-id" : null,
    expires_at: report.expires_at, completed_at: options.completedInvite ? now.toISOString() : null, completed_report_id: options.completedInvite ? "report-id" : null };
  const fetchStub = stub(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url); const path = url.pathname;
    const text = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : "";
    const body = text ? JSON.parse(text) : null;
    calls.push({ path, method: req.method, body });
    let value: unknown = null; let status = 200;
    if (req.method === "HEAD") return new Response(null, { headers: { "Content-Range": "*/0" } });
    if (path === "/v1/responses") {
      if (options.gatewayStatus) return new Response(JSON.stringify({ error: { message: 'Provider access denied' } }), { status: options.gatewayStatus, headers: { 'Content-Type': 'application/json' } });
      return gatewayStream(options.gatewayCount);
    }
    if (path === "/rest/v1/rpc/reserve_placement_next_steps") {
      if (options.nextStepsNotReady) value = { status: 'not_ready' };
      else if (report.placement_next_steps) value = report.placement_next_steps;
      else {
        report.placement_next_steps = { status: 'running', lease: 'private-lease', attempts: 1 };
        value = { status: 'reserved', lease: 'private-lease', studentId: 'unclaimed-student-id', testId: 'unclaimed-test-id' };
      }
    } else if (path === "/rest/v1/rpc/finish_placement_next_steps") {
      report.placement_next_steps = body?.p_error ? { status: 'failed', error: body.p_error, terminal: body.p_terminal, attempts: 1 } : { status: 'ready', suggestions: (body?.p_suggestions as Array<Record<string, unknown>>).map((s, i) => ({ ...s, id: `saved-lesson-${i + 1}` })) };
      value = report.placement_next_steps;
    } else if (path === "/emails") { value = { id: "mail-id" }; if (options.failEmail) status = 500; }
    else if (path === "/auth/v1/user") {
      if (options.unauthorized) { status = 401; value = { message: "Invalid token" }; }
      else value = { id: options.differentTeacher ? "other-owner-id" : "owner-id", email: "teacher@example.test", is_anonymous: options.anonymous ?? false };
    } else if (path === "/rest/v1/profiles") {
      value = options.registeredTeacher ? { id: "owner-id" } : null;
    } else if (path === "/rest/v1/students" && req.method === "GET") {
      value = options.pendingStudent
        ? { id: "student-id", placement_pending_at: now.toISOString(), english_level: null }
        : options.existingStudent ? { id: "student-id", placement_pending_at: null, english_level: "B1" } : null;
    } else if (path === "/rest/v1/public_placement_reports") {
      if (req.method === "GET") {
        value = url.searchParams.get("report_token") === `eq.${teacherToken}` || url.searchParams.get("student_report_token") === `eq.${studentToken}` || url.searchParams.has("id") ? report : null;
      } else {
        value = options.reservationBusy && body?.claimed_by ? null : { id: "report-id" };
        if (options.failFinish && body?.claimed_student_id) { status = 500; value = { message: "fixture finish failure", code: "XX000" }; }
      }
    } else if (path === "/rest/v1/public_placement_invites") value = req.method === "GET" ? invite : body?.completed_report_id ? { id: "invite-id" } : null;
    else if (path === "/rest/v1/rpc/claim_unclaimed_placement_student") {
      value = options.claimRpcResult ?? true;
    }
    else if (path.startsWith("/rest/v1/")) {
      if (req.method === "POST" && path.endsWith(`/${options.failTable}`)) { status = 500; value = { message: "fixture write failure", code: "XX000" }; }
      else if (req.method === "GET" && path.endsWith("/student_tests")) {
        if (url.searchParams.get("generation_params->>report_id") === "eq.report-id") {
          value = !options.claimedTestMissing ? { id: "test-id" } : null;
        } else {
          value = { id: options.unclaimedTestId ?? "test-id", status: options.unclaimedTestStatus ?? "reviewed", score_percentage: 64, answered_count: 40, total_questions: 72, completed_at: now.toISOString(), reviewed_at: now.toISOString(), time_spent_seconds: 900 };
        }
      } else if (req.method === "GET" && path.endsWith("/student_learning_profiles")) {
        value = {
          id: "profile-id", student_id: options.unclaimedStudentId ?? "student-id", welcome_test_id: options.unclaimedTestId ?? "test-id",
          estimated_level: "B1", ai_summary: JSON.stringify({ summary: "Strong oral clarity, gaps in past tense.", recommendations: ["Review Past Simple"], writing_quality: "good", key_observations: ["Clear structure"] }),
          grammar_score: 55, vocabulary_score: 70, reading_score: 65, traits: { motivation_type: "career" }, divergences: [],
          raw_answers: { interpretation_version: 2, wt_q41: "SHOULD_NOT_LEAK" },
        };
      } else if (req.method === "GET" && path.endsWith("/test_skill_results")) {
        value = [{ element_type: "grammar", correct_answers: 6, total_questions: 11, score_percentage: 55, suggested_rating: 3, skill_tags: ["past_simple"] }];
      } else if (req.method === "GET" && path.endsWith("/student_test_questions")) {
        value = [
          { id: "q1", question_index: 0, question_type: "multiple_choice", question_text: "Answered Q", question_data: { question_id: "wt_q1" }, correct_answer: "A", explanation: "Rule A", element_type: "grammar", difficulty_level: "B1", skill_tags: ["past_simple"], student_answer: "A", is_correct: true, answered_at: now.toISOString(), ai_feedback: null },
          { id: "q2", question_index: 1, question_type: "multiple_choice", question_text: "Unanswered Q", question_data: { question_id: "wt_q2" }, correct_answer: "SECRET_KEY", explanation: "SECRET_EXPLANATION", element_type: "grammar", difficulty_level: "B1", skill_tags: ["present_perfect"], student_answer: null, is_correct: null, answered_at: null, ai_feedback: null },
        ];
      } else if (req.method === "GET" && (path.endsWith("/student_progress_goals") || path.endsWith("/future_worksheet_suggestions") || path.endsWith("/dslm_curriculum_phases"))) {
        value = [];
      }
      else value = { id: path.endsWith("student_tests") ? "test-id" : "student-id" };
    } else if (path === "/functions/v1/recalculate-pacing") value = { success: true };
    else if (path === "/functions/v1/process-welcome-test") value = { success: true, accepted: true, status: "completed" };
    else throw new Error(`Unexpected fixture request: ${path}`);
    return new Response(JSON.stringify(value), { status, headers: { "Content-Type": "application/json" } });
  });
  const call = (body: unknown, token = "synthetic-user", method = "POST") => handleRequest(new Request("https://fixture.example.test/functions/v1/public-placement-report", {
    method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(method === "POST" ? { body: typeof body === "string" ? body : JSON.stringify(body) } : {}),
  }));
  try { await run(call, calls); }
  finally { fetchStub.restore(); names.forEach((name, i) => { const value = previous[i]; if (value === undefined) Deno.env.delete(name); else Deno.env.set(name, value); }); }
}

Deno.test("HTTP malformed requests stop before privileged reads", async () => {
  await fixture(async (call, calls) => {
    for (const body of ["{", { action: "claim", token: "bad" }, { action: "invite", teacherEmail: "bad", studentName: "Marta" }]) {
      const res = await call(body); assertEquals(res.status, 400); await res.text();
    }
    assertEquals(calls.length, 0);
  });
});
Deno.test("HTTP invite emails identify teacher and confirm sender with seven-day link", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "invite", teacherName: "Anna", teacherEmail: "TEACHER@example.test", studentName: "Marta", studentEmail: "student@example.test" });
    assertEquals(res.status, 200); const data = await res.json(); assertEquals(data.teacherConfirmed, true);
    const mails = calls.filter(c => c.path === "/emails");
    assertEquals(mails.map(c => c.body?.to), [["student@example.test"], ["teacher@example.test"]]);
    assertEquals(String(mails[0].body?.html).includes("Anna (teacher@example.test)"), true);
    const row = calls.find(c => c.path.endsWith("public_placement_invites") && c.method === "POST")?.body;
    const expires = Date.parse(String(row?.expires_at)); assertEquals(Math.abs(expires - Date.now() - 7 * 86400_000) < 2000, true);
  });
});
Deno.test("HTTP registered teacher invite creates a hidden pending learner and server-owned links", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "invite", teacherEmail: "teacher@example.test", studentName: "Marta", studentEmail: "student@example.test" });
    assertEquals(res.status, 200); await res.text();
    const student = calls.find(c => c.path.endsWith("/students") && c.method === "POST")?.body;
    assertEquals(typeof student?.placement_pending_at, "string");
    const invite = calls.find(c => c.path.endsWith("/public_placement_invites") && c.method === "POST")?.body;
    assertEquals(invite?.teacher_id, "owner-id"); assertEquals(invite?.student_id, "student-id");
  }, { registeredTeacher: true });
});
Deno.test("HTTP registered teacher invite reuses an existing learner without hiding or duplicating them", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "invite", teacherEmail: "teacher@example.test", studentName: "Marta", studentEmail: "student@example.test" });
    assertEquals(res.status, 200); await res.text();
    assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "POST"), false);
    const invite = calls.find(c => c.path.endsWith("/public_placement_invites") && c.method === "POST")?.body;
    assertEquals(invite?.student_id, "student-id");
  }, { registeredTeacher: true, existingStudent: true });
});
Deno.test("HTTP invited completion routes both emails using server addresses and distinct tokens", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "submit", result, studentName: "Marta", inviteToken, studentEmail: "teacher@example.test", teacherEmail: "attacker@example.test" });
    assertEquals(res.status, 200); const data = await res.json(); assertEquals(data.sentToInvitingTeacher, true);
    const row = calls.find(c => c.path.endsWith("public_placement_reports") && c.method === "POST")?.body;
    assertNotEquals(row?.report_token, row?.student_report_token);
    assertEquals(row?.student_email, "student@example.test"); assertEquals(row?.teacher_email, "teacher@example.test");
    assertEquals(calls.filter(c => c.path === "/emails").map(c => c.body?.to), [["teacher@example.test"], ["student@example.test"]]);
    assertEquals(data.studentUrl.includes(String(row?.student_report_token)), true);
    assertEquals(data.studentUrl.includes(String(row?.report_token)), false);
  });
});
Deno.test("HTTP registered invitation auto-claims the exact test, reveals the learner and emails the account result", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "submit", result, studentName: "Marta", inviteToken, studentEmail: "attacker@example.test", teacherEmail: "attacker@example.test" });
    assertEquals(res.status, 200); const data = await res.json();
    assertEquals(data.autoClaimed, true); assertEquals(data.teacherSent, true);
    assertEquals(calls.find(c => c.path.endsWith("/student_tests") && c.method === "POST")?.body?.student_id, "student-id");
    assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "POST"), false);
    assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "PATCH" && c.body?.placement_pending_at === null), true);
    const teacherMail = calls.find(c => c.path === "/emails" && (c.body?.to as string[] | undefined)?.[0] === "teacher@example.test")?.body?.html;
    assertEquals(String(teacherMail).includes("/student/student-id?tab=timeline&amp;filter=tests&amp;testId=test-id"), true);
    assertEquals(String(teacherMail).includes("Create free account"), false);
  }, { registeredTeacher: true, pendingStudent: true });
});
Deno.test("HTTP teacher mail failure preserves an already auto-claimed result", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "submit", result, studentName: "Marta", inviteToken });
    assertEquals(res.status, 200); const data = await res.json();
    assertEquals(data.autoClaimed, true); assertEquals(data.teacherSent, false);
    assertEquals(calls.some(c => c.path.endsWith("/public_placement_reports") && c.method === "DELETE"), false);
    assertEquals(calls.some(c => c.path.endsWith("/student_tests") && c.method === "DELETE"), false);
  }, { registeredTeacher: true, pendingStudent: true, failEmail: true });
});
Deno.test("HTTP auto-claim failure never deletes an existing learner or emails a false success", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "submit", result, studentName: "Marta", inviteToken });
    assertEquals(res.status, 500); await res.text();
    assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "DELETE"), false);
    assertEquals(calls.some(c => c.path.endsWith("/public_placement_invites") && c.method === "PATCH" && c.body?.completed_report_id === null), true);
    assertEquals(calls.some(c => c.path.endsWith("/public_placement_reports") && c.method === "DELETE"), true);
    assertEquals(calls.some(c => c.path === "/emails"), false);
  }, { registeredTeacher: true, existingStudent: true, failTable: "student_tests" });
});
Deno.test("HTTP student token does not return teacher-only analysis", async () => {
  await fixture(async call => {
    const res = await call({ action: "get", token: studentToken, view: "teacher" });
    assertEquals(res.status, 200); const data = await res.json(); assertEquals(data.role, "student");
    assertEquals(data.result.divergences, []); assertEquals(data.teacher_email, undefined);
  });
});
Deno.test("HTTP student token cannot claim even with an authenticated caller", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: studentToken }); assertEquals(res.status, 403); await res.text();
    assertEquals(calls.some(c => c.method === "POST" || c.method === "PATCH"), false);
  });
});
for (const options of [{ unauthorized: true }, { anonymous: true }]) {
  Deno.test(`HTTP claim requires a real signed-in teacher ${JSON.stringify(options)}`, async () => {
    await fixture(async (call, calls) => {
      const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 401); await res.text();
      assertEquals(calls.some(c => c.method === "PATCH"), false);
    }, options);
  });
}
Deno.test("HTTP claim creates reviewed test, linked profile, goals and pacing", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 200);
    const claim = await res.json(); assertEquals(claim.studentId, "student-id"); assertEquals(claim.testId, "test-id");
    const writes = (table: string) => calls.find(c => c.path.endsWith(`/${table}`) && c.method === "POST")?.body;
    assertEquals(writes("student_tests")?.status, "reviewed");
    assertEquals(writes("student_learning_profiles")?.welcome_test_id, "test-id");
    assertEquals(writes("students")?.student_email, "student@example.test");
    assertEquals((writes("student_progress_goals") as unknown as Array<{ source: string }>).map(g => g.source), ["welcome_test_auto", "welcome_test_auto"]);
    assertEquals(calls.some(c => c.path === "/functions/v1/recalculate-pacing"), true);
  });
});
Deno.test("HTTP manual retry reuses and reveals the invited pending learner", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 200);
    const claim = await res.json(); assertEquals(claim.studentId, "student-id"); assertEquals(claim.testId, "test-id");
    assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "POST"), false);
    assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "PATCH" && c.body?.placement_pending_at === null), true);
  }, { registeredTeacher: true, pendingStudent: true });
});
Deno.test("HTTP registered invitation cannot be claimed by another teacher", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 403); await res.text();
    assertEquals(calls.some(c => c.method === "PATCH" || c.method === "POST"), false);
  }, { registeredTeacher: true, pendingStudent: true, differentTeacher: true });
});
for (const failTable of ["student_tests", "student_learning_profiles", "student_progress_goals"]) {
  Deno.test(`HTTP failed ${failTable} cannot report successful claim`, async () => {
    await fixture(async (call, calls) => {
      const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 500); await res.text();
      assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "DELETE"), true);
      assertEquals(calls.some(c => c.path.endsWith("/public_placement_reports") && c.method === "PATCH" && c.body?.claimed_by === null), true);
    }, { failTable });
  });
}
Deno.test("HTTP repeated completed claim returns the same learner and exact test without new writes", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 200);
    const claim = await res.json();
    assertEquals(claim.alreadyClaimed, true); assertEquals(claim.studentId, "student-id"); assertEquals(claim.testId, "test-id");
    assertEquals(calls.some(c => c.path.endsWith("/student_tests") && c.method === "GET"), true);
    assertEquals(calls.some(c => c.method === "POST" || c.method === "PATCH"), false);
  }, { claimed: true });
});
Deno.test("HTTP repeated claim never opens a missing or unrelated test", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 409); await res.text();
    assertEquals(calls.some(c => c.method === "POST" || c.method === "PATCH"), false);
  }, { claimed: true, claimedTestMissing: true });
});
Deno.test("HTTP forwarding rejects teacher token and enforces three forwards", async () => {
  await fixture(async call => {
    const res = await call({ action: "forward", token: teacherToken, teacherEmail: "other@example.test" });
    assertEquals(res.status, 410); await res.text();
  });
  await fixture(async (call, calls) => {
    const res = await call({ action: "forward", token: studentToken, teacherEmail: "other@example.test" });
    assertEquals(res.status, 429); await res.text(); assertEquals(calls.some(c => c.path === "/emails"), false);
  }, { forwardCount: 3 });
});

Deno.test("HTTP teacher mail failure removes the new report and leaves invitation retryable", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "submit", result, studentName: "Marta", inviteToken });
    assertEquals(res.status, 500); await res.text();
    assertEquals(calls.some(c => c.path.endsWith("public_placement_reports") && c.method === "DELETE"), true);
    assertEquals(calls.some(c => c.path.endsWith("public_placement_invites") && c.method === "PATCH"), false);
  }, { failEmail: true });
});
Deno.test("HTTP a completed invitation cannot send a second report", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "submit", result, studentName: "Marta", inviteToken });
    assertEquals(res.status, 409); await res.text();
    assertEquals(calls.some(c => c.method === "POST" || c.path === "/emails"), false);
  }, { completedInvite: true });
});
for (const claimed of [false, true]) {
  Deno.test(`HTTP seven-day report expiry applies to public links, claimed=${claimed}`, async () => {
    await fixture(async call => {
      for (const token of [teacherToken, studentToken]) {
        const res = await call({ action: "get", token }); assertEquals(res.status, 410); await res.text();
      }
    }, { expired: true, claimed });
  });
}
Deno.test("HTTP a busy claim reservation creates no learner", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 409); await res.text();
    assertEquals(calls.some(c => c.method === "POST"), false);
  }, { reservationBusy: true });
});
Deno.test("HTTP failure to finish claim rolls back its learner bundle", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 500); await res.text();
    assertEquals(calls.some(c => c.path.endsWith("students") && c.method === "DELETE"), true);
    assertEquals(calls.some(c => c.path.endsWith("public_placement_reports") && c.body?.claimed_by === null), true);
  }, { failFinish: true });
});
Deno.test("HTTP submit stores sanitized answers while public get never returns raw answers", async () => {
  await fixture(async (call, calls) => {
    const res = await call({
      action: "submit",
      result,
      answers: {
        wt_q1: "I can talk about most topics, but I make grammar mistakes and miss some words",
        wt_q41: "I want to prepare for product demos.",
        wt_q16s: "local-recording:wt_q16s",
        unknown_q: "discard",
      },
      studentName: "Marta",
      teacherEmail: "teacher@example.test",
    });
    assertEquals(res.status, 200);
    await res.text();
    const inserted = calls.find(c => c.path.endsWith("/public_placement_reports") && c.method === "POST")?.body;
    assertEquals(inserted?.answers, {
      wt_q1: "I can talk about most topics, but I make grammar mistakes and miss some words",
      wt_q41: "I want to prepare for product demos.",
    });
    const getRes = await call({ action: "get", token: teacherToken });
    assertEquals(getRes.status, 200);
    const got = await getRes.json();
    assertEquals("answers" in got, false);
  }, { reportAnswers: { wt_q41: "PRIVATE ANSWER" } });
});
Deno.test("HTTP claim with stored answers seeds 72 questions and triggers process-welcome-test with skip_emails", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken });
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals([data.studentId, data.testId], ["student-id", "test-id"]);
    const testWrite = calls.find(c => c.path.endsWith("/student_tests") && c.method === "POST")?.body;
    assertEquals(testWrite?.status, "completed");
    assertEquals(testWrite?.total_questions, 72);
    assertEquals((testWrite?.generation_params as Record<string, unknown>)?.welcome_bank, 2);
    const questionsWrite = calls.find(c => c.path.endsWith("/student_test_questions") && c.method === "POST")?.body as unknown as Array<Record<string, unknown>>;
    assertEquals(questionsWrite.length, 72);
    assertEquals(questionsWrite.find((q) => (q.question_data as Record<string, unknown>)?.question_id === "wt_q41")?.student_answer, "I want to lead meetings.");
    assertEquals(calls.some(c => c.path.endsWith("/student_learning_profiles") && c.method === "POST"), false);
    const processCall = calls.find(c => c.path === "/functions/v1/process-welcome-test")?.body;
    assertEquals(processCall, { test_id: "test-id", student_id: "student-id", teacher_id: "owner-id", answered_count: 40, skip_emails: true });
    assertEquals(calls.some(c => c.path === "/functions/v1/recalculate-pacing"), false);
  }, { reportAnswers: { wt_q41: "I want to lead meetings." } });
});
Deno.test("HTTP registered auto-claim with answers seeds questions and runs process-welcome-test", async () => {
  await fixture(async (call, calls) => {
    const res = await call({
      action: "submit",
      result,
      answers: { wt_q41: "I need English for weekly client calls." },
      studentName: "Marta",
      inviteToken,
    });
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.autoClaimed, true);
    const questionsWrite = calls.find(c => c.path.endsWith("/student_test_questions") && c.method === "POST")?.body as unknown as Array<Record<string, unknown>>;
    assertEquals(questionsWrite.length, 72);
    assertEquals(calls.some(c => c.path === "/functions/v1/process-welcome-test" && c.body?.skip_emails === true), true);
  }, { registeredTeacher: true, pendingStudent: true });
});
Deno.test("HTTP failed student_test_questions insert rolls back learner and claim reservation", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken });
    assertEquals(res.status, 500);
    await res.text();
    assertEquals(calls.some(c => c.path.endsWith("/student_test_questions") && c.method === "DELETE"), true);
    assertEquals(calls.some(c => c.path.endsWith("/student_tests") && c.method === "DELETE"), true);
    assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "DELETE"), true);
    assertEquals(calls.some(c => c.path.endsWith("/public_placement_reports") && c.body?.claimed_by === null), true);
  }, { reportAnswers: { wt_q41: "I want to lead meetings." }, failTable: "student_test_questions" });
});

Deno.test("HTTP unregistered submit with answers seeds unclaimed student, 72 questions and triggers process-welcome-test", async () => {
  await fixture(async (call, calls) => {
    const res = await call({
      action: "submit",
      result,
      answers: { wt_q41: "I want to prepare for board presentations." },
      studentName: "Marta",
      studentEmail: "student@example.test",
      teacherEmail: "teacher@example.test",
    });
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.autoClaimed, false);
    assertEquals(data.teacherSent, true);
    const studentWrite = calls.find(c => c.path.endsWith("/students") && c.method === "POST")?.body;
    assertEquals(studentWrite?.teacher_id, UNCLAIMED_PLACEMENT_TEACHER_ID);
    assertEquals(studentWrite?.student_email, "student@example.test");
    assertEquals(typeof studentWrite?.placement_pending_at, "string");
    const questionsWrite = calls.find(c => c.path.endsWith("/student_test_questions") && c.method === "POST")?.body as unknown as Array<Record<string, unknown>>;
    assertEquals(questionsWrite.length, 72);
    const linkWrite = calls.find(c => c.path.endsWith("/public_placement_reports") && c.method === "PATCH")?.body;
    assertEquals(linkWrite, { unclaimed_student_id: "student-id", unclaimed_test_id: "test-id" });
    const processCall = calls.find(c => c.path === "/functions/v1/process-welcome-test")?.body;
    assertEquals(processCall, {
      test_id: "test-id",
      student_id: "student-id",
      teacher_id: UNCLAIMED_PLACEMENT_TEACHER_ID,
      answered_count: 40,
      skip_emails: true,
    });
  });
});

Deno.test("HTTP teacher get returns full diagnostic bundle with unanswered keys masked; student get omits it", async () => {
  await fixture(async (call, calls) => {
    const teacherRes = await call({ action: "get", token: teacherToken });
    assertEquals(teacherRes.status, 200);
    const teacherData = await teacherRes.json();
    assertEquals(teacherData.role, "teacher");
    assertEquals("answers" in teacherData, false);
    assertEquals(teacherData.teacherDiagnostic.studentId, "unclaimed-student-id");
    assertEquals(teacherData.teacherDiagnostic.testId, "unclaimed-test-id");
    assertEquals(teacherData.teacherDiagnostic.learningProfile.estimated_level, "B1");
    assertEquals(teacherData.teacherDiagnostic.learningProfile.raw_answers, { interpretation_version: 2 });
    assertEquals(teacherData.teacherDiagnostic.questions[0].correct_answer, "A");
    assertEquals(teacherData.teacherDiagnostic.questions[1].correct_answer, null);
    assertEquals(teacherData.teacherDiagnostic.questions[1].explanation, null);

    const callsBeforeStudent = calls.length;
    const studentRes = await call({ action: "get", token: studentToken });
    assertEquals(studentRes.status, 200);
    const studentData = await studentRes.json();
    assertEquals(studentData.role, "student");
    assertEquals("teacherDiagnostic" in studentData, false);
    const studentQueries = calls.slice(callsBeforeStudent).map(c => c.path);
    assertEquals(studentQueries.some(p => p.endsWith("/student_learning_profiles") || p.endsWith("/student_test_questions")), false);
  }, { unclaimedStudentId: "unclaimed-student-id", unclaimedTestId: "unclaimed-test-id" });
});

Deno.test("HTTP claim on pre-seeded unclaimed report transfers ownership atomically via RPC without recreating rows", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken });
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data, { success: true, studentId: "unclaimed-student-id", testId: "unclaimed-test-id" });
    const rpcCall = calls.find(c => c.path === "/rest/v1/rpc/claim_unclaimed_placement_student");
    assertEquals(rpcCall?.body, {
      p_student_id: "unclaimed-student-id",
      p_new_teacher_id: "owner-id",
      p_teacher_email: "teacher@example.test",
    });
    assertEquals(calls.some(c => c.path.endsWith("/students") && c.method === "POST"), false);
    assertEquals(calls.some(c => c.path.endsWith("/student_tests") && c.method === "POST"), false);
    assertEquals(calls.some(c => c.path === "/functions/v1/process-welcome-test"), false);
  }, { unclaimedStudentId: "unclaimed-student-id", unclaimedTestId: "unclaimed-test-id", unclaimedTestStatus: "reviewed" });
});

Deno.test('HTTP only an unexpired teacher token can reserve lesson proposals', async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: 'generate_next_steps', token: studentToken });
    assertEquals(res.status, 403); await res.text();
    assertEquals(calls.some(c => c.path.includes('reserve_placement_next_steps') || c.path === '/v1/responses'), false);
  });
  await fixture(async (call, calls) => {
    const res = await call({ action: 'generate_next_steps', token: teacherToken });
    assertEquals(res.status, 410); await res.text();
    assertEquals(calls.some(c => c.path.includes('reserve_placement_next_steps')), false);
  }, { expired: true });
});
Deno.test('HTTP generated three lessons persist, read back and are cached without a second AI request', async () => {
  await fixture(async (call, calls) => {
    const first = await call({ action: 'generate_next_steps', token: teacherToken });
    assertEquals(first.status, 200); assertEquals(await first.json(), { status: 'running' });
    const get = await call({ action: 'get', token: teacherToken });
    const report = await get.json();
    assertEquals(report.nextSteps.status, 'ready');
    assertEquals(report.nextSteps.suggestions.length, 3);
    assertEquals(report.nextSteps.suggestions[0].id, 'saved-lesson-1');
    const again = await call({ action: 'generate_next_steps', token: teacherToken });
    assertEquals((await again.json()).status, 'ready');
    assertEquals(calls.filter(c => c.path === '/v1/responses').length, 1);
    const ai = calls.find(c => c.path === '/v1/responses')?.body;
    assertEquals(ai?.stream, true); assertEquals(ai?.store, false);
    assertEquals(ai?.model, 'openai/gpt-6-astra');
    assertEquals((ai?.reasoning as Record<string, unknown>)?.effort, 'medium');
    assertEquals(JSON.stringify(ai).includes('SHOULD_NOT_LEAK'), false);
    const student = await call({ action: 'get', token: studentToken });
    assertEquals('nextSteps' in await student.json(), false);
  }, { unclaimedStudentId: 'unclaimed-student-id', unclaimedTestId: 'unclaimed-test-id' });
});
Deno.test('HTTP planner denial persists a terminal state and never replays on a new click', async () => {
  await fixture(async (call, calls) => {
    const first = await call({ action: 'generate_next_steps', token: teacherToken }); await first.text();
    const again = await call({ action: 'generate_next_steps', token: teacherToken });
    assertEquals(await again.json(), { status: 'failed', error: 'Provider access denied', retryable: false });
    assertEquals(calls.filter(c => c.path === '/v1/responses').length, 1);
    assertEquals(calls.filter(c => c.path.includes('finish_placement_next_steps'))[0].body?.p_terminal, true);
  }, { unclaimedStudentId: 'unclaimed-student-id', unclaimedTestId: 'unclaimed-test-id', gatewayStatus: 403 });
});
Deno.test('HTTP incomplete proposals are not saved as a successful three-lesson result', async () => {
  await fixture(async (call, calls) => {
    const first = await call({ action: 'generate_next_steps', token: teacherToken }); await first.text();
    const saved = calls.find(c => c.path.includes('finish_placement_next_steps'))?.body;
    assertEquals(saved?.p_suggestions, null);
    assertEquals(typeof saved?.p_error, 'string');
  }, { unclaimedStudentId: 'unclaimed-student-id', unclaimedTestId: 'unclaimed-test-id', gatewayCount: 2 });
});
Deno.test('HTTP in-progress reservations and unfinished analyses never start new billed work', async () => {
  for (const options of [{ nextSteps: { status: 'running', lease: 'PRIVATE', attempts: 1 } }, { nextStepsNotReady: true }]) {
    await fixture(async (call, calls) => {
      const res = await call({ action: 'generate_next_steps', token: teacherToken });
      assertEquals(res.status, options.nextStepsNotReady ? 409 : 200);
      assertEquals((await res.text()).includes('PRIVATE'), false);
      assertEquals(calls.some(c => c.path === '/v1/responses'), false);
    }, options);
  }
});