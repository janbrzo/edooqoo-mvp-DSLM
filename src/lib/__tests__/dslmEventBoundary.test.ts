import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseAiEvaluation, mapItemEvaluationsToAiEvaluations } from '../../utils/aiEvaluationMapper';
import { buildQuestionEvaluations, buildOpenItemEvaluations } from '../../../supabase/functions/process-pending-ai-evaluations/itemBuilder';

const dir = join(__dirname, '../../../supabase/migrations');
const file = readdirSync(dir).sort().filter(f => f.endsWith('.sql'))
  .filter(f => readFileSync(join(dir, f), 'utf8').includes('FUNCTION public.normalize_dslm_ratings(')).pop();
const sql = file ? readFileSync(join(dir, file), 'utf8') : '';

describe('Stage 1.2 event boundary contract', () => {
  it('normalizes before event consumers and protects helper execution', () => {
    expect(sql).toContain('BEFORE INSERT OR UPDATE OF event_payload, mastery, skill_ids');
    expect(sql).toContain('v_score BETWEEN 0 AND 100');
    expect(sql).toContain('ELSE -1 END');
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
  });
  it('adds flashcard evidence without changing the card outcome formula', () => {
    expect(sql).toContain("NEW.event_source = 'flashcard'");
    expect(sql).toContain("'mastery', NEW.mastery");
    expect(sql).not.toContain('v_raw_mastery :=');
  });
  it('classification updates an observation instead of adding another point', () => {
    expect(sql).toContain('AFTER INSERT OR UPDATE OF category, content, tags, metadata, ai_classified, ai_confidence, deleted_at, is_outdated');
    expect(sql).toContain('WHERE id = v_event AND event_payload IS DISTINCT FROM v_payload');
    expect(sql).toContain("p_entry->>'category' IS DISTINCT FROM 'Skill Assessment'");
    expect(sql).toContain('NEW.created_at');
  });
});

describe('Missing evaluation is not a real zero', () => {
  it('canonical display preserves zero and marks missing as unevaluated', () => {
    const result = parseAiEvaluation({ question_evaluations: [{ question_index: 0 }, { question_index: 1, quality_score: 0 }] });
    expect(result?.[0].quality_score).toBe(-1);
    expect(result?.[1].quality_score).toBe(0);
  });
  it('legacy display does not fabricate a failing score', () => {
    expect(mapItemEvaluationsToAiEvaluations([{ name: 'ns.B1.grammar.x', question_index: 0 }])?.[0].quality_score).toBe(-1);
    expect(mapItemEvaluationsToAiEvaluations([{ name: 'ns.B1.grammar.x', question_index: 0, mastery: 0 }])?.[0].quality_score).toBe(0);
  });
  it('server payload preserves zero and marks missing as unevaluated', () => {
    const result = buildQuestionEvaluations({ evaluations: [{ question_index: 0 }, { question_index: 1, quality_score: 0 }], answers: {}, hasAudio: () => false });
    expect(result.question_evaluations[0].quality_score).toBe(-1);
    expect(result.question_evaluations[1].quality_score).toBe(0);
  });
  it('open ratings keep missing audio unscored and a genuine zero scored', () => {
    const items = buildOpenItemEvaluations({ evaluations: [{ question_index: 0, quality_score: 0 }], questionItems: [{ nano_skill: [{ name: 'ns.B1.grammar.x' }, { name: 'ns.B1.speaking.x' }] }], answers: { '0': 'x' }, hasAudio: () => false });
    expect(items[0]).toMatchObject({ mastery: 0, hasValue: true });
    expect(items[1]).toMatchObject({ mastery: -1, hasValue: false });
  });
});