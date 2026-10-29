import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  HOMEWORK_FORBIDDEN_COLUMNS,
  HOMEWORK_OWNER_VIEW_COLUMNS,
  HOMEWORK_OWNER_VIEW_SELECT,
  homeworkColumnList,
} from '../homeworkColumns';

const SRC_ROOT = path.resolve(__dirname, '../../..');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

/** The query chain that follows each `.from('homework_assignments')`. */
function homeworkChains(source: string): string[] {
  const chains: string[] = [];
  const re = /\.from\(\s*['"`]homework_assignments['"`]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const rest = source.slice(match.index, match.index + 900);
    const end = rest.search(/;\s*\n|\)\s*;/);
    chains.push(rest.slice(0, end > 0 ? end : 400));
  }
  return chains;
}

describe('homework column constants', () => {
  it('never contain prompt and have no duplicates', () => {
    for (const forbidden of HOMEWORK_FORBIDDEN_COLUMNS) {
      expect(HOMEWORK_OWNER_VIEW_COLUMNS as readonly string[]).not.toContain(forbidden);
      expect(HOMEWORK_OWNER_VIEW_SELECT.split(', ')).not.toContain(forbidden);
    }
    expect(new Set(HOMEWORK_OWNER_VIEW_COLUMNS).size).toBe(HOMEWORK_OWNER_VIEW_COLUMNS.length);
    expect(homeworkColumnList(['id', 'title'])).toBe('id, title');
  });
});

describe('homework_assignments column grant (20261029090000)', () => {
  const migration = fs.readFileSync(
    path.resolve(SRC_ROOT, '../supabase/migrations/20261029090000_homework_assignments_hide_prompt.sql'),
    'utf8',
  );
  const granted = (migration.match(/GRANT SELECT \(([\s\S]*?)\)\s*ON public\.homework_assignments/)?.[1] ?? '')
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);

  it('grants exactly HOMEWORK_OWNER_VIEW_COLUMNS to anon and authenticated', () => {
    expect([...granted].sort()).toEqual([...HOMEWORK_OWNER_VIEW_COLUMNS].sort());
  });

  it('never grants prompt', () => {
    for (const forbidden of HOMEWORK_FORBIDDEN_COLUMNS) expect(granted).not.toContain(forbidden);
  });
});

describe('client reads of public.homework_assignments', () => {
  const files = walk(SRC_ROOT).filter((file) => !file.includes(`${path.sep}integrations${path.sep}supabase${path.sep}types`));
  const offenders: string[] = [];
  let inspected = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const chain of homeworkChains(source)) {
      inspected += 1;
      const rel = path.relative(SRC_ROOT, file);
      if (/\.select\(\s*['"`]\s*\*/.test(chain)) offenders.push(`${rel}: select('*')`);
      if (/\.select\(\s*`[^`]*[\s,(]\*\s*,/.test(chain)) offenders.push(`${rel}: wildcard in select template`);
      if (/\.select\(\s*\)/.test(chain)) offenders.push(`${rel}: select() without columns`);
      const writeAt = chain.search(/\.(insert|update|upsert)\(/);
      const readPart = writeAt > 0 ? chain.slice(0, writeAt) : chain;
      if (/\bprompt\b/.test(readPart)) offenders.push(`${rel}: selects prompt`);
    }
  }

  it('finds the known call sites (guards the scanner itself)', () => {
    expect(inspected).toBeGreaterThan(8);
  });

  it('has no wildcard or argument-less select on homework_assignments', () => {
    expect(offenders).toEqual([]);
  });
});
