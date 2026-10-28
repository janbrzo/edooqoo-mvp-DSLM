import { describe, it, expect } from 'vitest';
import { applyWorksheetListOptions, buildSearchFilter, escapeLikeTerm, resolveListOrdering } from '../listQuery';

class FakeQuery {
  calls: Array<[string, ...unknown[]]> = [];
  or(filters: string) {
    this.calls.push(['or', filters]);
    return this;
  }
  order(column: string, options: { ascending: boolean }) {
    this.calls.push(['order', column, options.ascending]);
    return this;
  }
}

const STUDENT = '4ee84131-4ac8-4931-86ee-e116234e7e1f';

describe('buildSearchFilter', () => {
  it('searches the title and the lesson topic in the query, not in the page', () => {
    expect(buildSearchFilter('Interview')).toBe(
      'title.ilike."%Interview%",form_data->>lessonTopic.ilike."%Interview%"',
    );
  });

  it('returns null for blank text', () => {
    expect(buildSearchFilter('   ')).toBeNull();
    expect(buildSearchFilter(undefined)).toBeNull();
  });

  it('includes students whose name matched, and drops anything that is not a uuid', () => {
    const filter = buildSearchFilter('anna', [STUDENT, 'x),title.eq.1']);
    expect(filter).toContain(`student_id.in.(${STUDENT})`);
    expect(filter).not.toContain('title.eq.1');
  });

  it('keeps commas, parentheses and quotes literal and escapes LIKE wildcards', () => {
    expect(escapeLikeTerm('50%_off\\')).toBe('50\\%\\_off\\\\');
    const filter = buildSearchFilter('a,b)"c%')!;
    expect(filter.startsWith('title.ilike."%a,b)\\"c\\\\%%"')).toBe(true);
    // exactly three top-level clauses are never exceeded by injected commas
    expect(filter.split('",').length).toBe(2);
  });
});

describe('resolveListOrdering', () => {
  it('defaults to newest first', () => {
    expect(resolveListOrdering(undefined, undefined, 'created_at')).toEqual([{ column: 'created_at', ascending: false }]);
  });

  it('orders by the chosen column with a stable date tiebreak', () => {
    expect(resolveListOrdering('name', true, 'created_at')).toEqual([
      { column: 'title', ascending: true },
      { column: 'created_at', ascending: false },
    ]);
    expect(resolveListOrdering('date', true, 'deleted_at')).toEqual([{ column: 'deleted_at', ascending: true }]);
  });
});

describe('applyWorksheetListOptions', () => {
  it('applies the search filter and ordering to the query', () => {
    const query = new FakeQuery();
    applyWorksheetListOptions(query, { search: 'past simple', sortBy: 'name', ascending: false }, 'created_at');
    expect(query.calls[0][0]).toBe('or');
    expect(query.calls.slice(1)).toEqual([
      ['order', 'title', false],
      ['order', 'created_at', false],
    ]);
  });

  it('does not filter without a search term', () => {
    const query = new FakeQuery();
    applyWorksheetListOptions(query, undefined, 'created_at');
    expect(query.calls).toEqual([['order', 'created_at', false]]);
  });
});
