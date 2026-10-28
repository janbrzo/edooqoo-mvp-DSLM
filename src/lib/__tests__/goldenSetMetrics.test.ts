import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
// @ts-expect-error plain ESM script without types
import { aggregateMetrics, computeWorksheetMetrics, isWordOrderBuildable, renderSummaryMarkdown } from '../../../scripts/engine/metrics.mjs';
// @ts-expect-error plain ESM script without types
import { formDataForStorage, promptServiceFormData } from '../../../scripts/engine/run-golden-set.mjs';
import { buildWorksheetRequest } from '@/lib/worksheet/buildWorksheetRequest';
import { buildPromptServiceFormData } from '@/utils/promptFormatter';

const EM = String.fromCharCode(0x2014);
const nano = (name: string, confidence = 0.9) => [{ name, confidence, reason: 'x' }];

const worksheet = {
  title: 'Fixture',
  exercises: [
    {
      type: 'word-order',
      instructions: 'Put the words in order. Ask your teacher or partner.',
      teacher_tip: 'Ask students to read aloud.',
      sentences: [
        // buildable (punctuation and capitals ignored)
        { scrambled_words: 'is / she / a / teacher', correct_order: 'She is a teacher.', nano_skill: nano('ns.A2.word_order.subject_verb_object') },
        // unbuildable: key has an extra "an"
        { scrambled_words: 'a / am / I / specialist / IT', correct_order: 'I am an IT specialist.', nano_skill: nano('ns.A2.word_order.subject_verb_object') },
        // internal comma and multi-word chunk are fine
        { scrambled_words: 'New York / in / lives / he', correct_order: 'He lives, in New York.', nano_skill: nano('ns.A2.word_order.subject_verb_object') },
      ],
    },
    {
      type: 'multiple-choice',
      instructions: 'Choose.',
      teacher_tip: 'Students can discuss with a partner.',
      questions: [
        { text: 'q1', options: [{ label: 'A', text: 'a', correct: true }, { label: 'B', text: 'b', correct: false }, { label: 'C', text: 'c', correct: false }, { label: 'D', text: 'd', correct: false }] },
        { text: 'q2', options: [{ label: 'A', text: 'a', correct: false }, { label: 'B', text: 'b', correct: true }, { label: 'C', text: 'c', correct: true }, { label: 'D', text: 'd', correct: false }] },
        { text: 'q3', options: [{ label: 'A', text: 'a', correct: false }, { label: 'B', text: 'b', correct: false }, { label: 'C', text: 'c', correct: false }, { label: 'D', text: 'd', correct: false }] },
        { text: 'q4', options: [{ label: 'A', text: 'a', correct: false }, { label: 'B', text: 'b', correct: false }, { label: 'C', text: 'c', correct: false }, { label: 'D', text: 'd', correct: true }] },
      ],
    },
    {
      type: 'fill-in-blanks',
      instructions: 'Fill.',
      teacher_tip: 'Tip.',
      word_bank: ['work', 'big', 'cold'],
      sentences: [
        { text: 'It is _____ outside.', answer: 'cold', nano_skill: nano('ns.A2.vocabulary.contextual_word_choice') },
        { text: 'He _____ here.', answer: 'works', nano_skill: nano('ns.A2.present_simple.third_person_s') },
        { text: 'The dog is _____.', answer: 'tiny', nano_skill: nano('Bad name') },
        { text: 'A _____ and a _____.', answer: 'big', nano_skill: [] },
      ],
    },
    {
      type: 'gap-text',
      instructions: 'Gaps.',
      teacher_tip: `Short ${EM} tip for students.`,
      sentences: [
        { text: 'Can you _____ (recommend) a wine?', answer: 'recommend', verb: 'recommend', nano_skill: nano('ns.A2.modal_verbs.base_form_after_modal') },
        { text: 'She _____ (open) it.', answer: 'open', verb: 'open', nano_skill: nano('ns.A2.present_simple.third_person_s', 1.5) },
        { text: 'He _____ (go) home.', answer: 'went', verb: 'go', nano_skill: nano('ns.A2.past_simple.irregular_verb_go') },
        { text: 'No verb field _____.', answer: 'x', nano_skill: nano(`ns.A2.t.s${EM}`) },
      ],
    },
  ],
};

