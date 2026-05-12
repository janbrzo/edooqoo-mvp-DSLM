// submit-bug-report
// v6.8.6 — adds email_status / email_error tracking on bug_reports so
// /admin/error-logs can show whether the Resend send succeeded.
// Frontend calls this function via direct fetch() (BugReportModal v6.8.5).
// Receives a bug report from a teacher (auth required), inserts into
// public.bug_reports, optionally signs attachment URLs, and emails the
// sandbox-safe or verified-domain destination via Resend.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { logError, formatErr } from "../_shared/logError.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, content-type, apikey, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, prefer",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface BugReportBody {
  title: string;
  description: string;
  page_url?: string;
  user_agent?: string;
  viewport?: string;
  console_errors?: unknown[];
  attachment_paths?: string[]; // storage paths inside `bug-reports` bucket
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  // NOTE: Resend sandbox mode (using onboarding@resend.dev as `from`) only
  // allows sending to the Resend account owner's email. BUG_REPORT_EMAIL may
  // still be configured for the future verified-domain path, so ignore it while
  // the sender remains sandboxed. This prevents repeated HTTP 403 failures.
  const bugReportFrom = Deno.env.get("BUG_REPORT_FROM_EMAIL") || "Edooqoo Bugs <onboarding@resend.dev>";
  const resendSandboxRecipient = "j4n.brz0@gmail.com";
  const isSandboxSender = bugReportFrom.includes("onboarding@resend.dev");
  const bugEmail = isSandboxSender
    ? resendSandboxRecipient
    : (Deno.env.get("BUG_REPORT_EMAIL") || resendSandboxRecipient);
  const resendKey = Deno.env.get("RESEND_API_KEY");

  const sbAdmin = createClient(supabaseUrl, serviceKey);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const sbUser = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await sbUser.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;
    const userEmail = userData.user.email ?? "(unknown)";

    const body = (await req.json()) as BugReportBody;

    // --- validate ---
    const title = String(body.title ?? "").trim();
    const description = String(body.description ?? "").trim();
    if (title.length < 1 || title.length > 200) {
      return new Response(JSON.stringify({ error: "Title must be 1–200 chars" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (description.length < 1 || description.length > 5000) {
      return new Response(JSON.stringify({ error: "Description must be 1–5000 chars" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const attachmentPaths = Array.isArray(body.attachment_paths)
      ? body.attachment_paths.filter((p) => typeof p === "string" && p.startsWith(`${userId}/`)).slice(0, 5)
      : [];
    const consoleErrors = Array.isArray(body.console_errors)
      ? body.console_errors.slice(0, 50)
      : [];

    // --- insert ---
    const { data: inserted, error: insErr } = await sbAdmin
      .from("bug_reports")
      .insert({
        teacher_id: userId,
        title,
        description,
        page_url: body.page_url ?? null,
        user_agent: body.user_agent ?? null,
        viewport: body.viewport ?? null,
        console_errors: consoleErrors,
        attachment_paths: attachmentPaths,
        email_status: "pending",
      })
      .select("id, created_at")
      .single();

    if (insErr || !inserted) {
      const f = formatErr(insErr);
      await logError(sbAdmin, {
        source_name: "submit-bug-report",
        component: "bug_report",
        message: f.message,
        error_code: f.code,
        context: { userId, title },
        user_id: userId,
      });
      return new Response(JSON.stringify({ error: f.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- signed URLs for attachments (1h) ---
    const signedAttachments: { path: string; url: string | null }[] = [];
    for (const path of attachmentPaths) {
      const { data: signed } = await sbAdmin.storage
        .from("bug-reports")
        .createSignedUrl(path, 60 * 60);
      signedAttachments.push({ path, url: signed?.signedUrl ?? null });
    }

    // --- email via Resend (best-effort) ---
    // Outcomes: 'sent' | 'failed' | 'skipped'.
    // Result is persisted to bug_reports.email_status and surfaced in /admin/error-logs.
    let emailStatus: "sent" | "failed" | "skipped" = "skipped";
    let emailError: string | null = null;
    let teacherDisplay = userEmail;
    try {
      const { data: profile } = await sbAdmin
        .from("profiles")
        .select("first_name, last_name, email")
        .eq("id", userId)
        .maybeSingle();
      if (profile) {
        const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ").trim();
        teacherDisplay = fullName ? `${fullName} <${profile.email ?? userEmail}>` : (profile.email ?? userEmail);
      }
    } catch { /* non-fatal */ }

    if (resendKey) {
      try {
        const consoleHtml = consoleErrors.length
          ? `<pre style="background:#f6f8fa;padding:12px;border-radius:6px;font-size:12px;white-space:pre-wrap;max-height:400px;overflow:auto;">${escapeHtml(JSON.stringify(consoleErrors, null, 2))}</pre>`
          : "<p><em>No recent console errors captured.</em></p>";
        const attachmentsHtml = signedAttachments.length
          ? `<ul>${signedAttachments.map((a) => `<li><a href="${a.url}">${escapeHtml(a.path)}</a></li>`).join("")}</ul>`
          : "<p><em>No screenshots attached.</em></p>";

        const html = `
          <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:680px;margin:0 auto;padding:20px;color:#111;">
            <h2 style="color:#7c3aed;margin:0 0 8px;">🐛 New Bug Report — Edooqoo</h2>
            <p style="color:#666;font-size:13px;margin:0 0 16px;">Report ID: <code>${inserted.id}</code></p>
            <h3 style="margin:16px 0 4px;">${escapeHtml(title)}</h3>
            <div style="white-space:pre-wrap;background:#f9fafb;padding:12px;border-radius:6px;border:1px solid #eee;">${escapeHtml(description)}</div>
            <table style="margin-top:16px;font-size:13px;color:#374151;">
              <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Reporter</td><td>${escapeHtml(teacherDisplay)}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">User ID</td><td><code>${userId}</code></td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Page URL</td><td>${escapeHtml(body.page_url ?? "—")}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">Viewport</td><td>${escapeHtml(body.viewport ?? "—")}</td></tr>
              <tr><td style="padding:2px 8px 2px 0;color:#6b7280;">User Agent</td><td>${escapeHtml(body.user_agent ?? "—")}</td></tr>
            </table>
            <h4 style="margin-top:20px;">Screenshots / Attachments</h4>
            ${attachmentsHtml}
            <h4 style="margin-top:20px;">Recent console errors</h4>
            ${consoleHtml}
          </div>`;

        const emailResp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendKey}`,
          },
          body: JSON.stringify({
            from: bugReportFrom,
            to: [bugEmail],
            reply_to: userEmail,
            subject: `[Bug] ${title.slice(0, 120)}`,
            html,
          }),
        });
        if (!emailResp.ok) {
          const t = await emailResp.text();
          console.error("[submit-bug-report] resend failed", emailResp.status, t);
          emailStatus = "failed";
          emailError = `HTTP ${emailResp.status} ${t.slice(0, 400)}`;
        } else {
          emailStatus = "sent";
        }
      } catch (mailErr) {
        console.error("[submit-bug-report] email error", mailErr);
        emailStatus = "failed";
        emailError = mailErr instanceof Error ? mailErr.message : String(mailErr);
      }
    } else {
      console.warn("[submit-bug-report] RESEND_API_KEY not configured; skipping email.");
      emailStatus = "skipped";
      emailError = "RESEND_API_KEY not configured";
    }

    // Persist email outcome. Failure to persist is logged but does not affect
    // the response — the bug itself is already recorded.
    try {
      await sbAdmin
        .from("bug_reports")
        .update({ email_status: emailStatus, email_error: emailError })
        .eq("id", inserted.id);
    } catch (uErr) {
      console.error("[submit-bug-report] failed to update email_status", uErr);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        id: inserted.id,
        createdAt: inserted.created_at,
        emailStatus,
        emailError,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const f = formatErr(err);
    await logError(sbAdmin, {
      source_name: "submit-bug-report",
      component: "bug_report",
      message: f.message,
      error_code: f.code,
      stack: f.stack,
    });
    return new Response(JSON.stringify({ error: f.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}