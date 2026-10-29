/**
 * Pure helpers for send-flashcard-email (no Deno or network imports so Vitest
 * can load them). HTML escaping is injected by the caller (the shared
 * `escapeHtml` from `_shared/auth.ts`).
 */

export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 120;
export const DEFAULT_APP_BASE_URL = 'https://edooqoo.com';

export type Escape = (value: unknown) => string;

// Single address only: no whitespace, commas, semicolons, angle brackets or control chars.
const SIMPLE_EMAIL = /^[^\s@,;<>()[\]\\"':]+@[^\s@,;<>()[\]\\"':]+\.[^\s@,;<>()[\]\\"':.]{2,}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

/** Returns the trimmed address, or null when it is not one plain email address. */
export function validateRecipientEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const email = value.trim();
  if (!email || email.length > MAX_EMAIL_LENGTH) return null;
  if (CONTROL_CHARS.test(email)) return null;
  if (!SIMPLE_EMAIL.test(email)) return null;
  return email;
}

/** Trim, strip control characters, collapse whitespace and cap the length. */
export function cleanText(value: unknown, max = MAX_NAME_LENGTH): string {
  if (typeof value !== 'string') return '';
  // eslint-disable-next-line no-control-regex
  const text = value.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > max ? text.slice(0, max).trim() : text;
}

export function normalizeBaseUrl(raw: string | undefined | null): string {
  const base = (raw || DEFAULT_APP_BASE_URL).trim().replace(/\/+$/, '');
  return base || DEFAULT_APP_BASE_URL;
}

export function buildSetUrl(baseUrl: string, shareToken: string): string {
  return `${normalizeBaseUrl(baseUrl)}/flashcards/${encodeURIComponent(shareToken)}`;
}

/** Same route the teacher UI shows as the student hub flashcards link. */
export function buildHubUrl(baseUrl: string, hubToken: string): string {
  return `${normalizeBaseUrl(baseUrl)}/my/${encodeURIComponent(hubToken)}/flashcards`;
}

export interface FlashcardEmailInput {
  isAllSets: boolean;
  teacherName: string;
  setTitle: string;
  url: string;
}

export function buildFlashcardEmail(input: FlashcardEmailInput, esc: Escape): { subject: string; html: string } {
  const teacher = cleanText(input.teacherName) || 'Your teacher';
  const title = cleanText(input.setTitle);
  const teacherHtml = esc(teacher);
  const urlHtml = esc(input.url);

  const subject = (input.isAllSets
    ? `${teacher} shared your flashcard dashboard with you`
    : `${teacher} shared flashcards with you: ${title}`
  ).replace(/[\r\n]+/g, ' ');

  const html = input.isAllSets
    ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed;">📚 Your Flashcard Dashboard</h2>
          <p>Hello,</p>
          <p><strong>${teacherHtml}</strong> has shared all your flashcard sets with you.</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">Access All Your Sets</h3>
            <p style="margin: 0; color: #4b5563;">Click below to view and study all your flashcard sets in one place.</p>
          </div>
          <p>Click the button below to access your learning dashboard:</p>
          <a href="${urlHtml}" 
             style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
            Open Dashboard
          </a>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This link will remain active for 1 year. You can access your flashcards anytime.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            Or copy and paste this URL: ${urlHtml}
          </p>
        </div>
      `
    : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #7c3aed;">📚 New Flashcard Set Shared!</h2>
          <p>Hello,</p>
          <p><strong>${teacherHtml}</strong> has shared a flashcard set with you:</p>
          <div style="background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #1f2937;">${esc(title)}</h3>
          </div>
          <p>Click the button below to start learning:</p>
          <a href="${urlHtml}" 
             style="display: inline-block; background: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; margin: 20px 0;">
            Start Learning
          </a>
          <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
            This link will remain active for 1 year. You can practice these flashcards as many times as you like.
          </p>
          <p style="color: #6b7280; font-size: 12px; margin-top: 20px;">
            Or copy and paste this URL: ${urlHtml}
          </p>
        </div>
      `;

  return { subject, html };
}
