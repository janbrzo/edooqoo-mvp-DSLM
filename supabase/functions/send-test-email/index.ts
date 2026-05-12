/**
 * send-test-email - Edge function to send test link via email
 * Supports both regular tests and welcome tests
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { shareToken, recipientEmail, testTitle, teacherName, testType } = await req.json();

    if (!shareToken || !recipientEmail) {
      return new Response(JSON.stringify({ error: "Missing shareToken or recipientEmail" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || Deno.env.get('APP_BASE_URL') || "https://edooqoo.com";
    const isWelcomeTest = testType === "welcome";
    const shareUrl = isWelcomeTest ? `${origin}/welcome-test/${shareToken}` : `${origin}/test/${shareToken}`;

    console.log("[send-test-email] Sending to:", recipientEmail, "type:", testType || "regular");

    const emailBody = isWelcomeTest
      ? `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7c3aed;">🎯 Welcome Test</h2>
        <p>Hello,</p>
        <p><strong>${teacherName || "Your teacher"}</strong> has invited you to take a Welcome Test to help personalize your English learning experience.</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937;">What to expect:</h3>
          <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
            <li>Questions about your learning style and preferences</li>
            <li>Grammar and vocabulary assessment</li>
            <li>Takes 20-30 minutes</li>
            <li>No grades — this helps your teacher understand you better</li>
          </ul>
        </div>
        <a href="${shareUrl}" 
           style="display: inline-block; background: #7c3aed; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; margin: 20px 0; font-size: 16px;">
          Start Welcome Test
        </a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          <strong>Tip:</strong> Answer honestly — there are no wrong answers for the profile questions. If you don't know a grammar answer, just click "I don't know".
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          Or copy and paste this URL: ${shareUrl}
        </p>
      </div>
    `
      : `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #7c3aed;">📝 Test Assignment</h2>
        <p>Hello,</p>
        <p><strong>${teacherName || "Your teacher"}</strong> has assigned you a test:</p>
        <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0; color: #1f2937;">${testTitle}</h3>
        </div>
        <p>Click the button below to start the test:</p>
        <a href="${shareUrl}" 
           style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
          Start Test
        </a>
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
          <strong>Important:</strong> You will need to enter your email before starting. Your time will be tracked during the test.
        </p>
        <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
          Or copy and paste this URL: ${shareUrl}
        </p>
      </div>
    `;

    const subject = isWelcomeTest
      ? `${teacherName || "Your teacher"} invited you to take a Welcome Test`
      : `${teacherName || "Your teacher"} assigned you a test: ${testTitle}`;

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "EDOOQOO <noreply@edooqoo.com>",
        to: [recipientEmail],
        subject,
        html: emailBody,
      }),
    });

    const emailData = await emailResponse.json();

    if (!emailResponse.ok) {
      console.error("[send-test-email] Resend error:", emailData);
      throw new Error(emailData.message || "Failed to send email");
    }

    console.log("[send-test-email] Email sent successfully:", emailData.id);

    return new Response(JSON.stringify({ success: true, emailId: emailData.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[send-test-email] Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
