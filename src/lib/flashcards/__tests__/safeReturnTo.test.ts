import { describe, it, expect } from 'vitest';
import { safeReturnTo } from '../safeReturnTo';

const FALLBACK = '/';

describe('safeReturnTo', () => {
  it.each([
    ['javascript:alert(1)'],
    ['JaVaScRiPt:alert(1)'],
    ['//evil.com'],
    ['/\\evil.com'],
    ['\\evil'],
    ['https://evil.com'],
    ['/%2F%2Fevil.com'],
    ['/%2f/evil.com'],
    ['/\tjavascript:alert(1)'],
    ['/\njavascript:alert(1)'],
    ['/%09/evil.com'],
    ['/%5Cevil.com'],
    ['data:text/html,x'],
    ['vbscript:msgbox(1)'],
    ['/%E0%A4%A'],
    [''],
    [null],
    [undefined],
  ])('rejects %j', (raw) => {
    expect(safeReturnTo(raw as string | null | undefined, FALLBACK)).toBe(FALLBACK);
  });

  it('accepts a relative flashcards path', () => {
    expect(safeReturnTo('/my/abc/flashcards', FALLBACK)).toBe('/my/abc/flashcards');
  });

  it('accepts a relative path with a query string', () => {
    expect(safeReturnTo('/my/abc/flashcards?x=1', FALLBACK)).toBe('/my/abc/flashcards?x=1');
  });

  it('returns the supplied fallback', () => {
    expect(safeReturnTo(null, '/dash')).toBe('/dash');
  });
});
