/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/ban-ts-comment */
/**
 * Unit tests of the deterministic quality checks (quality.ts). Fixtures are
 * synthetic worksheets shaped like real model output and reproduce the defect
 * patterns measured in the Phase 2 report.
 */
import { describe, expect, it } from 'vitest';
// @ts-ignore plain ESM script without types (typed or untyped depending on tsconfig resolution)
import { computeWorksheetMetrics } from '../../../../scripts/engine/metrics.mjs';
import {
  evaluateWorksheetQuality,
  hasBaseFormContext,
  isWordOrderBuildable,
  normaliseWordOrderTokens,
  sortRequestedTypesForMedia,
  type QualityReport,
} from '../quality';

const EM = String.fromCharCode(0x2014);
const nano = (name = 'ns.A2.grammar.present_simple', confidence = 0.9) => [{ name, confidence, reason: 'Tests the form.' }];
const ws = (...exercises: Record<string, any>[]) => ({ title: 'Fixture', exercises });
const check = (worksheet: unknown, ctx = {}): QualityReport => evaluateWorksheetQuality(worksheet, ctx);

const DEFAULT_8 = ['reading', 'true-false', 'matching', 'fill-in-blanks', 'multiple-choice', 'dialogue', 'discussion', 'error-correction'];

describe('exercise count and type order', () => {
  const sheet = (types: string[]) => ws(...types.map((type) => ({ type })));

  it('matches a full set in the requested order', () => {
    const r = check(sheet(DEFAULT_8), { expectedCount: 8, requestedTypes: DEFAULT_8 });
    expect(r.exercise_count).toEqual({ applicable: true, expected: 8, actual: 8, match: true });
    expect(r.type_order).toMatchObject({ applicable: true, same_set: true, exact_order: true, first_mismatch_index: -1 });
    expect(r.defects).toEqual([]);
  });

  it('reports a truncated worksheet (6 of 8) with the missing types', () => {
    const r = check(sheet(DEFAULT_8.slice(0, 6)), { expectedCount: 8, requestedTypes: DEFAULT_8 });
    expect(r.exercise_count).toMatchObject({ expected: 8, actual: 6, match: false });
    expect(r.type_order.same_set).toBe(false);
    expect(r.type_order.missing).toEqual(['discussion', 'error-correction']);
    expect(r.defects).toEqual(['exercise_count_mismatch', 'type_set_mismatch']);
  });

  it('reports a single exercise instead of the planned set', () => {
    const r = check(sheet(['reading']), { expectedCount: 6, requestedTypes: DEFAULT_8 });
    expect(r.exercise_count).toMatchObject({ expected: 6, actual: 1, match: false });
    expect(r.defects).toContain('exercise_count_mismatch');
  });

  it('uses only the first expectedCount requested types (45 min lesson)', () => {
    const r = check(sheet(DEFAULT_8.slice(0, 6)), { expectedCount: 6, requestedTypes: DEFAULT_8 });
    expect(r.defects).toEqual([]);
  });

  it('reports an order mismatch with the same set as its own class', () => {
    const swapped = [...DEFAULT_8];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];
    const r = check(sheet(swapped), { expectedCount: 8, requestedTypes: DEFAULT_8 });
    expect(r.type_order).toMatchObject({ same_set: true, exact_order: false, first_mismatch_index: 0 });
    expect(r.defects).toEqual(['type_order_mismatch']);
  });

  it('marks an order that follows the picture > audio > others sort rule', () => {
    const requested = ['reading', 'multiple-choice-audio', 'describe-picture', 'matching', 'listening-comprehension', 'discussion'];
    const sorted = sortRequestedTypesForMedia(requested);
    expect(sorted).toEqual(['describe-picture', 'multiple-choice-audio', 'listening-comprehension', 'reading', 'matching', 'discussion']);
    const r = check(sheet(sorted), { expectedCount: 6, requestedTypes: requested, hasMedia: true });
    expect(r.type_order).toMatchObject({ same_set: true, exact_order: false, exact_order_media_sorted: true });
    // the order the prompt asks for with media is correct: no defect
    expect(r.defects).toEqual([]);
  });

  it('reviewer case: [reading, multiple-choice-picture, listening-comprehension] sorted by the media rule is not a defect', () => {
    const requested = ['reading', 'multiple-choice-picture', 'listening-comprehension'];
    const r = check(sheet(['multiple-choice-picture', 'listening-comprehension', 'reading']), { expectedCount: 3, requestedTypes: requested, hasMedia: true });
    expect(r.type_order).toMatchObject({ exact_order: false, exact_order_media_sorted: true });
    expect(r.defects).toEqual([]);
  });

  it('with media, an order that is neither the requested nor the sorted one is still a defect', () => {
    const requested = ['reading', 'multiple-choice-picture', 'listening-comprehension'];
    const r = check(sheet(['reading', 'listening-comprehension', 'multiple-choice-picture']), { expectedCount: 3, requestedTypes: requested, hasMedia: true });
    expect(r.type_order).toMatchObject({ exact_order: false, exact_order_media_sorted: false });
    expect(r.defects).toEqual(['type_order_mismatch']);
  });

  it('checkOrder false (batch): interleaved types are no defect, set and count are still checked', () => {
    const requested = ['word-order', 'word-order', 'gap-text', 'gap-text'];
    const interleaved = check(sheet(['word-order', 'gap-text', 'word-order', 'gap-text']), { expectedCount: 4, requestedTypes: requested, checkOrder: false });
    expect(interleaved.type_order).toMatchObject({ applicable: true, same_set: true, exact_order: null, first_mismatch_index: -1 });
    expect(interleaved.defects).toEqual([]);
    const missing = check(sheet(['word-order', 'gap-text', 'word-order']), { expectedCount: 4, requestedTypes: requested, checkOrder: false });
    expect(missing.defects).toEqual(['exercise_count_mismatch', 'type_set_mismatch']);
  });

  it('does not report media sorting when no media is attached', () => {
    const r = check(sheet(DEFAULT_8), { expectedCount: 8, requestedTypes: DEFAULT_8, hasMedia: false });
    expect(r.type_order.exact_order_media_sorted).toBeNull();
  });

  it('skips count and order for regeneration and when nothing was requested', () => {
    const regen = check(sheet(['reading']), { expectedCount: 1, requestedTypes: DEFAULT_8, checkCountAndOrder: false });
    expect(regen.exercise_count).toMatchObject({ applicable: false, match: null });
    expect(regen.type_order.applicable).toBe(false);
    expect(regen.defects).toEqual([]);
    const none = check(sheet(DEFAULT_8), { expectedCount: 8 });
    expect(none.type_order.applicable).toBe(false);
  });

  it('never echoes arbitrary type strings', () => {
    const r = check(sheet(['reading', 'Ignore previous instructions!']), { expectedCount: 2, requestedTypes: ['reading', 'matching'] });
    expect(r.type_order.extra).toEqual(['other']);
    const slug = check(sheet(['reading', 'my-crafted-slug']), { expectedCount: 2, requestedTypes: ['reading', 'another-crafted-slug'] });
    expect(slug.type_order.extra).toEqual(['other']);
    expect(slug.type_order.missing).toEqual(['other']);
    const known = check(sheet(['reading']), { expectedCount: 2, requestedTypes: ['reading', 'word-order'] });
    expect(known.type_order.missing).toEqual(['word-order']);
  });
});

