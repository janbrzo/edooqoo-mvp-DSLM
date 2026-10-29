import { describe, it, expect, vi, afterEach } from 'vitest';
import { canonicalizeInPlace, canonicalizeWorksheet, canonicalOptionsFromForm, CANONICAL_VERSION, isCanonicalSaveEnabled } from '../canonicalize';
import { getExerciseTimeByType as clientTime } from '../../../../src/utils/timeCalculator';
import { getExerciseTimeByType as sharedTime } from '../../_shared/exerciseTime';

const ID = /^ex_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function counterIds() {
  let n = 0;
  return () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`;
}

function sampleWorksheet() {
  return {
    title: 'Hotel calls',
    exercises: [
      {
        type: 'reading',
        title: 'Exercise 9: Reading Comprehension: The booking',
        content: 'A guest calls the hotel.',
        questions: [
          { question: 'Who calls?', answer: 'A guest', nano_skill: { tag: 'ns.B1.reading.main_idea', confidence: 0.8, extra: ['a', { deep: true }] } },
        ],
      },
      {
        type: 'matching',
        title: '',
        pairs: [
          { word: 'reserve', match: 'book in advance', nano_skill: { tag: 'ns.B1.vocabulary.definition_reserve', confidence: 0.9 } },
          { word: 'vacancy', match: 'a free room', nano_skill: { tag: 'ns.B1.vocabulary.definition_vacancy', confidence: 0.7 } },
        ],
      },
      {
        type: 'multiple-choice',
        title: 'Multiple Choice',
        questions: [
          {
            text: 'Pick one',
            options: [
              { label: 'A', text: 'x', correct: false },
              { label: 'B', text: 'y', correct: false },
              { label: 'C', text: 'z', correct: true },
              { label: 'D', text: 'w', correct: false },
            ],
            nano_skill: { tag: 'ns.B1.grammar.articles', confidence: 0.6 },
          },
        ],
      },
    ],
  };
}

const OPTIONS = { lessonTime: '45min', hasGrammar: true, titles: true };

describe('canonicalizeWorksheet', () => {
  it('adds ex_ ids, canonical_version, per-type time and numbered titles', () => {
    const result = canonicalizeWorksheet(sampleWorksheet(), { ...OPTIONS, newId: counterIds() });
    expect(result.canonical_version).toBe(CANONICAL_VERSION);
    expect(result.exercises.map((e: any) => e.canonical_version)).toEqual([1, 1, 1]);
    for (const exercise of result.exercises) expect(exercise.id).toMatch(ID);
    expect(result.exercises.map((e: any) => e.time)).toEqual([7, 5, 5]);
    expect(result.exercises.map((e: any) => e.title)).toEqual([
      'Exercise 1: Reading Comprehension: The booking',
      'Exercise 2: Vocabulary Matching',
      'Exercise 3: Multiple Choice',
    ]);
  });

  it('applies the P1.5 shape normalisation (pairs become term/definition items)', () => {
    const result = canonicalizeWorksheet(sampleWorksheet(), { ...OPTIONS, newId: counterIds() });
    expect(result.exercises[1].items.map((i: any) => [i.term, i.definition])).toEqual([
      ['reserve', 'book in advance'],
      ['vacancy', 'a free room'],
    ]);
  });

  it('is idempotent: a second pass changes nothing, ids included', () => {
    const once = canonicalizeWorksheet(sampleWorksheet(), { ...OPTIONS, newId: counterIds() });
    const twice = canonicalizeWorksheet(once, { ...OPTIONS, newId: counterIds() });
    expect(twice).toEqual(once);
    expect(twice.exercises.map((e: any) => e.id)).toEqual(once.exercises.map((e: any) => e.id));
  });

  it('keeps ids unique, replacing a duplicate or foreign id', () => {
    const worksheet = sampleWorksheet() as any;
    const kept = 'ex_11111111-1111-4111-8111-111111111111';
    worksheet.exercises[0].id = kept;
    worksheet.exercises[1].id = kept;
    worksheet.exercises[2].id = 7;
    const result = canonicalizeWorksheet(worksheet, { ...OPTIONS, newId: counterIds() });
    const ids = result.exercises.map((e: any) => e.id);
    expect(ids[0]).toBe(kept);
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) expect(id).toMatch(ID);
  });

  it('generates distinct ids with the real id source', () => {
    const result = canonicalizeWorksheet(sampleWorksheet(), OPTIONS);
    expect(new Set(result.exercises.map((e: any) => e.id)).size).toBe(3);
  });

  it('passes every nano_skill through 1:1 (deep equal)', () => {
    const before = sampleWorksheet();
    const collect = (worksheet: any) =>
      worksheet.exercises.flatMap((exercise: any) =>
        [...(exercise.questions ?? []), ...(exercise.items ?? exercise.pairs ?? [])]
          .filter((item: any) => item?.nano_skill)
          .map((item: any) => item.nano_skill),
      );
    // The pairs are renamed by P1.5 (term/definition items) but keep their nano_skill objects.
    const expected = collect(before);
    const after = canonicalizeWorksheet(before, { ...OPTIONS, newId: counterIds() });
    expect(collect(after)).toEqual(expected);
    expect(expected).toHaveLength(4);
  });

  it('does not shuffle options and does not invent an answer key', () => {
    const worksheet = sampleWorksheet() as any;
    worksheet.exercises[2].questions[0].options.forEach((option: any) => { option.correct = false; });
    const before = JSON.parse(JSON.stringify(worksheet.exercises[2].questions));
    const result = canonicalizeWorksheet(worksheet, { ...OPTIONS, newId: counterIds() });
    expect(result.exercises[2].questions).toEqual(before);
  });

  it('does not modify its input', () => {
    const input = sampleWorksheet();
    const snapshot = JSON.parse(JSON.stringify(input));
    canonicalizeWorksheet(input, { ...OPTIONS, newId: counterIds() });
    expect(input).toEqual(snapshot);
  });

  it('leaves titles alone when titles is false (batch)', () => {
    const result = canonicalizeWorksheet(sampleWorksheet(), { ...OPTIONS, titles: false, newId: counterIds() });
    expect(result.exercises.map((e: any) => e.title)).toEqual([
      'Exercise 9: Reading Comprehension: The booking',
      '',
      'Multiple Choice',
    ]);
    expect(result.exercises[0].id).toMatch(ID);
  });

  it('returns a value without an exercises array unchanged', () => {
    const odd = { title: 'x' };
    expect(canonicalizeWorksheet(odd, OPTIONS)).toBe(odd);
  });

  it('canonicalizeInPlace mutates the parsed worksheet so the response matches the saved row', () => {
    const worksheet = sampleWorksheet() as any;
    canonicalizeInPlace(worksheet, { lessonTime: '60min', teachingPreferences: '' }, true);
    expect(worksheet.canonical_version).toBe(1);
    // 60min without grammar: reading 9, matching 6, multiple-choice 7
    expect(worksheet.exercises.map((e: any) => e.time)).toEqual([9, 6, 7]);
  });
});

describe('CANONICAL_SAVE flag', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('is on by default and off for off / 0 / false', () => {
    expect(isCanonicalSaveEnabled()).toBe(true);
    for (const value of ['off', 'OFF', '0', 'false']) {
      vi.stubGlobal('Deno', { env: { get: () => value } });
      expect(isCanonicalSaveEnabled()).toBe(false);
    }
    vi.stubGlobal('Deno', { env: { get: () => 'on' } });
    expect(isCanonicalSaveEnabled()).toBe(true);
  });

  it('canonicalizeInPlace does nothing when the flag is off', () => {
    vi.stubGlobal('Deno', { env: { get: () => 'off' } });
    const worksheet = sampleWorksheet() as any;
    canonicalizeInPlace(worksheet, { lessonTime: '45min' }, true);
    expect(worksheet).toEqual(sampleWorksheet());
  });
});

describe('canonicalOptionsFromForm', () => {
  it('mirrors the client: grammar means a non-blank teachingPreferences', () => {
    expect(canonicalOptionsFromForm({ lessonTime: '45min', teachingPreferences: ' past simple ' }, true).hasGrammar).toBe(true);
    expect(canonicalOptionsFromForm({ lessonTime: '45min', teachingPreferences: '   ' }, true).hasGrammar).toBe(false);
    expect(canonicalOptionsFromForm(undefined, false)).toEqual({ lessonTime: null, hasGrammar: false, titles: false });
  });
});

describe('per-type time table parity with the client', () => {
  it('is the same function for the Edge Function and the client', () => {
    expect(clientTime).toBe(sharedTime);
  });

  it('keeps the numbers the client has always used', () => {
    expect(sharedTime('reading', '45min', true)).toBe(7);
    expect(sharedTime('reading', '60 min', false)).toBe(9);
    expect(sharedTime('discussion', '45min', false)).toBe(4);
    expect(sharedTime('listening-comprehension', '60min', true)).toBe(12);
    expect(sharedTime('unknown-type', '45min', true)).toBe(3);
    expect(sharedTime('reading', 'weird', true)).toBe(7);
  });
});
