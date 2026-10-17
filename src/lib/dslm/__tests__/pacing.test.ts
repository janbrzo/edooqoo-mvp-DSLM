import { describe, it, expect } from 'vitest';
import {
  autoPacingIndex,
  computeIntensity,
  computeStylePacing,
  intensityPromptLines,
  loadLearningProfileForPacing,
  resolvePromptPacing,
  selfProfileFromEntries,
  shouldAutoApplyInitialWtPacing,
  capacityOfLearningPath,
  WT_INITIAL_AUTO_REASON,
  type StylePacingInput,
} from '../../../../supabase/functions/_shared/pacing';

const NOW = new Date('2026-10-12T00:00:00Z');
const inDays = (d: number) => new Date(NOW.getTime() + d * 86400000).toISOString();

const run = (partial: Partial<StylePacingInput>) =>
  computeStylePacing({ student: {}, now: NOW, ...partial });

describe('computeStylePacing: parity with the pre-iteration-5 recalculate-pacing', () => {
  it('returns the neutral default with a reasoning line when there are no signals', () => {
    const r = run({});
    expect(r.pacing).toBe(50);
    expect(r.reasoning).toEqual(['No strong signals: defaulting near 50.']);
    expect(r.deadlineDays).toBeNull();
  });

  it('reproduces goal, level, mastery, trend and Self-Profile signals (old result 53)', () => {
    // 50 +20 (business) -10 (A2) -10 (output 30) +15 (input 90) -10 (3 declining)
    // +8 (time obstacle) -5 (grammar) +5 (career) -5 (reading-writing) -5 (2h/week) = 53
    const r = run({
      student: { main_goal: 'Business meetings', english_level: 'A2' },
      metrics: [
        { skill_category: 'writing', current_mastery: 30, trend: 'declining' },
        { skill_category: 'reading', current_mastery: 90, trend: 'declining' },
        { skill_category: 'grammar', current_mastery: 50, trend: 'declining' },
      ],
      selfProfile: {
        learning_obstacles: ['Lack of time', 'Grammar'],
        motivation_driver: 'Career advancement',
        learning_style_pref: 'Grammar-first',
        time_availability_per_week: 2,
      },
    });
    expect(r.pacing).toBe(53);
    expect(r.reasoning).toContain('Output mastery 30% < 40 → −10 (more input)');
    expect(r.reasoning).toContain('Only 2h/week → −5 (consolidate, don\'t push)');
  });

  it('keeps additive deadline branches and goal pressure identical (old result 90)', () => {
    // 50 +20 (travel) +10 (3 urgent) -15 (exam title) +10 (business title), then <=90d: max(75+15, 50) = 90
    const r = run({
      student: { main_goal: 'travel', main_goal_target_date: inDays(200) },
      goals: [
        { title: 'IELTS test', target_date: inDays(40) },
        { title: 'Business email', target_date: inDays(50) },
        { title: 'Other', target_date: inDays(60) },
        { title: 'No date exam' },
      ],
    });
    expect(r.pacing).toBe(90);
    expect(r.deadlineDays).toBe(40);
    expect(r.reasoning).toContain('Deadline ≤90 days (40d) → +15, floor 50');
  });

  it('applies the >180 day and <=180 day adjustments as before', () => {
    expect(run({ student: { main_goal_target_date: inDays(200) } }).pacing).toBe(45);
    expect(run({ student: { main_goal_target_date: inDays(120) } }).pacing).toBe(55);
  });

  it('forces 100 for an overdue deadline', () => {
    const r = run({ student: { main_goal_target_date: inDays(-5), english_level: 'A1' } });
    expect(r.pacing).toBe(100);
    expect(r.reasoning).toContain('Overdue deadline (-5d) → forced Pragmatic 100');
  });

  it('ignores a goal date passed long ago instead of pinning 100 forever, and says so', () => {
    const r = run({ student: { main_goal_target_date: inDays(-60), english_level: 'B1' } });
    expect(r.pacing).toBe(50);
    expect(r.deadlineDays).toBeNull();
    expect(r.reasoning[0]).toMatch(/passed over 14 days ago: ignored, update or archive the goal/);
  });

  it('an unparseable date is not a deadline', () => {
    const r = run({ student: { main_goal_target_date: 'not a date' } });
    expect(r.deadlineDays).toBeNull();
    expect(r.reasoning.join(' ')).not.toMatch(/NaN/);
  });
});