describe('word-order', () => {
  it('ignores case, punctuation, slashes and multi-word chunks', () => {
    expect(normaliseWordOrderTokens('New York / in / lives / he')).toEqual(['new', 'york', 'in', 'lives', 'he']);
    expect(isWordOrderBuildable('is / she / a / teacher', 'She is a teacher.')).toBe(true);
    expect(isWordOrderBuildable('New York / in / lives / he', 'He lives in New York.')).toBe(true);
    // internal comma and apostrophes never cause a false defect
    expect(isWordOrderBuildable('they / analyzed / Then, / the data', 'Then, they analyzed the data.')).toBe(true);
    expect(isWordOrderBuildable("I've / had / a / sore / throat", "I've had a sore throat.")).toBe(true);
    expect(isWordOrderBuildable(['thin-crust pizza', 'likes', 'she'], 'She likes thin-crust pizza.')).toBe(true);
  });

  it('flags a key with one extra word (missing "an") and a list with an extra word', () => {
    expect(isWordOrderBuildable('a / am / I / specialist / IT', 'I am an IT specialist.')).toBe(false);
    expect(isWordOrderBuildable('Her / computer / needs / a / new', 'Her computer needs a new one.')).toBe(false);
    expect(isWordOrderBuildable('at / I / need / to / see / a / doctor', 'I need to see a doctor.')).toBe(false);
  });

  it('counts items and unbuildable items per worksheet', () => {
    const r = check(ws({
      type: 'word-order',
      sentences: [
        { scrambled_words: 'is / she / a / teacher', correct_order: 'She is a teacher.' },
        { scrambled_words: 'a / am / I / specialist / IT', correct_order: 'I am an IT specialist.' },
        { scrambled_words: 'only the list' },
        { scrambled_words: 'to / need / I / go', correct_order: 'I need to go.' },
      ],
    }));
    expect(r.word_order).toEqual({ items: 3, unbuildable: 1 });
    expect(r.defects).toEqual(['word_order_unbuildable']);
  });

  it('accepts the picture variant and array lists', () => {
    const r = check(ws({
      type: 'word-order-picture',
      sentences: [{ scrambled_words: ['the', 'dog', 'runs'], correct_order: 'The dog runs.' }],
    }));
    expect(r.word_order).toEqual({ items: 1, unbuildable: 0 });
  });
});

