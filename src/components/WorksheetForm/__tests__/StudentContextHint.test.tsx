import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StudentContextHint } from '../StudentContextHint';

describe('StudentContextHint copy', () => {
  it('only promises what the worksheet form really uses', () => {
    const html = renderToStaticMarkup(
      <>
        <StudentContextHint variant="no-students" />
        <StudentContextHint variant="no-selection" />
      </>,
    );
    expect(html).toContain('level and plan step');
    expect(html).not.toMatch(/goals|pacing/);
  });
});
