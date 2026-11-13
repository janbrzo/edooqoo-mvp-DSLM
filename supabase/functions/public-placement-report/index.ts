/**
 * public-placement-report: service-only storage for the public /welcome-test/demo result.
 * Actions:
 *  - submit: stores the bounded summary, emails the teacher (full report link) and,
 *            optionally, the student (student-facing link). No auth, 7-day expiry.
 *            Teacher and student links use separate tokens; the role comes from the token.
 *  - get:    returns a report by token (never returns email addresses).
 *  - claim:  signed-in teacher creates a student + learning profile from the report, once.
 *  - invite: teacher without an account sends the student a test link (7-day invite).
 *  - invite_get: returns the invited student's name only (teacher email stays server-side).
 */
import { buildGoalRows, buildWelcomeTestRow, resolveStudentEmail } from "./claimSeed.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Results created before the 7-day change carry a 48 h expiry; still accepted. */
const LEGACY_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_PER_TEACHER_EMAIL_PER_HOUR = 5;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITES_PER_TEACHER_EMAIL_PER_HOUR = 10;
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;

const skill = z.object({
  score: z.number().min(0).max(100).nullable(),
  correct: z.number().int().min(0).max(200),
  answered: z.number().int().min(0).max(200),
  total: z.number().int().min(0).max(200),
});
const resultSchema = z.object({
  version: z.literal(1),
  completedAt: z.string().max(40),
  expiresAt: z.string().max(40),
  answeredCount: z.number().int().min(0).max(500),
  totalQuestions: z.number().int().min(1).max(500),
  level: z.enum(LEVELS).nullable(),
  levelConfidence: z.string().max(40).nullable(),
  skills: z.record(z.enum(["grammar", "vocabulary", "reading", "listening"]), skill),
  selfAwarenessScore: z.number().min(0).max(100).nullable(),
  traits: z.record(z.string().max(100), z.string().max(500)).refine((t) => Object.keys(t).length <= 30),
  divergences: z.array(z.object({ pair: z.string().max(200).optional(), declared: z.string().max(500), observed: z.string().max(500) }).passthrough()).max(20),
  openResponseCount: z.number().int().min(0).max(500),
  recordingCount: z.number().int().min(0).max(500),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    result: resultSchema,
    studentName: z.string().trim().min(1).max(80),
    studentEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
    teacherEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
    inviteToken: tokenSchema.optional(),
  }),
  z.object({
    action: z.literal("invite"),
    studentName: z.string().trim().min(1).max(80),
    studentEmail: z.string().trim().email().max(254).optional().or(z.literal("")),
    teacherEmail: z.string().trim().email().max(254),
    teacherName: z.string().trim().max(80).optional().or(z.literal("")),
  }),
  z.object({ action: z.literal("invite_get"), token: tokenSchema }),
  z.object({ action: z.literal("get"), token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) }),
  z.object({ action: z.literal("claim"), token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) }),
]);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("Email service is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "EDOOQOO <noreply@edooqoo.com>", to: [to], subject, html }),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`[public-placement-report] Resend failed [${res.status}]: ${text}`);
    throw new Error(`Email could not be sent (${res.status})`);
  }
}

const button = (href: string, label: string) =>
  `<a href="${href}" style="display:inline-block;background:#7c3aed;color:#fff;padding:14px 28px;text-decoration:none;border-radius:999px;font-weight:bold;margin:16px 0;">${label}</a>`;

