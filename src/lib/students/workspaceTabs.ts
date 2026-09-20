/**
 * workspaceTabs — pure URL contract for the Student Workspace (v6.9.111, phase M1).
 *
 * The student page moves from 7 visible (+4 hidden) tabs to 4 canonical tabs:
 * prep | timeline | library | model. Legacy `?tab=` links live in sent emails,
 * bookmarks and Edge Function templates, so the alias map below is permanent,
 * not transitional.
 *
 * No React, no Supabase, no globals — every rule here is unit-testable.
 */

export type WorkspaceTab = 'prep' | 'timeline' | 'library' | 'model';
export type LibrarySection = 'worksheets' | 'flashcards' | 'homework';
export type TimelineFilter =
  | 'all'
  | 'lessons'
  | 'worksheets'
  | 'homework'
  | 'notes'
  | 'tests';

export interface ResolvedTab {
  tab: WorkspaceTab;
  section?: LibrarySection;
  filter?: TimelineFilter;
  view?: string;
  /** true when the raw input was not already a canonical tab value */
  changed: boolean;
}

/** A deliberate in-workspace navigation initiated by the teacher. */
export type WorkspaceNavigationTarget =
  | { tab: 'prep' }
  | { tab: 'timeline'; filter?: TimelineFilter; testId?: string }
  | { tab: 'library'; section?: LibrarySection; set?: string }
  | {
      tab: 'model';
      view?: string;
      focus?: string;
      editSuggestion?: string;
      cacheKey?: string;
    };

/** Render order of the tab strip. */
export const WORKSPACE_TABS: readonly WorkspaceTab[] = [
  'prep',
  'timeline',
  'library',
  'model',
] as const;

export const LIBRARY_SECTIONS: readonly LibrarySection[] = [
  'worksheets',
  'flashcards',
  'homework',
] as const;

export const TIMELINE_FILTERS: readonly TimelineFilter[] = [
  'all',
  'lessons',
  'worksheets',
  'homework',
  'notes',
  'tests',
] as const;

export const DEFAULT_TAB: WorkspaceTab = 'prep';

interface AliasTarget {
  tab: WorkspaceTab;
  section?: LibrarySection;
  filter?: TimelineFilter;
  view?: string;
}

/** Legacy `?tab=` values → canonical workspace state. Permanent. */
export const TAB_ALIASES: Readonly<Record<string, AliasTarget>> = {
  overview: { tab: 'prep' },
  dslm: { tab: 'model' },
  '1minute': { tab: 'model' },
  progress: { tab: 'model', view: 'pathway' },
  skills: { tab: 'model', view: 'skills' },
  knowledge: { tab: 'model', view: 'profile' },
  events: { tab: 'model', view: 'profile' },
  worksheets: { tab: 'library', section: 'worksheets' },
  flashcards: { tab: 'library', section: 'flashcards' },
  homework: { tab: 'timeline', filter: 'homework' },
  tests: { tab: 'timeline', filter: 'tests' },
  calendar: { tab: 'timeline', filter: 'lessons' },
};

/** Params that must survive any URL rewrite. */
export const PRESERVED_PARAMS: readonly string[] = [
  'set',
  'intake',
  'view',
  'focus',
  'testId',
  '_',
  'editSuggestion',
] as const;

export function isWorkspaceTab(value: string | null | undefined): value is WorkspaceTab {
  return !!value && (WORKSPACE_TABS as readonly string[]).includes(value);
}

function isLibrarySection(value: string | null | undefined): value is LibrarySection {
  return !!value && (LIBRARY_SECTIONS as readonly string[]).includes(value);
}

function isTimelineFilter(value: string | null | undefined): value is TimelineFilter {
  return !!value && (TIMELINE_FILTERS as readonly string[]).includes(value);
}

function clean(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * Translate any `?tab=` value into canonical workspace state.
 * Unknown / missing values fall back to `prep`. Never throws.
 */
export function resolveTab(raw: string | null | undefined): ResolvedTab {
  const value = clean(raw);

  if (isWorkspaceTab(value)) {
    return { tab: value, changed: false };
  }

  const alias = TAB_ALIASES[value];
  if (alias) {
    return { ...alias, changed: true };
  }

  return { tab: DEFAULT_TAB, changed: true };
}

function serialize(params: URLSearchParams): string {
  return [...params.entries()]
    .map(([k, v]) => `${k}=${v}`)
    .sort()
    .join('&');
}

/**
 * URL-level wrapper: resolves the tab and rebuilds the query string with
 * canonical values, preserving every pass-through param.
 * Explicit params in the input always win over alias defaults.
 * Idempotent — feeding `next` back in yields `changed: false`.
 */
export function resolveWorkspaceParams(params: URLSearchParams): {
  resolved: ResolvedTab;
  next: URLSearchParams;
  changed: boolean;
} {
  const base = resolveTab(params.get('tab'));

  const explicitSection = params.get('section');
  const explicitFilter = params.get('filter');
  const explicitView = params.get('view');

  const section = isLibrarySection(explicitSection) ? explicitSection : base.section;
  const filter = isTimelineFilter(explicitFilter) ? explicitFilter : base.filter;
  const view = explicitView || base.view;

  const next = new URLSearchParams();
  next.set('tab', base.tab);
  if (base.tab === 'library' && section) next.set('section', section);
  if (base.tab === 'timeline' && filter) next.set('filter', filter);

  for (const key of PRESERVED_PARAMS) {
    if (key === 'view') {
      if (view) next.set('view', view);
      continue;
    }
    const value = params.get(key);
    if (value !== null) next.set(key, value);
  }

  const changed = serialize(next) !== serialize(params);

  const resolved: ResolvedTab = {
    tab: base.tab,
    ...(section ? { section } : {}),
    ...(filter ? { filter } : {}),
    ...(view ? { view } : {}),
    changed,
  };

  return { resolved, next, changed };
}

function setNonEmpty(params: URLSearchParams, key: string, value: string | undefined): void {
  if (value?.trim()) params.set(key, value);
}

/**
 * Build params for an intentional navigation inside the workspace.
 *
 * Unlike resolveWorkspaceParams(), this removes state owned by other tabs.
 * `intake` is the only cross-tab workflow param and therefore survives every
 * teacher-initiated navigation until its owning flow consumes it.
 */
export function buildWorkspaceParams(
  current: URLSearchParams,
  target: WorkspaceNavigationTarget,
): URLSearchParams {
  const next = new URLSearchParams();
  next.set('tab', target.tab);

  const intake = current.get('intake');
  if (intake !== null) next.set('intake', intake);

  switch (target.tab) {
    case 'prep':
      break;
    case 'timeline':
      if (target.filter) next.set('filter', target.filter);
      if (target.filter === 'tests') setNonEmpty(next, 'testId', target.testId);
      break;
    case 'library':
      if (target.section) next.set('section', target.section);
      if (target.section === 'flashcards') setNonEmpty(next, 'set', target.set);
      break;
    case 'model':
      setNonEmpty(next, 'view', target.view);
      setNonEmpty(next, 'focus', target.focus);
      setNonEmpty(next, 'editSuggestion', target.editSuggestion);
      setNonEmpty(next, '_', target.cacheKey);
      break;
  }

  return next;
}

/** Canonical link builder for the student workspace. */
export function studentTabPath(
  studentId: string,
  tab: WorkspaceTab,
  extra?: Record<string, string>,
): string {
  const params = new URLSearchParams({ tab });
  for (const [key, value] of Object.entries(extra ?? {})) {
    if (value !== undefined && value !== null && value !== '') params.set(key, value);
  }
  return `/student/${studentId}?${params.toString()}`;
}
