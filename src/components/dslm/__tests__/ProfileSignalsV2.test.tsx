import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnswerBehaviourLine, DeclaredVsMeasured, LearningPathBlock, LowCoverageBadge } from '../ProfileSignalsV2';
import type { LearningProfileV2Columns } from '@/types/dslm/learningProfileV2';

const renderAll = (profile: LearningProfileV2Columns) => renderToStaticMarkup(
  <>
    <LowCoverageBadge profile={profile} />
    <DeclaredVsMeasured profile={profile} />
    <LearningPathBlock profile={profile} />
    <AnswerBehaviourLine profile={profile} />
  </>,
);

describe('ProfileSignalsV2', () => {
  it('renders nothing for an old profile without v2 data', () => {
    expect(renderAll({ ai_summary: 'x', raw_answers: { wt_q1: 'a' } })).toBe('');
  });

  it('renders every block for a v2 profile', () => {
    const html = renderAll({
      signal_coverage: 0.4,
      divergences: [{ pair: 'level', declared: 'B2', observed: 'A2', gap: 2, severity: 'strong' }],
      learning_path: { version: 2, score: 80, path: 'target', coverage: 0.4, component_scores: {}, overrides_applied: [], capacity_warning: 'unrealistic_goal' },
      answer_behaviour: { keyed_total: 10, keyed_answered: 8, skip_count_skill: 2, idk_count_skill: 0, coverage: 0.8, median_seconds_keyed: 9, rushed_count: 0 },
    });
    expect(html).toContain('Low signal coverage');
    expect(html).toContain('Declared vs measured');
    expect(html).toContain('based on 40% of the signals');
    expect(html).toContain('too low for this goal');
    expect(html).toContain('2 skill items skipped');
  });
});
