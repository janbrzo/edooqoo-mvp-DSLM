import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGoalRows,
  buildLegacySkillResultRows,
  buildPlacementQuestionRows,
  buildWelcomeTestRow,
  resolveStudentEmail,
} from "./claimSeed.ts";

const r = { level: "A2", answeredCount: 40, totalQuestions: 58, completedAt: "2026-11-12T10:00:00.000Z",
  skills: { grammar: { score: 27, correct: 3, answered: 11, total: 11 }, vocabulary: { score: 9, correct: 1, answered: 11, total: 11 }, reading: { score: 25, correct: 1, answered: 4, total: 4 }, listening: { score: 67, correct: 2, answered: 3, total: 3 } } };

Deno.test("claimed test is stored as a reviewed welcome test", () => {
  const row = buildWelcomeTestRow(r, "s", "t", "rep");
  assertEquals([row.test_type, row.status, row.score_percentage, row.answered_count], ["welcome", "reviewed", 32, 40]);
});

Deno.test("full-answer claimed test uses bank 2 form A and starts in completed status for server grading", () => {
  const row = buildWelcomeTestRow(r, "s", "t", "rep", true);
  assertEquals([row.test_type, row.status, row.total_questions, row.reviewed_at], ["welcome", "completed", 72, null]);
  assertEquals(row.generation_params, {
    welcome_bank: 2,
    welcome_form: "A",
    source: "public_placement_preview",
    report_id: "rep",
  });
});

Deno.test("placement question rows map all 72 bank items, strip local recordings and leave is_correct null", () => {
  const rows = buildPlacementQuestionRows("test-1", {
    wt_q1: "I can talk about most topics, but I make grammar mistakes and miss some words",
    wt_q16s: "local-recording:wt_q16s",
    wt_q41: "I want to lead client meetings in English.",
  }, r.completedAt);
  assertEquals(rows.length, 72);
  const q1 = rows.find((row) => row.question_data.question_id === "wt_q1");
  const q16s = rows.find((row) => row.question_data.question_id === "wt_q16s");
  const q41 = rows.find((row) => row.question_data.question_id === "wt_q41");
  assertEquals(q1?.student_answer, "I can talk about most topics, but I make grammar mistakes and miss some words");
  assertEquals(q1?.answered_at, r.completedAt);
  assertEquals(q1?.is_correct, null);
  assertEquals(q16s?.student_answer, null);
  assertEquals(q16s?.answered_at, null);
  assertEquals(q41?.student_answer, "I want to lead client meetings in English.");
});

Deno.test("legacy skill rows preserve counts for all four summary skills including listening", () => {
  const rows = buildLegacySkillResultRows(r, "s", "test-1");
  assertEquals(rows.map((row) => [row.element_type, row.correct_answers, row.total_questions, row.score_percentage]), [
    ["grammar", 3, 11, 27],
    ["vocabulary", 1, 11, 9],
    ["reading", 1, 4, 25],
    ["listening", 2, 3, 67],
  ]);
});

Deno.test("goals target weakest then strongest skill", () => {
  const rows = buildGoalRows(r, "s", "t", "test");
  assertEquals(rows.map((g) => g.target_category), ["vocabulary", "listening"]);
  assertEquals(rows[0].source, "welcome_test_auto");
});

Deno.test("teacher email never becomes the student email", () => {
  assertEquals(resolveStudentEmail(null, "Teacher@x.com", ["teacher@x.com"]), null);
  assertEquals(resolveStudentEmail("stu@x.com", "teacher@x.com", ["teacher@x.com"]), "stu@x.com");
  assertEquals(resolveStudentEmail(null, "stu@x.com", ["teacher@x.com"]), "stu@x.com");
});
