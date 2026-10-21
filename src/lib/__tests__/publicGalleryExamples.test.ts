import { describe, expect, it } from 'vitest';
import { PUBLIC_GALLERY_EXAMPLES, publicDecisionPath, selectPublishedExamples } from '../gallery/publicExamples';
import { DEFAULT_DECISION_INPUT, hasSharedDecisionEvidence, parseDecisionInput } from '../decisionTool/decisionRules.mjs';

describe('Public gallery source selection', () => {
  const publishedRow = {
    public_slug: PUBLIC_GALLERY_EXAMPLES[0].slug,
    published_at: '2026-06-01T20:31:15.162+00:00',
    public_level: 'B1',
  };

  it('uses only reviewed sources present in the publication-filtered list', () => {
    expect(selectPublishedExamples([publishedRow, { ...publishedRow, public_slug: 'unreviewed' }])).toHaveLength(1);
    expect(selectPublishedExamples([])).toEqual([]);
    expect(selectPublishedExamples([{ ...publishedRow, published_at: null }])).toEqual([]);
  });

  it('does not transfer exercise bodies, learner identity, answers or private metrics', () => {
    const examples = selectPublishedExamples([{
      ...publishedRow, title: 'Changed private title', ai_response: 'private exercises',
      html_content: '<p>private</p>', student_id: 'private-id', answers: ['secret'], mastery: 98,
    }]);
    expect(examples[0]).toEqual({ ...PUBLIC_GALLERY_EXAMPLES[0], level: 'B1' });
  });

  it('does not turn mixed worksheet levels into an invented learner level', () => {
    expect(selectPublishedExamples([{ ...publishedRow, public_level: 'B1/B2' }])[0]?.level).toBeNull();
    expect(publicDecisionPath('B1/B2')).toBe('/tools/what-should-i-teach-next');
  });
});

describe('Public worksheet to next lesson link', () => {
  it('prefills only a valid CEFR level and never asserts learner mastery', () => {
    const path = publicDecisionPath('A2');
    expect(path).toBe('/tools/what-should-i-teach-next?level=A2');
    expect(parseDecisionInput(path.split('?')[1])).toEqual({ ...DEFAULT_DECISION_INPUT, level: 'A2' });
  });

  it('rejects free text and personal data in the link', () => {
    expect(publicDecisionPath('B2&studentName=Private')).toBe('/tools/what-should-i-teach-next');
    expect(publicDecisionPath(null)).toBe('/tools/what-should-i-teach-next');
  });

  it('does not auto-decide from level, source, identity or invalid evidence parameters', () => {
    expect(hasSharedDecisionEvidence('?level=A2&src=gallery')).toBe(false);
    expect(hasSharedDecisionEvidence('?studentName=Private&mastery=invalid')).toBe(false);
    expect(hasSharedDecisionEvidence('?mastery=secure&independence=independent')).toBe(true);
  });
});