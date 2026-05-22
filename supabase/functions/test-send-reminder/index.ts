import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "npm:resend@4.0.0";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import React from "npm:react@18.3.1";
import { HomeworkReminderEmail } from "../_shared/email-templates/homework-reminder.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY") as string);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * TEST FUNCTION: Force send homework reminder
 * 
 * This function bypasses all time checks and forces a reminder email to be sent
 * for a specific homework assignment. Useful for testing reminder functionality.
 * 
 * Body params:
 * - homework_id: string (required) - The ID of the homework assignment
 */
Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[TEST-SEND-REMINDER] Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get homework_id from request body
    const { homework_id } = await req.json();

    if (!homework_id) {
      return new Response(
        JSON.stringify({ error: "homework_id is required" }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`[TEST-SEND-REMINDER] Testing homework: ${homework_id}`);

    // Fetch the specific homework
    const { data: homework, error: fetchError } = await supabase
      .from("homework_assignments")
      .select(
        `
        id,
        title,
        deadline,
        share_token,
        teacher_id,
        student_id,
        reminder_sent_at,
        reminder_hours,
        created_at,
        students (
          id,
          name,
          student_email
        ),
        profiles (
          email,
          first_name,
          last_name
        )
      `,
      )
      .eq("id", homework_id)
      .single();

    if (fetchError || !homework) {
      console.error("[TEST-SEND-REMINDER] Homework not found:", fetchError);
      return new Response(
        JSON.stringify({ error: "Homework not found", details: fetchError }),
        { 
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    const student = Array.isArray(homework.students) ? homework.students[0] : homework.students;
    const teacher = Array.isArray(homework.profiles) ? homework.profiles[0] : homework.profiles;

    console.log("[TEST-SEND-REMINDER] Homework details:");
    console.log(`  Title: ${homework.title}`);
    console.log(`  Student: ${student?.name}, Email: ${student?.student_email}`);
    console.log(`  Teacher: ${teacher?.first_name} ${teacher?.last_name}, Email: ${teacher?.email}`);
    console.log(`  Deadline: ${homework.deadline}`);
    console.log(`  Last reminder sent: ${homework.reminder_sent_at || 'NEVER'}`);

    if (!student?.student_email) {
      return new Response(
        JSON.stringify({ 
          error: "Student has no email address", 
          homework: {
            id: homework.id,
            title: homework.title,
            student_name: student?.name
          }
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    // Generate reminder email
    const homeworkUrl = `${supabaseUrl.replace('.supabase.co', '.lovable.app')}/homework/${homework.share_token}`;
    
    const emailHtml = await renderAsync(
      React.createElement(HomeworkReminderEmail, {
        studentName: student.name,
        homeworkTitle: homework.title,
        deadline: homework.deadline ? new Date(homework.deadline).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }) : '',
        homeworkLink: homeworkUrl,
        daysUntilDeadline: homework.deadline
          ? Math.floor((new Date(homework.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
          : 0,
        teacherName: `${teacher?.first_name || ''} ${teacher?.last_name || ''}`.trim() || 'Your teacher',
      })
    );

    console.log(`[TEST-SEND-REMINDER] Sending email to: ${student.student_email}`);

    // Send email
    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "FlashTeach <onboarding@resend.dev>",
      to: [student.student_email],
      subject: `Reminder: ${homework.title}`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("[TEST-SEND-REMINDER] Email send failed:", emailError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to send email", 
          details: emailError,
          homework: {
            id: homework.id,
            title: homework.title,
            student_email: student.student_email
          }
        }),
        { 
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" } 
        }
      );
    }

    console.log(`[TEST-SEND-REMINDER] Email sent successfully:`, emailData);

    // Update reminder_sent_at
    const { error: updateError } = await supabase
      .from("homework_assignments")
      .update({ reminder_sent_at: new Date().toISOString() })
      .eq("id", homework.id);

    if (updateError) {
      console.error("[TEST-SEND-REMINDER] Failed to update reminder_sent_at:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Test reminder sent successfully",
        homework: {
          id: homework.id,
          title: homework.title,
          student_name: student.name,
          student_email: student.student_email,
          deadline: homework.deadline,
          reminder_sent_at: new Date().toISOString()
        },
        email_result: emailData
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error: any) {
    console.error("[TEST-SEND-REMINDER] Error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