describe('computeStylePacing: deadline floors are applied last (W3a N2)', () => {
  it('a <=2 week deadline stays 100 even with a later negative signal (old code gave 90)', () => {
    const r = run({ student: { main_goal_target_date: inDays(10), english_level: 'A1' } });
    expect(r.pacing).toBe(100);
    expect(r.reasoning[0]).toBe(
      'Deadline ≤2 weeks (10d) → forced Pragmatic 100 (no time for fundamentals)',
    );
  });

  it('a <=30 day deadline never drops below 75 (old code gave 57)', () => {
    const r = run({
      student: { main_goal_target_date: inDays(20), english_level: 'A1' },
      selfProfile: { learning_obstacles: ['Confidence'] },
    });
    expect(r.pacing).toBe(75);
  });

  it('a <=90 day deadline floors at 50 after the other signals', () => {
    // 50 -30 (IELTS) -10 (A2) = 10, then max(25, 50) = 50 (old code: 40)
    const r = run({ student: { main_goal: 'IELTS exam', english_level: 'A2', main_goal_target_date: inDays(60) } });
    expect(r.pacing).toBe(50);
  });
});

describe('computeStylePacing: Welcome Test profile signals', () => {
  it('maps anxiety, error attitude, level confidence and weekly time (slower profile)', () => {
    const r = run({
      profile: { anxiety_level: 'high', error_attitude: 'avoidant', level_confidence: 'overestimates', weekly_study_time: 'none' },
    });
    expect(r.pacing).toBe(25);
    expect(r.reasoning).toContain('High anxiety (Welcome Test) → −10 (slower, structured)');
  });

  it('maps a confident, committed profile upwards', () => {
    const r = run({
      profile: { anxiety_level: 'low', error_attitude: 'comfortable', level_confidence: 'underestimates', weekly_study_time: '3_plus_hours' },
    });
    expect(r.pacing).toBe(65);
  });

  it('treats medium anxiety, cautious errors, accurate confidence and 1 hour as neutral', () => {
    const r = run({
      profile: { anxiety_level: 'medium', error_attitude: 'cautious', level_confidence: 'accurate', weekly_study_time: '1_hour' },
    });
    expect(r.pacing).toBe(50);
  });

  it('maps 15_30_min to -5 and 2_3_hours to +5', () => {
    expect(run({ profile: { weekly_study_time: '15_30_min' } }).pacing).toBe(45);
    expect(run({ profile: { weekly_study_time: '2_3_hours' } }).pacing).toBe(55);
  });

  it('ignores the legacy non-existent behavioral fields', () => {
    const r = run({ profile: { behavioral_traits: { high_anxiety: true }, output_readiness: 10 } as any });
    expect(r.pacing).toBe(50);
  });
});

describe('computeStylePacing: weekly time is never counted twice', () => {
  it('uses the Self-Profile slider and ignores the Welcome Test answer when both exist', () => {
    const r = run({ selfProfile: { time_availability_per_week: 10 }, profile: { weekly_study_time: 'none' } });
    expect(r.pacing).toBe(55);
  });

  it('a neutral slider value still suppresses the Welcome Test answer', () => {
    const r = run({ selfProfile: { time_availability_per_week: 5 }, profile: { weekly_study_time: '3_plus_hours' } });
    expect(r.pacing).toBe(50);
  });

  it('falls back to the Welcome Test answer when the slider is absent', () => {
    const r = run({ selfProfile: { motivation_driver: 'Daily life' }, profile: { weekly_study_time: 'none' } });
    expect(r.pacing).toBe(45);
  });
});

