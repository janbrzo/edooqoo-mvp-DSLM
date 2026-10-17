/**
 * DSLM item ratings of an OPEN exercise from verify-open-answers results.
 * Shared by the worksheet queue and the homework server path so both write the
 * same ratings. Pure, no I/O.
 */
import { scoreToMastery } from '../_shared/itemMastery.ts';

/** nano_skill of an exercise item as an array of entries that have a name. */
export function validNanoSkills(item: any): any[] {
  let nanoSkills = item?.nano_skill ?? item?.nanoSkill;
  if (!nanoSkills) return [];
  if (!Array.isArray(nanoSkills)) nanoSkills = [nanoSkills];
  return nanoSkills.filter((ns: any) => ns && ns.name);
}

const isSpeakingSkill = (n: string) => n.includes('.speaking.') || n.includes('.sp.');
const isWritingSkill = (n: string) => n.includes('.writing.') || n.includes('.wr.');

export function buildOpenItemEvaluations(params: {
  evaluations: any[];
  questionItems: any[];
  answers: Record<string, unknown>;
  hasAudio: (questionIndex: number) => boolean;
}): any[] {
  const { evaluations, questionItems, answers, hasAudio: hasAudioFor } = params;
  const itemEvaluations: any[] = [];
  for (const e of evaluations || []) {
    const qIdx = e.question_index;
    const validSkills = validNanoSkills(questionItems[qIdx]);
    // No nano_skills: skip (no junk question_* metrics).
    if (validSkills.length === 0) continue;

    const hasAudio = hasAudioFor(qIdx);
    const hasWritten = !!(answers[String(qIdx)] && String(answers[String(qIdx)]).trim());

    for (const ns of validSkills) {
      const nsName = String(ns.name || '').toLowerCase();
      let mastery: number;
      if (isWritingSkill(nsName) && hasWritten && e.writing_score !== undefined) {
        mastery = scoreToMastery(e.writing_score);
      } else if (isSpeakingSkill(nsName) && hasAudio && e.speaking_score !== undefined) {
        mastery = scoreToMastery(e.speaking_score);
      } else if (isSpeakingSkill(nsName) && !hasAudio) {
        mastery = -1; // no audio submitted: speaking is not evaluated
      } else {
        // A real 0 (non-answer, off-topic) stays 0; a missing or invalid score is unevaluated.
        mastery = scoreToMastery(e.quality_score);
      }

      let confidence = ns.confidence || 0.90;
      if (isSpeakingSkill(nsName)) confidence = hasAudio ? 0.90 : 0.30;
      else if (isWritingSkill(nsName)) confidence = hasWritten ? 0.90 : 0.70;

      itemEvaluations.push({
        question_index: qIdx,
        name: ns.name,
        reason: ns.reason || '',
        mastery,
        hasValue: mastery >= 0,
        confidence,
        feedback: e.feedback || '',
        response_type: hasAudio ? 'audio' : 'written',
        writing_score: hasWritten ? e.writing_score : undefined,
        speaking_score: hasAudio ? e.speaking_score : undefined,
      });
    }
  }
  return itemEvaluations;
}

/** Canonical ai_evaluation payload (same shape as the homework client writes). */
export function buildQuestionEvaluations(params: {
  evaluations: any[];
  answers: Record<string, unknown>;
  hasAudio: (questionIndex: number) => boolean;
}): { question_evaluations: any[] } {
  const { evaluations, answers, hasAudio } = params;
  return {
    question_evaluations: (evaluations || []).map((e: any) => {
      const qIdx = e.question_index;
      const hasWritten = !!(answers[String(qIdx)] && String(answers[String(qIdx)]).trim());
      return {
        question_index: qIdx,
        is_acceptable: e.is_acceptable ?? ((e.quality_score || 0) >= 0.5),
        quality_score: typeof e.quality_score === 'number' && Number.isFinite(e.quality_score) ? e.quality_score : -1,
        feedback: e.feedback || '',
        ...(e.key_verdict ? { key_verdict: e.key_verdict } : {}),
        writing_score: hasWritten ? e.writing_score : undefined,
        speaking_score: hasAudio(qIdx) ? e.speaking_score : undefined,
      };
    }),
  };
}
