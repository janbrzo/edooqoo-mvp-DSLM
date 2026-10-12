import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { OPEN_EXERCISE_TYPES, CLOSED_EXERCISE_TYPES, isOpenExerciseType, isClosedExerciseType } from '@/utils/masteryCalculator';
import { resolveEnglishLevel, DEFAULT_ENGLISH_LEVEL } from '../../../../supabase/functions/_shared/englishLevel';

const ROOT = join(__dirname, '../../../..');

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return f === 'node_modules' || f === '__tests__' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(f) ? [p] : [];
  });

describe('exercise type lists have one source', () => {
  it('open and closed lists never overlap', () => {
    expect(OPEN_EXERCISE_TYPES.filter((t) => CLOSED_EXERCISE_TYPES.includes(t))).toEqual([]);
    for (const t of OPEN_EXERCISE_TYPES) expect(isClosedExerciseType(t)).toBe(false);
  });

  it('open types include the variants callers match exactly', () => {
    for (const t of ['describe', 'describe-picture', 'answer-questions-audio', 'sentence-transformation', 'speaking', 'essay']) {
      expect(isOpenExerciseType(t)).toBe(true);
    }
    expect(isOpenExerciseType('fill-in-blanks')).toBe(false);
    expect(isOpenExerciseType(undefined)).toBe(false);
  });

  it('no other file declares its own open-type list', () => {
    const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'supabase/functions'))]
      .filter((f) => !f.endsWith('_shared/itemMastery.ts') && !f.includes('/mcp/'));
    // A literal array bound to an "open..." name that lists open exercise types.
    const ownLists = files.filter((f) =>
      /\bconst\s+\w*open\w*\s*(?::[^=]+)?=\s*\[[^\]]*'paraphrasing'/i.test(readFileSync(f, 'utf8')));
    expect(ownLists.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });
});

describe('resolveEnglishLevel', () => {
  it('takes the first CEFR candidate', () => {
    expect(resolveEnglishLevel('A2', 'B1/B2')).toBe('A2');
    expect(resolveEnglishLevel(null, 'b1 / b2')).toBe('B1/B2');
  });
  it('skips placeholders and falls back to the old default', () => {
    expect(resolveEnglishLevel('unknown', 'Intermediate', 'C1')).toBe('C1');
    expect(resolveEnglishLevel(undefined, '')).toBe(DEFAULT_ENGLISH_LEVEL);
  });
});
