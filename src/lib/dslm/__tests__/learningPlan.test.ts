import { describe, it, expect } from 'vitest';
import {
  findCurrentPhase,
  formatPhaseCaption,
  orderUpNext,
  sortPhases,
  type PlanPhaseLite,
  type PlanSuggestionLite,
} from '../learningPlan';

const phase = (over: Partial<PlanPhaseLite> & { id: string }): PlanPhaseLite => ({
  sequence_number: 1,
  status: 'planned',
  title: `Title ${over.id}`,
  ...over,
});

const step = (over: Partial<PlanSuggestionLite> & { id: string }): PlanSuggestionLite => ({
  sequence_number: 1,
  suggested_topic: `Topic ${over.id}`,
  phase_id: null,
  is_used: false,
  deleted_at: null,
  ...over,
});

const ids = (items: { suggestion: PlanSuggestionLite }[]) => items.map((i) => i.suggestion.id);

describe('sortPhases / findCurrentPhase', () => {
  it('sorts by sequence number', () => {
    const sorted = sortPhases([phase({ id: 'b', sequence_number: 2 }), phase({ id: 'a', sequence_number: 1 })]);
    expect(sorted.map((p) => p.id)).toEqual(['a', 'b']);
  });

  it('picks the first in-progress phase in sequence order', () => {
    const current = findCurrentPhase([
      phase({ id: 'p3', sequence_number: 3, status: 'in_progress' }),
      phase({ id: 'p2', sequence_number: 2, status: 'in_progress' }),
      phase({ id: 'p1', sequence_number: 1, status: 'done' }),
    ]);
    expect(current?.id).toBe('p2');
  });

  it('returns null without an in-progress phase', () => {
    expect(findCurrentPhase([phase({ id: 'p1' })])).toBeNull();
    expect(findCurrentPhase(null)).toBeNull();
  });
});

describe('orderUpNext', () => {
  const phases = [
    phase({ id: 'P1', sequence_number: 1, status: 'in_progress', title: 'Meetings' }),
    phase({ id: 'P2', sequence_number: 2, status: 'planned', title: 'Negotiation' }),
  ];

  it('regression: never compares per-phase sequence numbers across phases', () => {
    // sequence_number restarts at 1 in every phase.
    const items = orderUpNext({
      phases,
      phaseSteps: [
        step({ id: 'p2-s1', phase_id: 'P2', sequence_number: 1 }),
        step({ id: 'p1-s2', phase_id: 'P1', sequence_number: 2 }),
      ],
      nextSteps: [],
    });
    expect(ids(items)).toEqual(['p1-s2', 'p2-s1']);
  });

  it('puts the in-progress phase first even when it is not the first phase', () => {
    const items = orderUpNext({
      phases: [
        phase({ id: 'A', sequence_number: 1, status: 'planned' }),
        phase({ id: 'B', sequence_number: 2, status: 'in_progress' }),
      ],
      phaseSteps: [
        step({ id: 'a1', phase_id: 'A', sequence_number: 1 }),
        step({ id: 'b1', phase_id: 'B', sequence_number: 1 }),
      ],
    });
    expect(ids(items)).toEqual(['b1', 'a1']);
    expect(items[0].isCurrentPhase).toBe(true);
  });

  it('orders other phases by phase sequence, then step sequence, then id', () => {
    const items = orderUpNext({
      phases: [
        phase({ id: 'A', sequence_number: 1 }),
        phase({ id: 'B', sequence_number: 2 }),
      ],
      phaseSteps: [
        step({ id: 'b2', phase_id: 'B', sequence_number: 2 }),
        step({ id: 'a2', phase_id: 'A', sequence_number: 2 }),
        step({ id: 'a1z', phase_id: 'A', sequence_number: 1 }),
        step({ id: 'a1a', phase_id: 'A', sequence_number: 1 }),
      ],
    });
    expect(ids(items)).toEqual(['a1a', 'a1z', 'a2', 'b2']);
  });

  it('places steps of unknown phases after known phases and free steps last', () => {
    const items = orderUpNext({
      phases,
      phaseSteps: [
        step({ id: 'ghost', phase_id: 'deleted-phase', sequence_number: 1 }),
        step({ id: 'p2-s1', phase_id: 'P2', sequence_number: 1 }),
      ],
      nextSteps: [step({ id: 'free-1', sequence_number: 1 })],
    });
    expect(ids(items)).toEqual(['p2-s1', 'ghost', 'free-1']);
    expect(items[1].phaseLabel).toBeNull();
  });

  it('drops used and soft-deleted rows', () => {
    const items = orderUpNext({
      phases,
      phaseSteps: [
        step({ id: 'used', phase_id: 'P1', is_used: true }),
        step({ id: 'gone', phase_id: 'P1', deleted_at: '2026-10-01T00:00:00Z' }),
        step({ id: 'live', phase_id: 'P1', sequence_number: 3 }),
      ],
    });
    expect(ids(items)).toEqual(['live']);
  });

  it('moves rows without a topic to the end', () => {
    const items = orderUpNext({
      phases,
      phaseSteps: [
        step({ id: 'blank', phase_id: 'P1', sequence_number: 1, suggested_topic: '  ' }),
        step({ id: 'real', phase_id: 'P1', sequence_number: 2 }),
      ],
    });
    expect(ids(items)).toEqual(['real', 'blank']);
  });

  it('numbers steps inside their own phase and labels the phase', () => {
    const items = orderUpNext({
      phases,
      phaseSteps: [
        step({ id: 'p1-a', phase_id: 'P1', sequence_number: 4 }),
        step({ id: 'p1-b', phase_id: 'P1', sequence_number: 7 }),
        step({ id: 'p2-a', phase_id: 'P2', sequence_number: 9 }),
      ],
      nextSteps: [step({ id: 'f', sequence_number: 5 })],
    });
    expect(items.map((i) => i.displayIndex)).toEqual([1, 2, 1, 1]);
    expect(items[0].phaseLabel).toBe('Phase 1');
    expect(items[0].phaseTitle).toBe('Meetings');
    expect(formatPhaseCaption(items[0])).toBe('Phase 1: Meetings');
    expect(formatPhaseCaption(items[3])).toBeNull();
  });

  it('handles empty and missing input', () => {
    expect(orderUpNext({})).toEqual([]);
    expect(orderUpNext({ phases: null, phaseSteps: null, nextSteps: null })).toEqual([]);
  });
});
