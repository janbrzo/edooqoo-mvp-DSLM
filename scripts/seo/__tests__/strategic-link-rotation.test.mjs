import { describe, expect, it } from 'vitest';
import { allocateStrategicLinks, STRATEGIC_LINK_DESTINATIONS } from '../strategic-link-rotation.mjs';

const destinations = [
  ['/blog/exam-worksheets.html', 'Exam tasks', 'assessment', 2],
  ['/blog/lesson-prep.html', 'Lesson prep', 'planning', 2],
];
const sources = Array.from({ length: 6 }, (_, i) => ({
  route: `/blog/english-lesson-worksheet-${i}.html`, existingLinks: [],
}));
const eligible = new Set([...sources.map((source) => source.route), ...destinations.map(([route]) => route)]);

describe('strategic link allocation', () => {
  it('is deterministic regardless of donor enumeration order', () => {
    expect(allocateStrategicLinks(sources, eligible, destinations))
      .toEqual(allocateStrategicLinks([...sources].reverse(), eligible, destinations));
  });

  it('assigns the requested number of distinct donors without exceeding three extra links', () => {
    const allocation = allocateStrategicLinks(sources, eligible, destinations);
    for (const [route, , , count] of destinations) {
      expect([...allocation.values()].filter((links) => links.some(([target]) => target === route)))
        .toHaveLength(count);
    }
    for (const links of allocation.values()) {
      expect(links.length).toBeLessThanOrEqual(3);
      expect(new Set(links.map(([route]) => route)).size).toBe(links.length);
    }
  });

  it('excludes ineligible sources and destinations, including retired routes', () => {
    const restricted = new Set([sources[0].route, sources[1].route, destinations[0][0]]);
    const allocation = allocateStrategicLinks(sources, restricted, destinations);
    expect([...allocation.keys()]).toEqual([sources[0].route, sources[1].route]);
    expect([...allocation.values()].flat().map(([route]) => route))
      .toEqual([destinations[0][0], destinations[0][0]]);
  });

  it('never adds self links or a target already linked from the donor', () => {
    const donors = [
      { route: destinations[0][0], existingLinks: [] },
      { ...sources[0], existingLinks: [[destinations[0][0], 'Existing']] },
      sources[1], sources[2],
    ];
    const allocation = allocateStrategicLinks(donors, eligible, [destinations[0]]);
    expect(allocation.get(destinations[0][0])).toEqual([]);
    expect(allocation.get(sources[0].route)).toEqual([]);
    expect(allocation.get(sources[1].route)).toHaveLength(1);
    expect(allocation.get(sources[2].route)).toHaveLength(1);
  });

  it('fails explicitly instead of filling capacity with unrelated recommendations', () => {
    const donor = { route: '/blog/calendar-booking.html', existingLinks: [] };
    expect(() => allocateStrategicLinks([donor], new Set([donor.route, destinations[0][0]]), [destinations[0]]))
      .toThrow('Insufficient topic-matched link capacity');
  });

  it('keeps every phase 4.1 orphan and weak-route destination in the targeted rotation', () => {
    const targets = new Set(STRATEGIC_LINK_DESTINATIONS.map(([route]) => route));
    expect(targets.has('/blog/esl-games-for-teachers')).toBe(true);
    for (const route of [
      '/blog/ielts-preparation-worksheets-guide.html',
      '/blog/task-based-language-teaching-worksheets.html',
      '/a1-beginner-english-worksheets.html', '/a2-elementary-english-worksheets.html',
      '/ai-lesson-planning-for-english-teachers.html',
    ]) expect(targets.has(route)).toBe(true);
  });
});