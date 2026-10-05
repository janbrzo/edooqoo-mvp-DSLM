import { describe, it, expect } from 'vitest';
import { buildInsightsSummary, categoryLabel, rankCategories, type InsightsSummaryInput } from '../insightsSummary';
import { describeFit } from '../confidenceScore';

const base: InsightsSummaryInput = {
  englishLevel: 'B2',
  hasPlacementProfile: false,
  estimatedLevel: null,
  categories: [],
  daysSinceLastActivity: null,
  homeworkTotal: 0,
  homeworkCompleted: 0,
};

describe('rankCategories', () => {
  it('keeps only categories with evidence, weakest first', () => {
    const ranked = rankCategories([
      { category: 'reading', avg_mastery: 78.4, total_events: 10, trend: 'improving' },
      { category: 'writing', avg_mastery: 41, total_events: 5, trend: 'declining' },
      { category: 'speaking', avg_mastery: 0, total_events: 0 },
    ]);
    expect(ranked.map((c) => [c.label, c.pct, c.trend])).toEqual([
      ['Writing', 41, 'declining'],
      ['Reading', 78, 'improving'],
    ]);
  });

  it('labels unknown categories readably', () => {
    expect(categoryLabel('visual_comprehension')).toBe('Visual comprehension');
    expect(categoryLabel('business_talk')).toBe('Business talk');
  });
});

describe('buildInsightsSummary', () => {
  it('states plainly that nothing is known yet', () => {
    const s = buildInsightsSummary(base);
    expect(s.hasEvidence).toBe(false);
    expect(s.lines).toEqual([
      'Level B2 (set by you) · placement test: not taken',
      'No lessons, homework or flashcard activity yet',
    ]);
  });

  it('names the strongest and up to two weakest categories', () => {
    const s = buildInsightsSummary({
      ...base,
      hasPlacementProfile: true,
      estimatedLevel: 'B1',
      categories: [
        { category: 'reading', avg_mastery: 78, total_events: 3 },
        { category: 'writing', avg_mastery: 41, total_events: 3 },
        { category: 'grammar', avg_mastery: 55, total_events: 3 },
      ],
      daysSinceLastActivity: 3,
      homeworkTotal: 5,
      homeworkCompleted: 4,
    });
    expect(s.hasEvidence).toBe(true);
    expect(s.lines).toEqual([
      'Level B2 (set by you) · placement test estimate: B1',
      'Strongest: Reading 78% · Work on: Writing 41%, Grammar 55%',
      'Last active 3 days ago · homework 4 of 5 done',
    ]);
  });

  it('handles a single category and homework without activity', () => {
    const s = buildInsightsSummary({
      ...base,
      englishLevel: null,
      hasPlacementProfile: true,
      categories: [{ category: 'speaking', avg_mastery: 62, total_events: 1 }],
      homeworkTotal: 2,
      homeworkCompleted: 0,
    });
    expect(s.lines).toEqual([
      'Level not set · placement test: completed',
      'Only Speaking has evidence so far: 62%',
      'Homework 0 of 2 done',
    ]);
  });

  it('phrases today and yesterday', () => {
    expect(buildInsightsSummary({ ...base, daysSinceLastActivity: 0 }).lines[1]).toBe('Last active today');
    expect(buildInsightsSummary({ ...base, daysSinceLastActivity: 1 }).lines[1]).toBe('Last active yesterday');
  });
});

describe('describeFit', () => {
  it('maps the heuristic score to a word', () => {
    expect(describeFit(98)).toBe('Strong fit');
    expect(describeFit(80)).toBe('Strong fit');
    expect(describeFit(79)).toBe('Good fit');
    expect(describeFit(65)).toBe('Good fit');
    expect(describeFit(64)).toBe('Rough fit');
  });
});
