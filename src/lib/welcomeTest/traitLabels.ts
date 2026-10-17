/**
 * Human labels for the Welcome Test traits (teacher-facing). Pure, no React.
 *
 * Trait keys and values come from supabase/functions/_shared/welcomeTestTraits.ts
 * (`TRAIT_QUESTIONS`); the parity test in __tests__/traitLabels.test.ts fails
 * when a trait or a mapped value has no label here.
 */

export type TraitGroup = 'goals' | 'habits' | 'learning' | 'feelings';

export const TRAIT_GROUP_LABELS: Readonly<Record<TraitGroup, string>> = {
  goals: 'Goals and motivation',
  habits: 'Study habits',
  learning: 'How they learn',
  feelings: 'Feelings about English',
};

export interface TraitMeta {
  label: string;
  group: TraitGroup;
  /** Question id (mirrors TRAIT_QUESTIONS[key].questionId). */
  questionId: string;
  /** Short "based on" note: what the student was asked or shown. */
  basedOn: string;
  /** declared = stated preference, behaviour = reaction to a scenario. */
  kind: 'declared' | 'behaviour';
}

export const TRAIT_META: Readonly<Record<string, TraitMeta>> = {
  self_assessed_level: { label: 'Self-assessed level', group: 'goals', questionId: 'wt_q1', kind: 'declared', basedOn: 'How they describe their own English' },
  motivation_type: { label: 'Motivation', group: 'goals', questionId: 'wt_q3', kind: 'declared', basedOn: 'Why they are learning English' },
  usage_context: { label: 'Where they use English', group: 'goals', questionId: 'wt_q3b', kind: 'declared', basedOn: 'Situations they chose' },
  latent_goal: { label: 'Underlying goal', group: 'goals', questionId: 'wt_q3c', kind: 'behaviour', basedOn: 'Which future scenario they picked' },
  career_english_importance: { label: 'Career importance of English', group: 'goals', questionId: 'wt_q17b', kind: 'behaviour', basedOn: 'Reaction to a job opportunity scenario' },
  learning_timeline: { label: 'Time pressure', group: 'goals', questionId: 'wt_q41b', kind: 'declared', basedOn: 'How soon they need English' },
  weekly_study_time: { label: 'Study time per week', group: 'habits', questionId: 'wt_q5', kind: 'declared', basedOn: 'Time they say they can study' },
  deadline_response: { label: 'Reaction to a deadline', group: 'habits', questionId: 'wt_q5b', kind: 'behaviour', basedOn: 'Reaction to an urgent English task' },
  homework_commitment: { label: 'Homework habits', group: 'habits', questionId: 'wt_q5c', kind: 'behaviour', basedOn: 'What they do with homework when motivation is low' },
  persistence_level: { label: 'Persistence', group: 'habits', questionId: 'wt_q13b', kind: 'behaviour', basedOn: 'What happened when they last tried to learn something' },
  plateau_response: { label: 'Reaction to a plateau', group: 'habits', questionId: 'wt_q13c', kind: 'behaviour', basedOn: 'Reaction to feeling stuck' },
  preferred_input_channel: { label: 'Learns new words by', group: 'learning', questionId: 'wt_q8', kind: 'declared', basedOn: 'How they prefer to meet a new word' },
  reading_strategy: { label: 'Reading strategy', group: 'learning', questionId: 'wt_q15', kind: 'behaviour', basedOn: 'Reaction to a hard message in English' },
  feedback_preference: { label: 'Feedback style', group: 'learning', questionId: 'wt_q42', kind: 'declared', basedOn: 'How they want mistakes handled' },
  correction_preference: { label: 'Correction style', group: 'learning', questionId: 'wt_q7b', kind: 'declared', basedOn: 'How they want to be corrected while speaking' },
  anxiety_level: { label: 'Anxiety about mistakes', group: 'feelings', questionId: 'wt_q7', kind: 'declared', basedOn: 'How they feel about speaking and making mistakes' },
  ambiguity_tolerance: { label: 'Coping with unclear English', group: 'feelings', questionId: 'wt_q4', kind: 'behaviour', basedOn: 'Reaction to not understanding someone' },
  error_attitude: { label: 'Attitude to errors', group: 'feelings', questionId: 'wt_q14', kind: 'behaviour', basedOn: 'Reaction to a restaurant order scenario' },
};

export const TRAIT_ORDER: readonly string[] = Object.keys(TRAIT_META);