function teacherEmailHtml(name: string, level: string | null, reportUrl: string, claimUrl: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <h2 style="color:#7c3aed;">${escapeHtml(name)} completed a placement test</h2>
  <p>${escapeHtml(name)} took the Edooqoo placement test and wants you to see the results before your first lesson.</p>
  <p>Estimated level: <strong>${level ?? "not enough evidence yet"}</strong></p>
  <p>The full report shows skill scores, the learning profile and where the student's declared needs differ from what the scenarios revealed.</p>
  ${button(claimUrl, `Create free account &amp; add ${escapeHtml(name)}`)}
  <p>${escapeHtml(name)} is added to your students with this profile, ready for a 1-minute first lesson.</p>
  <p><a href="${reportUrl}" style="color:#7c3aed;font-weight:bold;">Open the full report</a></p>
  <p style="color:#6b7280;font-size:12px;">The link is valid for 7 days after the test. ${reportUrl}</p></div>`;
}

function teacherLabel(teacherName: string | null, teacherEmail: string): string {
  return teacherName ? `${escapeHtml(teacherName)} (${escapeHtml(teacherEmail)})` : escapeHtml(teacherEmail);
}

function inviteEmailHtml(name: string, testUrl: string, teacher: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <h2 style="color:#7c3aed;">Hi ${escapeHtml(name)}, your English placement test is ready</h2>
  <p>Your English teacher, <strong>${teacher}</strong>, invited you to take this placement test before your first lesson.</p>
  <p>Your teacher would like to understand your English and your goals before your first lesson.</p>
  <ul style="color:#4b5563;"><li>About 20 to 25 minutes on your phone or laptop</li><li>Grammar, vocabulary, reading, listening, writing and speaking</li><li>No grades: it helps your teacher plan lessons around you</li></ul>
  ${button(testUrl, "Start the placement test")}
  <p style="color:#6b7280;font-size:12px;">The link is valid for 7 days. ${testUrl}</p></div>`;
}