const form = {
  lessonTime: '45min',
  selectedExercises: ['word-order', 'multiple-choice', 'fill-in-blanks', 'gap-text'],
};

describe('isWordOrderBuildable', () => {
  it('ignores case, punctuation and slashes, compares multisets', () => {
    expect(isWordOrderBuildable('is / she / a / teacher', 'She is a teacher.')).toBe(true);
    expect(isWordOrderBuildable('a / am / I / specialist / IT', 'I am an IT specialist.')).toBe(false);
    expect(isWordOrderBuildable('New York / in / lives / he', 'He lives, in New York.')).toBe(true);
    expect(isWordOrderBuildable(['I', "can't", 'go'], "I can't go.")).toBe(true);
    expect(isWordOrderBuildable('the / the / cat', 'The cat.')).toBe(false);
  });
});

describe('computeWorksheetMetrics', () => {
  const m = computeWorksheetMetrics(worksheet, { formData: form, timing: { total_ms: 12000, first_progress_ms: 3000, sse_events: 9 } });

  it('counts exercises and compares the type list with the request', () => {
    expect(m.exercise_count).toEqual({ actual: 4, expected: 6, match: false });
    expect(m.types.same_set).toBe(true);
    expect(m.types.exact_order).toBe(true);
    const swapped = computeWorksheetMetrics(worksheet, { formData: { ...form, selectedExercises: ['multiple-choice', 'word-order', 'fill-in-blanks', 'gap-text'] } });
    expect(swapped.types.exact_order).toBe(false);
    expect(swapped.types.first_mismatch_index).toBe(0);
  });

  it('finds unbuildable word-order items', () => {
    expect(m.word_order.items).toBe(3);
    expect(m.word_order.unbuildable).toBe(1);
  });

  it('finds MC questions with 0 or 2 correct options and the position histogram', () => {
    expect(m.multiple_choice.questions).toBe(4);
    expect(m.multiple_choice.zero_correct).toBe(1);
    expect(m.multiple_choice.multi_correct).toBe(1);
    expect(m.multiple_choice.correct_position).toMatchObject({ A: 1, B: 0, C: 0, D: 1 });
  });

  it('finds fill-in-blanks answers missing from the bank, near forms, distractors, multi-blank', () => {
    expect(m.fill_in_blanks.exercises_with_bank).toBe(1);
    expect(m.fill_in_blanks.multi_blank_sentences).toBe(1);
    expect(m.fill_in_blanks.single_blank_sentences).toBe(3);
    expect(m.fill_in_blanks.answer_missing_from_bank).toBe(2); // works, tiny
    expect(m.fill_in_blanks.answer_missing_near_form).toBe(1); // works ~ work
    expect(m.fill_in_blanks.answer_missing_true).toBe(1);
    // bank (3) has no extra word over 4 sentences
    expect(m.fill_in_blanks.exercises_with_distractors).toBe(0);
  });

  it('finds gap-text answers equal to the base word and separates modal context', () => {
    expect(m.gap_text.items).toBe(4);
    expect(m.gap_text.items_with_verb).toBe(3);
    expect(m.gap_text.answer_equals_base).toBe(2);
    expect(m.gap_text.answer_equals_base_contextual).toBe(1);
    expect(m.gap_text.answer_equals_base_defect).toBe(1);
  });

  it('counts em dashes in visible text apart from nano_skill', () => {
    expect(m.em_dash.visible).toBe(1);
    expect(m.em_dash.nano_skill).toBe(1);
  });

  it('counts register phrases', () => {
    expect(m.register.teacher_or_partner.instructions).toBe(1);
    expect(m.register.with_a_partner.all_text).toBe(1);
    expect(m.register.students.teacher_tip).toBe(3); // "students" in three tips
    expect(m.register.has_students_in_tips).toBe(true);
  });

  it('counts nano_skill tags and the canonical share', () => {
    expect(m.nano_skill.tags).toBe(10);
    expect(m.nano_skill.canonical).toBe(8); // "Bad name" and the em dash one are not canonical
    expect(m.nano_skill.bad_format).toBe(2);
    expect(m.nano_skill.bad_confidence).toBe(1);
  });

  it('reports timing and size', () => {
    expect(m.generation.total_ms).toBe(12000);
    expect(m.generation.first_progress_ms).toBe(3000);
    expect(m.generation.json_chars).toBeGreaterThan(100);
    expect(m.generation.approx_tokens).toBe(Math.round(m.generation.json_chars / 4));
  });

  it('survives an empty or malformed worksheet', () => {
    const e = computeWorksheetMetrics(null, { formData: { lessonTime: '60min' } });
    expect(e.exercise_count).toEqual({ actual: 0, expected: 8, match: false });
    expect(e.nano_skill.tags).toBe(0);
  });
});

