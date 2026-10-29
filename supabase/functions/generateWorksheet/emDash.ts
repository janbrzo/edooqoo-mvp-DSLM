/* eslint-disable @typescript-eslint/no-explicit-any */
// Em dash sanitizer. English teacher-facing text must not contain U+2014 (it
// reads as AI-generated), so model output is cleaned before it is normalised
// and saved, and client-supplied context that is fed back into the prompt
// (audio transcript, image description) is cleaned before the prompt is built.
//
// Rule, in this order (an en dash U+2013 is never touched):
//   digit EM DASH digit         -> en dash (a numeric range)
//   EM DASH at the start/end    -> removed together with the spaces around it
//   EM DASH before , . ; : ! ?  -> removed together with the spaces around it
//   anything else               -> ", " (the dash and the spaces around it)
// so "a — b" and "a—b" both become "a, b".

const EM_DASH = "—";

/** Number of em dashes in `text` (also the `&mdash;` / `&#8212;` entity forms). */
export function countEmDashesInText(text: string): number {
  return (text.match(/—|&mdash;|&#8212;/gi) || []).length;
}

/** Cleans one plain string. */
export function replaceEmDashes(text: string): string {
  if (!/—|&mdash;|&#8212;/i.test(text)) return text;
  return text
    .replace(/&mdash;|&#8212;/gi, EM_DASH)
    .replace(/(\d)—(?=\d)/g, "$1–")
    .replace(/^\s*—\s*/, "")
    .replace(/\s*—\s*$/, "")
    .replace(/\s*—\s*(?=[,.;:!?])/g, "")
    .replace(/\s*—\s*/g, ", ");
}

/**
 * Cleans the text of a JSON document in place of its strings: the same rule, with
 * a string's own start (`"`) and end (`"`) taking the place of the text's, and
 * the `—` escape treated like the character.
 */
export function replaceEmDashesInJsonText(json: string): string {
  if (!/—|\\u2014|&mdash;|&#8212;/i.test(json)) return json;
  return json
    .replace(/\\u2014/gi, EM_DASH)
    .replace(/&mdash;|&#8212;/gi, EM_DASH)
    .replace(/(\d)—(?=\d)/g, "$1–")
    .replace(/(?<=(?<!\\)")\s*—\s*/g, "")
    .replace(/\s*—\s*(?=(?<!\\)")/g, "")
    .replace(/\s*—\s*(?=[,.;:!?])/g, "")
    .replace(/\s*—\s*/g, ", ");
}

/** Counts the em dashes in every string of a value (no change made). */
export function countEmDashes(value: unknown): number {
  if (typeof value === "string") return countEmDashesInText(value);
  if (Array.isArray(value)) return value.reduce((sum: number, item) => sum + countEmDashes(item), 0);
  if (value && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).reduce((sum: number, item) => sum + countEmDashes(item), 0);
  }
  return 0;
}

/**
 * Cleans every string of a parsed value in place and returns how many em
 * dashes were replaced.
 */
export function sanitizeEmDashes(value: unknown): number {
  let replaced = 0;
  const visit = (node: any): void => {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === "string") {
          const clean = replaceEmDashes(node[i]);
          if (clean !== node[i]) {
            replaced += countEmDashesInText(node[i]);
            node[i] = clean;
          }
        } else if (node[i] && typeof node[i] === "object") visit(node[i]);
      }
    } else if (node && typeof node === "object") {
      for (const key of Object.keys(node)) {
        const item = node[key];
        if (typeof item === "string") {
          const clean = replaceEmDashes(item);
          if (clean !== item) {
            replaced += countEmDashesInText(item);
            node[key] = clean;
          }
        } else if (item && typeof item === "object") visit(item);
      }
    }
  };
  visit(value);
  return replaced;
}
