/**
 * P1.5: Exercise shape normalizer.
 *
 * The generator (and older saved worksheets) drift between equivalent field
 * names for the same exercise data: `pairs` vs `items`, `word`/`match` vs
 * `term`/`definition`, `words` vs `items` for categorize. Renderers only read
 * one canonical shape, so drifted exercises rendered as empty blocks.
 *
 * This module maps every known legacy shape onto the canonical one used by the
 * renderers. It is pure and non-destructive: unknown fields are preserved and
 * the original object is returned untouched when nothing needs normalizing.
 *
 * Shared by the renderers (src/lib/worksheet/normalizeExercise.ts re-exports it)
 * and by the scorers (itemMastery.ts, closedItemContext.ts), so the student sees
 * and is graded against the same shape. Pure, no I/O, no path aliases.
 */

type AnyExercise = Record<string, any>;

const baseType = (type: string | undefined): string =>
  (type || '').replace('-picture', '').replace('-audio', '');

const toTermDefinition = (raw: any): any => {
  if (!raw || typeof raw !== 'object') return raw;
  if (raw.term !== undefined || raw.definition !== undefined) {
    return {
      ...raw,
      term: raw.term ?? raw.word ?? raw.left ?? '',
      definition: raw.definition ?? raw.match ?? raw.right ?? '',
    };
  }
  const term = raw.word ?? raw.left ?? raw.question ?? raw.prompt;
  const definition = raw.match ?? raw.right ?? raw.answer ?? raw.meaning;
  if (term === undefined && definition === undefined) return raw;
  return { ...raw, term: term ?? '', definition: definition ?? '' };
};

const normText = (v: unknown): string => String(v ?? '').trim().toLowerCase();
const isBlank = (v: unknown): boolean => v === undefined || v === null || String(v).trim() === '';

/**
 * The generator sometimes returns `items: [{ term }]` plus a separate
 * `matches: [{ term, definition, nano_skill }]`. Merge the definitions back into
 * the items (by term, then by position) so the Definitions column is not empty
 * and the answer key can be resolved.
 */
const mergeMatches = (items: any[], matches: any): any[] => {
  if (!Array.isArray(matches) || matches.length === 0) return items;
  const byTerm = new Map<string, any>();
  for (const m of matches) {
    const key = normText(m?.term ?? m?.word ?? m?.left);
    if (key && !byTerm.has(key)) byTerm.set(key, m);
  }
  return items.map((item, i) => {
    if (!item || typeof item !== 'object' || !isBlank(item.definition)) return item;
    const match = byTerm.get(normText(item.term)) ?? (matches.length === items.length ? matches[i] : undefined);
    const definition = match?.definition ?? match?.match ?? match?.right;
    if (isBlank(definition)) return item;
    return {
      ...item,
      definition,
      ...(isBlank(item.nano_skill) && !isBlank(match?.nano_skill) ? { nano_skill: match.nano_skill } : {}),
    };
  });
};

const asArray = (value: any): any[] | null =>
  Array.isArray(value) && value.length > 0 ? value : null;

/** Types whose items are term/definition pairs. */
const PAIR_TYPES = new Set([
  'matching',
  'matching-halves',
  'synonyms',
  'antonyms',
  'synonyms-antonyms',
]);

export function normalizeExerciseShape<T extends AnyExercise>(exercise: T): T {
  if (!exercise || typeof exercise !== 'object') return exercise;

  const type = baseType(exercise.type);
  let next: AnyExercise | null = null;
  const patch = (key: string, value: any) => {
    next = next || { ...exercise };
    next[key] = value;
  };

  if (PAIR_TYPES.has(type)) {
    const source =
      asArray(exercise.items) ||
      asArray(exercise.pairs) ||
      asArray(exercise.words) ||
      asArray(exercise.halves);
    if (source) {
      const items = type === 'matching'
        ? mergeMatches(source.map(toTermDefinition), exercise.matches)
        : source.map(toTermDefinition);
      const changed =
        !Array.isArray(exercise.items) ||
        exercise.items.length !== items.length ||
        items.some((item, i) => item !== exercise.items[i]);
      if (changed) patch('items', items);
    }
  }

  if (type === 'categorize') {
    const source = asArray(exercise.items) || asArray(exercise.words);
    if (source) {
      if (!Array.isArray(exercise.items) || exercise.items.length === 0) patch('items', source);
      if (!Array.isArray(exercise.words) || exercise.words.length === 0) patch('words', source);
    }
  }

  if (type === 'complete-word' || type === 'negative-prefixes') {
    const source = asArray(exercise.words) || asArray(exercise.items);
    if (source && (!Array.isArray(exercise.words) || exercise.words.length === 0)) {
      patch('words', source);
    }
  }

  if (type === 'sentence-transformation') {
    const source = asArray(exercise.sentences) || asArray(exercise.transformations);
    if (source && (!Array.isArray(exercise.sentences) || exercise.sentences.length === 0)) {
      patch('sentences', source);
    }
  }

  if (type === 'gap-text' || type === 'word-order' || type === 'paraphrasing') {
    const source = asArray(exercise.sentences) || asArray(exercise.items);
    if (source && (!Array.isArray(exercise.sentences) || exercise.sentences.length === 0)) {
      patch('sentences', source);
    }
  }

  if (type === 'true-false') {
    const source = asArray(exercise.statements) || asArray(exercise.questions);
    if (source && (!Array.isArray(exercise.statements) || exercise.statements.length === 0)) {
      patch('statements', source);
    }
  }

  return (next || exercise) as T;
}

/** Normalize every exercise in a worksheet-like object. */
export function normalizeWorksheetExercises<T extends AnyExercise>(worksheet: T): T {
  if (!worksheet || !Array.isArray(worksheet.exercises)) return worksheet;
  const exercises = worksheet.exercises.map(normalizeExerciseShape);
  const changed = exercises.some((ex, i) => ex !== worksheet.exercises[i]);
  return changed ? ({ ...worksheet, exercises } as T) : worksheet;
}
