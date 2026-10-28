import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { isAccessRevokedError } from '../homeworkStateRpc';

const hook = readFileSync('src/hooks/useInteractiveHomework.tsx', 'utf8');
const page = readFileSync('src/pages/HomeworkPage.tsx', 'utf8');
const review = readFileSync('src/pages/HomeworkReviewPage.tsx', 'utf8');

describe('isAccessRevokedError', () => {
  it('recognises the server refusing the e-mail', () => {
    expect(isAccessRevokedError({ code: '42501' })).toBe(true);
    expect(isAccessRevokedError({ code: 'P0001' })).toBe(false);
    expect(isAccessRevokedError(null)).toBe(false);
  });
});

describe('student identity on the homework pages', () => {
  it('a refused e-mail is terminal: no endless retry, the remembered e-mail is dropped', () => {
    expect(hook).toMatch(/isAccessRevokedError\(error\)/);
    expect(hook).toMatch(/return true; \/\/ terminal/);
    expect(page).toMatch(/localStorage\.removeItem\(`homework_email_\$\{token\}`\)[\s\S]*setVerifiedEmail\(null\)/);
  });

  it('the review page reads the stored answers with the normalised e-mail', () => {
    expect(review).toMatch(/\.eq\('student_email', studentEmail\.trim\(\)\.toLowerCase\(\)\)/);
  });
});
