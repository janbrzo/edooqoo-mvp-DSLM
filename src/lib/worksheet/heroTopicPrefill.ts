export const HERO_TOPIC_PREFILL_EVENT = 'worksheet:heroTopicPrefill';
export const HERO_TOPIC_MAX_LENGTH = 200;

export function normalizeHeroLessonTopic(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, HERO_TOPIC_MAX_LENGTH) : '';
}

export function readHeroLessonTopicPrefill(event: Event): string | null {
  const detail = (event as CustomEvent<{ topic?: unknown }>).detail;
  const topic = normalizeHeroLessonTopic(detail?.topic);
  return topic || null;
}
