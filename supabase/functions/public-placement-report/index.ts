/**
 * public-placement-report: service-only storage for the public /welcome-test/demo result.
 * Actions:
 *  - submit: stores the bounded summary, emails the teacher (full report link) and,
 *            optionally, the student (student-facing link). No auth, 48 h expiry.
 *  - get:    returns a report by token (never returns email addresses).
 *  - claim:  signed-in teacher creates a student + learning profile from the report, once.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";

const TTL_MS = 48 * 60 * 60 * 1000;
const MAX_PER_TEACHER_EMAIL_PER_HOUR = 5;
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
    teacherEmail: z.string().trim().email().max(254),
  }),
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

function teacherEmailHtml(name: string, level: string | null, reportUrl: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <h2 style="color:#7c3aed;">${escapeHtml(name)} completed a placement test</h2>
  <p>${escapeHtml(name)} took the Edooqoo placement test and wants you to see the results before your first lesson.</p>
  <p>Estimated level: <strong>${level ?? "not enough evidence yet"}</strong></p>
  <p>The full report shows skill scores, the learning profile and where the student's declared needs differ from what the scenarios revealed.</p>
  ${button(reportUrl, "Open the full report")}
  <p>Create a free Edooqoo account from the report and ${escapeHtml(name)} is added to your students with this profile, ready for a 1-minute first lesson.</p>
  <p style="color:#6b7280;font-size:12px;">The link expires 48 hours after the test. ${reportUrl}</p></div>`;
}

function studentEmailHtml(name: string, studentUrl: string): string {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#1f2937;">
  <h2 style="color:#7c3aed;">Your placement results, ${escapeHtml(name)}</h2>
  <p>Thank you for taking the test. Your results are ready and your teacher has received the full report.</p>
  ${button(studentUrl, "See my results")}
  <p style="color:#6b7280;font-size:12px;">The link expires 48 hours after the test. ${studentUrl}</p></div>`;
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
    if (body.action === "submit") {
      const completed = Date.parse(body.result.completedAt);
      const expires = Date.parse(body.result.expiresAt);
      if (!Number.isFinite(completed) || expires !== completed + TTL_MS || expires <= now || completed > now + 60_000) {
        return json({ error: "This result has expired or is invalid. Please retake the test." }, 400);
      }
      const teacherEmail = body.teacherEmail.toLowerCase();
      const { count } = await admin.from("public_placement_reports").select("id", { count: "exact", head: true })
        .eq("teacher_email", teacherEmail).gte("created_at", new Date(now - 3600_000).toISOString());
      if ((count ?? 0) >= MAX_PER_TEACHER_EMAIL_PER_HOUR) return json({ error: "Too many reports for this teacher email. Try again later." }, 429);

      const token = newToken();
      const studentEmail = body.studentEmail ? body.studentEmail.toLowerCase() : null;
      const { error } = await admin.from("public_placement_reports").insert({
        report_token: token, result: body.result, student_name: body.studentName,
        student_email: studentEmail, teacher_email: teacherEmail, expires_at: new Date(expires).toISOString(),
      });
      if (error) throw error;

      const reportUrl = `${appBase}/placement-report/${token}`;
      const studentUrl = `${appBase}/placement-report/${token}?view=student`;
      await sendEmail(teacherEmail, `${body.studentName} shared placement test results with you`, teacherEmailHtml(body.studentName, body.result.level, reportUrl));
      let studentSent = false;
      if (studentEmail) {
        try { await sendEmail(studentEmail, "Your placement test results", studentEmailHtml(body.studentName, studentUrl)); studentSent = true; }
        catch (e) { console.error("[public-placement-report] student email failed", e); }
      }
      return json({ success: true, token, studentUrl, studentSent });
    }

    const { data: report, error } = await admin.from("public_placement_reports")
      .select("id, result, student_name, student_email, expires_at, claimed_by, claimed_student_id")
      .eq("report_token", body.token).maybeSingle();
    if (error) throw error;
    if (!report) return json({ error: "Report not found" }, 404);
    const expired = Date.parse(report.expires_at) <= now;

    if (body.action === "get") {
      if (expired && !report.claimed_by) return json({ error: "expired" }, 410);
      return json({ studentName: report.student_name, result: report.result, expiresAt: report.expires_at, claimed: !!report.claimed_by });
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
    const { data: student, error: studentError } = await admin.from("students").insert({
      teacher_id: user.id, name: report.student_name, student_email: report.student_email,
      teacher_email: user.email ?? null, english_level: r.level,
    }).select("id").single();
    if (studentError) {
      await admin.from("public_placement_reports").update({ claimed_by: null, claimed_at: null }).eq("id", report.id);
      throw studentError;
    }

    const score = (k: string) => r.skills[k as keyof typeof r.skills]?.score ?? null;
    const scored = Object.entries(r.skills).filter(([, s]) => s.score !== null) as [string, { score: number }][];
    scored.sort((a, b) => b[1].score - a[1].score);
    const { error: profileError } = await admin.from("student_learning_profiles").insert({
      student_id: student.id, teacher_id: user.id,
      estimated_level: r.level, level_confidence: r.levelConfidence,
      grammar_score: score("grammar"), vocabulary_score: score("vocabulary"), reading_score: score("reading"),
      self_awareness_score: r.selfAwarenessScore, traits: r.traits, divergences: r.divergences,
      motivation_type: r.traits.motivation_type ?? null, preferred_input_channel: r.traits.preferred_input_channel ?? null,
      feedback_preference: r.traits.feedback_preference ?? null,
      strongest_skill: scored[0]?.[0] ?? null, weakest_skill: scored.length > 1 ? scored[scored.length - 1][0] : null,
      raw_answers: { source: "public_placement_preview", report_id: report.id, answered: r.answeredCount, total: r.totalQuestions },
    });
    if (profileError) console.error("[public-placement-report] profile insert failed", profileError);

    await admin.from("public_placement_reports").update({ claimed_student_id: student.id }).eq("id", report.id);
    return json({ success: true, studentId: student.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[public-placement-report] error", e);
    return json({ error: message }, 500);
  }
});
