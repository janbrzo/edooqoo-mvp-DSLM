import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { toWorksheetHistoryRows, WORKSHEET_HISTORY_COLUMNS } from '../../../supabase/functions/_shared/worksheetHistory';

describe('worksheet history rows for the DSLM planners', () => {
  it('reads the topic from form_data.lessonTopic and falls back to the title', () => {
    const rows = toWorksheetHistoryRows([
      { title: 'Title A', form_data: { lessonTopic: ' Job interviews ' }, created_at: '2026-10-01T10:00:00Z' },
      { title: 'Title B', form_data: null, created_at: '2026-09-01T10:00:00Z' },
      { title: '', form_data: {}, created_at: '2026-08-01T10:00:00Z' },
      { title: 'No date', form_data: {}, created_at: null },
    ]);
    expect(rows).toEqual([
      { topic: 'Job interviews', created_at: '2026-10-01T10:00:00Z' },
      { topic: 'Title B', created_at: '2026-09-01T10:00:00Z' },
    ]);
  });

  it('tolerates a missing result', () => {
    expect(toWorksheetHistoryRows(null)).toEqual([]);
    expect(toWorksheetHistoryRows(undefined)).toEqual([]);
  });

  it('never selects the non-existent worksheets.topic column', () => {
    expect(WORKSHEET_HISTORY_COLUMNS).not.toMatch(/\btopic\b/);
    for (const fn of ['generate-timeline', 'generate-curriculum-phases']) {
      const src = readFileSync(join(__dirname, `../../../supabase/functions/${fn}/index.ts`), 'utf8');
      expect(src).not.toMatch(/\.select\('topic, created_at'\)/);
      expect(src).toMatch(/WORKSHEET_HISTORY_COLUMNS/);
    }
  });
});

describe('skill metric recency uses the time of the evidence', () => {
  const read = (p: string) => readFileSync(join(__dirname, `../../../supabase/functions/${p}`), 'utf8');

  it('the weak-area block ages a skill by last_event_at, not by updated_at', () => {
    const core = read('_shared/dslmPromptCore.ts');
    expect(core).toMatch(/r\.last_event_at/);
    expect(core).not.toMatch(/\b(m|r|row)\.updated_at/);
  });

  it('planners and pacing read last_event_at', () => {
    expect(read('generate-timeline/index.ts')).toMatch(/updated_at, last_event_at/);
    expect(read('generate-curriculum-phases/index.ts')).toMatch(/updated_at, last_event_at/);
    expect(read('generate-timeline/index.ts')).toMatch(/total_events/);
    expect(read('generate-curriculum-phases/index.ts')).toMatch(/total_events/);
    // Style pacing inputs are read by one shared helper (recalculate-pacing and the generators use it).
    expect(read('recalculate-pacing/index.ts')).toMatch(/computeStylePacingForStudent/);
    const pacing = read('_shared/pacing.ts');
    expect(pacing).toMatch(/\.gte\('last_event_at'/);
    expect(pacing).not.toMatch(/\.gte\('updated_at'/);
  });
});
