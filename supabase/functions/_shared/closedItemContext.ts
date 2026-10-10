/**
 * Closed-exercise context extractor for AI evaluation.
 *
 * Turns one closed item (multiple choice, true/false, matching, blanks, ...)
 * into a self-contained payload for `verify-open-answers`: the question with
 * its options, the student's answer resolved to readable text (letters are
 * mapped back through the same seeded shuffle the renderers use) and the
 * answer key as `suggested_answer` (ground truth anchor for the model).
 *
 * Field fallbacks MUST mirror `calculateItemMastery` in masteryCalculator.ts,
 * otherwise the AI and the deterministic DSLM score read different keys.
 * Shared by the client (re-exported from src/lib/answers/closedItemContext.ts)
 * and process-pending-ai-evaluations. Pure, no I/O, no path aliases. Returns null when the item or the answer cannot be resolved.
 */
/**
 * Copy of `shuffleArrayWithSeed` in src/utils/masteryCalculator.ts (Edge Functions
 * cannot import from src/). Parity is enforced by closedItemContext.test.ts.
 */
export function shuffleArrayWithSeed(array: any[], seed: string): any[] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash << 5) - hash + seed.charCodeAt(i);
    hash = hash & hash;
  }
  const random = () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 1000) / 1000;
  };
  const out = [...array];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export interface ClosedItemContext {
  question_text: string;
  student_answer: string;
  suggested_answer: string;
}

const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v).trim());
const isEmpty = (v: unknown) => v === undefined || v === null || str(v) === '';
const isLetter = (v: unknown): v is string => typeof v === 'string' && /^[A-Z]$/i.test(v.trim());
const letterIndex = (v: string) => v.trim().toUpperCase().charCodeAt(0) - 65;
const textOf = (v: any): string =>
  typeof v === 'string' ? v : str(v?.text ?? v?.word ?? v?.sentence ?? v?.statement ?? v?.question ?? '');

