import { CalendarSlot } from '@/hooks/useCalendarSlots';

export interface PositionedSlot {
  slot: CalendarSlot;
  columnIndex: number;
  columnCount: number;
  isOverlapping: boolean;
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function slotsOverlap(a: CalendarSlot, b: CalendarSlot): boolean {
  return timeToMinutes(a.start_time) < timeToMinutes(b.end_time) &&
         timeToMinutes(a.end_time) > timeToMinutes(b.start_time);
}

/**
 * Assigns column positions to overlapping slots so they render side-by-side.
 */
export function detectOverlaps(slots: CalendarSlot[]): PositionedSlot[] {
  if (slots.length === 0) return [];

  const sorted = [...slots].sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time));

  // Build adjacency: which slots overlap with which
  const overlaps = new Map<string, Set<string>>();
  for (const s of sorted) overlaps.set(s.id, new Set());

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      if (timeToMinutes(sorted[j].start_time) >= timeToMinutes(sorted[i].end_time)) break;
      if (slotsOverlap(sorted[i], sorted[j])) {
        overlaps.get(sorted[i].id)!.add(sorted[j].id);
        overlaps.get(sorted[j].id)!.add(sorted[i].id);
      }
    }
  }

  // Greedy column assignment
  const columnAssignment = new Map<string, number>();

  for (const s of sorted) {
    const neighbors = overlaps.get(s.id)!;
    const usedColumns = new Set<number>();
    for (const nId of neighbors) {
      if (columnAssignment.has(nId)) {
        usedColumns.add(columnAssignment.get(nId)!);
      }
    }
    let col = 0;
    while (usedColumns.has(col)) col++;
    columnAssignment.set(s.id, col);
  }

  // Determine column count for each group of overlapping slots
  // Group = slot + all transitively connected overlapping slots
  const visited = new Set<string>();
  const groups: string[][] = [];

  function dfs(id: string, group: string[]) {
    visited.add(id);
    group.push(id);
    for (const nId of overlaps.get(id)!) {
      if (!visited.has(nId)) dfs(nId, group);
    }
  }

  for (const s of sorted) {
    if (!visited.has(s.id)) {
      const group: string[] = [];
      dfs(s.id, group);
      groups.push(group);
    }
  }

  const columnCountMap = new Map<string, number>();
  for (const group of groups) {
    const maxCol = Math.max(...group.map(id => columnAssignment.get(id)!)) + 1;
    for (const id of group) {
      columnCountMap.set(id, maxCol);
    }
  }

  return sorted.map(s => ({
    slot: s,
    columnIndex: columnAssignment.get(s.id)!,
    columnCount: columnCountMap.get(s.id)!,
    isOverlapping: columnCountMap.get(s.id)! > 1,
  }));
}
