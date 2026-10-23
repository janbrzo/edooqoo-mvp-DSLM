import { describe, it, expect } from 'vitest';
import {
  BANK2_NEW_IDS,
  BRANCH_BLOCKS,
  LEVEL_ITEM_CEFR,
  shownNewIds,
  visibleBranchIds,
  type VerdictOf,
} from '../../../../supabase/functions/_shared/welcomeTestFlow';
import {
  estimateLevelLadder,
  type LadderItem,
} from '../../../../supabase/functions/_shared/welcomeTestLevel';
import { BANK2_NEW_QUESTIONS, BANK2_VARIANTS_B } from '@/data/welcomeTestBank2';
import { ALL_WELCOME_TEST_QUESTIONS } from '@/data/welcomeTestQuestions';

/** Verdicts from a map; ids not in the map are unanswered. */
const verdicts = (m: Record<string, boolean | null>): VerdictOf => (id) => (id in m ? m[id] : undefined);
const GRAMMAR = ['wt_q20', 'wt_q21', 'wt_q22', 'wt_q23', 'wt_q24', 'wt_q25', 'wt_q26', 'wt_q27'];
const VOCAB_B1 = ['wt_q28', 'wt_q29', 'wt_q30', 'wt_q31', 'wt_q32'];
const VOCAB_B2 = ['wt_q33', 'wt_q34', 'wt_q35'];
const all = (ids: string[], v: boolean | null) => Object.fromEntries(ids.map((id) => [id, v]));

describe('bank 2 data', () => {
  it('the 14 new questions are appended after bank 1 with matching ids, keys and Form B', () => {
    expect(BANK2_NEW_QUESTIONS.map((q) => q.id)).toEqual([...BANK2_NEW_IDS]);
    for (const q of BANK2_NEW_QUESTIONS) {
      expect(q.cefr, q.id).toBeTruthy();
      expect(q.options ? q.options.includes(q.correct_answer as string) : !!q.correct_answer, q.id).toBe(true);
      const b = BANK2_VARIANTS_B[q.id];
      expect(b, `Form B of ${q.id}`).toBeTruthy();
      expect([b.id, b.section, b.element_type, b.nano_skill, b.cefr, b.question_type, b.difficulty_level])
        .toEqual([q.id, q.section, q.element_type, q.nano_skill, q.cefr, q.question_type, q.difficulty_level]);
      expect(b.question_text).not.toBe(q.question_text);
      expect(b.options ? b.options.includes(b.correct_answer as string) : !!b.correct_answer, `${q.id} B key`).toBe(true);
      // The CEFR table the server uses must agree with the bank.
      expect(LEVEL_ITEM_CEFR[q.id], q.id).toBe(q.cefr);
    }
  });

  it('every item in the CEFR table is a real keyed question of the bank', () => {
    const byId = new Map(ALL_WELCOME_TEST_QUESTIONS.map((q) => [q.id, q]));
    for (const id of Object.keys(LEVEL_ITEM_CEFR)) {
      const q = byId.get(id);
      expect(q, id).toBeTruthy();
      expect(q!.correct_answer, id).toBeTruthy();
    }
  });
});

