/**
 * aiEvaluationMapper.ts - Shared utility for converting AI evaluation data
 * 
 * This is the SINGLE source of truth for converting between different AI evaluation formats.
 * Used by both /shared and /worksheet views.
 * 
 * Priority:
 * 1. ai_evaluation.question_evaluations (canonical, same as /homework)
 * 2. item_evaluations (backward-compatible fallback for old records)
 */

import { AiEvaluation } from '@/components/homework/AiEvaluationBadge';

/**
 * Parse canonical ai_evaluation object (same format as homework_student_answers.ai_evaluation)
 * into per-question AiEvaluation map.
 */
export function parseAiEvaluation(aiEval: any): Record<number, AiEvaluation> | undefined {
  if (!aiEval) return undefined;
  
  const questionEvals = aiEval.question_evaluations;
  if (!Array.isArray(questionEvals) || questionEvals.length === 0) return undefined;
  
  const result: Record<number, AiEvaluation> = {};
  
  for (const qe of questionEvals) {
    const qIdx = qe.question_index ?? 0;
    result[qIdx] = {
      is_acceptable: qe.is_acceptable ?? (qe.quality_score >= 0.5),
      quality_score: qe.quality_score ?? 0,
      feedback: qe.feedback ?? '',
      question_index: qIdx,
      writing_score: qe.writing_score,
      speaking_score: qe.speaking_score,
    };
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Backward-compatible fallback: convert item_evaluations (DSLM format) to AiEvaluation map.
 * Only used for historical records that don't have ai_evaluation.
 */
export function mapItemEvaluationsToAiEvaluations(items: any[] | undefined): Record<number, AiEvaluation> | undefined {
  if (!items || items.length === 0) return undefined;
  
  // Group items by question_index
  const grouped: Record<number, any[]> = {};
  items.forEach(item => {
    const qIdx = item.question_index ?? 0;
    if (!grouped[qIdx]) grouped[qIdx] = [];
    grouped[qIdx].push(item);
  });
  
  const result: Record<number, AiEvaluation> = {};
  
  for (const [qIdxStr, groupItems] of Object.entries(grouped)) {
    const qIdx = parseInt(qIdxStr);
    
    // Check if any item is pending
    if (groupItems.some(item => item.hasValue === false)) {
      result[qIdx] = { is_acceptable: false, quality_score: -1, feedback: '', question_index: qIdx };
      continue;
    }
    
    let baseMastery: number | undefined;
    let writingMastery: number | undefined;
    let speakingMastery: number | undefined;
    let feedback = '';
    
    groupItems.forEach(item => {
      const name = (item.name || '').toLowerCase();
      if (name.endsWith('.writing') || name.includes('.writing.') || name.includes('.wr.')) {
        writingMastery = item.mastery;
      } else if (name.endsWith('.speaking') || name.includes('.speaking.') || name.includes('.sp.')) {
        speakingMastery = item.mastery;
      } else {
        baseMastery = item.mastery;
        // Fallback: read writing_score/speaking_score from item
        if (writingMastery === undefined && item.writing_score !== undefined) {
          writingMastery = Math.round(item.writing_score * 100);
        }
        if (speakingMastery === undefined && item.speaking_score !== undefined) {
          speakingMastery = Math.round(item.speaking_score * 100);
        }
      }
      if (item.feedback) feedback = item.feedback;
    });
    
    const effectiveMastery = baseMastery ?? 
      (writingMastery !== undefined && speakingMastery !== undefined 
        ? Math.round((writingMastery + speakingMastery) / 2) 
        : writingMastery ?? speakingMastery ?? 0);
    
    result[qIdx] = {
      is_acceptable: effectiveMastery >= 70,
      quality_score: effectiveMastery / 100,
      feedback,
      question_index: qIdx,
      writing_score: writingMastery !== undefined ? writingMastery / 100 : undefined,
      speaking_score: speakingMastery !== undefined && speakingMastery >= 0 ? speakingMastery / 100 : undefined,
    };
  }
  
  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Resolve AI evaluations with priority:
 * 1. Canonical ai_evaluation (per-question, same as homework)
 * 2. Fallback from item_evaluations (for old records)
 */
export function resolveAiEvaluations(
  aiEvaluation: any | undefined,
  itemEvaluations: any[] | undefined
): Record<number, AiEvaluation> | undefined {
  // Try canonical first
  const canonical = parseAiEvaluation(aiEvaluation);
  if (canonical) return canonical;
  
  // Fallback to item_evaluations
  return mapItemEvaluationsToAiEvaluations(itemEvaluations);
}
