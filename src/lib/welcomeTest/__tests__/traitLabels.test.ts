import { describe, expect, it } from 'vitest';
import { TRAIT_QUESTIONS } from '../../../../supabase/functions/_shared/welcomeTestTraits';
import {
  MANY_IDK_THRESHOLD,
  TRAIT_META,
  TRAIT_ORDER,
  formatDivergenceText,
  humanizeDivergenceText,
  interpretIdk,
  interpretSelfAwareness,
  knownTraitValues,
  selfAssessmentAccuracyLabel,
  traitBasedOn,
  traitConfidence,
  traitLabel,
  traitValueLabel,
  visibleTraitKeys,
} from '../traitLabels';

describe('trait label parity with the server', () => {
  it('labels every server trait with the same question id', () => {
    for (const [key, cfg] of Object.entries(TRAIT_QUESTIONS)) {
      expect(TRAIT_META[key], `missing meta for ${key}`).toBeDefined();
      expect(TRAIT_META[key].questionId).toBe(cfg.questionId);
    }
    expect([...TRAIT_ORDER].sort()).toEqual(Object.keys(TRAIT_QUESTIONS).sort());
  });

  it('labels every mapped value of every trait', () => {
    for (const [key, cfg] of Object.entries(TRAIT_QUESTIONS)) {
      const labelled = new Set(knownTraitValues(key));
      for (const value of new Set(Object.values(cfg.mapping))) {
        expect(labelled.has(value), `${key}=${value} has no label`).toBe(true);
      }
    }
  });

  it('never shows a raw snake_case key or an em dash', () => {
    for (const [key, cfg] of Object.entries(TRAIT_QUESTIONS)) {
      expect(traitLabel(key)).not.toMatch(/_/);
      for (const value of Object.values(cfg.mapping)) {
        const text = traitValueLabel(key, value);
        expect(text).not.toMatch(/_/);
        expect(text).not.toContain('\u2014');
      }
    }
  });
});

describe('labels', () => {
  it('uses the planned wording', () => {
    expect(traitValueLabel('weekly_study_time', '2_3_hours')).toBe('2-3 hours per week');
    expect(traitValueLabel('feedback_preference', 'delayed_discussion')).toBe('Prefers to discuss mistakes later');
  });

  it('labels multi-select values part by part and falls back for unknown input', () => {
    expect(traitValueLabel('usage_context', 'work_formal, travel')).toBe('At work, Travel');
    expect(traitValueLabel('new_trait', 'some_value')).toBe('Some value');
    expect(traitLabel('new_trait_key')).toBe('New trait key');
    expect(traitValueLabel('anxiety_level', null)).toBe('-');
    expect(traitBasedOn('unknown')).toBeNull();
    expect(traitBasedOn('anxiety_level')).toMatch(/mistakes/);
  });

  it('skips metadata keys', () => {
    expect(visibleTraitKeys(['__interpretation_version__', 'anxiety_level', 'zzz_new', 'motivation_type']))
      .toEqual(['motivation_type', 'anxiety_level', 'zzz_new']);
  });
});

describe('traitConfidence', () => {
  it('marks a single answer as low confidence', () => {
    const c = traitConfidence('anxiety_level', { anxiety_level: { question_id: 'wt_q7', single_item: true } });
    expect(c).toEqual({ level: 'low', chip: 'Low confidence (1 answer)', note: 'Based on 1 answer' });
  });

  it('marks several answers as medium', () => {
    expect(traitConfidence('anxiety_level', { anxiety_level: { single_item: false } })?.level).toBe('medium');
  });

  it('falls back to one answer on old profiles without trait_evidence', () => {
    expect(traitConfidence('anxiety_level', undefined)?.chip).toBe('Low confidence (1 answer)');
    expect(traitConfidence('anxiety_level', null)?.note).toBe('Based on 1 answer');
    expect(traitConfidence('mystery', {})).toBeNull();
  });
});

describe('awareness lines', () => {
  it('reads self_awareness_score in three bands and handles null', () => {
    expect(interpretSelfAwareness(80)).toMatch(/good self-monitoring/);
    expect(interpretSelfAwareness(40)).toMatch(/Sometimes/);
    expect(interpretSelfAwareness(5)).toMatch(/guesses/);
    expect(interpretSelfAwareness(null)).toMatch(/No signal/);
  });

  it('reads the I-do-not-know counts', () => {
    expect(interpretIdk(0, 0)).toBe('Never chose "I don\'t know".');
    expect(interpretIdk(1, 1)).toContain('1 "I don\'t know" answer in total');
    expect(interpretIdk(MANY_IDK_THRESHOLD, 3)).toMatch(/low confidence or low engagement/);
    expect(interpretIdk(undefined, undefined)).toBe('Never chose "I don\'t know".');
  });
});

describe('self-assessment accuracy', () => {
  it('names level_confidence values', () => {
    expect(selfAssessmentAccuracyLabel('accurate')).toBe('Accurate');
    expect(selfAssessmentAccuracyLabel('overestimates')).toBe('Overestimates their level');
    expect(selfAssessmentAccuracyLabel('underestimates')).toBe('Underestimates their level');
    expect(selfAssessmentAccuracyLabel(null)).toBe('Unknown');
  });
});

describe('divergence text', () => {
  it('replaces snake_case tokens with readable wording', () => {
    expect(humanizeDivergenceText('latent goal: career_critical')).toBe('latent goal: career-driven');
    expect(humanizeDivergenceText('homework under low motivation: some_new_key')).toBe('homework under low motivation: some new key');
  });

  it('builds the declared, observed and sentence parts', () => {
    const t = formatDivergenceText({ declared: 'study time: 2_3_hours', observed: 'homework: avoidant' });
    expect(t?.declared).toBe('Study time: 2-3 hours per week');
    expect(t?.sentence).toBe('Declared: Study time: 2-3 hours per week. Observed: homework: avoidant.');
    expect(formatDivergenceText({ declared: 'x' })).toBeNull();
  });
});