describe('selfProfileFromEntries', () => {
  it('keeps the first value per field and prefers metadata.raw_value', () => {
    expect(selfProfileFromEntries([
      { metadata: { field: 'motivation_driver', raw_value: 'Travel' }, content: 'Motivation: Travel' },
      { metadata: { field: 'motivation_driver', raw_value: 'Hobby' } },
      { metadata: { field: 'learning_style_pref' }, content: 'Visual' },
      { metadata: {}, content: 'ignored' },
    ])).toEqual({ motivation_driver: 'Travel', learning_style_pref: 'Visual' });
  });
});

describe('computeIntensity', () => {
  it('returns nulls without a Learning Path', () => {
    expect(computeIntensity(null, 30)).toEqual({ intensity: null, score: null, version: null, capacityWarning: null, reasoning: [] });
    expect(computeIntensity('x', null).intensity).toBeNull();
  });

  it('reads a v1 result (no version key)', () => {
    const r = computeIntensity({ score: 64, path: 'accelerated', component_scores: {}, overrides_applied: [] }, null);
    expect(r).toMatchObject({ intensity: 'accelerated', score: 64, version: 1, capacityWarning: null });
    expect(r.reasoning[0]).toContain('accelerated (score 64)');
  });

  it('derives the path from the score when the path is missing', () => {
    expect(computeIntensity({ score: 80 }, null).intensity).toBe('target');
    expect(computeIntensity({ score: 20 }, null).intensity).toBe('comfort');
  });

  it('reads a v2 result with a capacity cap and warning', () => {
    const r = computeIntensity({
      version: 2, score: 50, path: 'guided', component_scores: {}, coverage: 0.8, overrides_applied: [],
      capacity: 'low', capacity_cap: 50, capacity_warning: 'unrealistic_goal',
    }, 21);
    expect(r).toMatchObject({ intensity: 'guided', score: 50, version: 2, capacityWarning: 'unrealistic_goal' });
    expect(r.reasoning).toContain('Intensity capped at 50 by declared study capacity (low)');
  });

  it('handles a v2 result without enough signal', () => {
    const r = computeIntensity({ version: 2, score: null, path: null, coverage: 0.1 }, null);
    expect(r).toMatchObject({ intensity: null, score: null, version: 2, capacityWarning: null });
  });

  it('never changes the style pacing number', () => {
    const before = run({ student: { main_goal: 'business' } }).pacing;
    computeIntensity({ version: 2, score: 95, path: 'target' }, 10);
    expect(run({ student: { main_goal: 'business' } }).pacing).toBe(before);
  });
});

describe('intensityPromptLines', () => {
  it('renders one line, plus the capacity warning when set, with no em dash', () => {
    expect(intensityPromptLines(computeIntensity(null, null))).toBe('');
    const one = intensityPromptLines(computeIntensity({ score: 64, path: 'accelerated' }, null));
    expect(one).toBe('\n- Intensity (Welcome Test Learning Path): accelerated (score 64). Use it for lesson density and homework load within the fixed phases and weeks, not for the Scientific/Pragmatic style.');
    const two = intensityPromptLines(computeIntensity({ version: 2, score: 40, path: 'guided', capacity_warning: 'unrealistic_goal' }, 10));
    expect(two.split('\n- ')).toHaveLength(3);
    expect(two).toContain('Capacity warning: declared study capacity is low for this deadline');
    expect(two).not.toContain('\u2014');
  });
});

describe('autoPacingIndex / resolvePromptPacing', () => {
  it('uses goal, deadline weeks and level', () => {
    expect(autoPacingIndex({ main_goal: 'IELTS', english_level: 'A2' }, 6)).toBe(35);
    expect(autoPacingIndex({ main_goal: 'business' }, 12)).toBe(85);
    expect(autoPacingIndex({}, 20)).toBe(50);
    expect(autoPacingIndex({}, null)).toBe(50);
    expect(autoPacingIndex({ main_goal: 'work', english_level: 'B2' }, 4)).toBe(95);
  });

  it('respects a stored non-default value exactly and treats 50 as default', () => {
    expect(resolvePromptPacing({ dslm_pacing_mode: 70, main_goal: 'IELTS' }, 4)).toBe(70);
    expect(resolvePromptPacing({ dslm_pacing_mode: 0 }, 4)).toBe(0);
    expect(resolvePromptPacing({ dslm_pacing_mode: 150 }, null)).toBe(100);
    expect(resolvePromptPacing({ dslm_pacing_mode: 50 }, 6)).toBe(75);
    expect(resolvePromptPacing({ dslm_pacing_mode: null }, null)).toBe(50);
  });
});

