import type { WelcomeTestQuestionDef } from '@/types/welcomeTest';
import { checkWelcomeTestKeyedAnswer } from '@/lib/welcomeTest/keyedAnswer';
import { CURRENT_WELCOME_BANK } from '@/lib/welcomeTest/seed';
import { questionDefsFor } from '@/lib/welcomeTest/flow';
import {
  estimateLevelLadder,
  type LadderItem,
  type LevelConfidence,
} from '../../../supabase/functions/_shared/welcomeTestLevel';
import { LEVEL_ITEM_CEFR } from '../../../supabase/functions/_shared/welcomeTestFlow';
import { reconstructTraits } from '../../../supabase/functions/_shared/welcomeTestTraits';
import {
  answerBehaviour,
  computeDivergences,
  SKILL_ELEMENT_TYPES,
  type Divergence,
} from '../../../supabase/functions/_shared/welcomeTestSignals';

export const PUBLIC_PLACEMENT_TEST_PATH = '/welcome-test/demo';
export const PUBLIC_PLACEMENT_TEST_TOKEN = 'demo';
export const PUBLIC_PLACEMENT_TTL_MS = 48 * 60 * 60 * 1000;
export const PUBLIC_PLACEMENT_STORAGE_KEY = 'edooqoo_public_placement_test_v1';
export const PUBLIC_PLACEMENT_RESULT_HASH = 'placement-result';

const PUBLIC_QUESTION_IDS = new Set(questionDefsFor(CURRENT_WELCOME_BANK, 'A').map((question) => question.id));
const VALID_LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1']);
const VALID_CONFIDENCE = new Set(['accurate', 'overestimates', 'underestimates']);
const SKILL_NAMES = ['grammar', 'vocabulary', 'reading', 'listening'] as const;

export type PublicPlacementSkillName = (typeof SKILL_NAMES)[number];

export interface PublicPlacementSkillResult {
  score: number | null;
  correct: number;
  answered: number;
  total: number;
}

export interface PublicPlacementResult {
  version: 1;
  completedAt: string;
  expiresAt: string;
  answeredCount: number;
  totalQuestions: number;
  level: string | null;
  levelConfidence: LevelConfidence | null;
  skills: Partial<Record<PublicPlacementSkillName, PublicPlacementSkillResult>>;
  selfAwarenessScore: number | null;
  traits: Record<string, string>;
  divergences: Divergence[];
  openResponseCount: number;
  recordingCount: number;
}

export interface PublicPlacementSession {
  version: 1;
  answers: Record<string, unknown>;
  currentSectionIndex: number;
  currentQuestionIndex: number;
  completedAt: string | null;
  result: PublicPlacementResult | null;
  expiresAt: string;
}

function isAnswered(value: unknown): boolean {
  return value !== undefined && value !== null;
}

function isValidStoredAnswer(value: unknown): boolean {
  if (value === '__IDK__') return true;
  if (typeof value === 'string') return value.length <= 20_000;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 20 && value.every((item) => typeof item === 'string' && item.length <= 2_000);
  if (value && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    return entries.length <= 20 && entries.every(([key, item]) => key.length <= 200 && typeof item === 'number' && Number.isFinite(item));
  }
  return false;
}

/** Only known question ids and serializable answer shapes can enter the public local session. */
export function sanitizePublicPlacementAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const [questionId, value] of Object.entries(answers)) {
    if (!PUBLIC_QUESTION_IDS.has(questionId) || !isValidStoredAnswer(value)) continue;
    clean[questionId] = typeof value === 'string' && value.startsWith('blob:')
      ? `local-recording:${questionId}`
      : value;
  }
  return clean;
}

