import { describe, expect, it } from 'vitest';
import { buildLevelSuggestionPayload, buildPacingDecisionPayload } from '../decisionPayloads';

const proposal = { id: 'p', student_id: 's', trigger_type: 'manual', current_pacing: 50, proposed_pacing: 62, created_at: '2026-10-01T00:00:00Z' };

describe('decision payload builders', () => {
  it('pacing payload carries the proposal and optional parts only when present', () => {
    expect(buildPacingDecisionPayload(proposal)).toEqual({
      trigger_type: 'manual', current_pacing: 50, proposed_pacing: 62, proposal_created_at: '2026-10-01T00:00:00Z',
    });
    const full = buildPacingDecisionPayload(proposal, { reason: '  too fast  ', applied_pacing: 60, surface: 'header_bell' });
    expect(full).toMatchObject({ reason: 'too fast', applied_pacing: 60, surface: 'header_bell' });
  });
  it('pacing reason is capped and blank reasons are dropped', () => {
    expect((buildPacingDecisionPayload(proposal, { reason: 'x'.repeat(900) }).reason as string).length).toBe(300);
    expect('reason' in buildPacingDecisionPayload(proposal, { reason: '   ' })).toBe(false);
  });
  it('level suggestion payload', () => {
    expect(buildLevelSuggestionPayload({ fromLevel: 'A2', toLevel: 'B1', testId: 't', scope: 'test' }))
      .toEqual({ from_level: 'A2', to_level: 'B1', test_id: 't', scope: 'test' });
    expect(buildLevelSuggestionPayload({ fromLevel: null, toLevel: 'B1', scope: 'student' }).test_id).toBeNull();
  });
});