describe('loadLearningProfileForPacing', () => {
  const fakeClient = (responses: Array<{ data: any; error: any }>, seen: string[]) => ({
    from: () => {
      const chain: any = {
        select: (cols: string) => { seen.push(cols); return chain; },
        eq: () => chain,
        maybeSingle: async () => responses.shift(),
      };
      return chain;
    },
  });

  it('prefers the learning_path column', async () => {
    const seen: string[] = [];
    const r = await loadLearningProfileForPacing(fakeClient([
      { data: { anxiety_level: 'high', learning_path: { version: 2, score: 70 }, raw_learning_path: { score: 10 } }, error: null },
    ], seen), 's', 't');
    expect(r.error).toBeNull();
    expect(r.profile?.anxiety_level).toBe('high');
    expect(r.profile?.learning_path).toEqual({ version: 2, score: 70 });
    expect(seen[0]).toContain('raw_answers->learning_path');
  });

  it('retries without the column when it does not exist and uses raw_answers', async () => {
    const seen: string[] = [];
    const r = await loadLearningProfileForPacing(fakeClient([
      { data: null, error: { code: '42703', message: 'column student_learning_profiles.learning_path does not exist' } },
      { data: { error_attitude: 'avoidant', raw_learning_path: { score: 30, path: 'guided' } }, error: null },
    ], seen), 's', 't');
    expect(seen).toHaveLength(2);
    expect(seen[1]).not.toMatch(/, learning_path$/);
    expect(r.profile?.learning_path).toEqual({ score: 30, path: 'guided' });
    expect(r.profile?.error_attitude).toBe('avoidant');
  });

  it('returns the error instead of silently dropping it, and tolerates a missing row', async () => {
    const err = await loadLearningProfileForPacing(fakeClient([{ data: null, error: { code: '500', message: 'boom' } }], []), 's', 't');
    expect(err).toEqual({ profile: null, error: 'boom' });
    const none = await loadLearningProfileForPacing(fakeClient([{ data: null, error: null }], []), 's', 't');
    expect(none).toEqual({ profile: null, error: null });
  });
});

describe('resolvePromptPacing: "set" is decided by last_pacing_set_manually (owner decision 2026-10-12)', () => {
  it('a value someone set is used even when it is exactly 50', () => {
    expect(resolvePromptPacing({ dslm_pacing_mode: 50, last_pacing_set_manually: false, main_goal: 'IELTS', english_level: 'A2' }, null)).toBe(50);
    expect(resolvePromptPacing({ dslm_pacing_mode: 50, last_pacing_set_manually: true, main_goal: 'work' }, 4)).toBe(50);
  });

  it('a value nobody set (new student default) uses the auto rule', () => {
    expect(resolvePromptPacing({ dslm_pacing_mode: 30, last_pacing_set_manually: null, main_goal: 'IELTS', english_level: 'A2' }, null)).toBe(10);
  });

  it('without the flag in the row, the previous rule applies', () => {
    expect(resolvePromptPacing({ dslm_pacing_mode: 30 }, null)).toBe(30);
    expect(resolvePromptPacing({ dslm_pacing_mode: 50, main_goal: 'IELTS', english_level: 'A2' }, null)).toBe(10);
  });
});

