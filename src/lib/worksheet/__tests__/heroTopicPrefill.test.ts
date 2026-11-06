import { describe, expect, it } from 'vitest';
import {
  HERO_TOPIC_MAX_LENGTH,
  normalizeHeroLessonTopic,
  readHeroLessonTopicPrefill,
} from '../heroTopicPrefill';

describe('hero topic prefill', () => {
  it('trims the topic and caps it at the worksheet form limit', () => {
    expect(normalizeHeroLessonTopic(`  ${'a'.repeat(240)}  `)).toHaveLength(HERO_TOPIC_MAX_LENGTH);
  });

  it('ignores empty and malformed events', () => {
    expect(readHeroLessonTopicPrefill({ detail: { topic: '   ' } } as unknown as Event)).toBeNull();
    expect(readHeroLessonTopicPrefill({ detail: { topic: 42 } } as unknown as Event)).toBeNull();
    expect(readHeroLessonTopicPrefill({} as unknown as Event)).toBeNull();
  });

  it('reads a valid topic without turning the event into generation intent', () => {
    const event = { detail: { topic: '  Negotiating a deadline  ' } } as unknown as Event;
    expect(readHeroLessonTopicPrefill(event)).toBe('Negotiating a deadline');
  });
});
