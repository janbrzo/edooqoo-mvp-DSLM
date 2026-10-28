import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (rel: string) => readFileSync(join(__dirname, '..', '..', '..', rel), 'utf8');

describe('worksheet form mobile fit (390 px) and submit lock', () => {
  const form = read('components/WorksheetForm/index.tsx');

  it('mode tooltips take no layout space unless hovered on desktop', () => {
    // An always-rendered nowrap tooltip made the page 442 px wide on mobile.
    expect(form).not.toMatch(/opacity-0 group-hover:opacity-100[^"]*whitespace-nowrap/);
    expect(form.match(/hidden md:group-hover:block/g)?.length).toBe(3);
  });

  it('shows the active mode hint as text on touch devices', () => {
    expect(form).toMatch(/isMobile && \(\s*<p[^>]*>\s*\{MODE_HINTS\[selectionMode\]\}/);
  });

  it('disables the Generate button while a submission is in flight', () => {
    expect(form).toMatch(/<Button type="submit" disabled=\{submitting\}/);
    expect(form).toMatch(/if \(submitting\) return;/);
  });

  it('keeps the generating modal inside the viewport', () => {
    const modal = read('components/GeneratingModal.tsx');
    expect(modal).not.toMatch(/\bmx-4\b/);
    expect(modal).toMatch(/overflow-x-hidden/);
  });
});
