#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  DEFAULT_DECISION_INPUT,
  decideNextLesson,
  parseDecisionInput,
  serializeDecisionInput,
} from '../../src/lib/decisionTool/decisionRules.mjs';

const repairByMastery = decideNextLesson({
  ...DEFAULT_DECISION_INPUT,
  mastery: 'not-mastered',
});
assert.equal(repairByMastery.decision, 'Repair');

const repairByBlockingError = decideNextLesson({
  ...DEFAULT_DECISION_INPUT,
  mastery: 'partial',
  recurringError: 'blocking',
});
assert.equal(repairByBlockingError.decision, 'Repair');

const continueForInsufficientEvidence = decideNextLesson({
  ...DEFAULT_DECISION_INPUT,
  mastery: 'insufficient',
  recurringError: 'none',
});
assert.equal(continueForInsufficientEvidence.decision, 'Continue');

const continueWithSupport = decideNextLesson({
  ...DEFAULT_DECISION_INPUT,
  mastery: 'secure',
  independence: 'supported',
  recurringError: 'none',
});
assert.equal(continueWithSupport.decision, 'Continue');

const continueWithRecurringError = decideNextLesson({
  ...DEFAULT_DECISION_INPUT,
  mastery: 'secure',
  independence: 'independent',
  recurringError: 'non-blocking',
});
assert.equal(continueWithRecurringError.decision, 'Continue');

const advance = decideNextLesson({
  ...DEFAULT_DECISION_INPUT,
  mastery: 'secure',
  independence: 'independent',
  recurringError: 'none',
});
assert.equal(advance.decision, 'Advance');

const serialized = serializeDecisionInput({
  ...DEFAULT_DECISION_INPUT,
  level: 'C1',
  goal: 'business-writing',
});
assert.deepEqual(parseDecisionInput(serialized), {
  ...DEFAULT_DECISION_INPUT,
  level: 'C1',
  goal: 'business-writing',
});

const keys = [...new URLSearchParams(serialized).keys()].sort();
assert.deepEqual(keys, [
  'goal',
  'homework',
  'independence',
  'level',
  'mastery',
  'recurringError',
  'upcoming',
]);
assert.equal(/name|email|student|note|text/i.test(keys.join(' ')), false);

const sanitized = parseDecisionInput('?level=B2&goal=workplace-speaking&studentName=Jane&notes=private');
assert.equal(sanitized.level, 'B2');
assert.equal(sanitized.goal, 'workplace-speaking');
assert.equal(Object.hasOwn(sanitized, 'studentName'), false);
assert.equal(Object.hasOwn(sanitized, 'notes'), false);

console.log('[decision-tool-test] PASS Repair, Continue, Advance, round-trip, and no-PII share serialization.');
