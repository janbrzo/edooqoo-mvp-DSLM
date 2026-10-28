/**
 * Server-side search and sort of the worksheet list.
 *
 * Why: search and sort used to run in the browser over the 20 rows of the
 * current page, so a title from page 10 was never found and the header showed
 * the page size instead of the number of worksheets.
 */

export type WorksheetListSort = 'date' | 'name' | 'student';

export interface WorksheetListOptions {
  /** Free text matched against the title and the lesson topic. */
  search?: string;
  /** Students whose name matches the search text (resolved by the caller, names live in another table). */
  studentIdsMatchingSearch?: string[];
  sortBy?: WorksheetListSort;
  ascending?: boolean;
}

/** Escapes LIKE wildcards so user text is matched literally. */
export function escapeLikeTerm(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Quotes a value for a PostgREST `or=(...)` filter (commas and parentheses stay literal). */
function quoteFilterValue(value: string): string {
  return `"${value.replace(/[\\"]/g, (char) => `\\${char}`)}"`;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Value of the PostgREST `or` filter for a search term, or null when there is
 * nothing to search. Matches the title, the lesson topic and assigned students.
 */
export function buildSearchFilter(search: string | undefined, studentIds: string[] = []): string | null {
  const term = (search ?? '').trim().slice(0, 100);
  if (!term) return null;

  const pattern = quoteFilterValue(`%${escapeLikeTerm(term)}%`);
  const clauses = [`title.ilike.${pattern}`, `form_data->>lessonTopic.ilike.${pattern}`];

  const ids = studentIds.filter((id) => UUID_PATTERN.test(id));
  if (ids.length > 0) clauses.push(`student_id.in.(${ids.join(',')})`);

  return clauses.join(',');
}

export interface ListOrdering {
  column: string;
  ascending: boolean;
}

/** Ordering columns, newest first by default. `student` groups worksheets by student. */
export function resolveListOrdering(
  sortBy: WorksheetListSort | undefined,
  ascending: boolean | undefined,
  defaultColumn: string,
): ListOrdering[] {
  const asc = ascending ?? false;
  switch (sortBy) {
    case 'name':
      return [{ column: 'title', ascending: asc }, { column: defaultColumn, ascending: false }];
    case 'student':
      return [{ column: 'student_id', ascending: asc }, { column: defaultColumn, ascending: false }];
    case 'date':
      return [{ column: defaultColumn, ascending: asc }];
    default:
      return [{ column: defaultColumn, ascending: false }];
  }
}

interface ListQueryBuilder<T> {
  or(filters: string): T;
  order(column: string, options: { ascending: boolean }): T;
}

/** Applies search and ordering to a supabase query builder. */
export function applyWorksheetListOptions<T extends ListQueryBuilder<T>>(
  query: T,
  options: WorksheetListOptions | undefined,
  defaultColumn: string,
): T {
  let next = query;
  const filter = buildSearchFilter(options?.search, options?.studentIdsMatchingSearch);
  if (filter) next = next.or(filter);
  for (const { column, ascending } of resolveListOrdering(options?.sortBy, options?.ascending, defaultColumn)) {
    next = next.order(column, { ascending });
  }
  return next;
}
