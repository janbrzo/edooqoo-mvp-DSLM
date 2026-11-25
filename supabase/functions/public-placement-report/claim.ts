import type { SupabaseClient } from "npm:@supabase/supabase-js@2";
import {
  buildGoalRows,
  buildLegacySkillResultRows,
  buildPlacementQuestionRows,
  buildWelcomeTestRow,
  type ClaimResult,
} from "./claimSeed.ts";

/**
 * Sentinel owner UUID for unclaimed public placement students.
 * Exists in public.profiles with email=NULL and deleted_at set; no auth.users
 * account can hold the nil UUID, so RLS blocks all anon/authenticated reads.
 */
export const UNCLAIMED_PLACEMENT_TEACHER_ID = "00000000-0000-0000-0000-000000000000";

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
  answers?: Record<string, unknown> | null;
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
 * Creates an unclaimed student + welcome test record immediately on public submit
 * so process-welcome-test can generate the full AI profile before teacher signup.
 */
export async function seedUnclaimedPlacementStudent(input: {
  admin: SupabaseClient;
  report: ClaimReport;
  studentEmail: string | null;
}): Promise<{ studentId: string; testId: string; hasAnswers: boolean }> {
  const { admin, report, studentEmail } = input;
  const r = report.result;
  const answers = report.answers && typeof report.answers === "object" && !Array.isArray(report.answers)
    ? report.answers
    : null;
  const hasAnswers = !!answers && Object.keys(answers).length > 0;
  const teacherId = UNCLAIMED_PLACEMENT_TEACHER_ID;
  let studentId = "";
  let testId = "";

  try {
    const { data: student, error } = await admin.from("students").insert({
      teacher_id: teacherId,
      name: report.student_name,
      student_email: studentEmail,
      teacher_email: report.teacher_email,
      english_level: r.level,
      placement_pending_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw error;
    if (!student) throw new Error("Unclaimed student could not be saved");
    studentId = student.id;

    const { data: testRow, error: testError } = await admin.from("student_tests")
      .insert(buildWelcomeTestRow(r, studentId, teacherId, report.id, hasAnswers) as Record<string, unknown>).select("id").single();
    if (testError) throw testError;
    if (!testRow) throw new Error("Unclaimed test could not be saved");
    testId = testRow.id;

    if (hasAnswers) {
      const questionRows = buildPlacementQuestionRows(testId, answers!, r.completedAt);
      const { error: questionsError } = await admin.from("student_test_questions").insert(questionRows);
      if (questionsError) throw questionsError;
    } else {
      const score = (key: string) => r.skills[key]?.score ?? null;
      const scored = Object.entries(r.skills).filter(([, value]) => value.score !== null) as [string, { score: number }][];
      scored.sort((a, b) => b[1].score - a[1].score);
      const cm = r.confidenceMatrix ?? {};
      const { error: profileError } = await admin.from("student_learning_profiles").upsert({
        student_id: studentId,
        teacher_id: teacherId,
        welcome_test_id: testId,
        estimated_level: r.level,
        self_assessed_level: r.selfAssessedLevel ?? r.traits.self_assessed_level ?? null,
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
        interest_topics: r.interestTopics ?? [],
        confidence_speaking: cm.speaking ?? null,
        confidence_writing: cm.writing ?? null,
        confidence_listening: cm.listening ?? null,
        confidence_reading: cm.reading ?? null,
        confidence_presenting: cm.presenting ?? null,
        confidence_small_talk: cm.small_talk ?? null,
        strongest_skill: scored[0]?.[0] ?? null,
        weakest_skill: scored.length > 1 ? scored[scored.length - 1][0] : null,
        raw_answers: { source: "public_placement_preview", report_id: report.id, answered: r.answeredCount, total: r.totalQuestions },
      }, { onConflict: "student_id,teacher_id" });
      if (profileError) throw profileError;

      const skillRows = buildLegacySkillResultRows(r, studentId, testId);
      if (skillRows.length) {
        const { error: skillError } = await admin.from("test_skill_results").insert(skillRows);
        if (skillError) throw skillError;
      }

      const goals = buildGoalRows(r, studentId, teacherId, testId);
      if (goals.length) {
        const { error: goalError } = await admin.from("student_progress_goals").insert(goals);
        if (goalError) throw goalError;
      }
    }

    const { error: linkError } = await admin.from("public_placement_reports")
      .update({ unclaimed_student_id: studentId, unclaimed_test_id: testId })
      .eq("id", report.id);
    if (linkError) throw linkError;

    return { studentId, testId, hasAnswers };
  } catch (failure) {
    if (testId) {
      await admin.from("student_test_questions").delete().eq("test_id", testId);
      await admin.from("test_skill_results").delete().eq("test_id", testId);
      await admin.from("student_progress_goals").delete().eq("student_id", studentId).eq("teacher_id", teacherId);
      await admin.from("student_learning_profiles").delete().eq("welcome_test_id", testId).eq("student_id", studentId).eq("teacher_id", teacherId);
      await admin.from("student_tests").delete().eq("id", testId).eq("student_id", studentId).eq("teacher_id", teacherId);
    }
    if (studentId) {
      await admin.from("students").delete().eq("id", studentId).eq("teacher_id", teacherId);
    }
    throw failure;
  }
}

/**
 * Atomically transfers an already-seeded unclaimed student and all linked
 * Welcome Test / DSLM records to the claiming teacher.
 */
export async function claimUnclaimedReport(input: {
  admin: SupabaseClient;
  reportId: string;
  unclaimedStudentId: string;
  unclaimedTestId: string;
  teacher: ClaimTeacher;
}): Promise<{ studentId: string; testId: string; needsProcessing: boolean }> {
  const { admin, reportId, unclaimedStudentId, unclaimedTestId, teacher } = input;
  try {
    const { data: moved, error: rpcError } = await admin.rpc("claim_unclaimed_placement_student", {
      p_student_id: unclaimedStudentId,
      p_new_teacher_id: teacher.id,
      p_teacher_email: teacher.email ?? null,
    });
    if (rpcError) throw rpcError;
    if (!moved) throw new Error("Unclaimed placement student is no longer available");

    const { data: finished, error: finishError } = await admin.from("public_placement_reports")
      .update({ claimed_student_id: unclaimedStudentId })
      .eq("id", reportId).eq("claimed_by", teacher.id).select("id").maybeSingle();
    if (finishError) throw finishError;
    if (!finished) throw new Error("Claim reservation was lost");

    const { data: testRow } = await admin.from("student_tests")
      .select("id, status").eq("id", unclaimedTestId).maybeSingle();

    return {
      studentId: unclaimedStudentId,
      testId: unclaimedTestId,
      needsProcessing: (testRow as { status?: string } | null)?.status !== "reviewed",
    };
  } catch (failure) {
    await admin.from("public_placement_reports")
      .update({ claimed_by: null, claimed_at: null, claimed_student_id: null })
      .eq("id", reportId).eq("claimed_by", teacher.id);
    throw failure;
  }
}

const PROFILE_DIAGNOSTIC_COLUMNS = [
  "id", "student_id", "welcome_test_id", "estimated_level", "self_assessed_level", "level_confidence",
  "motivation_type", "anxiety_level", "ambiguity_tolerance", "error_attitude", "preferred_activities",
  "preferred_input_channel", "feedback_preference", "interest_topics", "weekly_study_time",
  "grammar_score", "vocabulary_score", "reading_score", "writing_score", "speaking_score", "communication_score",
  "strongest_skill", "weakest_skill", "confidence_speaking", "confidence_writing", "confidence_listening",
  "confidence_reading", "confidence_presenting", "confidence_small_talk", "ai_summary", "evolution_summary",
  "idk_count_total", "idk_count_skill", "self_awareness_score", "traits", "learning_path", "divergences",
  "answer_behaviour", "signal_coverage", "raw_answers", "created_at", "updated_at",
].join(", ");

/**
 * Loads the real teacher-account Welcome Test diagnostic bundle for a report.
 * Must only be called when role === "teacher" (never for student tokens).
 */
export async function loadTeacherDiagnosticData(
  admin: SupabaseClient,
  studentId: string,
  testId: string,
) {
  const [testRes, profileRes, skillRes, questionsRes, goalsRes, suggestionsRes, phasesRes] = await Promise.all([
    admin.from("student_tests")
      .select("id, status, score_percentage, answered_count, total_questions, completed_at, reviewed_at, time_spent_seconds")
      .eq("id", testId).maybeSingle(),
    admin.from("student_learning_profiles")
      .select(PROFILE_DIAGNOSTIC_COLUMNS)
      .eq("student_id", studentId).eq("welcome_test_id", testId).maybeSingle(),
    admin.from("test_skill_results")
      .select("element_type, correct_answers, total_questions, score_percentage, suggested_rating, skill_tags")
      .eq("test_id", testId),
    admin.from("student_test_questions")
      .select("id, question_index, question_type, question_text, question_data, correct_answer, explanation, element_type, difficulty_level, skill_tags, student_answer, is_correct, answered_at, ai_feedback")
      .eq("test_id", testId).order("question_index", { ascending: true }),
    admin.from("student_progress_goals")
      .select("id, title, description, goal_type, kind, target_category, source, metadata")
      .eq("student_id", studentId).contains("metadata", { test_id: testId }),
    admin.from("future_worksheet_suggestions")
      .select("id, suggested_topic, suggested_goal, suggested_exercises, difficulty_level, rationale, generation_context, created_at")
      .eq("student_id", studentId).eq("generation_context->>test_id", testId)
      .is("deleted_at", null).order("sequence_number", { ascending: true }).limit(3),
    admin.from("dslm_curriculum_phases")
      .select("id, phase_number, title, description, focus_skills, target_level, estimated_lessons, status, created_at")
      .eq("student_id", studentId).order("phase_number", { ascending: true }),
  ]);

  const rawProfile = profileRes.data as Record<string, unknown> | null;
  let learningProfile: Record<string, unknown> | null = null;
  if (rawProfile) {
    const rawMeta = rawProfile.raw_answers as Record<string, unknown> | null | undefined;
    const sanitizedRaw = rawMeta && typeof rawMeta === "object" && "interpretation_version" in rawMeta
      ? { interpretation_version: rawMeta.interpretation_version }
      : null;
    learningProfile = { ...rawProfile, raw_answers: sanitizedRaw };
  }

  const questions = Array.isArray(questionsRes.data)
    ? questionsRes.data.map((q: Record<string, unknown>) => {
        const answered = q.student_answer !== null && q.student_answer !== undefined;
        return answered ? q : { ...q, correct_answer: null, explanation: null };
      })
    : [];

  return {
    studentId,
    testId,
    test: testRes.data ?? null,
    learningProfile,
    skillResults: Array.isArray(skillRes.data) ? skillRes.data : [],
    questions,
    goals: Array.isArray(goalsRes.data) ? goalsRes.data : [],
    nextSteps: Array.isArray(suggestionsRes.data) ? suggestionsRes.data : [],
    curriculumPhases: Array.isArray(phasesRes.data) ? phasesRes.data : [],
  };
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
}): Promise<{ studentId: string; testId: string; hasAnswers: boolean }> {
  const { admin, report, teacher, invite, studentEmail } = input;
  const r = report.result;
  const answers = report.answers && typeof report.answers === "object" && !Array.isArray(report.answers)
    ? report.answers
    : null;
  const hasAnswers = !!answers && Object.keys(answers).length > 0;
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
      .insert(buildWelcomeTestRow(r, studentId, teacher.id, report.id, hasAnswers) as Record<string, unknown>).select("id").single();
    if (testError) throw testError;
    if (!testRow) throw new Error("Test could not be saved");
    testId = testRow.id;

    if (hasAnswers) {
      const questionRows = buildPlacementQuestionRows(testId, answers!, r.completedAt);
      const { error: questionsError } = await admin.from("student_test_questions").insert(questionRows);
      if (questionsError) throw questionsError;
    } else {
      const score = (key: string) => r.skills[key]?.score ?? null;
      const scored = Object.entries(r.skills).filter(([, value]) => value.score !== null) as [string, { score: number }][];
      scored.sort((a, b) => b[1].score - a[1].score);
      const cm = r.confidenceMatrix ?? {};
      const { error: profileError } = await admin.from("student_learning_profiles").upsert({
        student_id: studentId,
        teacher_id: teacher.id,
        welcome_test_id: testId,
        estimated_level: r.level,
        self_assessed_level: r.selfAssessedLevel ?? r.traits.self_assessed_level ?? null,
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
        interest_topics: r.interestTopics ?? [],
        confidence_speaking: cm.speaking ?? null,
        confidence_writing: cm.writing ?? null,
        confidence_listening: cm.listening ?? null,
        confidence_reading: cm.reading ?? null,
        confidence_presenting: cm.presenting ?? null,
        confidence_small_talk: cm.small_talk ?? null,
        strongest_skill: scored[0]?.[0] ?? null,
        weakest_skill: scored.length > 1 ? scored[scored.length - 1][0] : null,
        raw_answers: { source: "public_placement_preview", report_id: report.id, answered: r.answeredCount, total: r.totalQuestions },
      }, { onConflict: "student_id,teacher_id" });
      if (profileError) throw profileError;

      const skillRows = buildLegacySkillResultRows(r, studentId, testId);
      if (skillRows.length) {
        const { error: skillError } = await admin.from("test_skill_results").insert(skillRows);
        if (skillError) throw skillError;
      }

      const goals = buildGoalRows(r, studentId, teacher.id, testId);
      if (goals.length) {
        const { error: goalError } = await admin.from("student_progress_goals").insert(goals);
        if (goalError) throw goalError;
      }
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

    return { studentId, testId, hasAnswers };
  } catch (failure) {
    if (testId) {
      const { error: questionsCleanupError } = await admin.from("student_test_questions").delete()
        .eq("test_id", testId);
      if (questionsCleanupError) throw new Error("Student setup could not be completed. Please try again later.");
      const { error: skillsCleanupError } = await admin.from("test_skill_results").delete()
        .eq("test_id", testId);
      if (skillsCleanupError) throw new Error("Student setup could not be completed. Please try again later.");
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

export async function triggerWelcomeTestProcessing(
  admin: SupabaseClient,
  input: { testId: string; studentId: string; teacherId: string; answeredCount: number },
): Promise<void> {
  try {
    const { error } = await admin.functions.invoke("process-welcome-test", {
      body: {
        test_id: input.testId,
        student_id: input.studentId,
        teacher_id: input.teacherId,
        answered_count: input.answeredCount,
        skip_emails: true,
      },
    });
    if (error) console.warn("[public-placement-report] welcome test processing trigger failed");
  } catch {
    console.warn("[public-placement-report] welcome test processing trigger failed");
  }
}
