import { describe, expect, it } from 'vitest';
import { toUrls } from '../submit-indexnow.mjs';

describe('toUrls', () => {
  it('expands paths, skips comments and blanks, and de-duplicates', () => {
    expect(toUrls(['# c', '', '/a', 'a', 'https://edooqoo.com/a', '/b.html'])).toEqual([
      'https://edooqoo.com/a',
      'https://edooqoo.com/b.html',
    ]);
  });
  it('refuses URLs on other hosts', () => {
    expect(() => toUrls(['https://example.com/x'])).toThrow(/Refusing/);
  });
});