describe('multiple-choice', () => {
  const q = (flags: boolean[]) => ({
    text: 'Choose.',
    options: flags.map((correct, i) => ({ label: 'ABCD'[i], text: `o${i}`, correct })),
  });

  it('reports questions with no correct option and with two correct options', () => {
    const r = check(ws({
      type: 'multiple-choice',
      questions: [q([true, false, false, false]), q([false, false, false, false]), q([true, true, false, false]), q([false, false, true, false])],
    }));
    expect(r.multiple_choice).toEqual({ questions: 4, zero_correct: 1, multi_correct: 1 });
    expect(r.defects).toEqual(['mc_zero_correct', 'mc_multi_correct']);
  });

  it('covers the picture and audio variants and ignores questions without options', () => {
    const r = check(ws(
      { type: 'multiple-choice-audio', questions: [q([true, true, false, false])] },
      { type: 'multiple-choice-picture', questions: [{ text: 'no options' }] },
    ));
    expect(r.multiple_choice).toEqual({ questions: 1, zero_correct: 0, multi_correct: 1 });
  });
});

describe('fill-in-blanks', () => {
  const sentences = (pairs: [string, string][]) => pairs.map(([text, answer]) => ({ text, answer }));

  it('flags an answer missing from the bank, separating near forms', () => {
    const r = check(ws({
      type: 'fill-in-blanks',
      word_bank: ['pain', 'work', 'receptionist', 'urgent', 'tired'],
      sentences: sentences([
        ['A terrible back ______ that stays.', 'pain'],
        ['She ______ every day.', 'works'],
        ['The ______ said no.', 'secretary'],
        ['He is ______.', 'tired'],
        ['It is ______ today.', 'urgent'],
      ]),
    }));
    expect(r.fill_in_blanks).toMatchObject({
      sentences: 5, single_blank_sentences: 5,
      answer_missing_from_bank: 2, answer_missing_near_form: 1, answer_missing_true: 1,
    });
    expect(r.defects).toContain('fib_answer_missing_from_bank');
  });

  it('flags a bank without distractors and accepts one with a distractor', () => {
    const rows = sentences([['A ______ b.', 'x'], ['C ______ d.', 'y']]);
    const noDistractors = check(ws({ type: 'fill-in-blanks', word_bank: ['x', 'y'], sentences: rows }));
    expect(noDistractors.fill_in_blanks).toMatchObject({ exercises_with_bank: 1, exercises_without_distractors: 1 });
    expect(noDistractors.defects).toEqual(['fib_no_distractors']);
    const withDistractor = check(ws({ type: 'fill-in-blanks', word_bank: ['x', 'y', 'z'], sentences: rows }));
    expect(withDistractor.fill_in_blanks.exercises_without_distractors).toBe(0);
    expect(withDistractor.defects).toEqual([]);
  });

  it('counts a missing bank apart from a bank without distractors', () => {
    const r = check(ws({ type: 'fill-in-blanks', sentences: sentences([['A ______ b.', 'x']]) }));
    expect(r.fill_in_blanks).toMatchObject({ exercises_with_bank: 0, exercises_without_bank: 1, exercises_without_distractors: 0 });
    expect(r.defects).toEqual([]);
  });

  it('does not judge multi-blank sentences against the bank', () => {
    const r = check(ws({
      type: 'fill-in-blanks',
      word_bank: ['a', 'b', 'c'],
      sentences: sentences([['___ and ___ together.', 'a / b'], ['One ___ here.', 'c']]),
    }));
    expect(r.fill_in_blanks).toMatchObject({ multi_blank_sentences: 1, single_blank_sentences: 1, answer_missing_from_bank: 0 });
  });

  it('reads the schema form of fill-in-blanks-audio (sentences + word_bank, no transcript_with_blanks)', () => {
    const r = check(ws({
      type: 'fill-in-blanks-audio',
      sentences: sentences([["Welcome to _______ Bistro.", "Bella's"], ['Can I take your _______?', 'order']]),
      word_bank: ["Bella's", 'order', 'fixed'],
    }));
    expect(r.fill_in_blanks).toMatchObject({ exercises: 1, exercises_with_bank: 1, answer_missing_from_bank: 0 });
    expect(r.defects).toEqual([]);
  });
});

