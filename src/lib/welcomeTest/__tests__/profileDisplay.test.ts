import { describe, expect, it } from 'vitest';
import {
  ANALYSING_MESSAGE,
  FEEDBACK_HINT_DAYS,
  computeKeyedScore,
  describeLevelState,
  divergenceSignalKeys,
  isFeedbackHintVisible,
  orderedTraitRows,
  readInterpretationVersion,
  readLevelEvidence,
  resolveProfileTraits,
  traitSignalKey,
} from '../profileDisplay';

const insufficient = { level_evidence: { status: 'insufficient', scored_items: 4, answered_items: 9, min_scored: 10, min_answered: 15 } };

describe('describeLevelState', () => {
  it('shows analysing while a welcome test is still completed', () => {
    expect(describeLevelState({ estimatedLevel: 'B1', rawAnswers: {}, testStatus: 'completed', isWelcomeTest: true }))
      .toEqual({ kind: 'analysing', message: ANALYSING_MESSAGE });
  });

  it('shows the manual-level message instead of a level when evidence is insufficient', () => {
    const state = describeLevelState({ estimatedLevel: null, rawAnswers: insufficient, testStatus: 'reviewed', isWelcomeTest: true });
    expect(state).toEqual({
      kind: 'insufficient',
      message: 'Not enough answers to estimate a level (4 of 10 needed). Set the level manually after the first lesson.',
    });
  });

  it('never shows a level when evidence is insufficient, even if one is stored', () => {
    expect(describeLevelState({ estimatedLevel: 'B2', rawAnswers: insufficient }).kind).toBe('insufficient');
  });

  it('shows the level, or none, for old profiles without level_evidence', () => {
    expect(describeLevelState({ estimatedLevel: 'B1', rawAnswers: null })).toEqual({ kind: 'level', level: 'B1' });
    expect(describeLevelState({ estimatedLevel: ' ', rawAnswers: {} }).kind).toBe('none');
  });

  it('omits the progress when min_scored is missing', () => {
    const state = describeLevelState({ estimatedLevel: null, rawAnswers: { level_evidence: { status: 'insufficient' } } });
    expect(state.kind === 'insufficient' && state.message).toBe(
      'Not enough answers to estimate a level. Set the level manually after the first lesson.',
    );
  });
});

describe('readers', () => {
  it('reads level_evidence defensively', () => {
    expect(readLevelEvidence(undefined)).toBeNull();
    expect(readLevelEvidence({ level_evidence: { status: 'weird' } })).toBeNull();
    expect(readLevelEvidence({ level_evidence: { status: 'ok', scored_items: 12 } })?.scoredItems).toBe(12);
  });

  it('reads the interpretation version', () => {
    expect(readInterpretationVersion({ __interpretation_version__: 3 })).toBe(3);
    expect(readInterpretationVersion({ __interpretation_version__: '3' })).toBeNull();
    expect(readInterpretationVersion(null)).toBeNull();
  });

  it('resolves traits from the JSON first, then the columns, skipping "__" keys', () => {
    const traits = resolveProfileTraits({
      traits: { anxiety_level: 'high', __interpretation_version__: 2, persistence_level: 'low', empty: '' },
      anxiety_level: 'low',
      motivation_type: 'instrumental',
      error_attitude: null,
    });
    expect(traits).toEqual({ anxiety_level: 'high', persistence_level: 'low', motivation_type: 'instrumental' });
    expect(orderedTraitRows(traits).map((r) => r.key)).toEqual(['motivation_type', 'persistence_level', 'anxiety_level']);
    expect(resolveProfileTraits(null)).toEqual({});
  });
});

describe('validation loop helpers', () => {
  it('builds stable signal keys, numbering a repeated divergence pair', () => {
    expect(traitSignalKey('anxiety_level')).toBe('trait:anxiety_level');
    expect(divergenceSignalKeys(['level', 'metacognition', 'metacognition'])).toEqual([
      'divergence:level', 'divergence:metacognition', 'divergence:metacognition#2',
    ]);
  });

  it('shows the hint only within 14 days of completion', () => {
    const now = new Date('2026-10-17T12:00:00Z');
    expect(FEEDBACK_HINT_DAYS).toBe(14);
    expect(isFeedbackHintVisible('2026-10-10T12:00:00Z', now)).toBe(true);
    expect(isFeedbackHintVisible('2026-10-03T12:00:00Z', now)).toBe(false);
    expect(isFeedbackHintVisible(null, now)).toBe(false);
    expect(isFeedbackHintVisible('not a date', now)).toBe(false);
  });
});

describe('computeKeyedScore', () => {
  it('counts only keyed items and ignores profile questions', () => {
    const qs = [
      { correct_answer: 'a', is_correct: true },
      { correct_answer: 'b', is_correct: false },
      { correct_answer: '', is_correct: null },
      { correct_answer: '""', is_correct: null },
      { correct_answer: null, is_correct: null },
    ];
    expect(computeKeyedScore(qs)).toEqual({ keyedTotal: 2, correct: 1, percent: 50 });
  });

  it('is null (not 0%) when nothing is scored or keyed', () => {
    expect(computeKeyedScore([{ correct_answer: 'a', is_correct: null }]).percent).toBeNull();
    expect(computeKeyedScore([]).percent).toBeNull();
  });
});
