import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { HomeworkNotificationEmail } from "../_shared/email-templates/homework-notification.tsx";
import { HomeworkReminderEmail } from "../_shared/email-templates/homework-reminder.tsx";
import { HomeworkSubmissionEmail } from "../_shared/email-templates/homework-submission.tsx";

// Force redeploy: 2024-11-16 19:15 UTC - Using Service Role for JWT verification
// CRITICAL FIX: Edge functions can't use auth.getUser() with session (no localStorage)
// Must use Service Role client and verify JWT token directly
const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendHomeworkEmailRequest {
  homeworkId: string;
  studentEmail: string;
  updateStudentEmail?: boolean; // If true, update student's email in database
  isReminder?: boolean; // If true, use reminder template and subject
  isSubmissionNotification?: boolean; // If true, send to teacher about student submission
  answeredExercisesCount?: number; // Number of exercises answered by student
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get and validate Authorization header
    const authHeader = req.headers.get("Authorization");
    console.log("[send-homework-email] Auth header present:", !!authHeader);
    
    if (!authHeader) {
      console.error("[send-homework-email] Missing Authorization header");
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

    // CRITICAL FIX: Use Service Role client to verify JWT token
    // Edge functions don't have localStorage, so auth.getUser() fails with session
    // We must use Service Role client and pass the token explicitly
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
    console.log("[send-homework-email] Verifying JWT token...");

    // Verify the JWT token using Service Role client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    console.log("[send-homework-email] User authenticated:", !!user);
    console.log("[send-homework-email] User ID:", user?.id);
    
    if (authError) {
      console.error("[send-homework-email] Auth error:", authError);
      throw new Error(`Authentication failed: ${authError.message}`);
    }
    
    if (!user) {
      console.error("[send-homework-email] No user found");
      throw new Error("Unauthorized: No valid user session");
    }

    // Now use Service Role client for database queries (with proper user_id filtering)
    const supabase = supabaseAdmin;

    const { homeworkId, studentEmail, updateStudentEmail, isReminder, isSubmissionNotification, answeredExercisesCount } = (await req.json()) as SendHomeworkEmailRequest;

    console.log(`Sending homework email for homework ${homeworkId} to ${studentEmail}, isReminder: ${isReminder || false}, isSubmissionNotification: ${isSubmissionNotification || false}`);

    // Fetch homework details (simplified - no JOINs to avoid RLS issues with Service Role)
    console.log(`[send-homework-email] Fetching homework with id: ${homeworkId} for teacher: ${user.id}`);
    
    const { data: homework, error: homeworkError } = await supabase
      .from("homework_assignments")
      .select("*")
      .eq("id", homeworkId)
      .eq("teacher_id", user.id)
      .single();

    console.log('[send-homework-email] Homework query result:', { 
      found: !!homework, 
      error: homeworkError,
      homeworkId: homework?.id,
      teacherId: homework?.teacher_id,
      studentId: homework?.student_id
    });

    if (homeworkError || !homework) {
      console.error('[send-homework-email] Homework not found:', homeworkError);
      throw new Error("Homework not found or unauthorized");
    }

    // Fetch related data separately
    let student = null;
    let teacherProfile = null;

    if (homework.student_id) {
      const { data: studentData } = await supabase
        .from("students")
        .select("id, name, english_level")
        .eq("id", homework.student_id)
        .single();
      student = studentData;
      console.log('[send-homework-email] Fetched student:', student);
    }

    const { data: profileData } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", homework.teacher_id)
      .single();
    teacherProfile = profileData;
    console.log('[send-homework-email] Fetched teacher profile:', teacherProfile);

    // Build homework object with related data (matching old structure)
    const homeworkWithRelations = {
      ...homework,
      students: student,
      profiles: teacherProfile
    };

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(studentEmail)) {
      throw new Error("Invalid email format");
    }

    // Update student email if requested
    if (updateStudentEmail && homeworkWithRelations.students?.id) {
      const { error: updateError } = await supabase
        .from("students")
        .update({ student_email: studentEmail })
        .eq("id", homeworkWithRelations.students.id)
        .eq("teacher_id", user.id);

      if (updateError) {
        console.error("Failed to update student email:", updateError);
        // Continue anyway - email sending is more important
      } else {
        console.log(`Updated student ${homeworkWithRelations.students.id} email to ${studentEmail}`);
      }
    }

    // Generate homework link
    const homeworkLink = `${req.headers.get("origin") || "https://your-domain.com"}/homework/${homeworkWithRelations.share_token}`;

    // Get teacher name
    const teacherName = homeworkWithRelations.profiles?.first_name
      ? `${homeworkWithRelations.profiles.first_name} ${homeworkWithRelations.profiles.last_name || ""}`.trim()
      : homeworkWithRelations.profiles?.email || "Your Teacher";

    // Get number of exercises
    const selectedExercises = homeworkWithRelations.selected_exercises as any[];
    const exercisesCount = Array.isArray(selectedExercises) ? selectedExercises.length : 0;

    // Determine email template and subject based on flags
    let EmailTemplate: any;
    let emailSubject: string;
    let recipientEmail: string;
    
    if (isSubmissionNotification) {
      // Submission notification goes to teacher
      EmailTemplate = HomeworkSubmissionEmail;
      emailSubject = `✅ ${homeworkWithRelations.students?.name || 'Student'} submitted: ${homeworkWithRelations.title}`;
      recipientEmail = homeworkWithRelations.profiles?.email || '';
      
      if (!recipientEmail) {
        throw new Error("Teacher email not found");
      }
    } else if (isReminder) {
      EmailTemplate = HomeworkReminderEmail;
      emailSubject = `Reminder: ${homeworkWithRelations.title}`;
      recipientEmail = studentEmail;
    } else {
      EmailTemplate = HomeworkNotificationEmail;
      emailSubject = `New Homework: ${homeworkWithRelations.title}`;
      recipientEmail = studentEmail;
    }
    
    // Calculate days until deadline (for reminder email)
    let daysUntilDeadline = 0;
    if (homeworkWithRelations.deadline) {
      const deadlineDate = new Date(homeworkWithRelations.deadline);
      const now = new Date();
      const diffTime = deadlineDate.getTime() - now.getTime();
      daysUntilDeadline = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }

    // Render email template with appropriate props
    let html: string;
    if (isSubmissionNotification) {
      html = await renderAsync(
        React.createElement(HomeworkSubmissionEmail, {
          studentName: homeworkWithRelations.students?.name || "Student",
          teacherName,
          homeworkTitle: homeworkWithRelations.title,
          homeworkLink,
          submittedAt: new Date().toISOString(),
          answeredExercisesCount: answeredExercisesCount || exercisesCount,
        }),
      );
    } else {
      html = await renderAsync(
        React.createElement(EmailTemplate, {
          studentName: homeworkWithRelations.students?.name || "Student",
          teacherName,
          homeworkTitle: homeworkWithRelations.title,
          homeworkLink,
          deadline: homeworkWithRelations.deadline,
          selectedExercisesCount: exercisesCount,
          daysUntilDeadline,
        }),
      );
    }

    // Send email via Resend
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: isSubmissionNotification 
        ? `Homework System <noreply@edooqoo.com>` 
        : `${teacherName} <noreply@edooqoo.com>`,
      to: [recipientEmail],
      subject: emailSubject,
      html,
    });

    if (emailError) {
      console.error("Resend error:", emailError);
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log("Email sent successfully:", emailData);
    
    // Update reminder_sent_at timestamp after successful email
    const nowIso = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('homework_assignments')
      .update({ reminder_sent_at: nowIso })
      .eq('id', homeworkId);
    
    if (updateError) {
      console.error('[send-homework-email] Failed to update reminder_sent_at', updateError);
      // Don't fail the whole operation - email was sent successfully
    } else {
      console.log('[send-homework-email] Updated reminder_sent_at to', nowIso);
    }

    return new Response(
      JSON.stringify({
        success: true,
        emailId: emailData?.id,
        message: "Homework email sent successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: any) {
    console.error("Error in send-homework-email:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: error.message === "Unauthorized" ? 401 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
