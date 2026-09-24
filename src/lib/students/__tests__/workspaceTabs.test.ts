import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TAB,
  PRESERVED_PARAMS,
  TAB_ALIASES,
  WORKSPACE_TABS,
  buildWorkspaceParams,
  isWorkspaceTab,
  resolveTab,
  resolveWorkspaceParams,
  studentTabPath,
} from '../workspaceTabs';

describe('resolveTab — canonical values', () => {
  for (const tab of WORKSPACE_TABS) {
    it(`passes through "${tab}" unchanged`, () => {
      expect(resolveTab(tab)).toEqual({ tab, changed: false });
    });
  }
});

describe('resolveTab — legacy aliases', () => {
  const cases: Array<[string, Record<string, unknown>]> = [
    ['overview', { tab: 'prep' }],
    ['dslm', { tab: 'model' }],
    ['1minute', { tab: 'model' }],
    ['progress', { tab: 'model', view: 'pathway' }],
    ['skills', { tab: 'model', view: 'skills' }],
    ['knowledge', { tab: 'model', view: 'profile' }],
    ['events', { tab: 'model', view: 'profile' }],
    ['worksheets', { tab: 'library', section: 'worksheets' }],
    ['flashcards', { tab: 'library', section: 'flashcards' }],
    ['homework', { tab: 'timeline', filter: 'homework' }],
    ['tests', { tab: 'timeline', filter: 'tests' }],
    ['calendar', { tab: 'timeline', filter: 'lessons' }],
  ];

  it('covers every alias in the map', () => {
    expect(cases.map(([k]) => k).sort()).toEqual(Object.keys(TAB_ALIASES).sort());
  });

  for (const [legacy, expected] of cases) {
    it(`maps "${legacy}"`, () => {
      expect(resolveTab(legacy)).toEqual({ ...expected, changed: true });
    });
  }
});

describe('resolveTab — fallbacks and hygiene', () => {
  for (const raw of [null, undefined, '', '   ', 'nonsense']) {
    it(`falls back to prep for ${JSON.stringify(raw)}`, () => {
      expect(resolveTab(raw)).toEqual({ tab: DEFAULT_TAB, changed: true });
    });
  }

  it('is case-insensitive', () => {
    expect(resolveTab('DSLM').tab).toBe('model');
  });

  it('trims whitespace', () => {
    expect(resolveTab(' tests ')).toEqual({ tab: 'timeline', filter: 'tests', changed: true });
  });

  it('isWorkspaceTab guards correctly', () => {
    expect(isWorkspaceTab('prep')).toBe(true);
    expect(isWorkspaceTab('dslm')).toBe(false);
    expect(isWorkspaceTab(null)).toBe(false);
  });
});

const q = (s: string) => new URLSearchParams(s);

describe('resolveWorkspaceParams', () => {
  it('preserves the flashcard set', () => {
    const { next, changed } = resolveWorkspaceParams(q('tab=flashcards&set=abc'));
    expect(next.toString()).toBe('tab=library&section=flashcards&set=abc');
    expect(changed).toBe(true);
  });

  it('preserves testId', () => {
    const { next } = resolveWorkspaceParams(q('tab=tests&testId=t1'));
    expect(next.toString()).toBe('tab=timeline&filter=tests&testId=t1');
  });

  it('preserves every pass-through param', () => {
    const input = q('tab=dslm&set=s&intake=i&view=goals&focus=f&testId=t&_=1&editSuggestion=e');
    const { next } = resolveWorkspaceParams(input);
    for (const key of PRESERVED_PARAMS) {
      expect(next.get(key)).toBe(input.get(key));
    }
  });

  it('lets an explicit view beat the alias view', () => {
    const { resolved } = resolveWorkspaceParams(q('tab=progress&view=goals'));
    expect(resolved).toMatchObject({ tab: 'model', view: 'goals' });
  });

  it('lets an explicit section beat the alias section', () => {
    const { next } = resolveWorkspaceParams(q('tab=worksheets&section=homework'));
    expect(next.get('section')).toBe('homework');
  });

  it('preserves editSuggestion for model deep links', () => {
    const { next } = resolveWorkspaceParams(q('tab=dslm&view=pathway&editSuggestion=s1'));
    expect(next.toString()).toBe('tab=model&view=pathway&editSuggestion=s1');
  });

  it('is idempotent', () => {
    const first = resolveWorkspaceParams(q('tab=dslm&view=pathway&focus=pick-idea'));
    const second = resolveWorkspaceParams(first.next);
    expect(second.changed).toBe(false);
    expect(second.next.toString()).toBe(first.next.toString());
  });

  it('leaves a canonical URL untouched', () => {
    const { next, changed } = resolveWorkspaceParams(q('tab=prep'));
    expect(changed).toBe(false);
    expect(next.toString()).toBe('tab=prep');
  });

  it('does not mutate the input', () => {
    const input = q('tab=dslm');
    resolveWorkspaceParams(input);
    expect(input.toString()).toBe('tab=dslm');
  });

  it('ignores param order when deciding changed', () => {
    const { changed } = resolveWorkspaceParams(q('view=pathway&tab=model'));
    expect(changed).toBe(false);
  });
});

