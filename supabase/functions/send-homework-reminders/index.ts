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

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authorization: only allow calls with the anon key (from cron) or service role key
  const authHeader = req.headers.get("Authorization");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const isAuthorized =
    authHeader === `Bearer ${anonKey}` ||
    authHeader === `Bearer ${serviceKey}`;

  if (!isAuthorized) {
    console.warn("[HOMEWORK-REMINDERS] Unauthorized call attempt");
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    console.log("[HOMEWORK-REMINDERS] Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find homework assignments that need reminders
    // Criteria:
    // - Created more than 24 hours ago
    // - Has a deadline that hasn't passed yet OR is slightly overdue (up to 7 days)
    // - Has not been completed
    // - Reminder hasn't been sent yet OR last reminder was sent more than 24h ago
    // - Student has email address
    const reminderThreshold = new Date();
    reminderThreshold.setHours(reminderThreshold.getHours() - 24);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: homeworkToRemind, error: fetchError } = await supabase
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
        completed_at,
        reminder_hours,
        reminder_scheduled_at,
        created_at,
        students!homework_assignments_student_id_fkey (
          id,
          name,
          student_email,
          send_overdue_emails
        ),
        teacher:profiles!homework_assignments_teacher_id_fkey (
          email,
          first_name,
          last_name
        )
      `,
      )
      .not("deadline", "is", null)
      .is("completed_at", null) // Not completed
      .not("reminder_scheduled_at", "is", null) // Must have scheduled reminder
      .gt("deadline", sevenDaysAgo.toISOString()); // Deadline within last 7 days (allows overdue)

    if (fetchError) {
      console.error("[HOMEWORK-REMINDERS] Error fetching homework:", fetchError);
      throw fetchError;
    }

    console.log(`[HOMEWORK-REMINDERS] Found ${homeworkToRemind?.length || 0} homework assignments (before filtering)`);

    if (!homeworkToRemind || homeworkToRemind.length === 0) {
      console.log('[HOMEWORK-REMINDERS] No homework found in database query');
      return new Response(
        JSON.stringify({
          success: true,
          message: "No homework reminders to send",
          count: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Log each homework BEFORE filtering for debugging
    console.log('[HOMEWORK-REMINDERS] Homework details BEFORE filtering:');
    homeworkToRemind.forEach((hw, idx) => {
      const student = Array.isArray(hw.students) ? hw.students[0] : hw.students;
      console.log(`  [${idx + 1}] ID: ${hw.id}, Title: "${hw.title}"`);
      console.log(`      Student: ${student?.name || 'N/A'}, Email: ${student?.student_email || 'NONE'}`);
      console.log(`      Deadline: ${hw.deadline}, Completed: ${hw.completed_at ? 'YES' : 'NO'}`);
      console.log(`      Reminder hours: ${hw.reminder_hours || 24}, Last sent: ${hw.reminder_sent_at || 'NEVER'}`);
      console.log(`      Created: ${hw.created_at}`);
    });

    // Filter: only homework where student has email AND it's time to send reminder
    const now = new Date();
    const filteredHomework = homeworkToRemind.filter((hw) => {
      const student = Array.isArray(hw.students) ? hw.students[0] : hw.students;
      
      // Check 1: Student has email
      if (!student?.student_email) {
        console.log(`  [FILTER] Homework "${hw.title}" (${hw.id}) - SKIP: No student email`);
        return false;
      }
      
      // Check 2: Has deadline
      if (!hw.deadline) {
        console.log(`  [FILTER] Homework "${hw.title}" (${hw.id}) - SKIP: No deadline`);
        return false;
      }
      
      // Check 3: Has reminder_scheduled_at
      if (!hw.reminder_scheduled_at) {
        console.log(`  [FILTER] Homework "${hw.title}" (${hw.id}) - SKIP: No reminder scheduled`);
        return false;
      }

      const deadline = new Date(hw.deadline);
      const reminderTime = new Date(hw.reminder_scheduled_at);
      const reminderDelay = hw.reminder_hours || 24;
      const isOverdue = now > deadline;
      
      console.log(`  [FILTER] Homework "${hw.title}" (${hw.id}):`);
      console.log(`      Deadline: ${hw.deadline}, Reminder delay: ${reminderDelay}h`);
      console.log(`      Reminder scheduled at: ${hw.reminder_scheduled_at}`);
      console.log(`      Current time: ${now.toISOString()}`);
      console.log(`      Is overdue: ${isOverdue}`);
      console.log(`      Last reminder sent: ${hw.reminder_sent_at || 'NEVER'}`);
      
      // OVERDUE LOGIC: Special handling for overdue homework
      if (isOverdue) {
        // Check 4a: Student has overdue emails enabled
        if (student.send_overdue_emails === false) {
          console.log(`      SKIP: Overdue emails disabled for this student`);
          return false;
        }
        
        // Check 4b: Overdue email not sent yet AFTER deadline
        // If reminder was sent BEFORE deadline, we still need to send overdue email
        if (hw.reminder_sent_at) {
          const lastReminderDate = new Date(hw.reminder_sent_at);
          // If last reminder was sent AFTER deadline, skip (overdue already sent)
          if (lastReminderDate > deadline) {
            console.log(`      SKIP: Overdue email already sent at ${hw.reminder_sent_at} (after deadline)`);
            return false;
          }
          // If last reminder was sent BEFORE deadline, we SHOULD send overdue now
          console.log(`      ✅ PASS: Last reminder was before deadline, sending overdue email now`);
        } else {
          console.log(`      ✅ PASS: No reminder sent yet, sending overdue email`);
        }
        
        return true;
      }
      
      // REGULAR REMINDER LOGIC: Before deadline
      // Check 4: It's time to send reminder (current time >= scheduled time)
      if (now < reminderTime) {
        const hoursRemaining = Math.round((reminderTime.getTime() - now.getTime()) / (1000 * 60 * 60));
        console.log(`      SKIP: Not yet time (${hoursRemaining}h remaining)`);
        return false;
      }
      
      // Check 5: If no reminder sent yet, send it
      if (!hw.reminder_sent_at) {
        console.log(`      ✅ PASS: First reminder, will send`);
        return true;
      }
      
      // Check 6: If last reminder was sent more than reminderDelay hours ago (for resends)
      const lastReminder = new Date(hw.reminder_sent_at);
      const hoursSinceLastReminder = (now.getTime() - lastReminder.getTime()) / (1000 * 60 * 60);
      console.log(`      Last reminder: ${hw.reminder_sent_at}, ${Math.round(hoursSinceLastReminder)}h ago`);
      
      if (hoursSinceLastReminder > reminderDelay) {
        console.log(`      ✅ PASS: Time for resend`);
        return true;
      } else {
        console.log(`      SKIP: Reminder already sent recently (${Math.round(reminderDelay - hoursSinceLastReminder)}h until next)`);
        return false;
      }
    });

    console.log(
      `[HOMEWORK-REMINDERS] Filtered to ${filteredHomework.length} homework with student emails and reminder criteria`,
    );

    // Process each homework
    const results = [];
    for (const homework of filteredHomework) {
      try {
        const student = Array.isArray(homework.students) ? homework.students[0] : homework.students;
        const teacher = Array.isArray(homework.teacher) ? homework.teacher[0] : homework.teacher;

        const studentName = student?.name || "Student";
        const studentEmail = student?.student_email;
        const teacherName =
          teacher?.first_name && teacher?.last_name
            ? `${teacher.first_name} ${teacher.last_name}`
            : teacher?.email || "Your teacher";

        const deadline = new Date(homework.deadline);
        const now = new Date();
        const daysUntilDeadline = Math.floor((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

        const appBaseUrl = Deno.env.get('APP_BASE_URL') || 'https://edooqoo.com';
        const homeworkUrl = `${appBaseUrl}/homework/${homework.share_token}`;

        console.log(`[HOMEWORK-REMINDERS] Sending reminder for homework "${homework.title}" to ${studentEmail}`);

        // Render email template
        const html = await renderAsync(
          React.createElement(HomeworkReminderEmail, {
            studentName,
            teacherName,
            homeworkTitle: homework.title,
            homeworkLink: homeworkUrl,
            deadline: homework.deadline,
            daysUntilDeadline,
          }),
        );

        // Send email via Resend
        const { data: emailData, error: emailError } = await resend.emails.send({
          from: `${teacherName} <noreply@edooqoo.com>`, // TODO: Use your verified domain
          to: [studentEmail!],
          subject:
            daysUntilDeadline < 0
              ? `⚠️ Overdue Homework: ${homework.title}`
              : `⏰ Reminder: ${homework.title} due ${daysUntilDeadline === 0 ? "today" : `in ${daysUntilDeadline} day${daysUntilDeadline !== 1 ? "s" : ""}`}`,
          html,
        });

        if (emailError) {
          console.error(`[HOMEWORK-REMINDERS] Failed to send email for homework ${homework.id}:`, emailError);
          results.push({
            homeworkId: homework.id,
            success: false,
            error: emailError.message,
          });
          continue;
        }

        console.log(`[HOMEWORK-REMINDERS] Email sent successfully for homework ${homework.id}:`, emailData);

        // Mark reminder as sent
        const { error: updateError } = await supabase
          .from("homework_assignments")
          .update({
            reminder_sent_at: new Date().toISOString(),
          })
          .eq("id", homework.id);

        if (updateError) {
          console.error(
            `[HOMEWORK-REMINDERS] Failed to update reminder status for homework ${homework.id}:`,
            updateError,
          );
          results.push({
            homeworkId: homework.id,
            success: false,
            error: "Failed to update reminder status",
          });
        } else {
          results.push({
            homeworkId: homework.id,
            studentName,
            studentEmail,
            homeworkTitle: homework.title,
            emailId: emailData?.id,
            success: true,
            reminderSent: true,
          });
        }
      } catch (error: any) {
        console.error(`[HOMEWORK-REMINDERS] Error processing homework ${homework.id}:`, error);
        results.push({
          homeworkId: homework.id,
          success: false,
          error: error.message || "Unknown error",
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`[HOMEWORK-REMINDERS] Completed: ${successCount}/${results.length} reminders sent successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent ${successCount} homework reminders`,
        count: successCount,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("[HOMEWORK-REMINDERS] Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Internal server error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