export function savePublicPlacementSession(
  session: Omit<PublicPlacementSession, 'version' | 'expiresAt' | 'answers'> & { answers: Record<string, unknown> },
  now: Date = new Date(),
): boolean {
  try {
    const value: PublicPlacementSession = {
      ...session,
      version: 1,
      answers: sanitizePublicPlacementAnswers(session.answers),
      expiresAt: new Date(now.getTime() + PUBLIC_PLACEMENT_TTL_MS).toISOString(),
    };
    localStorage.setItem(PUBLIC_PLACEMENT_STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function loadPublicPlacementSession(now: Date = new Date()): PublicPlacementSession | null {
  try {
    const raw = localStorage.getItem(PUBLIC_PLACEMENT_STORAGE_KEY);
    if (!raw || raw.length > 1_000_000) return null;
    const parsed = JSON.parse(raw) as Partial<PublicPlacementSession>;
    const expiresAt = typeof parsed.expiresAt === 'string' ? Date.parse(parsed.expiresAt) : Number.NaN;
    if (parsed.version !== 1 || !Number.isFinite(expiresAt) || expiresAt <= now.getTime()) {
      localStorage.removeItem(PUBLIC_PLACEMENT_STORAGE_KEY);
      return null;
    }
    const answers = sanitizePublicPlacementAnswers(
      parsed.answers && typeof parsed.answers === 'object' && !Array.isArray(parsed.answers)
        ? parsed.answers as Record<string, unknown>
        : {},
    );
    return {
      version: 1,
      answers,
      currentSectionIndex: Math.max(0, Math.floor(Number(parsed.currentSectionIndex) || 0)),
      currentQuestionIndex: Math.max(0, Math.floor(Number(parsed.currentQuestionIndex) || 0)),
      completedAt: typeof parsed.completedAt === 'string' ? parsed.completedAt : null,
      result: parsed.result ? validatePublicPlacementResult(parsed.result, now) : null,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  } catch {
    return null;
  }
}

export function clearPublicPlacementSession(): void {
  try { localStorage.removeItem(PUBLIC_PLACEMENT_STORAGE_KEY); } catch { /* Storage can be unavailable. */ }
}

function buildSkills(
  questions: readonly WelcomeTestQuestionDef[],
  answers: Record<string, unknown>,
): Partial<Record<PublicPlacementSkillName, PublicPlacementSkillResult>> {
  const skills: Partial<Record<PublicPlacementSkillName, PublicPlacementSkillResult>> = {};
  for (const name of SKILL_NAMES) {
    const items = questions.filter((question) => question.element_type === name && SKILL_ELEMENT_TYPES.has(name));
    const answered = items.filter((question) => isAnswered(answers[question.id]) && checkWelcomeTestKeyedAnswer(question, answers[question.id]) !== null);
    const correct = answered.filter((question) => checkWelcomeTestKeyedAnswer(question, answers[question.id]) === true).length;
    skills[name] = {
      score: answered.length > 0 ? Math.round((correct / answered.length) * 100) : null,
      correct,
      answered: answered.length,
      total: items.length,
    };
  }
  return skills;
}

/**
 * A deterministic preview, not the teacher-facing AI evaluation. Keyed answers use
 * the production bank-2 level ladder; open writing and recordings stay unscored.
 */
export function buildPublicPlacementResult(
  questions: readonly WelcomeTestQuestionDef[],
  answers: Record<string, unknown>,
  completedAt: Date = new Date(),
): PublicPlacementResult {
  const skills = buildSkills(questions, answers);
  const traits = reconstructTraits(answers);
  const ladderItems: LadderItem[] = questions.flatMap((question) => {
    const cefr = LEVEL_ITEM_CEFR[question.id];
    const skill = question.element_type;
    if (!cefr || !skill || !SKILL_ELEMENT_TYPES.has(skill)) return [];
    const answered = isAnswered(answers[question.id]);
    return [{
      id: question.id,
      cefr,
      skill,
      correct: answered ? checkWelcomeTestKeyedAnswer(question, answers[question.id]) : null,
      idk: answers[question.id] === '__IDK__',
    }];
  });
  const level = estimateLevelLadder(ladderItems, traits.self_assessed_level);
  const keyed = questions.filter((question) => SKILL_ELEMENT_TYPES.has(String(question.element_type ?? '')));
  const wrongOrIdk = keyed.filter((question) => isAnswered(answers[question.id]) && checkWelcomeTestKeyedAnswer(question, answers[question.id]) === false);
  const idkCount = wrongOrIdk.filter((question) => answers[question.id] === '__IDK__').length;
  const selfAwarenessScore = wrongOrIdk.length > 0 ? Math.round((idkCount / wrongOrIdk.length) * 100) : null;
  const behaviour = answerBehaviour(keyed.map((question) => ({
    element_type: question.element_type,
    student_answer: answers[question.id],
    is_correct: isAnswered(answers[question.id]) ? checkWelcomeTestKeyedAnswer(question, answers[question.id]) : null,
  })));
  const confidenceMatrix = answers.wt_q44 && typeof answers.wt_q44 === 'object' && !Array.isArray(answers.wt_q44)
    ? answers.wt_q44 as Record<string, unknown>
    : null;
  const divergences = computeDivergences({
    traits,
    estimatedLevel: level.level,
    selfAssessedLevel: traits.self_assessed_level,
    confidenceMatrix,
    readingScore: skills.reading?.score,
    writingScore: null,
    speakingScore: null,
    selfAwarenessScore,
    skillWrongOrIdk: wrongOrIdk.length,
    behaviour,
  });
  const openResponseCount = questions.filter((question) =>
    (question.question_type === 'open_ended' || question.question_type === 'open_reflection')
    && typeof answers[question.id] === 'string'
    && answers[question.id] !== '__IDK__'
    && (answers[question.id] as string).trim().length > 0).length;
  const recordingCount = questions.filter((question) =>
    question.question_type === 'speaking_record'
    && typeof answers[question.id] === 'string'
    && answers[question.id] !== '__IDK__'
    && (answers[question.id] as string).length > 0).length;

  return {
    version: 1,
    completedAt: completedAt.toISOString(),
    expiresAt: new Date(completedAt.getTime() + PUBLIC_PLACEMENT_TTL_MS).toISOString(),
    answeredCount: questions.filter((question) => isAnswered(answers[question.id])).length,
    totalQuestions: questions.length,
    level: level.level,
    levelConfidence: level.confidence,
    skills,
    selfAwarenessScore,
    traits,
    divergences,
    openResponseCount,
    recordingCount,
  };
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64 + '='.repeat((4 - base64.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

/** Shared links contain only this bounded summary, never free-text answers or audio. */
export function buildPublicPlacementResultUrl(result: PublicPlacementResult, origin: string): string {
  const url = new URL(PUBLIC_PLACEMENT_TEST_PATH, origin);
  url.hash = `${PUBLIC_PLACEMENT_RESULT_HASH}=${encodeBase64Url(JSON.stringify(result))}`;
  return url.toString();
}

function validSkillResult(value: unknown): value is PublicPlacementSkillResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const skill = value as PublicPlacementSkillResult;
  return (skill.score === null || (typeof skill.score === 'number' && skill.score >= 0 && skill.score <= 100))
    && [skill.correct, skill.answered, skill.total].every((count) => Number.isInteger(count) && count >= 0 && count <= 200);
}

export function validatePublicPlacementResult(value: unknown, now: Date = new Date()): PublicPlacementResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const result = value as PublicPlacementResult;
  const completed = Date.parse(result.completedAt);
  const expires = Date.parse(result.expiresAt);
  if (result.version !== 1 || !Number.isFinite(completed) || !Number.isFinite(expires)
    || expires !== completed + PUBLIC_PLACEMENT_TTL_MS || expires <= now.getTime()
    || !Number.isInteger(result.answeredCount) || !Number.isInteger(result.totalQuestions)
    || result.answeredCount < 0 || result.totalQuestions < 1 || result.answeredCount > result.totalQuestions
    || (result.level !== null && !VALID_LEVELS.has(result.level))
    || (result.levelConfidence !== null && !VALID_CONFIDENCE.has(result.levelConfidence))
    || !result.skills || typeof result.skills !== 'object' || Array.isArray(result.skills)
    || !result.traits || typeof result.traits !== 'object' || Array.isArray(result.traits)
    || !Array.isArray(result.divergences)) return null;
  for (const [name, skill] of Object.entries(result.skills)) {
    if (!SKILL_NAMES.includes(name as PublicPlacementSkillName) || !validSkillResult(skill)) return null;
  }
  if (Object.keys(result.traits).length > 30 || Object.values(result.traits).some((trait) => typeof trait !== 'string' || trait.length > 500)) return null;
  if (result.divergences.length > 20 || result.divergences.some((divergence) =>
    !divergence || typeof divergence !== 'object'
    || typeof divergence.declared !== 'string' || divergence.declared.length > 500
    || typeof divergence.observed !== 'string' || divergence.observed.length > 500)) return null;
  return result;
}

export type SharedPublicPlacementResult =
  | { status: 'none' | 'invalid' | 'expired'; result: null }
  | { status: 'valid'; result: PublicPlacementResult };

export function readSharedPublicPlacementResult(hash: string, now: Date = new Date()): SharedPublicPlacementResult {
  const match = hash.match(/(?:^#|&)placement-result=([^&]+)/);
  if (!match) return { status: 'none', result: null };
  try {
    if (match[1].length > 20_000) return { status: 'invalid', result: null };
    const parsed = JSON.parse(decodeBase64Url(decodeURIComponent(match[1]))) as PublicPlacementResult;
    const expires = Date.parse(parsed.expiresAt);
    if (Number.isFinite(expires) && expires <= now.getTime()) return { status: 'expired', result: null };
    const result = validatePublicPlacementResult(parsed, now);
    return result ? { status: 'valid', result } : { status: 'invalid', result: null };
  } catch {
    return { status: 'invalid', result: null };
  }
}
