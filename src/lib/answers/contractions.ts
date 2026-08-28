/**
 * English contraction dictionary used by the shared answer matcher.
 *
 * The matcher expands BOTH the student answer and the answer key to their
 * long forms before comparing, so `don't` and `do not` are equivalent in
 * either direction.
 */

/** Contracted form -> expanded form. Keys must be lowercase and use `'`. */
export const CONTRACTION_MAP: Record<string, string> = {
  // negations
  "don't": 'do not',
  "doesn't": 'does not',
  "didn't": 'did not',
  "isn't": 'is not',
  "aren't": 'are not',
  "wasn't": 'was not',
  "weren't": 'were not',
  "haven't": 'have not',
  "hasn't": 'has not',
  "hadn't": 'had not',
  "won't": 'will not',
  "wouldn't": 'would not',
  "can't": 'can not',
  cannot: 'can not',
  "couldn't": 'could not',
  "shouldn't": 'should not',
  "mustn't": 'must not',
  "mightn't": 'might not',
  "needn't": 'need not',
  "shan't": 'shall not',
  "ain't": 'is not',

  // be / have / will / would
  "i'm": 'i am',
  "i've": 'i have',
  "i'll": 'i will',
  "i'd": 'i would',
  "you're": 'you are',
  "you've": 'you have',
  "you'll": 'you will',
  "you'd": 'you would',
  "he's": 'he is',
  "he'll": 'he will',
  "he'd": 'he would',
  "she's": 'she is',
  "she'll": 'she will',
  "she'd": 'she would',
  "it's": 'it is',
  "it'll": 'it will',
  "it'd": 'it would',
  "we're": 'we are',
  "we've": 'we have',
  "we'll": 'we will',
  "we'd": 'we would',
  "they're": 'they are',
  "they've": 'they have',
  "they'll": 'they will',
  "they'd": 'they would',
  "that's": 'that is',
  "that'll": 'that will',
  "there's": 'there is',
  "there're": 'there are',
  "here's": 'here is',
  "who's": 'who is',
  "who've": 'who have',
  "what's": 'what is',
  "where's": 'where is',
  "when's": 'when is',
  "why's": 'why is',
  "how's": 'how is',
  "let's": 'let us',
};

/**
 * Generic suffix expansions applied to any word not covered by the map
 * (e.g. `Peter's going` -> `peter is going`, `students'll` -> `students will`).
 * Note: possessive `'s` is intentionally NOT expanded here — it is handled by
 * the map only for known pronouns, to avoid mangling `John's book`.
 */
const SUFFIX_RULES: Array<[RegExp, string]> = [
  [/(\w+)n't\b/g, '$1 not'],
  [/(\w+)'ll\b/g, '$1 will'],
  [/(\w+)'ve\b/g, '$1 have'],
  [/(\w+)'re\b/g, '$1 are'],
  [/(\w+)'d\b/g, '$1 would'],
];

/** Words produced by `n't` splitting that need repair (e.g. `wo not`). */
const SPLIT_REPAIRS: Array<[RegExp, string]> = [
  [/\bwo not\b/g, 'will not'],
  [/\bca not\b/g, 'can not'],
  [/\bsha not\b/g, 'shall not'],
  [/\bai not\b/g, 'is not'],
];

/**
 * Expands every contraction in an already lowercased, apostrophe-normalized
 * string. Idempotent: running it twice yields the same result.
 */
export const expandContractions = (text: string): string => {
  if (!text) return '';

  let out = ` ${text} `;

  // 1. Whole-token replacements from the explicit map (longest keys first so
  //    that e.g. "shouldn't" wins over a generic rule).
  const keys = Object.keys(CONTRACTION_MAP).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    out = out.replace(new RegExp(`(?<![\\w'])${escaped}(?![\\w'])`, 'g'), CONTRACTION_MAP[key]);
  }

  // 2. Generic suffix rules for tokens outside the map.
  for (const [pattern, replacement] of SUFFIX_RULES) {
    out = out.replace(pattern, replacement);
  }

  // 3. Repair malformed stems left by the `n't` rule.
  for (const [pattern, replacement] of SPLIT_REPAIRS) {
    out = out.replace(pattern, replacement);
  }

  return out.replace(/\s+/g, ' ').trim();
};
