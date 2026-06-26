// v6.9.62 P6 — Thin client wrapper around the apply_intake_extraction RPC.
// Used by AddStudentDialog (after the student row is created) to seed the
// profile from an AI extraction. The RPC is atomic — all-or-nothing.
import { supabase } from '@/integrations/supabase/client';

export interface IntakeExtractionPayload {
  language?: string;
  summary_notes?: string;
  student_name?:  { value?: string; confidence?: number; evidence_quote?: string };
  student_email?: { value?: string; confidence?: number; evidence_quote?: string };
  signals?: Array<{
    category?: 'Personal' | 'Skill Assessment';
    subtype?: string;
    element_type?: string;
    text?: string;
    confidence?: number;
    evidence_quote?: string;
  }>;
  goals?: Array<{
    goal_type?: 'main' | 'supporting' | 'additional';
    title?: string;
    description?: string;
    target_date?: string;
    confidence?: number;
    evidence_quote?: string;
  }>;
  english_level?: { value?: string; confidence?: number; evidence_quote?: string };
  main_goal?: { value?: string; target_date?: string; confidence?: number; evidence_quote?: string };
  native_language?: { value?: string; confidence?: number; evidence_quote?: string };
  pacing?: {
    sessions_per_week?: number;
    preferred_time?: string;
    rationale?: string;
    confidence?: number;
    evidence_quote?: string;
  };
}

export interface IntakeIncludes {
  notes?: boolean;
  signals?: Record<string, boolean>;
  goals?: Record<string, boolean>;
  english_level?: boolean;
  main_goal?: boolean;
  native_language?: boolean;
  pacing?: boolean;
}

export interface IntakeApplyResult {
  extraction_id: string;
  entry_ids: string[];
  goal_ids: string[];
  pacing_proposal_id: string | null;
  student_updates: Record<string, unknown>;
  auto_count: number;
}

const clampConfidence = (value: unknown, fallback = 0.6): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
};

const safeDate = (value: unknown): string => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10) === value ? value : '';
};

const normalizeCefr = (value: unknown): string => {
  const match = String(value || '').toUpperCase().match(/\b(A1|A2|B1|B2|C1|C2)\b/);
  return match?.[1] || '';
};

const sanitizePayloadForRpc = (payload: IntakeExtractionPayload): IntakeExtractionPayload => {
  const safe: IntakeExtractionPayload = JSON.parse(JSON.stringify(payload || {}));

  if (safe.student_name) safe.student_name.confidence = clampConfidence(safe.student_name.confidence, 0.7);
  if (safe.student_email) safe.student_email.confidence = clampConfidence(safe.student_email.confidence, 0.7);

  if (safe.english_level) {
    const level = normalizeCefr(safe.english_level.value);
    safe.english_level = level
      ? { ...safe.english_level, value: level, confidence: clampConfidence(safe.english_level.confidence, 0.6) }
      : undefined;
  }

  if (safe.main_goal) {
    safe.main_goal = {
      ...safe.main_goal,
      value: String(safe.main_goal.value || '').slice(0, 200),
      target_date: safeDate(safe.main_goal.target_date),
      confidence: clampConfidence(safe.main_goal.confidence, 0.6),
    };
  }

  if (safe.native_language) {
    safe.native_language = {
      ...safe.native_language,
      value: String(safe.native_language.value || '').slice(0, 40),
      confidence: clampConfidence(safe.native_language.confidence, 0.6),
    };
  }

  safe.signals = Array.isArray(safe.signals)
    ? safe.signals.map((signal) => ({
        ...signal,
        category: signal.category === 'Skill Assessment' ? 'Skill Assessment' : 'Personal',
        text: String(signal.text || '').slice(0, 500),
        confidence: clampConfidence(signal.confidence, 0.6),
      }))
    : [];

  safe.goals = Array.isArray(safe.goals)
    ? safe.goals.map((goal) => {
        const rawType = String(goal.goal_type || '').toLowerCase();
        const goalType = rawType === 'main' || rawType === 'supporting' || rawType === 'additional' ? rawType : 'additional';
        return {
          ...goal,
          goal_type: goalType as 'main' | 'supporting' | 'additional',
          title: String(goal.title || goal.description || 'Suggested goal').slice(0, 140),
          description: goal.description ? String(goal.description).slice(0, 400) : undefined,
          target_date: safeDate(goal.target_date),
          confidence: clampConfidence(goal.confidence, 0.6),
        };
      })
    : [];

  if (safe.pacing) {
    const parsed = Number(safe.pacing.sessions_per_week);
    safe.pacing.sessions_per_week = Number.isFinite(parsed) ? Math.max(1, Math.min(7, Math.round(parsed))) : undefined;
    safe.pacing.confidence = clampConfidence(safe.pacing.confidence, 0.6);
  }

  return safe;
};

export async function applyIntakeExtraction(args: {
  studentId: string;
  payload: IntakeExtractionPayload;
  includes: IntakeIncludes;
  rawText: string;
  model: string;
}): Promise<IntakeApplyResult> {
  const payload = sanitizePayloadForRpc(args.payload);
  const { data, error } = await (supabase as any).rpc('apply_intake_extraction', {
    p_student_id: args.studentId,
    p_payload: payload,
    p_includes: args.includes,
    p_raw_text: args.rawText,
    p_model: args.model,
  });
  if (error) throw error;
  return data as IntakeApplyResult;
}

export async function rollbackIntakeExtraction(extractionId: string): Promise<void> {
  const { error } = await (supabase as any).rpc('rollback_intake_extraction', {
    p_extraction_id: extractionId,
  });
  if (error) throw error;
}