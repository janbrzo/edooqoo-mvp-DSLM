import { describe, expect, it } from 'vitest';
import { buildPlacementAccountPreview } from '../placementAccountPreview';

const result = {
  level: 'A2', skills: {
    grammar: { score: 27, correct: 3, answered: 11 }, vocabulary: { score: 9, correct: 1, answered: 11 },
    reading: { score: 25, correct: 1, answered: 4 }, listening: { score: 67, correct: 2, answered: 3 },
  },
} as never;

describe('buildPlacementAccountPreview', () => {
  it('previews the same two goals the claim creates: weakest then strongest', () => {
    expect(buildPlacementAccountPreview(result).goals).toEqual(['Improve vocabulary range', 'Build confidence from listening comprehension']);
  });
  it('suggests the first lesson for the weakest skill', () => {
    expect(buildPlacementAccountPreview(result).firstLesson).toContain('vocabulary');
  });
});
