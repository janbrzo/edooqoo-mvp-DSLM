import { describe, expect, it } from 'vitest';
import { selectAutoAppliedWtPacing, WT_INITIAL_AUTO_REASON, type PacingChangeRow } from '../pacingAutoApplied';

const NOW = new Date('2026-10-17T12:00:00Z');
const row = (over: Partial<PacingChangeRow> = {}): PacingChangeRow => ({
  id: 'p1',
  status: 'accepted',
  trigger_type: 'placement_test',
  trigger_details: { reason: WT_INITIAL_AUTO_REASON, previous_pacing: 50, previous_last_pacing_set_manually: null },
  current_pacing: 50,
  proposed_pacing: 72,
  created_at: '2026-10-10T12:00:00Z',
  decided_at: '2026-10-10T12:00:00Z',
  ...over,
});

describe('selectAutoAppliedWtPacing', () => {
  it('returns the auto-applied proposal with its previous values', () => {
    expect(selectAutoAppliedWtPacing([row()], 72, NOW)).toEqual({
      proposalId: 'p1', newPacing: 72, previousPacing: 50, previousLastPacingSetManually: null,
    });
  });
  it('keeps a stored boolean flag', () => {
    const r = row({ trigger_details: { reason: WT_INITIAL_AUTO_REASON, previous_pacing: 40, previous_last_pacing_set_manually: false } });
    expect(selectAutoAppliedWtPacing([r], 72, NOW)?.previousLastPacingSetManually).toBe(false);
  });
  it('returns null when there is no row or it is older than 30 days', () => {
    expect(selectAutoAppliedWtPacing([], 72, NOW)).toBeNull();
    expect(selectAutoAppliedWtPacing([row({ decided_at: '2026-09-01T00:00:00Z' })], 72, NOW)).toBeNull();
  });
  it('is hidden once a later accepted change exists', () => {
    const later = row({ id: 'p2', trigger_type: 'periodic_30d', trigger_details: {}, decided_at: '2026-10-15T00:00:00Z', proposed_pacing: 60 });
    expect(selectAutoAppliedWtPacing([row(), later], 60, NOW)).toBeNull();
  });
  it('ignores reverted, pending and rejected rows', () => {
    expect(selectAutoAppliedWtPacing([row({ status: 'reverted' })], 50, NOW)).toBeNull();
    expect(selectAutoAppliedWtPacing([row({ status: 'pending' })], 72, NOW)).toBeNull();
    expect(selectAutoAppliedWtPacing([row({ status: 'rejected' })], 72, NOW)).toBeNull();
  });
  it('is hidden when the teacher changed the pacing since', () => {
    expect(selectAutoAppliedWtPacing([row()], 40, NOW)).toBeNull();
  });
  it('ignores accepted proposals that were not auto-applied', () => {
    expect(selectAutoAppliedWtPacing([row({ trigger_details: {} })], 72, NOW)).toBeNull();
  });
});
