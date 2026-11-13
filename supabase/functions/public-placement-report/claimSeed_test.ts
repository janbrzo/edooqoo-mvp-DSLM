import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildGoalRows, buildWelcomeTestRow, resolveStudentEmail } from "./claimSeed.ts";

const r = { level: "A2", answeredCount: 40, totalQuestions: 58, completedAt: "2026-11-12T10:00:00.000Z",
  skills: { grammar: { score: 27 }, vocabulary: { score: 9 }, reading: { score: 25 }, listening: { score: 67 } } };

Deno.test("claimed test is stored as a reviewed welcome test", () => {
  const row = buildWelcomeTestRow(r, "s", "t", "rep");
  assertEquals([row.test_type, row.status, row.score_percentage, row.answered_count], ["welcome", "reviewed", 32, 40]);
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
