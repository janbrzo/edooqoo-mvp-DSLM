import { describe, it, expect } from 'vitest';
import { getRandomSuggestionSets, SUGGESTION_SETS } from '../suggestionSets';

describe('getRandomSuggestionSets', () => {
  it('returns distinct sets', () => {
    for (let run = 0; run < 50; run += 1) {
      const ids = getRandomSuggestionSets(2).map((set) => set.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('never returns an excluded set', () => {
    const excluded = SUGGESTION_SETS[0].id;
    for (let run = 0; run < 50; run += 1) {
      expect(getRandomSuggestionSets(1, [excluded]).map((set) => set.id)).not.toContain(excluded);
    }
  });
});
