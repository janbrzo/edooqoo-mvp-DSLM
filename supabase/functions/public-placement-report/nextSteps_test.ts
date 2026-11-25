import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { placementSuggestionsSchema, publicPlacementNextSteps } from "./nextSteps.ts";
import { placementPlannerMessages, placementOutputSchema } from "./nextStepsPrompt.ts";

const lesson = { topic: 'Client updates', goal: null, additionalInfo: null, grammarFocus: null, rationale: 'Observed gap', difficulty: 'B1', exercises: ['reading', 'fill-in-blanks', 'matching', 'dialogue', 'discussion', 'multiple-choice', 'true-false', 'error-correction'], exerciseFocusMap: {}, focusSkills: [], focusSkillKeys: [], estimatedImpact: {} };
Deno.test('placement proposals require exactly three distinct topics and valid exercises', () => {
  const three = [1, 2, 3].map(n => ({ ...lesson, topic: `Client task ${n}` }));
  assertEquals(placementSuggestionsSchema.safeParse(three).success, true);
  assertEquals(placementSuggestionsSchema.safeParse(three.slice(0, 2)).success, false);
  assertEquals(placementSuggestionsSchema.safeParse([lesson, lesson, lesson]).success, false);
  assertEquals(placementSuggestionsSchema.safeParse(three.map(s => ({ ...s, exercises: ['disabled'] }))).success, false);
});
Deno.test('public proposal states never return reservation credentials and terminal failures cannot retry', () => {
  assertEquals(publicPlacementNextSteps({ status: 'running', lease: 'secret' }), { status: 'running' });
  assertEquals(publicPlacementNextSteps({ status: 'failed', error: 'Access denied', terminal: true, attempts: 1 }), { status: 'failed', error: 'Access denied', retryable: false });
});
Deno.test('planner uses bounded diagnostic evidence, never emails, raw answers or answer keys', () => {
  const messages = placementPlannerMessages({ learningProfile: { estimated_level: 'B1', email: 'PRIVATE_EMAIL', raw_answers: 'PRIVATE_RAW_ANSWERS' }, skillResults: [], goals: [], questions: [{ id: 'q1', student_answer: 'PRIVATE_ANSWER', correct_answer: 'PRIVATE_KEY', is_correct: false, skill_tags: ['past_simple'] }] });
  const input = messages[1].content;
  for (const privateValue of ['PRIVATE_EMAIL', 'PRIVATE_RAW_ANSWERS', 'PRIVATE_ANSWER', 'PRIVATE_KEY']) assertEquals(input.includes(privateValue), false);
  assertEquals(input.includes('past_simple'), true);
  assertEquals(placementOutputSchema.additionalProperties, false);
});