describe('gap-text', () => {
  const item = (text: string, answer: string, verb: string) => ({ text, answer, verb });

  it('classifies base-form answers after modal / to / do-support as contextual', () => {
    expect(hasBaseFormContext('Can you _____ (recommend) a hotel?')).toBe(true);
    expect(hasBaseFormContext('She wants to _____ (visit) Rome.')).toBe(true);
    expect(hasBaseFormContext("They didn't _____ (know) the way.")).toBe(true);
    expect(hasBaseFormContext('Open the door and _____ (come) in.')).toBe(true);
    expect(hasBaseFormContext('Last summer my friend _____ (visit) a city.')).toBe(false);
    expect(hasBaseFormContext('She _____ (visit) her aunt.')).toBe(false);
  });

  it('accepts the base form after plural and first/second person subjects, linking verbs and determiners', () => {
    for (const text of [
      'If we _____ (receive) the approvals, we go.',
      'The customers _____ (call) every day.',
      'I _____ (work) here.',
      'Children _____ (play) outside.',
      'It is _____ (vital) that we act.',
      'It is a very _____ (good) idea.',
      '_____ (Open) the window, please.',
    ]) expect(hasBaseFormContext(text), text).toBe(true);
  });

  it('accepts the subjunctive after it is vital / essential / imperative / suggested ... that', () => {
    for (const text of [
      'It is vital that the new policy _____ (be) implemented.',
      'The management suggested that the barista _____ (attend) a course.',
      'The board insists that every manager _____ (sign) the form.',
      'He asked it be done lest the client _____ (leave).',
    ]) expect(hasBaseFormContext(text), text).toBe(true);
  });

  it('baseline_A: the 4 previously reported defects are valid English and classify as contextual', () => {
    const items = [
      ['It is _____ (imperative) that all documents are submitted by the deadline.', 'imperative'],
      ['If we _____ (receive) the necessary approvals, the trip will proceed as planned.', 'receive'],
      ['It is __________ (vital) that the new policy concerning waste disposal be implemented immediately.', 'vital'],
      ['The management suggested that the barista __________ (attend) a specialized training course.', 'attend'],
    ].map(([text, word]) => ({ text, answer: word, verb: word }));
    const r = check(ws({ type: 'gap-text', sentences: items }));
    expect(r.gap_text).toMatchObject({ answer_equals_base: 4, contextual: 4, defect: 0 });
    expect(r.defects).toEqual([]);
  });

  it('reports a base form without context as a defect and keeps contextual ones apart', () => {
    const r = check(ws({
      type: 'gap-text',
      sentences: [
        item('Last summer, my friend Emily _____ (visit) a new city.', 'visit', 'visit'),
        item('Can you _____ (recommend) a hotel?', 'recommend', 'recommend'),
        item('She _____ (visit) every week.', 'visits', 'visit'),
        { text: 'No verb field _____ here.', answer: 'x' },
      ],
    }));
    expect(r.gap_text).toEqual({
      items: 4, items_with_verb: 3, answer_equals_base: 2, contextual: 1, defect: 1, exercises_over_contextual_limit: 0,
    });
    expect(r.defects).toEqual(['gap_text_base_form_no_context']);
  });

  it('accepts base_word as the verb field', () => {
    const r = check(ws({ type: 'gap-text', sentences: [{ text: 'He _____ (go) home.', answer: 'go', base_word: 'go' }] }));
    expect(r.gap_text).toMatchObject({ items_with_verb: 1, answer_equals_base: 1, defect: 1 });
  });

  it('allows at most 2 contextual base forms in 10 items, flags the exercise over the limit', () => {
    const contextual = (i: number) => item(`Students can _____ (word${i}) it.`, `word${i}`, `word${i}`);
    const filler = (i: number) => item(`He _____ (do${i}) it.`, `did${i}`, `do${i}`);
    const two = check(ws({ type: 'gap-text', sentences: [contextual(0), contextual(1), ...Array.from({ length: 8 }, (_, i) => filler(i))] }));
    expect(two.gap_text).toMatchObject({ contextual: 2, exercises_over_contextual_limit: 0 });
    expect(two.defects).toEqual([]);
    const three = check(ws({ type: 'gap-text', sentences: [contextual(0), contextual(1), contextual(2), ...Array.from({ length: 7 }, (_, i) => filler(i))] }));
    expect(three.gap_text).toMatchObject({ contextual: 3, exercises_over_contextual_limit: 1 });
    expect(three.defects).toEqual(['gap_text_contextual_over_limit']);
  });
});