function inviteConfirmationHtml(name: string, testUrl: string, studentEmailed: boolean): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <h2 style="color:#7c3aed;">Your placement test is on its way to ${escapeHtml(name)}</h2>
  <p>${studentEmailed ? `We emailed the test link to ${escapeHtml(name)}.` : `Share the link below with ${escapeHtml(name)}.`} You can also send it by WhatsApp or Messenger:</p>
  <p style="word-break:break-all;"><a href="${testUrl}" style="color:#7c3aed;">${testUrl}</a></p>
  <p>The link is valid for 7 days. When ${escapeHtml(name)} finishes, the full teaching profile arrives at this email address.</p></div>`;
}

function studentEmailHtml(name: string, studentUrl: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <h2 style="color:#7c3aed;">Your placement results, ${escapeHtml(name)}</h2>
  <p>Thank you for taking the test. Your results are ready and your teacher has received the full report.</p>
  ${button(studentUrl, "See my results")}
  <p style="color:#6b7280;font-size:12px;">The link is valid for 7 days after the test. ${studentUrl}</p></div>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
  const body = parsed.data;

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const appBase = (Deno.env.get("APP_BASE_URL") || "https://edooqoo.com").replace(/\/+$/, "");
  const now = Date.now();

  try {
    if (body.action === "invite") {
      const teacherEmail = body.teacherEmail.toLowerCase();
      const { count } = await admin.from("public_placement_invites").select("id", { count: "exact", head: true })
        .eq("teacher_email", teacherEmail).gte("created_at", new Date(now - 3600_000).toISOString());
      if ((count ?? 0) >= MAX_INVITES_PER_TEACHER_EMAIL_PER_HOUR) return json({ error: "Too many invites from this email. Try again later." }, 429);
      const token = newToken();
      const studentToken = newToken();
      const studentEmail = body.studentEmail ? body.studentEmail.toLowerCase() : null;
      const teacherName = body.teacherName ? body.teacherName : null;
      const { error } = await admin.from("public_placement_invites").insert({
        invite_token: token, student_name: body.studentName, student_email: studentEmail,
        teacher_email: teacherEmail, expires_at: new Date(now + INVITE_TTL_MS).toISOString(),
      });
      if (error) throw error;
      const testUrl = `${appBase}/welcome-test/demo?invite=${token}`;
      let studentSent = false;
      if (studentEmail) {
        try { await sendEmail(studentEmail, "Your English placement test", inviteEmailHtml(body.studentName, testUrl, teacherLabel(teacherName, teacherEmail))); studentSent = true; }
        catch (e) { console.error("[public-placement-report] invite email failed", e); }
      }
      let teacherConfirmed = false;
      try {
        await sendEmail(teacherEmail, `You sent an English placement test to ${body.studentName}`, inviteConfirmationHtml(body.studentName, testUrl, studentSent));
        teacherConfirmed = true;
      } catch (e) { console.error("[public-placement-report] invite confirmation failed", e); }
      return json({ success: true, testUrl, studentSent, teacherConfirmed });
    }

    if (body.action === "invite_get") {
      const { data: invite, error } = await admin.from("public_placement_invites")
        .select("student_name, expires_at, completed_at").eq("invite_token", body.token).maybeSingle();
      if (error) throw error;
      if (!invite || Date.parse(invite.expires_at) <= now) return json({ error: "Invite not available" }, 404);
      return json({ studentName: invite.student_name, completed: !!invite.completed_at });
    }

    if (body.action === "submit") {
      let invite: { id: string; teacher_email: string; student_name: string; student_email: string | null } | null = null;
      if (body.inviteToken) {
        const { data, error } = await admin.from("public_placement_invites")
          .select("id, teacher_email, student_name, student_email, expires_at, completed_at")
          .eq("invite_token", body.inviteToken).maybeSingle();
        if (error) throw error;
        if (!data || Date.parse(data.expires_at) <= now) return json({ error: "This test invitation has expired." }, 410);
        if (data.completed_at) return json({ error: "Results for this invitation were already sent." }, 409);
        invite = data;
      }
      const resolvedTeacherEmail = invite?.teacher_email ?? (body.teacherEmail || "");
      if (!resolvedTeacherEmail) return json({ error: "Teacher email is required" }, 400);
      const completed = Date.parse(body.result.completedAt);
      const expires = Date.parse(body.result.expiresAt);
      if (!Number.isFinite(completed) || (expires !== completed + TTL_MS && expires !== completed + LEGACY_TTL_MS) || expires <= now || completed > now + 60_000) {
        return json({ error: "This result has expired or is invalid. Please retake the test." }, 400);
      }
      const teacherEmail = resolvedTeacherEmail.toLowerCase();
      const { count } = await admin.from("public_placement_reports").select("id", { count: "exact", head: true })
        .eq("teacher_email", teacherEmail).gte("created_at", new Date(now - 3600_000).toISOString());
      if ((count ?? 0) >= MAX_PER_TEACHER_EMAIL_PER_HOUR) return json({ error: "Too many reports for this teacher email. Try again later." }, 429);

      const token = newToken();
      const studentToken = newToken();
      const typedEmail = body.studentEmail ? body.studentEmail.toLowerCase() : null;
      const studentEmail = invite ? (invite.student_email ?? null) : (typedEmail && typedEmail !== resolvedTeacherEmail.toLowerCase() ? typedEmail : null);
      const { data: inserted, error } = await admin.from("public_placement_reports").insert({
        report_token: token, student_report_token: studentToken, result: body.result, student_name: body.studentName,
        student_email: studentEmail, teacher_email: teacherEmail, expires_at: new Date(expires).toISOString(),
        invite_id: invite?.id ?? null,
      }).select("id").single();
      if (error) throw error;
      if (invite) {
        await admin.from("public_placement_invites").update({ completed_at: new Date().toISOString(), completed_report_id: inserted.id })
          .eq("id", invite.id).is("completed_at", null);
      }

      const reportUrl = `${appBase}/placement-report/${token}`;
      const studentUrl = `${appBase}/placement-report/${studentToken}`;
      await sendEmail(teacherEmail, `${body.studentName} shared placement test results with you`, teacherEmailHtml(body.studentName, body.result.level, reportUrl, `${reportUrl}?claim=1`));
      let studentSent = false;
      if (studentEmail) {
        try { await sendEmail(studentEmail, "Your placement test results", studentEmailHtml(body.studentName, studentUrl)); studentSent = true; }
        catch (e) { console.error("[public-placement-report] student email failed", e); }
      }
      return json({ success: true, studentUrl, studentSent, sentToInvitingTeacher: !!invite });
    }

    if (body.action !== "get" && body.action !== "claim") return json({ error: "Unknown action" }, 400);
    const columns = "id, result, student_name, student_email, teacher_email, invite_id, expires_at, claimed_by, claimed_student_id";
    let role: "teacher" | "student" = "teacher";
    let { data: report, error } = await admin.from("public_placement_reports").select(columns)
      .eq("report_token", body.token).maybeSingle();
    if (error) throw error;
    if (!report) {
      ({ data: report, error } = await admin.from("public_placement_reports").select(columns)
        .eq("student_report_token", body.token).maybeSingle());
      if (error) throw error;
      role = "student";
    }
    if (!report) return json({ error: "Report not found" }, 404);
    if (body.action === "claim" && role === "student") return json({ error: "Only the teacher link can add this student" }, 403);
    const expired = Date.parse(report.expires_at) <= now;

    if (body.action === "get") {
      if (expired && !report.claimed_by) return json({ error: "expired" }, 410);
      return json({ role, studentName: report.student_name, result: report.result, expiresAt: report.expires_at, claimed: !!report.claimed_by });
    }

    // claim
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user || user.is_anonymous) return json({ error: "Sign in to add this student" }, 401);
    if (report.claimed_by) {
      if (report.claimed_by === user.id) return json({ success: true, studentId: report.claimed_student_id, alreadyClaimed: true });
      return json({ error: "This report was already added by another teacher" }, 409);
    }
    if (expired) return json({ error: "expired" }, 410);

    // Reserve the claim first so two parallel requests cannot create two students.
    const { data: reserved, error: reserveError } = await admin.from("public_placement_reports")
      .update({ claimed_by: user.id, claimed_at: new Date().toISOString() })
      .eq("id", report.id).is("claimed_by", null).select("id").maybeSingle();
    if (reserveError) throw reserveError;
    if (!reserved) return json({ error: "This report was already added" }, 409);

    const r = report.result as z.infer<typeof resultSchema>;
    let inviteEmail: string | null = null;
    if (report.invite_id) {
      const { data: inv } = await admin.from("public_placement_invites").select("student_email").eq("id", report.invite_id).maybeSingle();
      inviteEmail = inv?.student_email ?? null;
    }
    const studentEmail = resolveStudentEmail(inviteEmail, report.invite_id ? null : report.student_email, [report.teacher_email, user.email]);
    const { data: student, error: studentError } = await admin.from("students").insert({
      teacher_id: user.id, name: report.student_name, student_email: studentEmail,
      teacher_email: user.email ?? null, english_level: r.level,
    }).select("id").single();
    if (studentError) {
      await admin.from("public_placement_reports").update({ claimed_by: null, claimed_at: null }).eq("id", report.id);
      throw studentError;
    }

    const score = (k: string) => r.skills[k as keyof typeof r.skills]?.score ?? null;
    const scored = Object.entries(r.skills).filter(([, s]) => s.score !== null) as [string, { score: number }][];
    scored.sort((a, b) => b[1].score - a[1].score);
    // A reviewed welcome test makes the Prep tab and results views treat the test as done.
    const { data: testRow, error: testError } = await admin.from("student_tests")
      .insert(buildWelcomeTestRow(r, student.id, user.id, report.id)).select("id").single();
    if (testError) console.error("[public-placement-report] test insert failed", testError);

    const { error: profileError } = await admin.from("student_learning_profiles").insert({
      student_id: student.id, teacher_id: user.id, welcome_test_id: testRow?.id ?? null,
      estimated_level: r.level, level_confidence: r.levelConfidence,
      grammar_score: score("grammar"), vocabulary_score: score("vocabulary"), reading_score: score("reading"),
      self_awareness_score: r.selfAwarenessScore, traits: r.traits, divergences: r.divergences,
      motivation_type: r.traits.motivation_type ?? null, preferred_input_channel: r.traits.preferred_input_channel ?? null,
      feedback_preference: r.traits.feedback_preference ?? null,
      strongest_skill: scored[0]?.[0] ?? null, weakest_skill: scored.length > 1 ? scored[scored.length - 1][0] : null,
      raw_answers: { source: "public_placement_preview", report_id: report.id, answered: r.answeredCount, total: r.totalQuestions },
    });
    if (profileError) console.error("[public-placement-report] profile insert failed", profileError);

    if (testRow?.id) {
      const goals = buildGoalRows(r, student.id, user.id, testRow.id);
      if (goals.length) {
        const { error: goalError } = await admin.from("student_progress_goals").insert(goals);
        if (goalError) console.error("[public-placement-report] goal insert failed", goalError);
      }
    }
    try {
      const { error: pacingError } = await admin.functions.invoke("recalculate-pacing", {
        body: { studentId: student.id, teacherId: user.id, mode: "proposal", triggerType: "placement_test",
          triggerDetails: { estimatedLevel: r.level, source: "public_placement" } },
      });
      if (pacingError) console.warn("[public-placement-report] pacing trigger failed", pacingError);
    } catch (e) { console.warn("[public-placement-report] pacing trigger failed", e); }

    await admin.from("public_placement_reports").update({ claimed_student_id: student.id }).eq("id", report.id);
    return json({ success: true, studentId: student.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[public-placement-report] error", e);
    return json({ error: message }, 500);
  }
});
