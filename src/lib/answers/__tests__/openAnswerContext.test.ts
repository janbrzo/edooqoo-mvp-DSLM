import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { buildOpenAnswerContext, exerciseSourceText, openExerciseContextString } from '../../../../supabase/functions/_shared/openAnswerContext';
import { buildOpenItemEvaluations } from '../../../../supabase/functions/process-pending-ai-evaluations/itemBuilder';
import {
  buildOpenAnswersToVerify, computeHomeworkWrite, isHomeworkAiType,
} from '../../../../supabase/functions/process-pending-ai-evaluations/homeworkEval';
import { CLOSED_EXERCISE_TYPES, OPEN_EXERCISE_TYPES } from '../../../../supabase/functions/_shared/itemMastery';
import { buildAnswersToVerify } from '@/utils/audioEvalUtils';

const reading = {
  type: 'reading', title: 'The Office', instructions: 'Read and answer.',
  content: 'Anna works in a small office in Leeds.',
  questions: [
    { question: 'Where does Anna work?', answer: 'In an office.', nano_skill: { name: 'ns.A2.reading.detail', reason: 'r' } },
    'Who is Anna?',
  ],
};

describe('buildOpenAnswerContext', () => {
  it('returns question, key and the reading passage', () => {
    const c = buildOpenAnswerContext({ exercise: reading, questionIndex: 0 });
    expect(c.question_text).toBe('Where does Anna work?');
    expect(c.suggested_answer).toBe('In an office.');
    expect(c.source_context).toContain('Reading text: Anna works in a small office');
  });
  it('handles string items, instructions and a missing item', () => {
    expect(buildOpenAnswerContext({ exercise: reading, questionIndex: 1 }).question_text).toBe('Who is Anna?');
    expect(buildOpenAnswerContext({ exercise: reading, questionIndex: 0, includeInstructions: true }).question_text).toContain('[Instructions: Read and answer.]');
    expect(buildOpenAnswerContext({ exercise: reading, questionIndex: 7 }).question_text).toBe('Question 8');
    expect(buildOpenAnswerContext({ exercise: null, questionIndex: 0 }).source_context).toBe('');
  });
  it('uses the worksheet listening transcript and the image description', () => {
    const t = exerciseSourceText({ type: 'listening-comprehension' }, { worksheetAudioTranscript: 'Hello there' });
    expect(t).toBe('Audio transcript: Hello there');
    expect(exerciseSourceText({ image_description: 'A red bus' })).toBe('Image description: A red bus');
    expect(exerciseSourceText({ content: JSON.stringify({ text: 'Wrapped passage' }) })).toContain('Wrapped passage');
  });
  it('clips very long passages and builds the context string', () => {
    const long = exerciseSourceText({ content: 'x'.repeat(10000) });
    expect(long.length).toBeLessThan(3100);
    expect(openExerciseContextString(reading, 'Exercise 1')).toMatch(/^The Office\n\nReading text:/);
    expect(openExerciseContextString({}, 'Exercise 1')).toBe('Exercise 1');
  });
});

describe('buildAnswersToVerify (homework) sends the source text', () => {
  it('prefixes the passage and passes the duration when known', () => {
    const out = buildAnswersToVerify({
      savedAnswer: { exercise_index: 2, exercise_type: 'reading', answers: { 0: 'She works in an office.' } },
      exerciseData: reading, audioAnswers: {}, transcriptionCache: {},
    });
    expect(out).toHaveLength(1);
    expect(out[0].question_text).toContain('Anna works in a small office');
    expect(out[0].question_text).toContain('Where does Anna work?');
    expect(out[0].suggested_answer).toBe('In an office.');
  });
  it('uses the worksheet transcript for listening', () => {
    const out = buildAnswersToVerify({
      savedAnswer: { exercise_index: 0, exercise_type: 'listening-comprehension', answers: { 0: 'ok' } },
      exerciseData: { questions: [{ question: 'Q?' }] }, audioAnswers: {}, transcriptionCache: {},
      worksheetAudioTranscript: 'Spoken text here',
    });
    expect(out[0].question_text).toContain('Audio transcript: Spoken text here');
  });
});