describe('buildWorkspaceParams', () => {
  it('builds Prep and removes state owned by other tabs', () => {
    const current = q('tab=model&section=homework&filter=tests&view=goals&focus=f&testId=t&set=s&editSuggestion=e&_=1');
    expect(buildWorkspaceParams(current, { tab: 'prep' }).toString()).toBe('tab=prep');
  });

  it('builds Timeline with a filter and removes foreign state', () => {
    const current = q('tab=library&section=flashcards&set=s&view=goals&focus=f');
    expect(buildWorkspaceParams(current, { tab: 'timeline', filter: 'homework' }).toString()).toBe(
      'tab=timeline&filter=homework',
    );
  });

  it('keeps testId only for the Tests filter', () => {
    expect(
      buildWorkspaceParams(q('tab=prep'), { tab: 'timeline', filter: 'tests', testId: 't1' }).toString(),
    ).toBe('tab=timeline&filter=tests&testId=t1');
    expect(
      buildWorkspaceParams(q('tab=timeline&filter=tests&testId=t1'), {
        tab: 'timeline',
        filter: 'lessons',
        testId: 't1',
      }).toString(),
    ).toBe('tab=timeline&filter=lessons');
  });

  it('builds Library with a section and removes foreign state', () => {
    const current = q('tab=timeline&filter=tests&testId=t1&view=profile');
    expect(buildWorkspaceParams(current, { tab: 'library', section: 'worksheets' }).toString()).toBe(
      'tab=library&section=worksheets',
    );
  });

  it('keeps set only for the Flashcards section', () => {
    expect(
      buildWorkspaceParams(q('tab=prep'), { tab: 'library', section: 'flashcards', set: 's1' }).toString(),
    ).toBe('tab=library&section=flashcards&set=s1');
    expect(
      buildWorkspaceParams(q('tab=library&section=flashcards&set=s1'), {
        tab: 'library',
        section: 'homework',
        set: 's1',
      }).toString(),
    ).toBe('tab=library&section=homework');
  });

  it('builds Model with its supported deep-link state', () => {
    expect(
      buildWorkspaceParams(q('tab=prep'), {
        tab: 'model',
        view: 'pathway',
        focus: 'pick-idea',
        editSuggestion: 's1',
        cacheKey: '123',
      }).toString(),
    ).toBe('tab=model&view=pathway&focus=pick-idea&editSuggestion=s1&_=123');
  });

  it('preserves intake across every canonical tab', () => {
    const current = q('tab=prep&intake=welcome');
    const targets = [
      { tab: 'prep' },
      { tab: 'timeline', filter: 'all' },
      { tab: 'library', section: 'worksheets' },
      { tab: 'model', view: 'goals' },
    ] as const;

    for (const target of targets) {
      expect(buildWorkspaceParams(current, target).get('intake')).toBe('welcome');
    }
  });

  it('does not mutate current params', () => {
    const current = q('tab=model&view=goals&intake=i');
    buildWorkspaceParams(current, { tab: 'prep' });
    expect(current.toString()).toBe('tab=model&view=goals&intake=i');
  });

  it('does not preserve unknown params', () => {
    const next = buildWorkspaceParams(q('tab=prep&utm_source=x&ref=y'), { tab: 'model' });
    expect(next.toString()).toBe('tab=model');
  });
});

