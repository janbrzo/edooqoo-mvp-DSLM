// v6.9.29 — Student-facing thank-you email after Welcome Test completion.
// No time promises. Reply-To = teacher email (set on send-side).
export function renderWelcomeTestCompletionEmail(opts: {
  studentName: string;
  teacherName: string;
}): { subject: string; html: string; text: string } {
  const { studentName, teacherName } = opts;
  const subject = `Thanks for completing your Welcome Test, ${studentName}!`;
  const html = `
<div style="font-family: -apple-system, Segoe UI, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
  <h2 style="color: #7c3aed; margin: 0 0 12px;">You're all set, ${studentName} 🎉</h2>
  <p>You've finished your Welcome Test — great job.</p>
  <p>Your teacher <strong>${teacherName}</strong> will review your results and reach out to plan your next steps. In the meantime, no action needed.</p>
  <p style="color: #6b7280; font-size: 12px; margin-top: 24px;">— Edooqoo</p>
</div>`.trim();
  const text = `You're all set, ${studentName}.\n\nYou've finished your Welcome Test — great job.\n\nYour teacher ${teacherName} will review your results and reach out to plan your next steps. In the meantime, no action needed.\n\n— Edooqoo`;
  return { subject, html, text };
}