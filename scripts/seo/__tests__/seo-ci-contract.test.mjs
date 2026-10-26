import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const { scripts } = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/seo-integrity.yml'), 'utf8');
const commands = [...workflow.matchAll(/^\s+run: (.+)$/gm)].map((match) => match[1].trim());

describe('SEO generation and CI contract', () => {
  it('uses the complete local synchronization command twice, with a clean-diff gate after each run', () => {
    const syncPositions = commands.flatMap((command, index) =>
      command === 'npm run seo:sync-generated' ? [index] : [],
    );
    expect(syncPositions).toHaveLength(2);
    for (const index of syncPositions) {
      expect(commands[index + 1]).toBe('git diff --exit-code');
    }
  });

  it('finishes generation with citation, JSON-LD and snapshot repairs in the required order', () => {
    const pipeline = scripts['seo:sync-generated'].split(' && ');
    expect(pipeline.slice(-4)).toEqual([
      'npm run seo:inject-citation-blocks',
      'npm run seo:dedupe-jsonld',
      'npm run seo:repair-snapshot-snippets',
      'npm run seo:repair-snapshot-head',
    ]);
    expect(pipeline.indexOf('npm run content:generate')).toBeGreaterThan(
      pipeline.indexOf('npm run seo:generate-decision-content'),
    );
    expect(pipeline.indexOf('npm run seo:generate-ai')).toBeGreaterThan(
      pipeline.indexOf('npm run seo:sync-sitemap-edge'),
    );
  });

  it('gates all content contracts after repeated synchronization and before the production build', () => {
    const audit = commands.indexOf('npm run content:audit');
    const lastSync = commands.lastIndexOf('npm run seo:sync-generated');
    const build = commands.indexOf('npm run build:seo');
    expect(audit).toBeGreaterThan(lastSync + 1);
    expect(build).toBeGreaterThan(audit);
    expect(scripts['content:audit'].split(' && ')).toEqual(expect.arrayContaining([
      'npm run seo:audit-internal-links',
      'npm run seo:audit-pseo-policy',
      'npm run seo:audit-sitemap-integrity',
      'npm run seo:audit-verification',
    ]));
  });

  it('checks backlinks, snapshots and routing before the production build', () => {
    const build = commands.indexOf('npm run build:seo');
    for (const check of [
      'npm run seo:check-cluster-hub-links',
      'npm run seo:check-snapshot-snippets',
      'npm run seo:check-snapshot-head',
      'npm run seo:test-edge-routing',
    ]) {
      const index = commands.findIndex((command) => command.split(' && ').includes(check));
      expect(index).toBeGreaterThan(commands.lastIndexOf('npm run seo:sync-generated'));
      expect(index).toBeLessThan(build);
    }
  });
});