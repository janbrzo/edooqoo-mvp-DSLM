/**
 * An answer value as it may be stored. A NUL character (U+0000) cannot be stored in the jsonb
 * answers column: the whole save request failed with a database error and the student only ever
 * saw "we will keep trying". Over-long text is cut so one pasted document cannot degrade the
 * evaluation of the neighbouring answers.
 */
export const MAX_ANSWER_CHARS = 20_000;

export function sanitizeAnswerValue<T>(value: T): T {
  if (typeof value === 'string') {
    // eslint-disable-next-line no-control-regex
    const clean = value.replace(/\u0000/g, '');
    return (clean.length > MAX_ANSWER_CHARS ? clean.slice(0, MAX_ANSWER_CHARS) : clean) as unknown as T;
  }
  if (Array.isArray(value)) return value.map((v) => sanitizeAnswerValue(v)) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeAnswerValue(v)]),
    ) as unknown as T;
  }
  return value;
}