describe('adaptive blocks', () => {
  it('shows nothing before the answers a block depends on exist', () => {
    expect(visibleBranchIds(verdicts({})).size).toBe(0);
    // seven of eight grammar answers: grammar blocks are still undecided
    expect(visibleBranchIds(verdicts(all(GRAMMAR.slice(0, 7), false))).size).toBe(0);
  });

  it('a typical student (A2-B2) sees only the 5 always-shown new questions', () => {
    const v = verdicts({
      ...all(GRAMMAR, true), wt_q22: false, wt_q27: false, // 6/8, 3 of 5 hard right: no C1, no A1
      ...all(VOCAB_B1, true), wt_q65: true, ...all(VOCAB_B2, false),
      wt_q18: true, wt_q19: false,
    });
    expect(visibleBranchIds(v).size).toBe(0);
    expect([...shownNewIds(v)].sort()).toEqual(['wt_q65', 'wt_q68', 'wt_q69', 'wt_q71', 'wt_q72']);
  });

  it('a beginner gets the A1 blocks (9 new questions), not the C1 ones', () => {
    const v = verdicts({
      ...all(GRAMMAR, false), ...all(VOCAB_B1, false), wt_q65: false, ...all(VOCAB_B2, false), wt_q18: false, wt_q19: false,
    });
    const shown = shownNewIds(v);
    expect([...shown].sort()).toEqual(
      ['wt_q59', 'wt_q60', 'wt_q63', 'wt_q64', 'wt_q65', 'wt_q68', 'wt_q69', 'wt_q71', 'wt_q72'].sort(),
    );
  });

  it('an advanced student gets the C1 blocks (10 new questions), not the A1 ones', () => {
    const v = verdicts({
      ...all(GRAMMAR, true), ...all(VOCAB_B1, true), wt_q65: true, ...all(VOCAB_B2, true), wt_q18: true, wt_q19: true,
    });
    const shown = shownNewIds(v);
    expect(shown.size).toBe(10);
    for (const id of ['wt_q61', 'wt_q62', 'wt_q66', 'wt_q67', 'wt_q70']) expect(shown.has(id), id).toBe(true);
    for (const id of ['wt_q59', 'wt_q60', 'wt_q63', 'wt_q64']) expect(shown.has(id), id).toBe(false);
  });

  it('grammar A1 needs both A2 items wrong or at most 3 of 8 right (one slip does not trigger it)', () => {
    const oneSlip = verdicts({ ...all(GRAMMAR, true), wt_q20: false });
    expect(visibleBranchIds(oneSlip).has('wt_q59')).toBe(false);
    const bothA2Wrong = verdicts({ ...all(GRAMMAR, true), wt_q20: false, wt_q24: false });
    expect(visibleBranchIds(bothA2Wrong).has('wt_q59')).toBe(true);
    const threeRight = verdicts({ ...all(GRAMMAR, false), wt_q21: true, wt_q22: true, wt_q23: true });
    expect(visibleBranchIds(threeRight).has('wt_q60')).toBe(true);
  });

  it('"I don\'t know" is an answer that counts as not correct; a skipped question keeps the block undecided', () => {
    const idkEverywhere = verdicts(all(GRAMMAR, false));
    expect(visibleBranchIds(idkEverywhere).has('wt_q59')).toBe(true);
    const skippedOne = verdicts(all(GRAMMAR.slice(0, 7), false));
    expect(visibleBranchIds(skippedOne).has('wt_q59')).toBe(false);
  });

  it('an unscored (needs review) verdict is an answer but not a correct one', () => {
    const v = verdicts({ ...all(GRAMMAR, true), wt_q21: null, wt_q22: null, wt_q23: null });
    expect(visibleBranchIds(v).has('wt_q61')).toBe(false); // only 2 of the hard 5 correct
  });

  it('a branch question already answered stays visible even if the rule no longer holds', () => {
    const base = { ...all(GRAMMAR, true) };
    expect(visibleBranchIds(verdicts({ ...base, wt_q61: true })).has('wt_q61')).toBe(true);
    // Change an earlier answer so the C1 rule fails (3 of 5 hard right): wt_q61 was answered, so it stays.
    const changed = verdicts({ ...base, wt_q21: false, wt_q22: false, wt_q61: true });
    expect(visibleBranchIds(changed).has('wt_q61')).toBe(true);
    expect(visibleBranchIds(changed).has('wt_q62')).toBe(false);
  });

  it('block ids are unique and cover exactly the adaptive new questions', () => {
    const ids = BRANCH_BLOCKS.flatMap((b) => [...b.ids]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.sort()).toEqual(['wt_q59', 'wt_q60', 'wt_q61', 'wt_q62', 'wt_q63', 'wt_q64', 'wt_q66', 'wt_q67', 'wt_q70']);
  });
});

