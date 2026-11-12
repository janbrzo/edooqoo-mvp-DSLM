import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { questionDefsFor } from '@/lib/welcomeTest/flow';
import {
  buildPublicPlacementResult,
  buildPublicPlacementResultUrl,
  clearPublicPlacementSession,
  loadPublicPlacementSession,
  PUBLIC_PLACEMENT_STORAGE_KEY,
  PUBLIC_PLACEMENT_TTL_MS,
  readSharedPublicPlacementResult,
  sanitizePublicPlacementAnswers,
  savePublicPlacementSession,
} from '../publicPlacementTest';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
  removeItem(key: string) { this.values.delete(key); }
  clear() { this.values.clear(); }
}

const NOW = new Date('2026-11-10T08:00:00.000Z');

beforeEach(() => { vi.stubGlobal('localStorage', new MemoryStorage()); });
afterEach(() => { vi.unstubAllGlobals(); });

describe('public placement local session', () => {
  it('expires saved answers and the result exactly 7 days after the last save', () => {
    const saved = savePublicPlacementSession({
      answers: { wt_q1: 'A real answer', wt_q16s: 'blob:local-audio' },
      currentSectionIndex: 2,
      currentQuestionIndex: 3,
      completedAt: null,
      result: null,
    }, NOW);
    expect(saved).toBe(true);
    expect(loadPublicPlacementSession(new Date(NOW.getTime() + PUBLIC_PLACEMENT_TTL_MS - 1))?.currentQuestionIndex).toBe(3);
    expect(loadPublicPlacementSession(new Date(NOW.getTime() + PUBLIC_PLACEMENT_TTL_MS))).toBeNull();
    expect(localStorage.getItem(PUBLIC_PLACEMENT_STORAGE_KEY)).toBeNull();
  });

  it('allowlists question ids and replaces blob URLs with local recording markers', () => {
    expect(sanitizePublicPlacementAnswers({
      wt_q1: 'Answer',
      wt_q16s: 'blob:private',
      injected: 'discard',
      wt_q2: ['one', 'two'],
    })).toEqual({ wt_q1: 'Answer', wt_q16s: 'local-recording:wt_q16s', wt_q2: ['one', 'two'] });
  });

  it('clears a local session without touching any other storage key', () => {
    localStorage.setItem('unrelated', 'keep');
    savePublicPlacementSession({ answers: {}, currentSectionIndex: 0, currentQuestionIndex: 0, completedAt: null, result: null }, NOW);
    clearPublicPlacementSession();
    expect(localStorage.getItem(PUBLIC_PLACEMENT_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('unrelated')).toBe('keep');
  });
});

describe('public placement deterministic result', () => {
  it('uses the real bank-2 ladder and trait mapping when keyed evidence is sufficient', () => {
    const questions = questionDefsFor(2, 'A');
    const answers: Record<string, unknown> = {};
    for (const question of questions) {
      if (question.correct_answer) answers[question.id] = Array.isArray(question.correct_answer) ? question.correct_answer[0] : question.correct_answer;
    }
    answers.wt_q8 = questionDefsFor(2, 'A').find((question) => question.id === 'wt_q8')!.options![1];
    const result = buildPublicPlacementResult(questions, answers, NOW);
    expect(result.level).toBe('C1');
    expect(result.traits.preferred_input_channel).toBe('auditory');
    expect(result.selfAwarenessScore).toBeNull();
  });

  it('withholds CEFR when only I-don-know answers exist and reports honest self-awareness', () => {
    const questions = questionDefsFor(2, 'A').filter((question) => question.correct_answer);
    const answers = Object.fromEntries(questions.map((question) => [question.id, '__IDK__']));
    const result = buildPublicPlacementResult(questions, answers, NOW);
    expect(result.level).toBeNull();
    expect(result.selfAwarenessScore).toBe(100);
  });

  it('shares a bounded summary without open text or audio and rejects it after 7 days', () => {
    const questions = questionDefsFor(2, 'A');
    const answers = { wt_q41: 'PRIVATE OPEN ANSWER', wt_q16s: 'blob:PRIVATE_AUDIO' };
    const result = buildPublicPlacementResult(questions, answers, NOW);
    const url = buildPublicPlacementResultUrl(result, 'https://edooqoo.com');
    expect(url).not.toContain('PRIVATE');
    expect(JSON.stringify(result)).not.toContain('PRIVATE');
    const hash = new URL(url).hash;
    expect(readSharedPublicPlacementResult(hash, new Date(NOW.getTime() + PUBLIC_PLACEMENT_TTL_MS - 1)).status).toBe('valid');
    expect(readSharedPublicPlacementResult(hash, new Date(NOW.getTime() + PUBLIC_PLACEMENT_TTL_MS)).status).toBe('expired');
  });
});
