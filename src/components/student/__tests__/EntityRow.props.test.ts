import { describe, it, expect } from 'vitest';
import { resolveRowClasses } from '../EntityRow';

describe('resolveRowClasses — interaction mode', () => {
  it('returns link mode when href is present', () => {
    expect(resolveRowClasses({ href: '/worksheet/1' }).mode).toBe('link');
  });

  it('returns button mode when only onClick is present', () => {
    expect(resolveRowClasses({ onClick: () => {} }).mode).toBe('button');
  });

  it('returns static mode when neither is present', () => {
    expect(resolveRowClasses({}).mode).toBe('static');
  });

  it('prefers link mode when both href and onClick are present', () => {
    expect(resolveRowClasses({ href: '/x', onClick: () => {} }).mode).toBe('link');
  });
});

describe('resolveRowClasses — container', () => {
  it('uses p-4 by default and p-3 when dense', () => {
    expect(resolveRowClasses({}).container).toContain('p-4');
    expect(resolveRowClasses({ dense: true }).container).toContain('p-3');
    expect(resolveRowClasses({ dense: true }).container).not.toContain('p-4');
  });

  it('adds hover and cursor only for interactive rows', () => {
    const staticRow = resolveRowClasses({});
    expect(staticRow.container).not.toContain('hover:bg-muted/50');
    expect(staticRow.container).not.toContain('cursor-pointer');

    const linkRow = resolveRowClasses({ href: '/x' });
    expect(linkRow.container).toContain('hover:bg-muted/50');
    expect(linkRow.container).toContain('cursor-pointer');
  });

  it('adds a focus ring for interactive rows', () => {
    expect(resolveRowClasses({ onClick: () => {} }).container).toContain('focus-visible:ring-2');
    expect(resolveRowClasses({}).container).not.toContain('focus-visible:ring-2');
  });

  it('destructive tone swaps the surface and drops the muted hover', () => {
    const row = resolveRowClasses({ tone: 'destructive', href: '/x' });
    expect(row.container).toContain('border-destructive/30');
    expect(row.container).toContain('bg-card');
    expect(row.container).not.toContain('hover:bg-muted/50');
  });

  it('appends a custom className last', () => {
    expect(resolveRowClasses({ className: 'mb-2' }).container).toContain('mb-2');
  });
});

describe('resolveRowClasses — parts', () => {
  it('scales the icon with density and tone', () => {
    expect(resolveRowClasses({}).icon).toContain('h-5 w-5');
    expect(resolveRowClasses({ dense: true }).icon).toContain('h-4 w-4');
    expect(resolveRowClasses({}).icon).toContain('text-primary');
    expect(resolveRowClasses({ tone: 'destructive' }).icon).toContain('text-destructive/70');
  });

  it('scales title and subtitle with density', () => {
    expect(resolveRowClasses({}).title).toContain('text-base');
    expect(resolveRowClasses({ dense: true }).title).toContain('text-sm');
    expect(resolveRowClasses({}).subtitle).toContain('text-sm');
    expect(resolveRowClasses({ dense: true }).subtitle).toContain('text-xs');
  });

  it('keeps meta on one line and the action in amber above the overlay', () => {
    const row = resolveRowClasses({ href: '/x' });
    expect(row.meta).toContain('whitespace-nowrap');
    expect(row.action).toContain('border-amber-500');
    expect(row.action).toContain('z-10');
  });

  it('exposes a full-row anchor overlay', () => {
    expect(resolveRowClasses({ href: '/x' }).overlay).toContain('after:absolute');
    expect(resolveRowClasses({ href: '/x' }).overlay).toContain('after:inset-0');
  });
});