describe('computeStylePacing: triangulated study capacity (Stage 4.7, B1-10)', () => {
  it('B1-10: declared 2_3_hours but avoidant homework (capacity low) pushes DOWN (-5), not up (+5)', () => {
    const declared = run({ profile: { weekly_study_time: '2_3_hours' } });
    expect(declared.pacing).toBe(55); // legacy profile without capacity: declaration is all there is
    const triangulated = run({ profile: { weekly_study_time: '2_3_hours', capacity: 'low' } });
    expect(triangulated.pacing).toBe(45);
    expect(triangulated.reasoning.join(' ')).toContain('Low study capacity');
  });

  it('study time contributes in one place only: capacity replaces the raw declared time (no double count)', () => {
    const r = run({ profile: { weekly_study_time: 'none', capacity: 'low' } });
    expect(r.pacing).toBe(45); // -5 once, not -10
    const high = run({ profile: { weekly_study_time: '3_plus_hours', capacity: 'high' } });
    expect(high.pacing).toBe(55);
    expect(run({ profile: { weekly_study_time: '3_plus_hours', capacity: 'normal' } }).pacing).toBe(50);
  });

  it('the Self-Profile slider still wins over capacity', () => {
    const r = run({ profile: { capacity: 'low' }, selfProfile: { time_availability_per_week: 10 } });
    expect(r.pacing).toBe(55); // +5 slider only
  });

  it('intensity never changes the style number', () => {
    const base = run({ profile: { capacity: 'low' } }).pacing;
    computeIntensity({ version: 3, score: 90, path: 'target', capacity: 'low', capacity_cap: 50 }, 10);
    expect(run({ profile: { capacity: 'low' } }).pacing).toBe(base);
  });

  it('reads LPS v3 in computeIntensity and the capacity from a stored learning path', () => {
    const i = computeIntensity({ version: 3, score: 50, path: 'guided', capacity: 'low', capacity_cap: 50, capacity_warning: 'unrealistic_goal' }, 20);
    expect(i.version).toBe(3);
    expect(i.intensity).toBe('guided');
    expect(i.capacityWarning).toBe('unrealistic_goal');
    expect(capacityOfLearningPath({ version: 3, capacity: 'low' })).toBe('low');
    expect(capacityOfLearningPath({ version: 1, score: 40 })).toBeNull();
    expect(capacityOfLearningPath(null)).toBeNull();
  });

  it('the loader exposes the triangulated capacity from learning_path', async () => {
    const supabase: any = {
      from: () => ({ select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({
        data: { weekly_study_time: '2_3_hours', learning_path: { version: 3, capacity: 'low' } }, error: null,
      }) }) }) }) }),
    };
    const r = await loadLearningProfileForPacing(supabase, 's', 't');
    expect(r.profile?.capacity).toBe('low');
    expect(r.profile?.weekly_study_time).toBe('2_3_hours');
  });
});

describe('shouldAutoApplyInitialWtPacing (Decision 5)', () => {
  const base = { triggerType: 'placement_test', lastPacingSetManually: null as boolean | null, hasEarlierAppliedProposal: false };
  it('applies the first Welcome Test proposal when pacing was never set', () => {
    expect(shouldAutoApplyInitialWtPacing(base)).toBe(true);
    expect(shouldAutoApplyInitialWtPacing({ ...base, lastPacingSetManually: false })).toBe(true);
    expect(WT_INITIAL_AUTO_REASON).toBe('welcome_test_initial_auto');
  });
  it('keeps the approval flow when the teacher set pacing manually', () => {
    expect(shouldAutoApplyInitialWtPacing({ ...base, lastPacingSetManually: true })).toBe(false);
  });
  it('keeps the approval flow for a retake (an earlier proposal was accepted or applied)', () => {
    expect(shouldAutoApplyInitialWtPacing({ ...base, hasEarlierAppliedProposal: true })).toBe(false);
  });
  it('only the placement_test trigger auto-applies', () => {
    for (const t of ['goal_added', 'periodic_30d', 'manual', undefined, null]) {
      expect(shouldAutoApplyInitialWtPacing({ ...base, triggerType: t as any })).toBe(false);
    }
  });
  it('the applied value is then respected by resolvePromptPacing even when it equals 50 (flag false)', () => {
    expect(resolvePromptPacing({ dslm_pacing_mode: 50, last_pacing_set_manually: false, main_goal: 'IELTS exam' }, null)).toBe(50);
  });
});