const TRAIT_VALUE_LABELS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  self_assessed_level: {
    'A1-A2': 'A1-A2 (basic)', 'A2-B1': 'A2-B1', 'B1-B2': 'B1-B2', 'B2-C1': 'B2-C1', 'C1-C2': 'C1-C2 (advanced)',
  },
  motivation_type: {
    instrumental: 'Practical need (work, exam, relocation)',
    integrative: 'Personal interest (travel, culture, people)',
    mixed: 'Mixed practical and personal',
  },
  usage_context: {
    work_formal: 'At work', travel: 'Travel', online_informal: 'Online and gaming', social: 'With friends and family',
    content_consumption: 'Films, books, podcasts', professional_field: 'In their professional field',
  },
  latent_goal: {
    career_critical: 'Career-driven', lifestyle: 'Lifestyle and enjoyment', travel_lifestyle: 'Travel lifestyle',
  },
  career_english_importance: {
    critical: 'Critical for their career', high: 'High', moderate: 'Moderate', not_career: 'Not for career',
  },
  learning_timeline: {
    urgent_specific: 'Urgent: a specific event soon', ongoing_important: 'Needs it regularly, wants progress in months',
    long_term_steady: 'Long term, steady progress', hobby_growth: 'Hobby and personal growth',
  },
  weekly_study_time: {
    none: 'Almost no extra time', '15_30_min': '15-30 minutes, a few times a week', '1_hour': 'About 1 hour per week',
    '2_3_hours': '2-3 hours per week', '3_plus_hours': 'More than 3 hours per week',
  },
  deadline_response: {
    intense_preparation: 'Panics, then prepares intensively', pragmatic_coping: 'Nervous, asks for help and practises key phrases',
    avoidance: 'Avoids it or hands it over', confident: 'Confident, light preparation',
  },
  homework_commitment: {
    pragmatic: 'Does it quickly to get it done', high: 'Does it carefully', avoidant: 'Postpones and tells the teacher',
    low: 'Starts, then stops', proactive: 'Does it early',
  },
  persistence_level: { high: 'High', medium: 'Medium', low: 'Low' },
  plateau_response: {
    intensity_response: 'Pushes harder', adaptive: 'Changes the method', rest_response: 'Takes a break',
    resilient: 'Accepts it and keeps going', doubt_prone: 'Starts to doubt themselves',
  },
  preferred_input_channel: { visual: 'Seeing it (visual)', auditory: 'Hearing it (auditory)', kinesthetic: 'Using it (hands-on)' },
  reading_strategy: {
    careful_lookup: 'Reads carefully and looks words up', clarification_seeker: 'Asks for clarification',
    context_guesser: 'Guesses from context', struggles_translates: 'Struggles and translates', avoids_uses_ai: 'Avoids reading, uses AI',
  },
  feedback_preference: {
    immediate: 'Wants immediate correction', delayed_discussion: 'Prefers to discuss mistakes later',
    major_only: 'Only major mistakes', written_review: 'Written corrections to review later', self_correct: 'Self-correction with hints',
  },
  correction_preference: {
    immediate: 'Wants immediate correction', delayed: 'Correct after they finish the thought',
    selective: 'Only serious mistakes', rule_based: 'Explain the rule every time', written_summary: 'Written summary after the lesson',
  },
  anxiety_level: { low: 'Low', medium: 'Medium', high: 'High' },
  ambiguity_tolerance: { low: 'Low (gets stuck or stressed)', medium: 'Medium (looks it up)', high: 'High (asks or guesses)' },
  error_attitude: { comfortable: 'Comfortable with mistakes', cautious: 'Cautious', avoidant: 'Avoids speaking when unsure' },
};

/** Values that mean the same in every trait, used for unknown keys and free text. */
const GENERIC_VALUE_LABELS: Readonly<Record<string, string>> = {
  low: 'Low', medium: 'Medium', high: 'High', accurate: 'Accurate', overestimates: 'Overestimates', underestimates: 'Underestimates',
};

/** The mapped values of a trait, exposed for the parity test. */
export function knownTraitValues(key: string): string[] {
  return Object.keys(TRAIT_VALUE_LABELS[key] ?? {});
}

const capitalize = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/** "some_raw_key" -> "Some raw key". */
export function humanizeKey(raw: string): string {
  return capitalize(raw.replace(/_/g, ' ').replace(/\s+/g, ' ').trim());
}

export function traitLabel(key: string): string {
  return TRAIT_META[key]?.label ?? humanizeKey(key);
}

export function traitBasedOn(key: string): string | null {
  return TRAIT_META[key]?.basedOn ?? null;
}

/** Label for one value; multi-select values ("work_formal, travel") are labelled per part. */
export function traitValueLabel(key: string, value: unknown): string {
  if (value === null || value === undefined || value === '') return '-';
  const text = String(value);
  const table = TRAIT_VALUE_LABELS[key];
  const one = (part: string): string => {
    const p = part.trim();
    return table?.[p] ?? GENERIC_VALUE_LABELS[p] ?? humanizeKey(p);
  };
  return text.includes(', ') ? text.split(', ').map(one).join(', ') : one(text);
}

