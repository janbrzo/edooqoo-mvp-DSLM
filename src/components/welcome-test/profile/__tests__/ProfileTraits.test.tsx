import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AwarenessBlock, LevelAssessmentBlock, ProfileTraits } from '../ProfileTraits';

describe('ProfileTraits', () => {
  it('shows labels and low-confidence chips, never raw keys or metadata', () => {
    const html = renderToStaticMarkup(
      <ProfileTraits
        profile={{
          traits: { weekly_study_time: '2_3_hours', feedback_preference: 'delayed_discussion', __interpretation_version__: 2 },
          raw_answers: { trait_evidence: { weekly_study_time: { question_id: 'wt_q5', single_item: true } } },
        }}
      />,
    );
    expect(html).toContain('2-3 hours per week');
    expect(html).toContain('Prefers to discuss mistakes later');
    expect(html).toContain('Low confidence (1 answer)');
    expect(html).not.toContain('2_3_hours');
    expect(html).not.toContain('__interpretation_version__');
  });

  it('renders nothing without traits', () => {
    expect(renderToStaticMarkup(<ProfileTraits profile={{}} />)).toBe('');
  });
});

describe('AwarenessBlock', () => {
  it('interprets the score and the counts', () => {
    const html = renderToStaticMarkup(<AwarenessBlock profile={{ self_awareness_score: 10, idk_count_total: 2, idk_count_skill: 1 }} />);
    expect(html).toContain('Mostly guesses');
    expect(html).toContain('2 total, 1 on skill questions');
  });
});

describe('LevelAssessmentBlock', () => {
  it('shows the insufficient message and no level', () => {
    const html = renderToStaticMarkup(
      <LevelAssessmentBlock
        profile={{
          estimated_level: null,
          raw_answers: { level_evidence: { status: 'insufficient', scored_items: 3, min_scored: 10 } },
        }}
      />,
    );
    expect(html).toContain('Not enough answers to estimate a level (3 of 10 needed). Set the level manually after the first lesson.');
  });

  it('shows the analysing state for a welcome test still completed', () => {
    const html = renderToStaticMarkup(<LevelAssessmentBlock profile={{ estimated_level: 'B1' }} testStatus="completed" isWelcomeTest />);
    expect(html).toContain('Analysing results...');
  });

  it('renames the level_confidence badge to Self-assessment accuracy', () => {
    const html = renderToStaticMarkup(<LevelAssessmentBlock profile={{ estimated_level: 'B1', level_confidence: 'overestimates' }} />);
    expect(html).toContain('Self-assessment accuracy');
    expect(html).toContain('Overestimates their level');
    expect(html).not.toContain('Self-Awareness');
  });
});
