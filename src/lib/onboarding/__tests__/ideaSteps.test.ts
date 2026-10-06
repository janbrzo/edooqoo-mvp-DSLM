import { describe, expect, it } from 'vitest';
import { resolveIdeaSteps } from '../ideaSteps';

const none = { suggestions: 0, usedSuggestions: 0, ideaNotes: 0, usedIdeaNotes: 0 };

describe('resolveIdeaSteps', () => {
  it('stays open without any signal', () => {
    expect(resolveIdeaSteps(none)).toEqual({ generate_next_ideas: false, pick_idea: false });
  });

  it('completes from lesson suggestions (what the checklist points to)', () => {
    expect(resolveIdeaSteps({ ...none, suggestions: 3 })).toEqual({ generate_next_ideas: true, pick_idea: false });
    expect(resolveIdeaSteps({ ...none, suggestions: 3, usedSuggestions: 1 })).toEqual({ generate_next_ideas: true, pick_idea: true });
  });

  it('keeps the legacy note signal so ticked steps never regress', () => {
    expect(resolveIdeaSteps({ ...none, ideaNotes: 1, usedIdeaNotes: 1 })).toEqual({ generate_next_ideas: true, pick_idea: true });
  });

  it('ignores invalid counts', () => {
    expect(resolveIdeaSteps({ suggestions: NaN, usedSuggestions: -2, ideaNotes: 0, usedIdeaNotes: 0 })).toEqual({ generate_next_ideas: false, pick_idea: false });
  });
});