describe('real producers emit URLs that still resolve', () => {
  const cases: Array<[string, string]> = [
    ['tab=tests', 'tab=timeline&filter=tests'],
    ['tab=tests&testId=x', 'tab=timeline&filter=tests&testId=x'],
    ['tab=dslm', 'tab=model'],
    ['tab=dslm&view=pathway', 'tab=model&view=pathway'],
    ['tab=dslm&view=goals&focus=add-goal-modal&_=1', 'tab=model&view=goals&focus=add-goal-modal&_=1'],
    ['tab=dslm&view=pathway&focus=pick-idea', 'tab=model&view=pathway&focus=pick-idea'],
    ['tab=flashcards', 'tab=library&section=flashcards'],
    ['tab=overview', 'tab=prep'],
    ['tab=worksheets', 'tab=library&section=worksheets'],
    ['tab=homework', 'tab=timeline&filter=homework'],
    ['tab=calendar', 'tab=timeline&filter=lessons'],
  ];

  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      expect(resolveWorkspaceParams(q(input)).next.toString()).toBe(expected);
    });
  }
});

/**
 * M7.9 regression guard — every legacy producer found in the codebase
 * (onboarding, AddStudentDialog intake, Welcome Test email/notifications,
 * PacingProposalsBell, SlotDetailModal, NextUpCard, flashcard modal,
 * timeline event hrefs) must resolve to a working canonical surface
 * without losing its deep-link context.
 */
describe('M7.9 — legacy producer inventory', () => {
  const cases: Array<[string, string]> = [
    ['tab=dslm&view=pathway&focus=send-welcome-test', 'tab=model&view=pathway&focus=send-welcome-test'],
    ['tab=dslm&view=goals&focus=add-goal-modal', 'tab=model&view=goals&focus=add-goal-modal'],
    ['tab=dslm&view=pathway&focus=learning-roadmap', 'tab=model&view=pathway&focus=learning-roadmap'],
    ['tab=dslm&view=pathway&focus=next-lesson-ideas', 'tab=model&view=pathway&focus=next-lesson-ideas'],
    [
      'tab=dslm&view=goals&focus=add-goal-modal&_=42&intake=abc',
      'tab=model&intake=abc&view=goals&focus=add-goal-modal&_=42',
    ],
    [
      'tab=dslm&view=pathway&focus=send-welcome-test&_=42&intake=abc',
      'tab=model&intake=abc&view=pathway&focus=send-welcome-test&_=42',
    ],
    ['tab=tests&testId=t-9', 'tab=timeline&filter=tests&testId=t-9'],
    ['tab=knowledge', 'tab=model&view=profile'],
    ['tab=timeline&filter=tests&testId=t-9', 'tab=timeline&filter=tests&testId=t-9'],
  ];

  for (const [input, expected] of cases) {
    it(`${input} → ${expected}`, () => {
      const first = resolveWorkspaceParams(q(input));
      expect(first.next.toString()).toBe(expected);
      expect(resolveWorkspaceParams(first.next).changed).toBe(false);
    });
  }
});

describe('studentTabPath', () => {
  it('builds a canonical prep link', () => {
    expect(studentTabPath('abc', 'prep')).toBe('/student/abc?tab=prep');
  });

  it('appends extras and skips empty values', () => {
    expect(studentTabPath('abc', 'model', { view: 'goals', focus: '' })).toBe(
      '/student/abc?tab=model&view=goals',
    );
  });
});
