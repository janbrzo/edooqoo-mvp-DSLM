/**
 * Programmatic SEO matrix.
 * Structured source of truth: src/data/pseoMatrix.json.
 */
import matrix from '@/data/pseoMatrix.json';

export interface PseoTopic {
  slug: string;
  label: string;
  category: 'grammar' | 'business' | 'vocabulary' | 'skills' | 'exam';
}

export interface PseoLevel {
  slug: string;
  cefr: 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';
  label: string;
}

export interface PseoExerciseType {
  slug: string;
  label: string;
  category: 'basic' | 'audio' | 'picture';
}

export interface PseoPersona {
  slug: string;
  label: string;
  professionPlural: string;
  domain: string;
}

export const PSEO_TOPICS = matrix.topics as PseoTopic[];
export const PSEO_LEVELS = matrix.levels as PseoLevel[];
export const PSEO_EXERCISE_TYPES = matrix.exerciseTypes as PseoExerciseType[];
export const PSEO_PERSONAS = matrix.personas as PseoPersona[];

export const findTopic = (slug: string) => PSEO_TOPICS.find((topic) => topic.slug === slug);
export const findLevel = (slug: string) => PSEO_LEVELS.find((level) => level.slug === slug);
export const findExerciseType = (slug: string) =>
  PSEO_EXERCISE_TYPES.find((exerciseType) => exerciseType.slug === slug);
export const findPersona = (slug: string) => PSEO_PERSONAS.find((persona) => persona.slug === slug);

export const ALL_TOPIC_LEVEL_PATHS = PSEO_TOPICS.flatMap((topic) =>
  PSEO_LEVELS.map((level) => `/esl-worksheets/${topic.slug}/${level.slug}`)
);
export const ALL_EXERCISE_TOPIC_PATHS = PSEO_EXERCISE_TYPES.flatMap((exerciseType) =>
  PSEO_TOPICS.map((topic) => `/worksheets/${exerciseType.slug}/${topic.slug}`)
);
export const ALL_PERSONA_PATHS = PSEO_PERSONAS.map((persona) => `/english-for/${persona.slug}`);
