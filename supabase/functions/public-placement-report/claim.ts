import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildGoalRows, buildWelcomeTestRow, type ClaimResult } from "./claimSeed.ts";

export type PlacementClaimResult = ClaimResult & {
  levelConfidence: string | null;
  selfAwarenessScore: number | null;
  traits: Record<string, string>;
  divergences: Array<Record<string, unknown>>;
};

export type ClaimReport = {
  id: string;
  student_name: string;
  teacher_email: string;
  result: PlacementClaimResult;
};

export type ClaimInvite = {
  teacher_id: string | null;
  student_id: string | null;
  student_email: string | null;
};

export type ClaimTeacher = {
  id: string;
  email?: string | null;
};

export async function reserveClaim(admin: SupabaseClient, reportId: string, teacherId: string, claimedAt: string): Promise<boolean> {
  const { data, error } = await admin.from("public_placement_reports")
    .update({ claimed_by: teacherId, claimed_at: claimedAt })
    .eq("id", reportId).is("claimed_by", null).select("id").maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Completes a report already reserved for this teacher. Existing learners are
 * never deleted during compensation, and only rows created by this claim are
 * removed when a required write fails.
 */
export async function claimReservedReport(input: {
  admin: SupabaseClient;
  report: ClaimReport;
  teacher: ClaimTeacher;
  invite: ClaimInvite | null;
  studentEmail: string | null;
}): Promise<{ studentId: string; testId: string }> {
  const { admin, report, teacher, invite, studentEmail } = input;
  const r = report.result;
  let studentId = invite?.student_id ?? "";
  let createdStudent = false;
  let testId = "";
  let pendingRestore: { placement_pending_at: string; english_level: string | null } | null = null;

  try {
    if (studentId) {
      const { data: existing, error } = await admin.from("students")
        .select("id, placement_pending_at, english_level").eq("id", studentId)
        .eq("teacher_id", teacher.id).is("deleted_at", null).maybeSingle();
      if (error) throw error;
      if (!existing) throw new Error("The invited student is no longer available");
      if (existing.placement_pending_at) {
        pendingRestore = {
          placement_pending_at: existing.placement_pending_at,
          english_level: existing.english_level,
        };
      }
    } else {
      const { data: student, error } = await admin.from("students").insert({
        teacher_id: teacher.id,
        name: report.student_name,
        student_email: studentEmail,
        teacher_email: teacher.email ?? null,
        english_level: r.level,
        placement_pending_at: null,
      }).select("id").single();
      if (error) throw error;
      if (!student) throw new Error("Student could not be saved");
      studentId = student.id;
      createdStudent = true;
    }

    const { data: testRow, error: testError } = await admin.from("student_tests")
      .insert(buildWelcomeTestRow(r, studentId, teacher.id, report.id)).select("id").single();
    if (testError) throw testError;
    if (!testRow) throw new Error("Test could not be saved");
    testId = testRow.id;

    const score = (key: string) => r.skills[key]?.score ?? null;
    const scored = Object.entries(r.skills).filter(([, value]) => value.score !== null) as [string, { score: number }][];
    scored.sort((a, b) => b[1].score - a[1].score);
    const { error: profileError } = await admin.from("student_learning_profiles").insert({
      student_id: studentId,
      teacher_id: teacher.id,
      welcome_test_id: testId,
      estimated_level: r.level,
      level_confidence: r.levelConfidence,
      grammar_score: score("grammar"),
      vocabulary_score: score("vocabulary"),
      reading_score: score("reading"),
      self_awareness_score: r.selfAwarenessScore,
      traits: r.traits,
      divergences: r.divergences,
      motivation_type: r.traits.motivation_type ?? null,
      preferred_input_channel: r.traits.preferred_input_channel ?? null,
      feedback_preference: r.traits.feedback_preference ?? null,
      strongest_skill: scored[0]?.[0] ?? null,
      weakest_skill: scored.length > 1 ? scored[scored.length - 1][0] : null,
      raw_answers: { source: "public_placement_preview", report_id: report.id, answered: r.answeredCount, total: r.totalQuestions },
    });
    if (profileError) throw profileError;

    const goals = buildGoalRows(r, studentId, teacher.id, testId);
    if (goals.length) {
      const { error: goalError } = await admin.from("student_progress_goals").insert(goals);
      if (goalError) throw goalError;
    }

    if (pendingRestore) {
      const { error: activationError } = await admin.from("students")
        .update({ placement_pending_at: null, english_level: r.level })
        .eq("id", studentId).eq("teacher_id", teacher.id);
      if (activationError) throw activationError;
    }

    const { data: finished, error: finishError } = await admin.from("public_placement_reports")
      .update({ claimed_student_id: studentId }).eq("id", report.id)
      .eq("claimed_by", teacher.id).select("id").maybeSingle();
    if (finishError) throw finishError;
    if (!finished) throw new Error("Claim reservation was lost");

    return { studentId, testId };
  } catch (failure) {
    if (testId) {
      const { error: goalsCleanupError } = await admin.from("student_progress_goals").delete()
        .eq("student_id", studentId).eq("teacher_id", teacher.id).eq("metadata->>test_id", testId);
      if (goalsCleanupError) throw new Error("Student setup could not be completed. Please try again later.");
      const { error: profileCleanupError } = await admin.from("student_learning_profiles").delete()
        .eq("welcome_test_id", testId).eq("student_id", studentId).eq("teacher_id", teacher.id);
      if (profileCleanupError) throw new Error("Student setup could not be completed. Please try again later.");
      const { error: testCleanupError } = await admin.from("student_tests").delete()
        .eq("id", testId).eq("student_id", studentId).eq("teacher_id", teacher.id);
      if (testCleanupError) throw new Error("Student setup could not be completed. Please try again later.");
    }
    if (pendingRestore) {
      const { error: restoreError } = await admin.from("students").update(pendingRestore)
        .eq("id", studentId).eq("teacher_id", teacher.id);
      if (restoreError) throw new Error("Student setup could not be completed. Please try again later.");
    }
    if (createdStudent) {
      const { error: studentCleanupError } = await admin.from("students").delete()
        .eq("id", studentId).eq("teacher_id", teacher.id);
      if (studentCleanupError) throw new Error("Student setup could not be completed. Please try again later.");
    }
    await admin.from("public_placement_reports")
      .update({ claimed_by: null, claimed_at: null, claimed_student_id: null })
      .eq("id", report.id).eq("claimed_by", teacher.id);
    throw failure;
  }
}

export async function triggerPlacementPacing(admin: SupabaseClient, studentId: string, teacherId: string, level: string | null): Promise<void> {
  try {
    const { error } = await admin.functions.invoke("recalculate-pacing", {
      body: {
        studentId,
        teacherId,
        mode: "proposal",
        triggerType: "placement_test",
        triggerDetails: { estimatedLevel: level, source: "public_placement" },
      },
    });
    if (error) console.warn("[public-placement-report] pacing trigger failed");
  } catch {
    console.warn("[public-placement-report] pacing trigger failed");
  }
}
