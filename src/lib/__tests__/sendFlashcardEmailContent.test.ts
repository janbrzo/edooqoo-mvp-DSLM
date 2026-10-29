import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildFlashcardEmail,
  buildHubUrl,
  buildSetUrl,
  cleanText,
  normalizeBaseUrl,
  validateRecipientEmail,
} from '../../../supabase/functions/send-flashcard-email/emailContent';

// Reference implementation of _shared/auth.ts escapeHtml (that module imports from esm.sh).
const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

describe('validateRecipientEmail', () => {
  it('accepts and trims a plain address', () => {
    expect(validateRecipientEmail('  a.b+c@example.co.uk ')).toBe('a.b+c@example.co.uk');
    expect(validateRecipientEmail('a@b.com\r\n')).toBe('a@b.com');
  });
  it.each([
    'a@b.com, c@d.com', 'a@b.com;c@d.com', 'a@b.com\nBcc: x@y.com', 'a b@c.com',
    '<a@b.com>', 'Name <a@b.com>', 'nope', '@b.com', 'a@b', '', '   ', 'a@b.com\u0000',
  ])('rejects %j', (v) => expect(validateRecipientEmail(v)).toBeNull());
  it('rejects non strings and overlong values', () => {
    expect(validateRecipientEmail(undefined)).toBeNull();
    expect(validateRecipientEmail(['a@b.com'])).toBeNull();
    expect(validateRecipientEmail(`${'a'.repeat(250)}@b.com`)).toBeNull();
  });
});

describe('url building', () => {
  it('strips trailing slashes and defaults the base', () => {
    expect(normalizeBaseUrl('https://edooqoo.com///')).toBe('https://edooqoo.com');
    expect(normalizeBaseUrl(undefined)).toBe('https://edooqoo.com');
  });
  it('builds the set and hub routes the app serves', () => {
    expect(buildSetUrl('https://edooqoo.com/', 'abc')).toBe('https://edooqoo.com/flashcards/abc');
    expect(buildSetUrl('https://edooqoo.com', '../x?y=1')).toBe('https://edooqoo.com/flashcards/..%2Fx%3Fy%3D1');
    expect(buildHubUrl('https://edooqoo.com', 'tok')).toBe('https://edooqoo.com/my/tok/flashcards');
  });
});

describe('buildFlashcardEmail', () => {
  const evil = '"><script>alert(1)</script>';
  it('escapes every interpolated value', () => {
    const { html, subject } = buildFlashcardEmail(
      { isAllSets: false, teacherName: evil, setTitle: evil, url: `https://edooqoo.com/flashcards/${evil}` }, esc);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(subject).not.toMatch(/[\r\n]/);
  });
  it('keeps the expiry copy and both variants', () => {
    const one = buildFlashcardEmail({ isAllSets: false, teacherName: 'Ann', setTitle: 'Verbs', url: 'https://edooqoo.com/flashcards/t' }, esc);
    const all = buildFlashcardEmail({ isAllSets: true, teacherName: '', setTitle: '', url: 'https://edooqoo.com/my/t/flashcards' }, esc);
    expect(one.html).toContain('This link will remain active for 1 year');
    expect(all.html).toContain('This link will remain active for 1 year');
    expect(one.subject).toBe('Ann shared flashcards with you: Verbs');
    expect(all.subject).toBe('Your teacher shared your flashcard dashboard with you');
  });
  it('caps names and strips newlines', () => {
    expect(cleanText('x'.repeat(500)).length).toBe(120);
    expect(cleanText('a\r\nBcc: b')).toBe('a Bcc: b');
  });
});

describe('send-flashcard-email index', () => {
  const src = readFileSync('supabase/functions/send-flashcard-email/index.ts', 'utf8');
  it('requires a teacher or service caller and never trusts Origin or body URLs', () => {
    expect(src).toMatch(/resolveCaller\(req\)/);
    expect(src).toMatch(/teacherIdOf\(caller\)/);
    expect(src).not.toMatch(/headers\.get\(.origin.\)/i);
    expect(src).not.toMatch(/portalUrl/);
    expect(src).not.toMatch(/console\.log/);
  });
});