describe('em dash', () => {
  it('counts visible text, transcripts and nano_skill separately', () => {
    const r = check({
      title: `Delivery ${EM} a problem`,
      audio_transcript: `Hello ${EM} this is Maria.`,
      exercises: [
        {
          type: 'reading',
          content: `A text ${EM} with one dash and another ${EM} here.`,
          teacher_tip: 'Plain tip.',
          nano_skill: [{ name: 'ns.B1.reading.main_idea', confidence: 0.9, reason: `Hidden ${EM} reason` }],
        },
        { type: 'fill-in-blanks-audio', transcript_with_blanks: `Hi ${EM} ____`, full_transcript: `Hi ${EM} there` },
      ],
    });
    expect(r.em_dash).toEqual({ visible: 3, transcript: 3, nano_skill: 1 });
    expect(r.defects).toEqual(['em_dash_visible', 'em_dash_transcript']);
  });

  it('keeps en dashes in numeric ranges out of the count', () => {
    const r = check(ws({ type: 'reading', content: 'Take 5–10 minutes.' }));
    expect(r.em_dash.visible).toBe(0);
  });
});

describe('nano_skill', () => {
  it('flags format and confidence defects only', () => {
    const r = check(ws({
      type: 'word-order',
      sentences: [
        { nano_skill: nano('ns.A2.word_order.simple_statement', 0.94) },
        { nano_skill: nano('ns.a2.word_order.simple_statement') },
        { nano_skill: nano('ns.B1.Word Order.simple') },
        { nano_skill: nano('ns.B1.grammar') },
        { nano_skill: nano('ns.C1.grammar.past_perfect', 1.4) },
        { nano_skill: [{ name: 'ns.C1.grammar.past_perfect', confidence: '0.9' }] },
      ],
    }));
    expect(r.nano_skill).toEqual({ tags: 6, bad_format: 3, bad_confidence: 2 });
    expect(r.defects).toEqual(['nano_skill_bad_format', 'nano_skill_bad_confidence']);
  });
});

describe('register markers', () => {
  it('counts teacher or partner and with a partner in text, students in teacher_tip', () => {
    const r = check(ws(
      {
        type: 'discussion',
        instructions: 'Discuss with your teacher or partner.',
        teacher_tip: 'Ask students to explain. Students can switch roles.',
        questions: ['Work with a partner and compare answers.'],
      },
      { type: 'dialogue', instructions: 'Practise with a partner.', teacher_tip: 'Ask your learner to repeat.' },
    ));
    expect(r.register).toEqual({ teacher_or_partner: 1, with_a_partner: 2, students_in_teacher_tip: 2 });
    expect(r.defects).toEqual(['register_teacher_or_partner', 'register_with_a_partner', 'register_students_in_teacher_tip']);
  });
});

describe('robustness and purity', () => {
  it('survives malformed input without throwing', () => {
    for (const input of [null, undefined, 'text', 42, [], {}, { exercises: 'x' }, { exercises: [null, 1, 'a', { type: 5 }] }]) {
      expect(() => check(input, { expectedCount: 8, requestedTypes: DEFAULT_8 })).not.toThrow();
    }
    expect(check(null).exercise_count.actual).toBe(0);
  });

  it('does not modify the worksheet', () => {
    const sheet = ws(
      { type: 'word-order', sentences: [{ scrambled_words: 'b / a', correct_order: 'A b.', nano_skill: nano() }] },
      { type: 'gap-text', sentences: [{ text: 'He can _____ (go).', answer: 'go', verb: 'go' }] },
    );
    const before = JSON.stringify(sheet);
    check(sheet, { expectedCount: 2, requestedTypes: ['word-order', 'gap-text'], hasMedia: true });
    expect(JSON.stringify(sheet)).toBe(before);
  });

  it('report holds numbers, booleans and enumerations only (no worksheet text)', () => {
    const secret = 'Maria Kowalska maria@example.test';
    const r = check({
      title: secret,
      exercises: [{ type: 'reading', content: `${secret} ${EM}`, instructions: secret, teacher_tip: secret }],
    }, { expectedCount: 1, requestedTypes: ['reading'] });
    expect(JSON.stringify(r)).not.toContain('Maria');
    expect(JSON.stringify(r)).not.toContain('example.test');
  });
});