describe('level ladder (algorithm 4)', () => {
  const skillOf = (id: string) => {
    const n = Number(id.replace(/\D/g, ''));
    if (id === 'wt_q18l' || id === 'wt_q71' || id === 'wt_q72') return 'listening';
    if ([18, 19, 68, 69, 70].includes(n)) return 'reading';
    if ((n >= 28 && n <= 35) || (n >= 63 && n <= 67)) return 'vocabulary';
    return 'grammar';
  };
  const item = (id: string, correct: boolean | null, idk = false): LadderItem =>
    ({ id, cefr: LEVEL_ITEM_CEFR[id], skill: skillOf(id), correct, idk });
  const items = (m: Record<string, boolean | null>) => Object.entries(m).map(([id, c]) => item(id, c));
  const t = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, true]));
  const f = (ids: string[]) => Object.fromEntries(ids.map((id) => [id, false]));

  it('a B1 student: passes A2 and B1, fails B2 (boundary found, high certainty)', () => {
    const r = estimateLevelLadder(items({
      ...t(['wt_q20', 'wt_q24', 'wt_q65']),
      ...t(['wt_q21', 'wt_q23', 'wt_q25', 'wt_q38', 'wt_q28', 'wt_q29', 'wt_q30', 'wt_q31']), wt_q26: false, wt_q32: false,
      ...f(['wt_q22', 'wt_q27', 'wt_q33']),
    }), 'B2');
    expect(r.level).toBe('B1');
    expect(r.confidence).toBe('overestimates');
    expect(r.evidence).toMatchObject({ status: 'ok', method: 'ladder', certainty: 'high', boundary_level: 'B2' });
    expect(r.version).toBe(4);
  });

  it('a level with fewer than 2 scored items is skipped, not failed', () => {
    const r = estimateLevelLadder(items({
      ...t(['wt_q21', 'wt_q23', 'wt_q25', 'wt_q26', 'wt_q38', 'wt_q28', 'wt_q29', 'wt_q30']),
      ...t(['wt_q22', 'wt_q27']), wt_q61: false,
    }), null);
    expect(r.level).toBe('B2');
    expect(r.evidence?.certainty).toBe('medium');
  });

  it('C1 is the top: never C2, flagged as "C1 or above"', () => {
    const r = estimateLevelLadder(items(t([
      'wt_q20', 'wt_q24', 'wt_q65', 'wt_q21', 'wt_q23', 'wt_q25', 'wt_q28', 'wt_q29',
      'wt_q22', 'wt_q27', 'wt_q33', 'wt_q61', 'wt_q62', 'wt_q66',
    ])), 'C1');
    expect(r.level).toBe('C1');
    expect(r.evidence?.reached_top).toBe(true);
    expect(r.confidence).toBe('accurate');
  });

  it('a student who fails the lowest tested level is reported as A1 (below floor)', () => {
    const r = estimateLevelLadder(items({
      ...f(['wt_q59', 'wt_q60', 'wt_q63', 'wt_q64', 'wt_q20', 'wt_q24', 'wt_q65', 'wt_q21', 'wt_q23', 'wt_q26']), wt_q25: true,
    }), null);
    expect(r.level).toBe('A1');
    expect(r.evidence?.below_floor).toBe(true);
  });

  it('a lucky pass above a failed level does not count', () => {
    const r = estimateLevelLadder(items({
      ...t(['wt_q20', 'wt_q24', 'wt_q65']),
      ...f(['wt_q21', 'wt_q23', 'wt_q25', 'wt_q38', 'wt_q28', 'wt_q29']), wt_q26: true, // B1 fails: 1 of 7
      ...t(['wt_q22', 'wt_q27', 'wt_q33', 'wt_q61', 'wt_q62', 'wt_q66']),
    }), null);
    expect(r.level).toBe('A2');
  });

  it('gives no level without enough evidence (the evidence gate stays)', () => {
    expect(estimateLevelLadder(items({ wt_q21: true, wt_q23: true }), null).level).toBeNull();
    const idk = ['wt_q20', 'wt_q24', 'wt_q21', 'wt_q23', 'wt_q25', 'wt_q28', 'wt_q29', 'wt_q22', 'wt_q27'].map((id) => item(id, false, true));
    const r = estimateLevelLadder(idk, null);
    expect(r.level).toBeNull();
    expect(r.evidence).toMatchObject({ status: 'insufficient', answered_items: 0 });
  });

  it('a single skill is not enough even with many answers', () => {
    const r = estimateLevelLadder(items(t(['wt_q20', 'wt_q24', 'wt_q21', 'wt_q23', 'wt_q25', 'wt_q26', 'wt_q38', 'wt_q22', 'wt_q27'])), null);
    expect(r.level).toBeNull();
    expect(r.evidence?.scored_skills).toBe(1);
  });

  it('skipped items (not scored) are not wrong answers', () => {
    const r = estimateLevelLadder([
      ...items({
        ...t(['wt_q20', 'wt_q24', 'wt_q65', 'wt_q21', 'wt_q23', 'wt_q25', 'wt_q26', 'wt_q28', 'wt_q29']),
      }),
      item('wt_q22', null), item('wt_q27', null),
    ], null);
    expect(r.level).toBe('B1');
  });
});
