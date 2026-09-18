import { describe, expect, it } from 'vitest';
import {
  buildWorksheetItems,
  filterBySearch,
  formatLibraryDate,
  sortItems,
  type LibraryWorksheetItem,
  type LibraryWorksheetSource,
} from '../libraryItems';

const source = (overrides: Partial<LibraryWorksheetSource> = {}): LibraryWorksheetSource => ({
  id: 'worksheet-1',
  title: 'Client negotiation',
  created_at: '2026-09-18T08:30:00.000Z',
  form_data: { grammar: 'Conditionals' },
  share_token: null,
  student_id: 'student-1',
  hasImage: true,
  hasAudio: false,
  ...overrides,
});

const item = (overrides: Partial<LibraryWorksheetItem> = {}): LibraryWorksheetItem => ({
  id: 'worksheet-1',
  title: 'Client negotiation',
  createdAt: '2026-09-18T08:30:00.000Z',
  grammar: 'Conditionals',
  hasImage: false,
  hasAudio: false,
  isShared: false,
  shareToken: null,
  studentId: 'student-1',
  ...overrides,
});

describe('buildWorksheetItems', () => {
  it('maps the worksheet source into the stable Library shape', () => {
    expect(buildWorksheetItems([source()])).toEqual([{
      id: 'worksheet-1',
      title: 'Client negotiation',
      createdAt: '2026-09-18T08:30:00.000Z',
      grammar: 'Conditionals',
      hasImage: true,
      hasAudio: false,
      isShared: false,
      shareToken: null,
      studentId: 'student-1',
    }]);
  });

  it.each([null, '', '   '])('uses the title fallback for %j', (title) => {
    expect(buildWorksheetItems([source({ title })])[0]?.title).toBe('Untitled worksheet');
  });

  it('omits soft-deleted worksheets', () => {
    expect(buildWorksheetItems([source({ deleted_at: '2026-09-18T09:00:00Z' })])).toEqual([]);
  });

  it('detects a shared worksheet and trims its token', () => {
    expect(buildWorksheetItems([source({ share_token: ' token-123 ' })])[0]).toMatchObject({
      isShared: true,
      shareToken: 'token-123',
    });
  });

  it('does not treat a whitespace-only token as shared', () => {
    expect(buildWorksheetItems([source({ share_token: '  ' })])[0]).toMatchObject({
      isShared: false,
      shareToken: null,
    });
  });
});

describe('filterBySearch', () => {
  const items = [
    item({ id: 'a', title: 'Quarterly REVIEW', grammar: 'Past perfect' }),
    item({ id: 'b', title: 'Client introduction', grammar: 'Conditionals' }),
  ];

  it('matches title case-insensitively and trims the query', () => {
    expect(filterBySearch(items, '  quarterly  ')).toEqual([items[0]]);
  });

  it('matches grammar case-insensitively', () => {
    expect(filterBySearch(items, 'CONDITIONALS')).toEqual([items[1]]);
  });

  it('returns the original input for an empty query', () => {
    expect(filterBySearch(items, '   ')).toBe(items);
  });
});

describe('sortItems', () => {
  const items = [
    item({ id: 'b', title: 'Beta', createdAt: '2026-09-17T08:00:00Z' }),
    item({ id: 'c', title: 'alpha', createdAt: '2026-09-18T08:00:00Z' }),
    item({ id: 'a', title: 'Alpha', createdAt: '2026-09-18T08:00:00Z' }),
  ];

  it('sorts newest first and resolves equal dates by id', () => {
    expect(sortItems(items, 'newest').map(({ id }) => id)).toEqual(['a', 'c', 'b']);
  });

  it('sorts oldest first and resolves equal dates by id', () => {
    expect(sortItems(items, 'oldest').map(({ id }) => id)).toEqual(['b', 'a', 'c']);
  });

  it('sorts titles case-insensitively and resolves equal titles by id', () => {
    expect(sortItems(items, 'title').map(({ id }) => id)).toEqual(['a', 'c', 'b']);
  });

  it('does not mutate the caller-owned array', () => {
    const before = [...items];
    sortItems(items, 'title');
    expect(items).toEqual(before);
  });
});

describe('formatLibraryDate', () => {
  it('formats the date and time for the Library row', () => {
    expect(formatLibraryDate('2026-09-18T08:30:00')).toBe('Sep 18, 2026 08:30');
  });
});