describe('aggregateMetrics', () => {
  it('sums over runs and renders a table', () => {
    const a = computeWorksheetMetrics(worksheet, { formData: form });
    const b = computeWorksheetMetrics(worksheet, { formData: form });
    const agg = aggregateMetrics([a, b], 3);
    expect(agg.worksheets).toBe(2);
    expect(agg.forms_total).toBe(3);
    expect(agg.word_order_unbuildable).toBe(2);
    expect(agg.word_order_unbuildable_pct).toBeCloseTo(33.3, 1);
    expect(agg.word_order_worksheets_affected).toBe(2);
    expect(agg.mc_multi_correct).toBe(2);
    expect(agg.exercise_count_mismatch).toBe(2);
    expect(agg.em_dash_worksheets).toBe(2);
    const md = renderSummaryMarkdown(agg);
    expect(md).toContain('Word-order unbuildable items');
    expect(md).not.toContain(EM);
  });
});

type GoldenForm = { id: string; media: string; formData: Record<string, unknown> & { englishLevel: string; lessonTime: string; teachingPreferences: string; lessonTopic: string; selectedExercises: string[] } };

describe('golden-set.json', () => {
  const set = JSON.parse(readFileSync(resolve(__dirname, '../../../scripts/engine/golden-set.json'), 'utf8'));

  it('has 12 forms covering 3 levels, 2 lesson times and 3 media modes', () => {
    expect(set.forms).toHaveLength(12);
    expect(new Set(set.forms.map((f: GoldenForm) => f.formData.englishLevel)).size).toBe(3);
    expect(new Set(set.forms.map((f: GoldenForm) => f.formData.lessonTime)).size).toBe(2);
    expect(new Set(set.forms.map((f: GoldenForm) => f.media))).toEqual(new Set(['none', 'picture', 'audio']));
    expect(set.forms.filter((f: GoldenForm) => f.formData.teachingPreferences).length).toBe(2);
    expect(set.forms.filter((f: GoldenForm) => /PWNED/.test(f.formData.lessonTopic)).length).toBe(1);
  });

  it('every form is exactly what buildWorksheetRequest would send (idempotent)', () => {
    for (const f of set.forms) {
      const fd = f.formData;
      const { request } = buildWorksheetRequest({
        lessonTime: fd.lessonTime,
        lessonTopic: fd.lessonTopic,
        lessonGoal: fd.lessonGoal,
        grammarFocus: fd.teachingPreferences,
        additionalInformation: fd.additionalInformation,
        englishLevel: fd.englishLevel,
        languageStyle: fd.languageStyle,
        selectedExercises: fd.selectedExercises,
        selectedMediaTypes: fd.selectedMediaTypes,
        exerciseFocusMap: fd.exerciseFocusMap,
      });
      expect({ id: f.id, ...JSON.parse(JSON.stringify(request)) }).toEqual({ id: f.id, ...fd });
      expect(fd.selectedExercises).toHaveLength(fd.lessonTime === '45min' ? 6 : 8);
    }
  });

  it('runner request builders mirror the browser builders', () => {
    const fd = set.forms[3].formData;
    expect(promptServiceFormData(fd)).toEqual(buildPromptServiceFormData(fd));
    const stored = formDataForStorage(fd);
    expect(Object.keys(stored).sort()).toEqual([
      'additionalInformation', 'englishLevel', 'exerciseFocusMap', 'languageStyle', 'lessonGoal', 'lessonTime',
      'lessonTopic', 'selectedAudio', 'selectedExercises', 'selectedImage', 'teachingPreferences',
    ]);
  });
});
