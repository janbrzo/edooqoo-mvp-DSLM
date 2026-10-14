/**
 * Answer context for open exercises sent to `verify-open-answers`.
 *
 * One extractor for the question text, the suggested answer and the source text
 * the question is about (reading passage, listening transcript, image
 * description), so a reading or listening answer is graded against its source.
 * Used by the AI queue (process-pending-ai-evaluations) and the homework submit
 * (src/utils/audioEvalUtils.ts). Pure, no I/O, no path aliases.
 */

/** Longest source text sent per exercise; keeps long passages from flooding the prompt. */
export const MAX_SOURCE_TEXT_CHARS = 3000;

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim());

/** Item list of an open exercise, whatever its shape. */
export function openExerciseItems(exercise: any): any[] {
  if (!exercise) return [];
  const list = exercise.questions || exercise.prompts || exercise.sentences || exercise.expressions || exercise.items;
  return Array.isArray(list) ? list : [];
}

/** Text of a reading passage stored as plain text, or as an object / JSON string with a text field. */
function passageText(content: unknown): string {
  if (content === undefined || content === null) return '';
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        return passageText(parsed);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (typeof content === 'object') {
    const o = content as Record<string, unknown>;
    return str(o.text ?? o.passage ?? o.content ?? o.body);
  }
  return '';
}

const clip = (s: string): string =>
  s.length > MAX_SOURCE_TEXT_CHARS ? `${s.slice(0, MAX_SOURCE_TEXT_CHARS)}...` : s;

/**
 * Source text of an exercise: reading passage, listening transcript and image
 * description. The transcript lives on the worksheet for audio exercises, so it
 * can be passed separately. Empty string when the exercise has none.
 */
export function exerciseSourceText(
  exercise: any,
  opts: { worksheetAudioTranscript?: string | null } = {},
): string {
  if (!exercise) return '';
  const parts: string[] = [];
  const transcript = str(exercise.audio_transcript) || str(exercise.transcript) || str(opts.worksheetAudioTranscript);
  if (transcript) parts.push(`Audio transcript: ${clip(transcript)}`);
  const image = str(exercise.image_description) || str(exercise.picture_description);
  if (image) parts.push(`Image description: ${clip(image)}`);
  const reading = passageText(exercise.content) || passageText(exercise.passage) || passageText(exercise.text);
  if (reading) parts.push(`Reading text: ${clip(reading)}`);
  return parts.join('\n\n');
}

export interface OpenAnswerContext {
  question_text: string;
  suggested_answer: string;
  /** Passage / transcript / image description of the whole exercise ('' when none). */
  source_context: string;
}

/**
 * Per-item context for one open question. A missing exercise or item yields a
 * generic "Question n" text (the answer is still graded, without a key).
 */
export function buildOpenAnswerContext(params: {
  exercise: any;
  questionIndex: number;
  worksheetAudioTranscript?: string | null;
  /** Prefix the first question with the exercise instructions (homework behaviour). */
  includeInstructions?: boolean;
}): OpenAnswerContext {
  const { exercise, questionIndex, worksheetAudioTranscript, includeInstructions } = params;
  const item = openExerciseItems(exercise)[questionIndex];
  let questionText = '';
  let suggested = '';

  if (typeof item === 'string') {
    questionText = item.trim();
  } else if (item && typeof item === 'object') {
    questionText = str(item.question ?? item.text ?? item.prompt ?? item.original ?? item.expression ?? item.sentence);
    suggested = str(
      item.suggested_answer ?? item.answer ?? item.suggested ?? item.correct_answer ?? item.correct ??
      item.paraphrase ?? item.transformed,
    );
  }
  if (!questionText) questionText = `Question ${questionIndex + 1}`;
  if (includeInstructions && exercise?.instructions && questionIndex === 0) {
    questionText = `[Instructions: ${exercise.instructions}]\n\n${questionText}`;
  }

  return {
    question_text: questionText,
    suggested_answer: suggested,
    source_context: exerciseSourceText(exercise, { worksheetAudioTranscript }),
  };
}

/** Context string for verify-open-answers: exercise title followed by its source text. */
export function openExerciseContextString(
  exercise: any,
  fallbackTitle: string,
  opts: { worksheetAudioTranscript?: string | null } = {},
): string {
  const title = str(exercise?.title) || fallbackTitle;
  const source = exerciseSourceText(exercise, opts);
  return [title, source].filter(Boolean).join('\n\n');
}
