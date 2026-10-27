import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Pillar 2 zero-regression baseline (Stage 2.4).
 *
 * Cross-cutting invariants for Explainable DSLM (Stages 2.1-2.3): the
 * evidence engine and the radar classifier stay pure, evidence UI never
 * writes to the database, demo mode never triggers metric reads, and the
 * protected Worksheet Generation Engine is not imported by any Pillar 2
 * module. SQL-side and Pillar 1 invariants live in dslmSqlBaseline.test.ts
 * and pillar1Baseline.test.ts.
 */

const read = (rel: string) => readFileSync(join(__dirname, '../..', rel), 'utf8');

/** Code without comments: intent documented in comments must not trip guards. */
const codeOnly = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');

const PURE_MODULES = [
  'lib/dslm/recommendationExplainability.ts',
  'lib/dslm/recommendationEvidenceView.ts',
  'lib/dslm/competencyRadar.ts',
];

const EVIDENCE_UI = [
  'components/dslm/WhyThisLessonBanner.tsx',
  'components/dslm/ConnectedWhyThisLesson.tsx',
  'components/dslm/CompetencyRadarView.tsx',
];

describe('Purity of evidence engines (Stages 2.1 and 2.3)', () => {
  for (const rel of PURE_MODULES) {
    it(`${rel} performs no I/O, no clock reads and no Supabase access`, () => {
      const body = read(rel);
      expect(body).not.toMatch(/from ['"]@\/integrations\/supabase/);
      expect(body).not.toMatch(/\bfetch\s*\(/);
      expect(body).not.toMatch(/\bDate\.now\s*\(/);
      expect(body).not.toMatch(/\bnew Date\s*\(\s*\)/);
      expect(body).not.toMatch(/\blocalStorage\b/);
      expect(body).not.toMatch(/\bsessionStorage\b/);
    });
  }
});

describe('Evidence UI is read-only (Stages 2.2 and 2.3)', () => {
  for (const rel of EVIDENCE_UI) {
    it(`${rel} never mutates the database`, () => {
      const body = read(rel);
      expect(body).not.toMatch(/\.insert\s*\(/);
      expect(body).not.toMatch(/\.update\s*\(/);
      expect(body).not.toMatch(/\.delete\s*\(/);
      expect(body).not.toMatch(/\.upsert\s*\(/);
      expect(body).not.toMatch(/supabase\.rpc\s*\(/);
    });

    it(`${rel} uses semantic design tokens only (no hardcoded colors)`, () => {
      const body = read(rel);
      expect(body).not.toMatch(/bg-\[#/);
      expect(body).not.toMatch(/text-\[#/);
      expect(body).not.toMatch(/\btext-white\b/);
      expect(body).not.toMatch(/\bbg-black\b/);
    });
  }

  it('CompetencyRadarView writes only the approved prefill sessionStorage keys', () => {
    const body = read('components/dslm/CompetencyRadarView.tsx');
    const writes = [...body.matchAll(/sessionStorage\.(setItem|removeItem)\(\s*'([^']+)'/g)].map((m) => m[2]);
    expect([...new Set(writes)].sort()).toEqual(['forceNewWorksheet', 'prefillSuggestionId', 'prefillWorksheet']);
    // Manual prefill only: it must never arm the auto-generation bootstrap.
    expect(body).not.toMatch(/autoGenerateWorksheet/);
  });
});

describe('Demo mode protection (Stage 2.2)', () => {
  it('ConnectedWhyThisLesson renders nothing and reads no metrics in demo mode', () => {
    const body = read('components/dslm/ConnectedWhyThisLesson.tsx');
    expect(body).toMatch(/if \(isDemoMode\) return null/);
    expect(body).toMatch(/usePlanEvidenceMetrics\(isDemoMode \? '' : studentId/);
  });

  it('usePlanEvidenceMetrics stays disabled in demo mode', () => {
    const body = read('hooks/dslm/usePlanEvidenceMetrics.ts');
    expect(body).toMatch(/edooqoo_demo_mode/);
    expect(body).toMatch(/enabled: !!studentId && !!teacherId && !isDemo\(\)/);
  });

  it('CompetencyRadarView routes its mutating-looking action through the demo guard', () => {
    const body = read('components/dslm/CompetencyRadarView.tsx');
    expect(body).toMatch(/guardAction\('Adding to the next lesson'/);
  });
});

describe('Protected Worksheet Generation Engine boundary', () => {
  for (const rel of [...PURE_MODULES, ...EVIDENCE_UI]) {
    it(`${rel} does not import the worksheet generation engine`, () => {
      const body = read(rel);
      expect(body).not.toMatch(/generateWorksheet/);
      expect(body).not.toMatch(/format-worksheet-prompt/);
    });
  }
});

describe('Honest-evidence contract (Stage 2.1)', () => {
  it('the engine exposes exactly the six approved evidence types', () => {
    const body = read('lib/dslm/recommendationExplainability.ts');
    const types = [...body.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    for (const t of ['spaced_review', 'critical_gap', 'goal_milestone', 'teacher_note', 'curriculum_step', 'diagnostic_baseline']) {
      expect(types).toContain(t);
    }
  });

  it('goal, note and diagnostic evidence require explicit caller-supplied links', () => {
    const body = read('lib/dslm/recommendationExplainability.ts');
    expect(body).toMatch(/linkedGoalIds/);
    expect(body).toMatch(/linkedNoteIds/);
    expect(body).toMatch(/linkedDiagnosticTestId/);
    // Provenance is never inferred from generated prose.
    expect(codeOnly('lib/dslm/recommendationExplainability.ts')).not.toMatch(/rationale/i);
  });

  it('no percentage match or confidence score is computed for display', () => {
    for (const rel of EVIDENCE_UI) {
      expect(codeOnly(rel)).not.toMatch(/confidence/i);
    }
  });
});
