/**
 * public-placement-report: service-only storage for the public /welcome-test/demo result.
 * Actions:
 *  - submit: stores the bounded summary, emails the teacher (full report link) and,
 *            optionally, the student (student-facing link). No auth, 7-day expiry.
 *            Teacher and student links use separate tokens; the role comes from the token.
 *  - get:    returns a report by token (never returns email addresses).
 *  - claim:  signed-in teacher creates/reuses a student + learning profile, once.
 *  - invite: Quick Send creates a 7-day link; registered teachers get automatic claim.
 *  - invite_get: returns the invited student's name only (teacher email stays server-side).
 */
import { isLocalRecordingMarker, resolveStudentEmail } from "./claimSeed.ts";
import { publicPlacementNextSteps, startPlacementNextSteps } from "./nextSteps.ts";
import { publicPlacementLearningPath, startPlacementLearningPath } from "./learningPath.ts";
import {
  claimReservedReport,
  claimUnclaimedReport,
  loadTeacherDiagnosticData,
  reserveClaim,
  seedUnclaimedPlacementStudent,
  triggerPlacementPacing,
  triggerWelcomeTestProcessing,
  UNCLAIMED_PLACEMENT_TEACHER_ID,
  type ClaimInvite,
  type ClaimReport,
  type PlacementClaimResult,
} from "./claim.ts";
import { WELCOME_TEST_SEED_BANK_2A } from "../_shared/welcomeTestSeedBank2A.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "npm:zod@3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
/** Results created before the 7-day change carry a 48 h expiry; still accepted. */
const LEGACY_TTL_MS = 48 * 60 * 60 * 1000;
const MAX_PER_TEACHER_EMAIL_PER_HOUR = 5;
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_INVITES_PER_TEACHER_EMAIL_PER_HOUR = 10;
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{20,64}$/);
const LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const KNOWN_BANK_2A_QUESTION_IDS = new Set(WELCOME_TEST_SEED_BANK_2A.map((row) => row.question_data.question_id));

const answerValueSchema = z.union([
  z.string().max(5_000),
  z.number().finite(),
  z.array(z.string().max(500)).max(20),
  z.record(z.string().max(200), z.number().finite()).refine((m) => Object.keys(m).length <= 20),
]);
const answersSchema = z.record(z.string().max(40), answerValueSchema).refine((a) => Object.keys(a).length <= 72);

function sanitizeSubmittedAnswers(answers: Record<string, unknown> | undefined): Record<string, unknown> | null {
  if (!answers) return null;
  const clean: Record<string, unknown> = {};
  for (const [id, value] of Object.entries(answers)) {
    if (!KNOWN_BANK_2A_QUESTION_IDS.has(id) || isLocalRecordingMarker(value)) continue;
    clean[id] = value;
  }
  return Object.keys(clean).length > 0 ? clean : null;
}

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
  interestTopics: z.array(z.string().max(100)).max(12).optional(),
  confidenceMatrix: z.record(z.enum(["speaking", "writing", "listening", "reading", "presenting", "small_talk"]), z.number().int().min(1).max(5)).optional(),
  selfAssessedLevel: z.string().max(100).nullable().optional(),
  keyedQuestionCount: z.number().int().min(0).max(500).optional(),
  keyedCorrectCount: z.number().int().min(0).max(500).optional(),
  keyedAnsweredCount: z.number().int().min(0).max(500).optional(),
  profileQuestionCount: z.number().int().min(0).max(500).optional(),
});

const bodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("submit"),
    result: resultSchema,
    answers: answersSchema.optional(),
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
  z.object({ action: z.literal("generate_next_steps"), token: tokenSchema }),
  z.object({ action: z.literal("generate_learning_path"), token: tokenSchema }),
  z.object({ action: z.literal("forward"), token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/), teacherEmail: z.string().trim().email().max(254) }),
]);

const MAX_FORWARDS_PER_REPORT = 3;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const escapeHtml = (v: string) => v.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] ?? c));

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
  await res.text();
  if (!res.ok) throw new Error(`Email could not be sent (${res.status})`);
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

function existingTeacherEmailHtml(name: string, level: string | null, resultUrl: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <h2 style="color:#7c3aed;">${escapeHtml(name)} completed a placement test</h2>
  <p>The results and teaching profile are now available on the student's profile in your Edooqoo account.</p>
  <p>Estimated level: <strong>${level ?? "not enough evidence yet"}</strong></p>
  ${button(escapeHtml(resultUrl), `View ${escapeHtml(name)}'s test results`)}
  <p style="color:#6b7280;font-size:12px;">Sign in to Edooqoo to open the saved result. ${escapeHtml(resultUrl)}</p></div>`;
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
  <p>Learning with a private teacher? Send them the full report in one click:</p>
  ${button(`${studentUrl}?forward=1`, "Send my results to my teacher")}
  <p style="color:#6b7280;font-size:12px;">The link is valid for 7 days after the test. ${studentUrl}</p></div>`;
}

