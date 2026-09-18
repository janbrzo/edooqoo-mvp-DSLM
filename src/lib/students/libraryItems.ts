/**
 * Pure data rules for the Student Workspace Library (v6.9.111, M6 step 1).
 *
 * UI components receive a small, stable item shape instead of depending on
 * the worksheet query model. This module contains no React, Supabase or
 * browser state and never mutates caller-owned arrays.
 */

import { format } from 'date-fns';

export type LibrarySection = 'worksheets' | 'flashcards' | 'homework';
export type LibrarySort = 'newest' | 'oldest' | 'title';

export const LIBRARY_PAGE_SIZE = 10;

export const LIBRARY_SECTIONS: readonly LibrarySection[] = [
  'worksheets',
  'flashcards',
  'homework',
];

export const LIBRARY_SECTION_LABELS: Record<LibrarySection, string> = {
  worksheets: 'Worksheets',
  flashcards: 'Flashcards',
  homework: 'Homework',
};

export interface LibraryWorksheetSource {
  id: string;
  title?: string | null;
  created_at: string;
  deleted_at?: string | null;
  form_data?: {
    grammar?: string | null;
  } | null;
  share_token?: string | null;
  student_id?: string | null;
  hasImage?: boolean;
  hasAudio?: boolean;
}

export interface LibraryWorksheetItem {
  id: string;
  title: string;
  createdAt: string;
  grammar: string | null;
  hasImage: boolean;
  hasAudio: boolean;
  isShared: boolean;
  shareToken: string | null;
  studentId: string | null;
}

const normalizeOptionalText = (value: string | null | undefined): string | null => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

export function buildWorksheetItems(
  rows: readonly LibraryWorksheetSource[],
): LibraryWorksheetItem[] {
  return rows
    .filter((row) => !row.deleted_at)
    .map((row) => ({
      id: row.id,
      title: normalizeOptionalText(row.title) ?? 'Untitled worksheet',
      createdAt: row.created_at,
      grammar: normalizeOptionalText(row.form_data?.grammar),
      hasImage: row.hasImage === true,
      hasAudio: row.hasAudio === true,
      isShared: Boolean(normalizeOptionalText(row.share_token)),
      shareToken: normalizeOptionalText(row.share_token),
      studentId: normalizeOptionalText(row.student_id),
    }));
}

export function filterBySearch(
  items: readonly LibraryWorksheetItem[],
  query: string,
): readonly LibraryWorksheetItem[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return items;

  return items.filter((item) =>
    item.title.toLocaleLowerCase().includes(needle)
      || item.grammar?.toLocaleLowerCase().includes(needle),
  );
}

const compareIds = (a: LibraryWorksheetItem, b: LibraryWorksheetItem): number =>
  a.id.localeCompare(b.id);

export function sortItems(
  items: readonly LibraryWorksheetItem[],
  sort: LibrarySort,
): LibraryWorksheetItem[] {
  return [...items].sort((a, b) => {
    let result = 0;

    if (sort === 'title') {
      result = a.title.localeCompare(b.title, undefined, { sensitivity: 'base' });
    } else {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      result = sort === 'newest' ? bTime - aTime : aTime - bTime;
    }

    return result || compareIds(a, b);
  });
}

export function formatLibraryDate(iso: string): string {
  return format(new Date(iso), 'MMM dd, yyyy HH:mm');
}