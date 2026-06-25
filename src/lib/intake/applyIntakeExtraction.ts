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

export async function applyIntakeExtraction(args: {
  studentId: string;
  payload: IntakeExtractionPayload;
  includes: IntakeIncludes;
  rawText: string;
  model: string;
}): Promise<IntakeApplyResult> {
  const { data, error } = await (supabase as any).rpc('apply_intake_extraction', {
    p_student_id: args.studentId,
    p_payload: args.payload,
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