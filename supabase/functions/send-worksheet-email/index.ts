// ============================================
// FAZA 8: Edge Function for Sending Worksheet Emails
// ============================================

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { WorksheetNotificationEmail } from "../_shared/email-templates/worksheet-notification.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendWorksheetEmailRequest {
  worksheetId: string;
  studentEmail: string;
  updateShareRecipientEmail?: boolean; // If true, save email to worksheets.share_recipient_email
  force?: boolean; // Bypass the duplicate-send guard
}

// P2.3: duplicate send guard window (ms)
const DEDUPE_WINDOW_MS = 10 * 60 * 1000;

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get and validate Authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("[send-worksheet-email] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("[send-worksheet-email] Missing Authorization header");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "No authorization header provided. Please ensure you're logged in." 
        }),
        { 
          status: 401, 
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Use Service Role client to verify JWT token
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "", 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", 
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Extract token from "Bearer <token>" format
    const token = authHeader.replace("Bearer ", "");
    console.log("[send-worksheet-email] Verifying JWT token...");

    // Verify the JWT token
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    console.log("[send-worksheet-email] User authenticated:", !!user);
    
    if (authError) {
      throw new Error("Unauthorized");
    }
    
    if (!user || user.is_anonymous) {
      throw new Error("Unauthorized: No valid user session");
    }

    const supabase = supabaseAdmin;
    const { worksheetId, studentEmail, updateShareRecipientEmail, force } =
      (await req.json()) as SendWorksheetEmailRequest;


    // Fetch worksheet details
    const { data: worksheet, error: worksheetError } = await supabase
      .from("worksheets")
      .select("*")
      .eq("id", worksheetId)
      .eq("teacher_id", user.id)
      .single();

    if (worksheetError || !worksheet) {
      console.error('[send-worksheet-email] Worksheet not found:', worksheetError);
      throw new Error("Worksheet not found or unauthorized");
    }

    // Fetch student info if worksheet has student_id
    let studentName = "Student";
    let assignedEmail: string | null = null;
    if (worksheet.student_id) {
      const { data: student } = await supabase
        .from("students")
        .select("name, student_email")
        .eq("id", worksheet.student_id)
        .eq("teacher_id", user.id)
        .single();
      if (student) {
        studentName = student.name;
        assignedEmail = student.student_email?.trim().toLowerCase() || null;
      }
    }

    // Fetch teacher profile
    const { data: teacherProfile } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", worksheet.teacher_id)
      .single();

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (typeof studentEmail !== "string" || studentEmail.length > 254 || !emailRegex.test(studentEmail)) {
      throw new Error("Invalid email format");
    }
    // A worksheet assigned to a student with a known email can only be sent to that student.
    if (assignedEmail && assignedEmail !== studentEmail.trim().toLowerCase()) {
      throw new Error("Recipient must be the assigned student's email");
    }

    // P2.3: duplicate send guard: same recipient within the dedupe window
    const normalizedEmail = studentEmail.toLowerCase();
    if (!force && worksheet.last_shared_at && worksheet.share_recipient_email === normalizedEmail) {
      const elapsed = Date.now() - new Date(worksheet.last_shared_at).getTime();
      if (elapsed >= 0 && elapsed < DEDUPE_WINDOW_MS) {
        console.log("[send-worksheet-email] Skipped duplicate send", { worksheetId, elapsed });
        return new Response(
          JSON.stringify({
            success: true,
            sent: false,
            skipped: true,
            reason: "duplicate_recent_send",
            recipient: normalizedEmail,
            message: "This worksheet was already emailed to this student a few minutes ago.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // Update share_recipient_email if requested
    if (updateShareRecipientEmail) {
      const { error: updateError } = await supabase
        .from("worksheets")
        .update({ share_recipient_email: studentEmail.toLowerCase() })
        .eq("id", worksheetId)
        .eq("teacher_id", user.id);

      if (updateError) {
        console.error("[send-worksheet-email] Failed to update share_recipient_email:", updateError);
      }
    }

    // Generate worksheet link
    const worksheetLink = `${(Deno.env.get("APP_BASE_URL") || "https://edooqoo.com").replace(/\/+$/, "")}/shared/${worksheet.share_token}`;

    // Get teacher name
    const teacherName = teacherProfile?.first_name
      ? `${teacherProfile.first_name} ${teacherProfile.last_name || ""}`.trim()
      : teacherProfile?.email || "Your Teacher";

    // Render email template
    const html = await renderAsync(
      React.createElement(WorksheetNotificationEmail, {
        studentName,
        teacherName,
        worksheetTitle: worksheet.title || "English Worksheet",
        worksheetLink,
      }),
    );

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: `${teacherName} <noreply@edooqoo.com>`,
      to: [studentEmail],
      subject: `New Worksheet: ${worksheet.title || "English Worksheet"}`,
      html,
    });

    if (emailError) {
      console.error("[send-worksheet-email] Resend error");
      throw new Error("Failed to send email");
    }

    // P2.3: record delivery timestamp for the duplicate send guard
    const { error: stampError } = await supabase
      .from("worksheets")
      .update({ last_shared_at: new Date().toISOString() })
      .eq("id", worksheetId)
      .eq("teacher_id", user.id);
    if (stampError) {
      console.error("[send-worksheet-email] Failed to record last_shared_at:", stampError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: true,
        recipient: normalizedEmail,
        emailId: emailData?.id,
        message: "Worksheet email sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    const safe = ["Unauthorized", "Unauthorized: No valid user session", "Worksheet not found or unauthorized", "Invalid email format", "Recipient must be the assigned student's email", "Failed to send email"];
    const message = safe.includes(error?.message) ? error.message : "Internal server error";
    console.error("[send-worksheet-email] Error:", message);
    return new Response(
      JSON.stringify({
        success: false,
        error: message,
      }),
      {
        status: message.startsWith("Unauthorized") ? 401 : message === "Internal server error" || message === "Failed to send email" ? 500 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
