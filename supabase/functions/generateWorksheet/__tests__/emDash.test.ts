/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, expect, it } from 'vitest';
import { countEmDashes, replaceEmDashes, replaceEmDashesInJsonText, sanitizeEmDashes } from '../emDash';

const D = String.fromCharCode(0x2014);
const EN = String.fromCharCode(0x2013);

describe('replaceEmDashes', () => {
  it.each([
    [`a ${D} b`, 'a, b'],
    [`a${D}b`, 'a, b'],
    [`a  ${D}  b`, 'a, b'],
    [`Wait${D}what?`, 'Wait, what?'],
    [`${D} Hello`, 'Hello'],
    [`The end ${D}`, 'The end'],
    [`well ${D}, maybe`, 'well, maybe'],
    [`5${D}10 minutes`, `5${EN}10 minutes`],
    [`one ${D} two ${D} three`, 'one, two, three'],
    ['a&mdash;b', 'a, b'],
    [`5${EN}10 minutes`, `5${EN}10 minutes`],
    ['no dash here', 'no dash here'],
  ])('%j -> %j', (input, expected) => {
    expect(replaceEmDashes(input)).toBe(expected);
  });

  it('never leaves an em dash behind and keeps en dashes', () => {
    const out = replaceEmDashes(`x${D}y ${EN} z ${D} w${D}`);
    expect(out).not.toContain(D);
    expect(out).toContain(EN);
  });
});

describe('replaceEmDashesInJsonText', () => {
  it('keeps the document valid JSON and applies the same rule inside strings', () => {
    const doc = JSON.stringify({ a: `x ${D} y`, b: `${D}start`, c: `end${D}`, d: `5${D}9`, e: `say "hi"${D}now` });
    const out = replaceEmDashesInJsonText(doc);
    expect(JSON.parse(out)).toEqual({ a: 'x, y', b: 'start', c: 'end', d: `5${EN}9`, e: 'say "hi", now' });
  });

  it('handles the escaped form the model may emit', () => {
    const out = replaceEmDashesInJsonText('{"a":"x \\u2014 y"}');
    expect(JSON.parse(out)).toEqual({ a: 'x, y' });
  });

  it('leaves clean text alone', () => {
    const doc = '{"a":"plain"}';
    expect(replaceEmDashesInJsonText(doc)).toBe(doc);
  });
});

describe('sanitizeEmDashes', () => {
  it('cleans nested strings in place and reports how many dashes it replaced', () => {
    const value: any = { t: `a ${D} b`, list: [`c${D}d`, { deep: `e ${D} f` }, 3, null], n: 1 };
    expect(countEmDashes(value)).toBe(3);
    expect(sanitizeEmDashes(value)).toBe(3);
    expect(value).toEqual({ t: 'a, b', list: ['c, d', { deep: 'e, f' }, 3, null], n: 1 });
    expect(sanitizeEmDashes(value)).toBe(0);
  });
});