/** Mirrors the halves shuffle in calculateItemMastery / ExerciseMatchingHalves. */
const shuffleIndicesWithSeed = (length: number, seedStr: string): number[] => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash = hash & hash;
  }
  const random = () => {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return (hash % 1000) / 1000;
  };
  const indices = Array.from({ length }, (_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices;
};

const build = (question: string, student: unknown, key: unknown): ClosedItemContext | null => {
  if (isEmpty(student) || isEmpty(key)) return null;
  return { question_text: question, student_answer: str(student), suggested_answer: str(key) };
};

export function buildClosedItemContext(
  exerciseType: string,
  exerciseData: any,
  itemIndex: number,
  allAnswers: Record<string | number, any>,
): ClosedItemContext | null {
  if (!exerciseData) return null;
  const raw = allAnswers?.[itemIndex];

  try {
    // Multiple choice (all variants)
    if (exerciseType.startsWith('multiple-choice')) {
      const q = exerciseData.questions?.[itemIndex];
      if (!q || !Array.isArray(q.options)) return null;
      const options = q.options.map((o: any, i: number) => {
        const label = str(o?.label) || String.fromCharCode(65 + i);
        return { label, text: typeof o === 'string' ? o : str(o?.text ?? o?.value), correct: o?.correct === true };
      });
      const correct = options.find((o: any) => o.correct);
      if (!correct) return null;
      let chosen = options.find((o: any) => o.text === str(raw) || o.label === str(raw));
      if (!chosen && isLetter(raw)) chosen = options[letterIndex(raw)];
      const optionList = options.map((o: any) => `${o.label}) ${o.text}`).join('; ');
      return build(
        `${textOf(q)}\nOptions: ${optionList}`,
        chosen ? `${chosen.label}) ${chosen.text}` : raw,
        `${correct.label}) ${correct.text}`,
      );
    }

    // True / False (all variants)
    if (exerciseType.startsWith('true-false')) {
      const s = exerciseData.statements?.[itemIndex];
      if (!s || typeof s.isTrue !== 'boolean') return null;
      const norm = raw === true || raw === 'true' ? 'True' : raw === false || raw === 'false' ? 'False' : raw;
      return build(`True or false: ${textOf(s)}`, norm, s.isTrue ? 'True' : 'False');
    }

    // Matching (letter answers resolved through the renderer shuffle)
    if (exerciseType === 'matching') {
      const items = exerciseData.items;
      const item = items?.[itemIndex];
      if (!item) return null;
      const key = item.correct_match || item.match || item.definition;
      let student: unknown = raw;
      if (isLetter(raw)) {
        const shuffled = shuffleArrayWithSeed(items, items.map((i: any) => i.term).join('|'));
        const picked = shuffled[letterIndex(raw)];
        student = picked ? picked.correct_match || picked.match || picked.definition : raw;
      }
      return build(`Match the term: ${str(item.term)}`, student, key);
    }

    // Matching halves
    if (exerciseType === 'matching-halves') {
      const halves = exerciseData.sentence_halves;
      const half = halves?.[itemIndex];
      if (!half) return null;
      let student: unknown = raw;
      if (isLetter(raw)) {
        const seed = `halves-${halves.map((h: any) => str(h.first_half)).join('|')}`;
        const order = shuffleIndicesWithSeed(halves.length, seed);
        const pickedIdx = order[letterIndex(raw)];
        student = pickedIdx !== undefined ? halves[pickedIdx]?.second_half : raw;
      }
      return build(`Complete the sentence: ${str(half.first_half)} ...`, student, half.second_half);
    }

    // Synonyms / antonyms
    if (exerciseType === 'synonyms' || exerciseType === 'antonyms' || exerciseType === 'synonyms-antonyms') {
      const items = exerciseData.items;
      const item = items?.[itemIndex];
      if (!item) return null;
      const key = item.answer || item.synonym || item.antonym || item.definition;
      let student: unknown = raw;
      if (item.definition && isLetter(raw)) {
        const shuffled = shuffleArrayWithSeed(items, `syn-${items.map((i: any) => i.term).join('|')}`);
        student = shuffled[letterIndex(raw)]?.definition ?? raw;
      }
      const kind = exerciseType === 'antonyms' ? 'an antonym' : exerciseType === 'synonyms' ? 'a synonym' : 'a synonym or antonym';
      return build(`Give ${kind} for: ${str(item.term ?? item.word)}`, student, key);
    }

    // Fill in blanks (incl. audio)
    if (exerciseType.startsWith('fill-in-blanks')) {
      const s = exerciseData.sentences?.[itemIndex];
      const key =
        exerciseType === 'fill-in-blanks-audio' && exerciseData.answers?.[itemIndex]
          ? exerciseData.answers[itemIndex]
          : s && typeof s !== 'string' ? s.answer || s.correct || s.missing_word : null;
      return build(`Fill in the blank: ${textOf(s)}`, raw, key);
    }

    // Gap text (single or multi-blank composite keys `${i}_${b}`)
    if (exerciseType === 'gap-text') {
      const s = exerciseData.sentences?.[itemIndex];
      if (!s) return null;
      const text = textOf(s);
      const blanks = (text.match(/_+/g) || []).length;
      const key = typeof s === 'string' ? null : s.answer || s.correct || s.missing_word;
      if (blanks > 1) {
        const parts: string[] = [];
        for (let b = 0; b < blanks; b++) parts.push(str(allAnswers?.[`${itemIndex}_${b}`]));
        if (parts.every((p) => p === '')) return null;
        return build(`Fill in the gaps (in order, separated by " / "): ${text}`, parts.join(' / '), key);
      }
      return build(`Fill in the gap: ${text}`, raw, key);
    }

    // Categorize (student answer is a category index)
    if (exerciseType === 'categorize') {
      const cats = exerciseData.categories;
      const item = exerciseData.items?.[itemIndex];
      if (!Array.isArray(cats) || !item) return null;
      const word = textOf(item);
      const catName = (c: any) => (typeof c === 'string' ? c : str(c?.name ?? c?.title ?? c?.category));
      const correctCat = cats.find((c: any) =>
        (c?.correct_items || []).some((ci: any) => textOf(ci).toLowerCase() === word.toLowerCase()),
      );
      const idx = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
      const student = !isNaN(idx) && cats[idx] ? catName(cats[idx]) : raw;
      return build(
        `Put "${word}" into the right category. Categories: ${cats.map(catName).join('; ')}`,
        student,
        correctCat ? catName(correctCat) : null,
      );
    }

    // Complete word
    if (exerciseType === 'complete-word') {
      const w = exerciseData.words?.[itemIndex];
      if (!w) return null;
      const key = typeof w === 'string' ? w : w.word || w.complete || w.complete_word;
      const prompt = typeof w === 'string' ? '' : str(w.incomplete ?? w.partial ?? w.hint ?? w.sentence);
      return build(`Complete the word${prompt ? `: ${prompt}` : ''}`, raw, key);
    }

    // Negative prefixes
    if (exerciseType === 'negative-prefixes') {
      const w = exerciseData.words?.[itemIndex];
      if (!w || typeof w === 'string') return null;
      return build(`Add the correct negative prefix to: ${str(w.word ?? w.base ?? w.root)}`, raw, w.prefix || w.answer);
    }

    // Odd one out
    if (exerciseType === 'odd-one-out') {
      const q = exerciseData.questions?.[itemIndex];
      if (!q) return null;
      const words = Array.isArray(q.words) ? q.words.map(textOf).join(', ') : textOf(q);
      return build(`Which word is the odd one out? ${words}`, raw, q.odd_word || q.correct || q.correct_answer);
    }

    // Error correction
    if (exerciseType === 'error-correction') {
      const s = exerciseData.sentences?.[itemIndex];
      if (!s) return null;
      const source = typeof s === 'string' ? s : str(s.incorrect || s.text);
      const key = typeof s === 'string' ? null : s.answer || s.correction || s.correct || s.corrected || s.correct_sentence;
      return build(`Correct the error: ${source}`, raw, key);
    }

    // Word order
    if (exerciseType === 'word-order') {
      const s = exerciseData.sentences?.[itemIndex];
      if (!s) return null;
      const scrambled = Array.isArray(s.words) ? s.words.join(' / ') : str(s.scrambled ?? s.text);
      return build(`Put the words in the correct order: ${scrambled}`, raw, s.correct_order || s.correct || s.answer);
    }
  } catch {
    return null;
  }

  return null;
}
