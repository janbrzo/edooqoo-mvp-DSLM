/**
 * Pure payload builders for the validation loop decision log. No I/O.
 */

export interface PacingProposalLike {
  id: string;
  student_id: string;
  trigger_type: string;
  current_pacing: number;
  proposed_pacing: number;
  created_at: string;
}

export function buildPacingDecisionPayload(
  proposal: PacingProposalLike,
  extra: { reason?: string | null; applied_pacing?: number | null; surface?: string } = {},
): Record<string, unknown> {
  const reason = (extra.reason ?? '').trim();
  return {
    trigger_type: proposal.trigger_type,
    current_pacing: proposal.current_pacing,
    proposed_pacing: proposal.proposed_pacing,
    proposal_created_at: proposal.created_at,
    ...(extra.applied_pacing != null ? { applied_pacing: extra.applied_pacing } : {}),
    ...(reason ? { reason: reason.slice(0, 300) } : {}),
    ...(extra.surface ? { surface: extra.surface } : {}),
  };
}

export function buildLevelSuggestionPayload(args: {
  fromLevel: string | null | undefined;
  toLevel: string;
  testId?: string | null;
  scope: 'test' | 'student';
}): Record<string, unknown> {
  return {
    from_level: args.fromLevel ?? null,
    to_level: args.toLevel,
    test_id: args.testId ?? null,
    scope: args.scope,
  };
}
