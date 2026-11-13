import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { stub } from "https://deno.land/std@0.224.0/testing/mock.ts";
import { handleRequest } from "./index.ts";

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
type Options = { failTable?: string; expired?: boolean; claimed?: boolean; unauthorized?: boolean; anonymous?: boolean; forwardCount?: number; completedInvite?: boolean; failEmail?: boolean; failFinish?: boolean; reservationBusy?: boolean };

async function fixture(run: (call: (body: unknown, token?: string, method?: string) => Promise<Response>, calls: Call[]) => Promise<void>, options: Options = {}) {
  const names = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "APP_BASE_URL", "RESEND_API_KEY"];
  const previous = names.map(name => Deno.env.get(name));
  names.forEach((name, i) => Deno.env.set(name, ["https://fixture.example.test", "synthetic-service", "https://app.example.test", "synthetic-mail"][i]));
  const calls: Call[] = [];
  const report = { id: "report-id", report_token: teacherToken, student_report_token: studentToken, result,
    student_name: "Marta", student_email: "student@example.test", teacher_email: "teacher@example.test", invite_id: null,
    expires_at: new Date(Date.now() + (options.expired ? -1 : 7 * 86400_000)).toISOString(),
    claimed_by: options.claimed ? "owner-id" : null, claimed_student_id: options.claimed ? "student-id" : null,
    forward_count: options.forwardCount ?? 0 };
  const invite = { id: "invite-id", teacher_email: "teacher@example.test", student_email: "student@example.test", student_name: "Marta",
    expires_at: report.expires_at, completed_at: options.completedInvite ? now.toISOString() : null, completed_report_id: options.completedInvite ? "report-id" : null };
  const fetchStub = stub(globalThis, "fetch", async (input: string | URL | Request, init?: RequestInit) => {
    const req = input instanceof Request ? input : new Request(input, init);
    const url = new URL(req.url); const path = url.pathname;
    const text = req.method !== "GET" && req.method !== "HEAD" ? await req.text() : "";
    const body = text ? JSON.parse(text) : null;
    calls.push({ path, method: req.method, body });
    let value: unknown = null; let status = 200;
    if (req.method === "HEAD") return new Response(null, { headers: { "Content-Range": "*/0" } });
    if (path === "/emails") { value = { id: "mail-id" }; if (options.failEmail) status = 500; }
    else if (path === "/auth/v1/user") {
      if (options.unauthorized) { status = 401; value = { message: "Invalid token" }; }
      else value = { id: "owner-id", email: "teacher@example.test", is_anonymous: options.anonymous ?? false };
    } else if (path === "/rest/v1/public_placement_reports") {
      if (req.method === "GET") {
        value = url.searchParams.get("report_token") === `eq.${teacherToken}` || url.searchParams.get("student_report_token") === `eq.${studentToken}` || url.searchParams.has("id") ? report : null;
      } else {
        value = options.reservationBusy && body?.claimed_by ? null : { id: "report-id" };
        if (options.failFinish && body?.claimed_student_id) { status = 500; value = { message: "fixture finish failure", code: "XX000" }; }
      }
    } else if (path === "/rest/v1/public_placement_invites") value = req.method === "GET" ? invite : null;
    else if (path.startsWith("/rest/v1/")) {
      if (req.method === "POST" && path.endsWith(`/${options.failTable}`)) { status = 500; value = { message: "fixture write failure", code: "XX000" }; }
      else value = { id: path.endsWith("student_tests") ? "test-id" : "student-id" };
    } else if (path === "/functions/v1/recalculate-pacing") value = { success: true };
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
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 200); assertEquals((await res.json()).studentId, "student-id");
    const writes = (table: string) => calls.find(c => c.path.endsWith(`/${table}`) && c.method === "POST")?.body;
    assertEquals(writes("student_tests")?.status, "reviewed");
    assertEquals(writes("student_learning_profiles")?.welcome_test_id, "test-id");
    assertEquals(writes("students")?.student_email, "student@example.test");
    assertEquals((writes("student_progress_goals") as unknown as Array<{ source: string }>).map(g => g.source), ["welcome_test_auto", "welcome_test_auto"]);
    assertEquals(calls.some(c => c.path === "/functions/v1/recalculate-pacing"), true);
  });
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
Deno.test("HTTP repeated completed claim returns the same learner without new writes", async () => {
  await fixture(async (call, calls) => {
    const res = await call({ action: "claim", token: teacherToken }); assertEquals(res.status, 200); assertEquals((await res.json()).alreadyClaimed, true);
    assertEquals(calls.some(c => c.method === "POST" || c.method === "PATCH"), false);
  }, { claimed: true });
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