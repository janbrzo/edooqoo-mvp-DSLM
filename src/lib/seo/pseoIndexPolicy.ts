import policy from '@/data/pseoIndexPolicy.json';

export interface PseoDecisionCriteria {
  useCase: string;
  contraindication: string;
  taskExample: string;
  qualityCriterion: string;
  referencePath: string;
  referenceLabel: string;
}

export interface PseoTopicPolicy extends PseoDecisionCriteria {
  validLevels: string[];
  exerciseTypes: string[];
}

const topicPolicies = policy.topics as Record<string, PseoTopicPolicy>;
const personaPolicies = policy.personas as Record<string, PseoDecisionCriteria>;

export const getTopicIndexPolicy = (topicSlug: string) => topicPolicies[topicSlug];
export const getPersonaIndexPolicy = (personaSlug: string) => personaPolicies[personaSlug];

export const isIndexableTopicLevel = (topicSlug: string, levelSlug: string) =>
  Boolean(topicPolicies[topicSlug]?.validLevels.includes(levelSlug));

export const isIndexableExerciseTopic = (exerciseTypeSlug: string, topicSlug: string) =>
  Boolean(topicPolicies[topicSlug]?.exerciseTypes.includes(exerciseTypeSlug));

export const isIndexablePersona = (personaSlug: string) => Boolean(personaPolicies[personaSlug]);

export const INDEXABLE_TOPIC_SLUGS = Object.keys(topicPolicies);
export const INDEXABLE_PERSONA_SLUGS = Object.keys(personaPolicies);