export async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return json({ error: "Invalid request", details: parsed.error.flatten().fieldErrors }, 400);
  const body = parsed.data;

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ error: "Service unavailable" }, 503);
  const admin = createClient(supabaseUrl, serviceKey);
  const configuredBase = Deno.env.get("APP_BASE_URL");
  if (!configuredBase) return json({ error: "Service unavailable" }, 503);
  const appBase = configuredBase.replace(/\/+$/, "");
  const now = Date.now();

  try {
    if (body.action === "invite") {
      const teacherEmail = body.teacherEmail.toLowerCase();
      const { count } = await admin.from("public_placement_invites").select("id", { count: "exact", head: true })
        .eq("teacher_email", teacherEmail).gte("created_at", new Date(now - 3600_000).toISOString());
      if ((count ?? 0) >= MAX_INVITES_PER_TEACHER_EMAIL_PER_HOUR) return json({ error: "Too many invites from this email. Try again later." }, 429);
      const token = newToken();
      const studentEmail = body.studentEmail ? body.studentEmail.toLowerCase() : null;
      const teacherName = body.teacherName ? body.teacherName : null;
      const { data: teacherProfile, error: teacherProfileError } = await admin.from("profiles")
        .select("id").eq("email", teacherEmail).is("deleted_at", null).limit(1).maybeSingle();
      if (teacherProfileError) throw teacherProfileError;
      let linkedStudentId: string | null = null;
      let createdPendingStudent = false;
      if (teacherProfile && studentEmail) {
        const { data: existingStudent, error: existingStudentError } = await admin.from("students")
          .select("id").eq("teacher_id", teacherProfile.id).eq("student_email", studentEmail)
          .is("deleted_at", null).limit(1).maybeSingle();
        if (existingStudentError) throw existingStudentError;
        linkedStudentId = existingStudent?.id ?? null;
      }
      if (teacherProfile && !linkedStudentId) {
        const { data: pendingStudent, error: pendingStudentError } = await admin.from("students").insert({
          teacher_id: teacherProfile.id,
          teacher_email: teacherEmail,
          name: body.studentName,
          student_email: studentEmail,
          placement_pending_at: new Date(now).toISOString(),
        }).select("id").single();
        if (pendingStudentError) throw pendingStudentError;
        linkedStudentId = pendingStudent.id;
        createdPendingStudent = true;
      }
      const { error } = await admin.from("public_placement_invites").insert({
        invite_token: token, student_name: body.studentName, student_email: studentEmail,
        teacher_email: teacherEmail, teacher_id: teacherProfile?.id ?? null, student_id: linkedStudentId,
        expires_at: new Date(now + INVITE_TTL_MS).toISOString(),
      });
      if (error) {
        if (createdPendingStudent && linkedStudentId && teacherProfile) {
          await admin.from("students").delete().eq("id", linkedStudentId).eq("teacher_id", teacherProfile.id);
        }
        throw error;
      }
      const testUrl = `${appBase}/welcome-test/demo?invite=${token}`;
      let studentSent = false;
      if (studentEmail) {
        try { await sendEmail(studentEmail, "Your English placement test", inviteEmailHtml(body.studentName, testUrl, teacherLabel(teacherName, teacherEmail))); studentSent = true; }
        catch { console.error("[public-placement-report] invite email failed"); }
      }
      let teacherConfirmed = false;
      try {
        await sendEmail(teacherEmail, `You sent an English placement test to ${body.studentName}`, inviteConfirmationHtml(body.studentName, testUrl, studentSent));
        teacherConfirmed = true;
      } catch { console.error("[public-placement-report] invite confirmation failed"); }
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
      let invite: (ClaimInvite & { id: string; teacher_email: string; student_name: string }) | null = null;
      if (body.inviteToken) {
        const { data, error } = await admin.from("public_placement_invites")
          .select("id, teacher_email, student_name, student_email, teacher_id, student_id, expires_at, completed_at")
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
      const storedAnswers = sanitizeSubmittedAnswers(body.answers);
      const { data: inserted, error } = await admin.from("public_placement_reports").insert({
        report_token: token, student_report_token: studentToken, result: body.result, student_name: body.studentName,
        student_email: studentEmail, teacher_email: teacherEmail, expires_at: new Date(expires).toISOString(),
        invite_id: invite?.id ?? null,
        ...(storedAnswers ? { answers: storedAnswers } : {}),
      }).select("id").single();
      if (error) throw error;
      const reportUrl = `${appBase}/placement-report/${token}`;
      const studentUrl = `${appBase}/placement-report/${studentToken}`;
      let autoClaim: { studentId: string; testId: string; hasAnswers: boolean } | null = null;
      if (invite?.teacher_id) {
        // Claim the invitation before writing learner evidence. A failed auto-claim
        // releases both records, so a retry cannot create a duplicate test.
        const { data: completedInvite, error: inviteReservationError } = await admin.from("public_placement_invites")
          .update({ completed_at: new Date().toISOString(), completed_report_id: inserted.id })
          .eq("id", invite.id).is("completed_at", null).select("id").maybeSingle();
        if (inviteReservationError) throw inviteReservationError;
        if (!completedInvite) {
          await admin.from("public_placement_reports").delete().eq("id", inserted.id);
          return json({ error: "Results for this invitation were already sent." }, 409);
        }
        try {
          const reserved = await reserveClaim(admin, inserted.id, invite.teacher_id, new Date().toISOString());
          if (!reserved) throw new Error("This report was already added");
          autoClaim = await claimReservedReport({
            admin,
            report: { id: inserted.id, student_name: body.studentName, teacher_email: teacherEmail, result: body.result, answers: storedAnswers },
            teacher: { id: invite.teacher_id, email: teacherEmail },
            invite,
            studentEmail,
          });
          if (autoClaim.hasAnswers) {
            await triggerWelcomeTestProcessing(admin, {
              testId: autoClaim.testId,
              studentId: autoClaim.studentId,
              teacherId: invite.teacher_id,
              answeredCount: body.result.answeredCount,
            });
          } else {
            await triggerPlacementPacing(admin, autoClaim.studentId, invite.teacher_id, body.result.level);
          }
        } catch (failure) {
          await admin.from("public_placement_invites").update({ completed_at: null, completed_report_id: null })
            .eq("id", invite.id).eq("completed_report_id", inserted.id);
          await admin.from("public_placement_reports").delete().eq("id", inserted.id).is("claimed_by", null);
          throw failure;
        }
      }

      let teacherSent = false;
      if (autoClaim) {
        const resultUrl = `${appBase}/student/${autoClaim.studentId}?tab=timeline&filter=tests&testId=${autoClaim.testId}`;
        try {
          await sendEmail(teacherEmail, `${body.studentName} completed their placement test`, existingTeacherEmailHtml(body.studentName, body.result.level, resultUrl));
          teacherSent = true;
        } catch {
          // The result is already safely claimed. Never remove it or invite a duplicate retry only because mail failed.
          console.error("[public-placement-report] existing teacher result email failed");
        }
      } else {
        try {
          await sendEmail(teacherEmail, `${body.studentName} shared placement test results with you`, teacherEmailHtml(body.studentName, body.result.level, reportUrl, `${reportUrl}?claim=1`));
          teacherSent = true;
        } catch (failure) {
          await admin.from("public_placement_reports").delete().eq("id", inserted.id);
          throw failure;
        }
      }
      if (invite && !autoClaim) {
        const { error: completeError } = await admin.from("public_placement_invites").update({ completed_at: new Date().toISOString(), completed_report_id: inserted.id })
          .eq("id", invite.id).is("completed_at", null);
        if (completeError) throw completeError;
      }
      if (!autoClaim) {
        try {
          const unclaimed = await seedUnclaimedPlacementStudent({
            admin,
            report: {
              id: inserted.id,
              student_name: body.studentName,
              teacher_email: teacherEmail,
              result: body.result,
              answers: storedAnswers,
            },
            studentEmail,
          });
          if (unclaimed.hasAnswers) {
            await triggerWelcomeTestProcessing(admin, {
              testId: unclaimed.testId,
              studentId: unclaimed.studentId,
              teacherId: UNCLAIMED_PLACEMENT_TEACHER_ID,
              answeredCount: body.result.answeredCount,
            });
          } else {
            await triggerPlacementPacing(admin, unclaimed.studentId, UNCLAIMED_PLACEMENT_TEACHER_ID, body.result.level);
          }
        } catch {
          // The report is already stored and emailed; claim retains its fallback creation path.
          console.warn("[public-placement-report] unclaimed student seeding failed");
        }
      }
      let studentSent = false;
      if (studentEmail) {
        try { await sendEmail(studentEmail, "Your placement test results", studentEmailHtml(body.studentName, studentUrl)); studentSent = true; }
        catch { console.error("[public-placement-report] student email failed"); }
      }
      return json({ success: true, studentUrl, studentSent, teacherSent, sentToInvitingTeacher: !!invite, autoClaimed: !!autoClaim });
    }

    if (body.action === "forward") {
      const { data: rep, error } = await admin.from("public_placement_reports")
        .select("id, report_token, student_name, result, expires_at, claimed_by, forward_count")
        .eq("student_report_token", body.token).maybeSingle();
      if (error) throw error;
      if (!rep || Date.parse(rep.expires_at) <= now) return json({ error: "This results link has expired." }, 410);
      if (rep.claimed_by) return json({ error: "A teacher has already added you with these results." }, 409);
      if ((rep.forward_count ?? 0) >= MAX_FORWARDS_PER_REPORT) return json({ error: "These results were already sent several times." }, 429);
      const { data: bumped } = await admin.from("public_placement_reports").update({ forward_count: (rep.forward_count ?? 0) + 1 })
        .eq("id", rep.id).eq("forward_count", rep.forward_count ?? 0).select("id").maybeSingle();
      if (!bumped) return json({ error: "Please try again." }, 409);
      const reportUrl = `${appBase}/placement-report/${rep.report_token}`;
      const level = (rep.result as { level?: string | null })?.level ?? null;
      await sendEmail(body.teacherEmail.toLowerCase(), `${rep.student_name} shared placement test results with you`, teacherEmailHtml(rep.student_name, level, reportUrl, `${reportUrl}?claim=1`));
      return json({ success: true });
    }

    if (body.action !== "get" && body.action !== "claim" && body.action !== "generate_next_steps" && body.action !== "generate_learning_path") return json({ error: "Unknown action" }, 400);
    const columns = "id, result, student_name, student_email, teacher_email, invite_id, expires_at, claimed_by, claimed_student_id, unclaimed_student_id, unclaimed_test_id, placement_next_steps, placement_learning_path";
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

    if (body.action === "generate_next_steps") {
      if (role !== "teacher") return json({ error: "Only the teacher link can prepare lessons" }, 403);
      if (expired) return json({ error: "This report has expired" }, 410);
      const nextSteps = await startPlacementNextSteps(admin, body.token);
      if (nextSteps?.status === "claimed") return json({ error: "Open the student's learning plan in your account to prepare more lessons." }, 409);
      if (nextSteps?.status === "not_ready") return json({ error: "The placement analysis is still being prepared. Please try again shortly." }, 409);
      if (nextSteps?.status === "expired") return json({ error: "This report has expired" }, 410);
      if (nextSteps?.status === "unavailable") return json({ error: "Report not available" }, 404);
      return json(publicPlacementNextSteps(nextSteps));
    }

    if (body.action === "generate_learning_path") {
      if (role !== "teacher") return json({ error: "Only the teacher link can build a learning path" }, 403);
      if (expired) return json({ error: "This report has expired" }, 410);
      const learningPath = await startPlacementLearningPath(admin, body.token);
      if (learningPath?.status === "claimed") return json({ error: "Open the student's learning plan in your account to edit their roadmap." }, 409);
      if (learningPath?.status === "not_ready") return json({ error: "The placement analysis is still being prepared. Please try again shortly." }, 409);
      if (learningPath?.status === "expired") return json({ error: "This report has expired" }, 410);
      if (learningPath?.status === "unavailable") return json({ error: "Report not available" }, 404);
      return json(publicPlacementLearningPath(learningPath));
    }

    if (body.action === "get") {
      if (expired) return json({ error: "expired" }, 410);
      const fullResult = report.result as z.infer<typeof resultSchema>;
      const studentResult = {
        ...fullResult,
        traits: Object.fromEntries(Object.entries(fullResult.traits).filter(([key]) => ["motivation_type", "latent_goal", "preferred_input_channel", "homework_commitment", "feedback_preference"].includes(key))),
        divergences: [], selfAwarenessScore: null, levelConfidence: null,
      };
      let teacherDiagnostic: Awaited<ReturnType<typeof loadTeacherDiagnosticData>> | undefined;
      if (role === "teacher") {
        const diagStudentId = report.claimed_student_id ?? report.unclaimed_student_id ?? null;
        const diagTestId = report.unclaimed_test_id ?? null;
        if (diagStudentId && diagTestId) {
          try {
            teacherDiagnostic = await loadTeacherDiagnosticData(admin, diagStudentId, diagTestId);
          } catch {
            console.warn("[public-placement-report] teacher diagnostic read failed");
          }
        }
      }
      return json({
        role,
        studentName: report.student_name,
        result: role === "student" ? studentResult : fullResult,
        expiresAt: report.expires_at,
        claimed: !!report.claimed_by,
        ...(role === "teacher" ? { nextSteps: publicPlacementNextSteps(report.placement_next_steps) } : {}),
        ...(role === "teacher" ? { learningPath: publicPlacementLearningPath(report.placement_learning_path) } : {}),
        ...(teacherDiagnostic ? { teacherDiagnostic } : {}),
      });
    }

    // claim
    const authHeader = req.headers.get("Authorization") ?? "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "");
    const { data: userData } = await admin.auth.getUser(jwt);
    const user = userData?.user;
    if (!user || user.is_anonymous) return json({ error: "Sign in to add this student" }, 401);
    if (report.claimed_by) {
      if (report.claimed_by === user.id && report.claimed_student_id) {
        const { data: claimedTest, error: claimedTestError } = await admin.from("student_tests")
          .select("id").eq("student_id", report.claimed_student_id).eq("teacher_id", user.id)
          .eq("generation_params->>report_id", report.id).maybeSingle();
        if (claimedTestError) throw claimedTestError;
        if (!claimedTest) return json({ error: "Test results are still being prepared. Please try again shortly." }, 409);
        return json({ success: true, studentId: report.claimed_student_id, testId: claimedTest.id, alreadyClaimed: true });
      }
      if (report.claimed_by === user.id) return json({ error: "Student is still being added. Please try again shortly." }, 409);
      return json({ error: "This report was already added by another teacher" }, 409);
    }
    if (expired) return json({ error: "expired" }, 410);

    let invite: ClaimInvite | null = null;
    if (report.invite_id) {
      const { data: inv, error: inviteError } = await admin.from("public_placement_invites")
        .select("student_email, teacher_id, student_id").eq("id", report.invite_id).maybeSingle();
      if (inviteError) throw inviteError;
      invite = inv;
    }
    if (invite?.teacher_id && invite.teacher_id !== user.id) {
      return json({ error: "This invitation belongs to a different teacher account" }, 403);
    }

    // Reserve first so parallel requests cannot create duplicate tests or learners.
    const reserved = await reserveClaim(admin, report.id, user.id, new Date().toISOString());
    if (!reserved) return json({ error: "This report was already added" }, 409);

    const r = report.result as PlacementClaimResult;
    if (report.unclaimed_student_id && report.unclaimed_test_id && !invite?.student_id) {
      const claimed = await claimUnclaimedReport({
        admin,
        reportId: report.id,
        unclaimedStudentId: report.unclaimed_student_id,
        unclaimedTestId: report.unclaimed_test_id,
        teacher: { id: user.id, email: user.email },
      });
      if (claimed.needsProcessing) {
        const { data: answerRow } = await admin.from("public_placement_reports")
          .select("answers").eq("id", report.id).maybeSingle();
        const hasAnswers = !!(answerRow?.answers && typeof answerRow.answers === "object" && Object.keys(answerRow.answers as Record<string, unknown>).length > 0);
        if (hasAnswers) {
          await triggerWelcomeTestProcessing(admin, {
            testId: claimed.testId,
            studentId: claimed.studentId,
            teacherId: user.id,
            answeredCount: r.answeredCount,
          });
        }
      }
      return json({ success: true, studentId: claimed.studentId, testId: claimed.testId });
    }

    const studentEmail = resolveStudentEmail(invite?.student_email, report.invite_id ? null : report.student_email, [report.teacher_email, user.email]);
    const { data: answerRow, error: answerRowError } = await admin.from("public_placement_reports")
      .select("answers").eq("id", report.id).maybeSingle();
    if (answerRowError) throw answerRowError;
    const claimReport: ClaimReport = {
      id: report.id,
      student_name: report.student_name,
      teacher_email: report.teacher_email,
      result: r,
      answers: (answerRow?.answers as Record<string, unknown> | null | undefined) ?? null,
    };
    const claimed = await claimReservedReport({ admin, report: claimReport, teacher: { id: user.id, email: user.email }, invite, studentEmail });
    if (claimed.hasAnswers) {
      await triggerWelcomeTestProcessing(admin, {
        testId: claimed.testId,
        studentId: claimed.studentId,
        teacherId: user.id,
        answeredCount: r.answeredCount,
      });
    } else {
      await triggerPlacementPacing(admin, claimed.studentId, user.id, r.level);
    }
    return json({ success: true, studentId: claimed.studentId, testId: claimed.testId });
  } catch (e) {
    console.error("[public-placement-report] request failed");
    return json({ error: "Could not complete this request. Please try again." }, 500);
  }
}

if (import.meta.main) Deno.serve(handleRequest);
