import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  DELETED_LIST_COLUMNS,
  LIST_COLUMNS,
  OWNER_VIEW_COLUMNS,
  OWNER_VIEW_SELECT,
  WORKSHEET_FORBIDDEN_COLUMNS,
  columnList,
} from '../worksheetColumns';

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

/** The query chain that follows each `.from('worksheets')` (up to the statement end). */
function worksheetChains(source: string): string[] {
  const chains: string[] = [];
  const re = /\.from\(\s*['"`]worksheets['"`]\s*\)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source))) {
    const rest = source.slice(match.index, match.index + 900);
    const end = rest.search(/;\s*\n|\)\s*;/);
    chains.push(rest.slice(0, end > 0 ? end : 400));
  }
  return chains;
}

describe('worksheet column constants', () => {
  const groups = {
    OWNER_VIEW_COLUMNS,
    LIST_COLUMNS,
    DELETED_LIST_COLUMNS,
  } as const;

  for (const [name, columns] of Object.entries(groups)) {
    it(`${name} never contains prompt or ip_address`, () => {
      for (const forbidden of WORKSHEET_FORBIDDEN_COLUMNS) {
        expect(columns as readonly string[]).not.toContain(forbidden);
      }
      expect(new Set(columns).size).toBe(columns.length);
    });
  }

  it('the select strings never contain prompt or ip_address', () => {
    for (const forbidden of WORKSHEET_FORBIDDEN_COLUMNS) {
      expect(OWNER_VIEW_SELECT.split(', ')).not.toContain(forbidden);
    }
    expect(columnList(['id', 'title'])).toBe('id, title');
  });

  it('list groups are subsets of the owner view', () => {
    for (const column of [...LIST_COLUMNS, ...DELETED_LIST_COLUMNS]) {
      expect(OWNER_VIEW_COLUMNS as readonly string[]).toContain(column);
    }
  });
});

describe('worksheets column grant (20261028120000)', () => {
  const migration = fs.readFileSync(
    path.resolve(SRC_ROOT, '../supabase/migrations/20261028120000_worksheets_hide_prompt_columns.sql'),
    'utf8',
  );
  const granted = (migration.match(/GRANT SELECT \(([\s\S]*?)\)\s*ON public\.worksheets/)?.[1] ?? '')
    .split(',')
    .map((column) => column.trim())
    .filter(Boolean);

  it('grants exactly OWNER_VIEW_COLUMNS to anon and authenticated', () => {
    expect([...granted].sort()).toEqual([...OWNER_VIEW_COLUMNS].sort());
  });

  it('never grants prompt or ip_address', () => {
    for (const forbidden of WORKSHEET_FORBIDDEN_COLUMNS) expect(granted).not.toContain(forbidden);
  });
});

describe('client reads of public.worksheets', () => {
  const files = walk(SRC_ROOT).filter((file) => !file.includes(`${path.sep}integrations${path.sep}supabase${path.sep}types`));
  const offenders: string[] = [];
  let inspected = 0;

  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const chain of worksheetChains(source)) {
      inspected += 1;
      const rel = path.relative(SRC_ROOT, file);
      if (/\.select\(\s*(['"`])\s*\*\s*\1/.test(chain)) offenders.push(`${rel}: select('*')`);
      if (/\.select\(\s*\)/.test(chain)) offenders.push(`${rel}: select() without columns`);
      if (/\b(prompt|ip_address)\b/.test(chain.slice(0, chain.search(/\.(insert|update|upsert)\(/) > 0 ? chain.search(/\.(insert|update|upsert)\(/) : chain.length)) ) {
        offenders.push(`${rel}: selects prompt or ip_address`);
      }
    }
    // A shared select variable must not hide a wildcard.
    if (/\.from\(\s*['"`]worksheets['"`]\s*\)/.test(source) && /selectQuery\s*=[^;]*['"`]\*['"`]/.test(source)) {
      offenders.push(`${path.relative(SRC_ROOT, file)}: selectQuery falls back to '*'`);
    }
  }

  it('finds the known call sites (guards the scanner itself)', () => {
    expect(inspected).toBeGreaterThan(30);
  });

  it('has no wildcard or argument-less select on worksheets', () => {
    expect(offenders).toEqual([]);
  });
});
