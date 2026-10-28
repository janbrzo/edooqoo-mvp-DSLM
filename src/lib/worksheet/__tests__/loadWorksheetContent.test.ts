import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { loadWorksheetContent, parseJsonObject, stripCodeFence } from '../loadWorksheetContent';

const sheet = { title: 'T', exercises: [{ type: 'multiple-choice' }] };
const json = JSON.stringify(sheet);

describe('loadWorksheetContent', () => {
  it('prefers a valid ai_response and is not degraded', () => {
    const out = loadWorksheetContent({ ai_response: json, html_content: JSON.stringify({ title: 'other', exercises: [] }) });
    expect(out).toEqual({ data: sheet, source: 'ai_response', degraded: false });
  });

  it('keeps an ai_response without exercises (behaviour of valid rows is unchanged)', () => {
    const out = loadWorksheetContent({ ai_response: '{"title":"Only title"}', html_content: json });
    expect(out.source).toBe('ai_response');
    expect(out.data).toEqual({ title: 'Only title' });
  });

  it('strips a json code fence and a BOM', () => {
    const out = loadWorksheetContent({ ai_response: '﻿```json\n' + json + '\n```' });
    expect(out.source).toBe('ai_response');
    expect(out.data).toEqual(sheet);
  });

  it('falls back to html_content JSON with exercises when ai_response is unparsable', () => {
    const out = loadWorksheetContent({ ai_response: '{"title":"cut off', html_content: json });
    expect(out).toEqual({ data: sheet, source: 'html_content', degraded: true, reason: 'ai_response_unparsable' });
  });

  it('falls back when ai_response is a JSON non-object', () => {
    expect(loadWorksheetContent({ ai_response: '[1,2]', html_content: json }).source).toBe('html_content');
    expect(loadWorksheetContent({ ai_response: '"text"', html_content: json }).degraded).toBe(true);
  });

  it('uses html_content without flagging degradation when ai_response is empty', () => {
    const out = loadWorksheetContent({ ai_response: '', html_content: json });
    expect(out).toEqual({ data: sheet, source: 'html_content', degraded: false });
  });

  it('rejects an HTML html_content and a JSON html_content without an exercises array', () => {
    expect(loadWorksheetContent({ ai_response: 'broken', html_content: '<html></html>' })).toMatchObject({
      data: null,
      source: 'none',
      reason: 'ai_response_unparsable',
    });
    expect(loadWorksheetContent({ ai_response: '', html_content: '{"title":"x"}' })).toMatchObject({
      data: null,
      reason: 'html_content_unusable',
    });
  });

  it('never throws on null, undefined, numbers or huge junk', () => {
    expect(loadWorksheetContent(null)).toEqual({ data: null, source: 'none', degraded: false, reason: 'no_content' });
    expect(loadWorksheetContent(undefined).data).toBeNull();
    expect(loadWorksheetContent({ ai_response: 42, html_content: {} as never }).data).toBeNull();
    expect(loadWorksheetContent({ ai_response: '{'.repeat(50_000) }).data).toBeNull();
  });

  it('accepts already parsed objects (RPC rows)', () => {
    expect(loadWorksheetContent({ ai_response: sheet }).data).toEqual(sheet);
  });
});

describe('helpers', () => {
  it('stripCodeFence leaves unfenced text alone', () => {
    expect(stripCodeFence('  {"a":1} ')).toBe('{"a":1}');
    expect(stripCodeFence('```\n{"a":1}\n```')).toBe('{"a":1}');
  });

  it('parseJsonObject only returns objects', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonObject('null')).toBeNull();
    expect(parseJsonObject(undefined)).toBeNull();
  });
});

describe('client call sites', () => {
  const root = path.resolve(__dirname, '../../..');
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '__tests__' && entry.name !== 'data') walk(full);
      } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name)) {
        const text = fs.readFileSync(full, 'utf8');
        if (/JSON\.parse\([^)]*\.ai_response/.test(text)) offenders.push(path.relative(root, full));
      }
    }
  };
  walk(root);

  it('parse worksheet content only through loadWorksheetContent', () => {
    expect(offenders).toEqual([]);
  });
});
