import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { placementPhasesSchema, publicPlacementLearningPath } from "./learningPath.ts";
import { placementLearningPathMessages, placementLearningPathOutputSchema } from "./learningPathPrompt.ts";

const makePhases = (count: number) =>
  Array.from({ length: count }, (_, idx) => ({
    title: `Workplace communication phase ${idx + 1}`,
    description: `Practice real-world task ${idx + 1}.`,
    focusAreas: ["status updates", "past simple"],
    estimatedWeeksStart: idx * 3 + 1,
    estimatedWeeksEnd: (idx + 1) * 3,
    rationale: "Addresses observed placement gaps.",
  }));

Deno.test("learning path requires 3 to 5 distinct contiguous phases starting at week 1", () => {
  assertEquals(placementPhasesSchema.safeParse(makePhases(3)).success, true);
  assertEquals(placementPhasesSchema.safeParse(makePhases(5)).success, true);
  assertEquals(placementPhasesSchema.safeParse(makePhases(2)).success, false);
  assertEquals(placementPhasesSchema.safeParse(makePhases(6)).success, false);
  const dup = makePhases(3);
  dup[1].title = dup[0].title;
  assertEquals(placementPhasesSchema.safeParse(dup).success, false);
  const gap = makePhases(3);
  gap[1].estimatedWeeksStart = 5;
  gap[1].estimatedWeeksEnd = 7;
  assertEquals(placementPhasesSchema.safeParse(gap).success, false);
  const badStart = makePhases(3);
  badStart[0].estimatedWeeksStart = 2;
  assertEquals(placementPhasesSchema.safeParse(badStart).success, false);
  const withEmDash = makePhases(3);
  withEmDash[0].title = "Leading updates \u2014 clearly";
  const parsed = placementPhasesSchema.parse(withEmDash);
  assertEquals(parsed[0].title.includes("\u2014"), false);
});

Deno.test("public learning path states never return reservation credentials and terminal failures cannot retry", () => {
  assertEquals(publicPlacementLearningPath({ status: "running", lease: "secret" }), { status: "running" });
  assertEquals(
    publicPlacementLearningPath({ status: "failed", error: "Access denied", terminal: true, attempts: 1 }),
    { status: "failed", error: "Access denied", retryable: false },
  );
  assertEquals(
    publicPlacementLearningPath({ status: "failed", error: "Timeout", terminal: false, attempts: 1 }),
    { status: "failed", error: "Timeout", retryable: true },
  );
  assertEquals(publicPlacementLearningPath(null), { status: "idle" });
});

Deno.test("learning path planner uses bounded diagnostic evidence, never emails, raw answers or answer keys", () => {
  const messages = placementLearningPathMessages({
    learningProfile: { estimated_level: "B1", email: "PRIVATE_EMAIL", raw_answers: "PRIVATE_RAW_ANSWERS" },
    skillResults: [],
    goals: [{ title: "Lead weekly meetings", description: "Clear summaries" }],
    questions: [{ id: "q1", student_answer: "PRIVATE_ANSWER", correct_answer: "PRIVATE_KEY", is_correct: false, skill_tags: ["past_simple"] }],
  });
  const input = messages[1].content;
  for (const privateValue of ["PRIVATE_EMAIL", "PRIVATE_RAW_ANSWERS", "PRIVATE_ANSWER", "PRIVATE_KEY"]) {
    assertEquals(input.includes(privateValue), false);
  }
  assertEquals(input.includes("past_simple"), true);
  assertEquals(input.includes("Lead weekly meetings"), true);
  assertEquals(placementLearningPathOutputSchema.additionalProperties, false);
});