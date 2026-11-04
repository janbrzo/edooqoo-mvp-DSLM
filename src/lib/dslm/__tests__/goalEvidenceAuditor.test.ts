import { describe, it, expect } from 'vitest';
import { auditGoal, type AuditGoal, type AuditMetric } from '../goalEvidenceAuditor';

const now = new Date('2026-11-04T08:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();
const m = (skill_name: string, mastery: number, events: number, last = daysAgo(1), cat = 'vocabulary', micro: string | null = null): AuditMetric => ({
  skill_name, skill_category: cat, micro_skill: micro, current_mastery: mastery, total_events: events, last_event_at: last,
});
const goal = (over: Partial<AuditGoal> = {}): AuditGoal => ({ id: 'g1', title: 'Negotiation vocabulary for meetings', ...over });

describe('goalEvidenceAuditor', () => {
  it('no matching metrics gives no suggestion and no confidence', () => {
    const r = auditGoal(goal(), [m('vocabulary.travel_airport', 90, 5)], now);
    expect(r.suggestedProgressPct).toBeNull();
    expect(r.confidence).toBe('none');
    expect(r.hasNewEvidence).toBe(false);
  });

  it('weights matching skills and applies forgetting to old evidence', () => {
    const fresh = auditGoal(goal(), [
      m('vocabulary.negotiation_phrases', 80, 5), m('vocabulary.meeting_language', 80, 5), m('speaking.negotiation_roleplay', 80, 5, daysAgo(1), 'speaking'),
    ], now);
    const stale = auditGoal(goal(), [
      m('vocabulary.negotiation_phrases', 80, 5, daysAgo(120)), m('vocabulary.meeting_language', 80, 5, daysAgo(120)), m('speaking.negotiation_roleplay', 80, 5, daysAgo(120), 'speaking'),
    ], now);
    expect(fresh.matchedSkillsCount).toBe(3);
    expect(fresh.suggestedProgressPct).toBe(80);
    expect(stale.suggestedProgressPct!).toBeLessThan(fresh.suggestedProgressPct!);
  });

  it('excludes flashcards and technical keys', () => {
    const r = auditGoal(goal({ title: 'question negotiation' }), [
      m('flashcard:negotiation', 100, 9), m('question_3', 100, 9, daysAgo(1), 'other'),
    ], now);
    expect(r.matchedSkillsCount).toBe(0);
  });

  it('one exercise cannot produce a high suggestion', () => {
    const r = auditGoal(goal(), [m('vocabulary.negotiation_phrases', 100, 1)], now);
    expect(r.confidence).toBe('low');
    expect(r.suggestedProgressPct!).toBeLessThanOrEqual(40);
    expect(r.statusRecommendation).not.toBe('ready_to_achieve');
  });

  it('recommends ready_to_achieve at >= 85% without critical gaps', () => {
    const metrics = [
      m('vocabulary.negotiation_phrases', 95, 5), m('vocabulary.meeting_language', 90, 5), m('vocabulary.negotiation_concessions', 92, 5),
    ];
    expect(auditGoal(goal(), metrics, now).statusRecommendation).toBe('ready_to_achieve');
    const withGap = [...metrics, m('vocabulary.negotiation_idioms', 30, 5)];
    expect(auditGoal(goal(), withGap, now).statusRecommendation).not.toBe('ready_to_achieve');
  });

  it('works without learning elements and respects a skill target_category', () => {
    const metrics = [m('vocabulary.negotiation_phrases', 70, 5), m('speaking.negotiation_roleplay', 70, 5, daysAgo(1), 'speaking')];
    const r = auditGoal(goal({ target_category: 'speaking', elements: [] }), metrics, now);
    expect(r.matchedSkillsCount).toBe(1);
    expect(r.supportingSkills[0].category).toBe('speaking');
  });

  it('flags at_risk when 70% of the time passed and progress < 40%', () => {
    const r = auditGoal(goal({ created_at: daysAgo(80), target_date: daysAgo(-20) }), [m('vocabulary.negotiation_phrases', 20, 3)], now);
    expect(r.statusRecommendation).toBe('at_risk');
  });

  it('is a suggestion only: input goal is not mutated and close saved values are not new evidence', () => {
    const g = goal({ manual_progress_pct: 75 });
    const metrics = [m('vocabulary.negotiation_phrases', 80, 5), m('vocabulary.meeting_language', 80, 5), m('vocabulary.negotiation_tactics', 80, 5)];
    const r = auditGoal(g, metrics, now);
    expect(g.manual_progress_pct).toBe(75);
    expect(r.currentSavedPct).toBe(75);
    expect(r.hasNewEvidence).toBe(false);
    expect(auditGoal({ ...g, manual_progress_pct: 40 }, metrics, now).hasNewEvidence).toBe(true);
    expect(auditGoal({ ...g, manual_progress_pct: 40, is_achieved: true }, metrics, now).hasNewEvidence).toBe(false);
  });
});