/** Traits shown on the profile card: keys starting with "__" are metadata. */
export function visibleTraitKeys(keys: Iterable<string>): string[] {
  const set = new Set([...keys].filter((k) => !k.startsWith('__')));
  const known = TRAIT_ORDER.filter((k) => set.has(k));
  const extra = [...set].filter((k) => !(k in TRAIT_META)).sort();
  return [...known, ...extra];
}

// ---------------------------------------------------------------------------
// Evidence and confidence
// ---------------------------------------------------------------------------

export interface TraitEvidenceEntry {
  question_id?: string;
  single_item?: boolean;
}

export interface TraitConfidence {
  level: 'low' | 'medium';
  /** Chip text, e.g. "Low confidence (1 answer)". */
  chip: string;
  /** Note under the value, e.g. "Based on 1 answer". */
  note: string;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const LOW: TraitConfidence = { level: 'low', chip: 'Low confidence (1 answer)', note: 'Based on 1 answer' };
const MEDIUM: TraitConfidence = { level: 'medium', chip: 'Medium confidence (several answers)', note: 'Based on several answers' };

/**
 * Confidence of one trait. `evidence` is raw_answers.trait_evidence (may be
 * absent on old profiles): then a trait that maps to one question is a single
 * answer. A trait with neither evidence nor a known question gets null.
 */
export function traitConfidence(key: string, evidence: unknown): TraitConfidence | null {
  const entry = isRecord(evidence) && isRecord(evidence[key]) ? (evidence[key] as TraitEvidenceEntry) : null;
  if (entry && entry.single_item === false) return MEDIUM;
  if (entry && entry.single_item === true) return LOW;
  return key in TRAIT_META ? LOW : null;
}

// ---------------------------------------------------------------------------
// Self-awareness and "I don't know"
// ---------------------------------------------------------------------------

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** One line on self_awareness_score (share of wrong-or-unknown skill items answered "I don't know"). */
export function interpretSelfAwareness(score: unknown): string {
  if (!isNum(score)) return 'No signal: no skill question was answered wrong or marked "I don\'t know".';
  if (score >= 60) return 'Often admits not knowing instead of guessing: good self-monitoring.';
  if (score >= 20) return 'Sometimes admits not knowing, sometimes guesses.';
  return 'Mostly guesses instead of saying "I don\'t know": check real understanding in class.';
}

export const MANY_IDK_THRESHOLD = 8;

/** One line on the "I don't know" counts. */
export function interpretIdk(total: unknown, skill: unknown): string {
  const t = isNum(total) ? total : 0;
  const s = isNum(skill) ? skill : 0;
  if (t === 0) return 'Never chose "I don\'t know".';
  const counts = `${t} "I don't know" ${t === 1 ? 'answer' : 'answers'} in total, ${s} on skill questions.`;
  if (t >= MANY_IDK_THRESHOLD) return `${counts} A high count can mean low confidence or low engagement, not only gaps.`;
  return `${counts} Honest about gaps rather than guessing.`;
}

// ---------------------------------------------------------------------------
// Self-assessment accuracy (profile.level_confidence)
// ---------------------------------------------------------------------------

export const SELF_ASSESSMENT_ACCURACY_LABEL = 'Self-assessment accuracy';

const ACCURACY_TEXT: Readonly<Record<string, string>> = {
  accurate: 'Accurate',
  overestimates: 'Overestimates their level',
  underestimates: 'Underestimates their level',
};

export function selfAssessmentAccuracyLabel(value: unknown): string {
  return typeof value === 'string' && ACCURACY_TEXT[value] ? ACCURACY_TEXT[value] : 'Unknown';
}

// ---------------------------------------------------------------------------
// Divergence text
// ---------------------------------------------------------------------------

const SNAKE_VALUE_TEXT: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const table of Object.values(TRAIT_VALUE_LABELS)) {
    for (const [value, label] of Object.entries(table)) {
      if (value.includes('_') && !m.has(value)) m.set(value, label.charAt(0).toLowerCase() + label.slice(1));
    }
  }
  return m;
})();

/** Replaces raw snake_case tokens in server divergence text with readable wording. */
export function humanizeDivergenceText(text: string): string {
  return text.replace(/\b[a-z0-9]+(?:_[a-z0-9]+)+\b/g, (token) => SNAKE_VALUE_TEXT.get(token) ?? token.replace(/_/g, ' '));
}

export interface DivergenceText {
  declared: string;
  observed: string;
  /** One sentence: "Declared: X. Observed: Y." */
  sentence: string;
}

export function formatDivergenceText(d: { declared?: unknown; observed?: unknown }): DivergenceText | null {
  const declared = typeof d.declared === 'string' ? d.declared.trim() : '';
  const observed = typeof d.observed === 'string' ? d.observed.trim() : '';
  if (!declared || !observed) return null;
  const dec = capitalize(humanizeDivergenceText(declared));
  const obs = humanizeDivergenceText(observed);
  return { declared: dec, observed: obs, sentence: `Declared: ${dec}. Observed: ${obs}.` };
}