describe('homework server evaluation', () => {
  it('builds open items with transcription and duration', () => {
    const items = buildOpenAnswersToVerify(
      { exercise_index: 1, exercise_type: 'reading' }, reading, { 0: 'text answer' }, { 1: 'http://a' },
      { 1: { text: 'spoken', wordCount: 1, duration: 4.2 } }, null,
    );
    expect(items.map((i) => i.question_index)).toEqual([0, 1]);
    expect(items[1].student_answer).toBe('');
    expect(items[1].audio_duration_seconds).toBe(4.2);
    expect(items[0].audio_duration_seconds).toBeUndefined();
  });
  it('scores open exercises with scoreToMastery and the average of scored items', () => {
    const w = computeHomeworkWrite({
      exerciseType: 'reading', exercise: reading, answers: { 0: 'a', 1: 'b' },
      evaluations: [{ question_index: 0, quality_score: 0.6, is_acceptable: false, feedback: 'f' }, { question_index: 1, quality_score: 0 }],
      transcribed: () => false,
    });
    // only item 0 has a nano skill
    expect(w.item_evaluations).toHaveLength(1);
    expect(w.item_evaluations![0].mastery).toBe(60);
    expect(w.mastery).toBe(60);
    expect(w.ai_evaluation.question_evaluations).toHaveLength(2);
  });
  it('keeps a real 0 and leaves a missing score unevaluated', () => {
    const ex = { questions: [{ nano_skill: { name: 'a.b' } }, { nano_skill: { name: 'a.c' } }] };
    const items = buildOpenItemEvaluations({
      evaluations: [{ question_index: 0, quality_score: 0 }, { question_index: 1 }],
      questionItems: ex.questions, answers: { 0: 'x', 1: 'y' }, hasAudio: () => false,
    });
    expect(items.map((i) => [i.mastery, i.hasValue])).toEqual([[0, true], [-1, false]]);
  });
  it('raises a typed closed answer the key marks wrong and recomputes the exercise mastery', () => {
    const exercise = {
      type: 'fill-in-blanks',
      sentences: [{ text: 'The ___ is big.', answer: 'boss', nano_skill: { name: 'x.y' } }],
    };
    const w = computeHomeworkWrite({
      exerciseType: 'fill-in-blanks', exercise, answers: { 0: 'manager' },
      evaluations: [{ question_index: 0, quality_score: 0.9, is_acceptable: true, feedback: 'ok' }],
      transcribed: () => false,
    });
    expect(w.item_evaluations![0]).toMatchObject({ mastery: 90, source: 'ai_alternative' });
    expect(w.mastery).toBe(100);
  });
  it('rebuilds closed ratings from the key, never from what the browser stored', () => {
    const exercise = { sentences: [{ text: '___', answer: 'boss', nano_skill: { name: 'x.y' } }] };
    const w = computeHomeworkWrite({
      exerciseType: 'fill-in-blanks', exercise, answers: { 0: 'boss' },
      evaluations: [{ question_index: 0, quality_score: 1, is_acceptable: true }], transcribed: () => false,
    });
    expect(w.item_evaluations).toEqual([
      expect.objectContaining({ question_index: 0, name: 'x.y', mastery: 100, hasValue: true }),
    ]);
    expect(w.item_evaluations![0]).not.toHaveProperty('source');
  });
});

describe('homework SQL list matches the exercise type lists', () => {
  const sql = readFileSync('supabase/migrations/20261015090400_homework_ai_queue_and_worksheet_save.sql', 'utf8');
  const listBody = sql.slice(sql.indexOf('list_homework_answers_needing_ai_evaluation(p_limit'), sql.indexOf('claim_homework_answer_ai_attempt(p_id'));
  const quoted = (s: string) => [...s.matchAll(/'([a-z-]+)'/g)].map((m) => m[1]);
  const openSql = quoted(listBody.slice(listBody.indexOf('a.exercise_type IN ('), listBody.indexOf('OR replace(')));
  const closedSql = quoted(listBody.slice(listBody.indexOf('OR replace('), listBody.indexOf('ORDER BY')));
  it('open types equal OPEN_EXERCISE_TYPES', () => {
    expect([...openSql].sort()).toEqual([...OPEN_EXERCISE_TYPES].sort());
  });
  it('typed closed types are the non-selection CLOSED types', () => {
    for (const t of CLOSED_EXERCISE_TYPES) {
      const norm = t.replace('-picture', '').replace('-audio', '');
      expect(isHomeworkAiType(t), t).toBe(closedSql.includes(norm));
    }
  });
});