describe('parity with the golden set metrics (scripts/engine/metrics.mjs)', () => {
  it('reports the same counts on a mixed worksheet', () => {
    const sheet = {
      title: `Mixed ${EM} fixture`,
      exercises: [
        {
          type: 'word-order',
          instructions: 'Ask your teacher or partner.',
          teacher_tip: 'Ask students to read aloud.',
          sentences: [
            { scrambled_words: 'is / she / a / teacher', correct_order: 'She is a teacher.', nano_skill: nano('ns.A2.word_order.svo') },
            { scrambled_words: 'a / am / I / specialist / IT', correct_order: 'I am an IT specialist.', nano_skill: nano('ns.bad') },
          ],
        },
        {
          type: 'multiple-choice',
          questions: [
            { text: 'q1', options: [{ text: 'a', correct: true }, { text: 'b', correct: true }, { text: 'c', correct: false }, { text: 'd', correct: false }] },
            { text: 'q2', options: [{ text: 'a', correct: false }, { text: 'b', correct: false }, { text: 'c', correct: true }, { text: 'd', correct: false }] },
          ],
        },
        {
          type: 'fill-in-blanks',
          word_bank: ['pain', 'work'],
          sentences: [{ text: 'A ____ here.', answer: 'pain' }, { text: 'She ____ daily.', answer: 'works' }, { text: 'It is ____.', answer: 'urgent' }],
        },
        {
          type: 'gap-text',
          sentences: [
            { text: 'Last summer she _____ (visit) Rome.', answer: 'visit', verb: 'visit' },
            { text: 'Can you _____ (recommend) one?', answer: 'recommend', verb: 'recommend' },
            { text: 'He _____ (go) home.', answer: 'goes', verb: 'go' },
          ],
        },
      ],
    };
    const form = { lessonTime: '60min', selectedExercises: ['word-order', 'multiple-choice', 'fill-in-blanks', 'gap-text'] };
    const m = computeWorksheetMetrics(sheet, { formData: form });
    const r = check(sheet, { expectedCount: 8, requestedTypes: form.selectedExercises });
    expect(r.word_order).toEqual({ items: m.word_order.items, unbuildable: m.word_order.unbuildable });
    expect(r.multiple_choice).toMatchObject({ questions: m.multiple_choice.questions, zero_correct: m.multiple_choice.zero_correct, multi_correct: m.multiple_choice.multi_correct });
    expect(r.fill_in_blanks).toMatchObject({
      answer_missing_from_bank: m.fill_in_blanks.answer_missing_from_bank,
      answer_missing_near_form: m.fill_in_blanks.answer_missing_near_form,
      answer_missing_true: m.fill_in_blanks.answer_missing_true,
    });
    expect(r.gap_text).toMatchObject({
      answer_equals_base: m.gap_text.answer_equals_base,
    });
    // the runtime classifier is deliberately more lenient than the script (low false-positive rate)
    expect(r.gap_text.contextual).toBeGreaterThanOrEqual(m.gap_text.answer_equals_base_contextual);
    expect(r.gap_text.defect).toBeLessThanOrEqual(m.gap_text.answer_equals_base_defect);
    expect(r.em_dash.visible).toBe(m.em_dash.visible);
    expect(r.nano_skill).toMatchObject({ tags: m.nano_skill.tags, bad_format: m.nano_skill.bad_format, bad_confidence: m.nano_skill.bad_confidence });
    expect(r.register.teacher_or_partner).toBe(m.register.teacher_or_partner.instructions);
    expect(r.register.students_in_teacher_tip).toBe(m.register.students.teacher_tip);
    expect(r.exercise_count.match).toBe(m.exercise_count.match);
  });
});
