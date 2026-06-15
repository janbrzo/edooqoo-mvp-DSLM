import fs from 'node:fs';
import path from 'node:path';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function getPseoPolicyData({ root }) {
  const matrix = readJson(path.join(root, 'src', 'data', 'pseoMatrix.json'));
  const policy = readJson(path.join(root, 'src', 'data', 'pseoIndexPolicy.json'));
  return { matrix, policy };
}

export function validatePseoPolicy({ root }) {
  const { matrix, policy } = getPseoPolicyData({ root });
  const topicSlugs = new Set(matrix.topics.map((item) => item.slug));
  const levelSlugs = new Set(matrix.levels.map((item) => item.slug));
  const exerciseSlugs = new Set(matrix.exerciseTypes.map((item) => item.slug));
  const personaSlugs = new Set(matrix.personas.map((item) => item.slug));
  const issues = [];

  if (Object.keys(policy.topics).length !== 10) {
    issues.push(`Expected 10 indexed topics, found ${Object.keys(policy.topics).length}`);
  }
  if (Object.keys(policy.personas).length !== 10) {
    issues.push(`Expected 10 indexed personas, found ${Object.keys(policy.personas).length}`);
  }

  for (const [topicSlug, topicPolicy] of Object.entries(policy.topics)) {
    if (!topicSlugs.has(topicSlug)) issues.push(`Unknown topic ${topicSlug}`);
    if (topicPolicy.exerciseTypes.length !== 5) {
      issues.push(`${topicSlug} must define exactly 5 exercise types`);
    }
    if (!topicPolicy.validLevels.length) issues.push(`${topicSlug} has no valid levels`);
    for (const levelSlug of topicPolicy.validLevels) {
      if (!levelSlugs.has(levelSlug)) issues.push(`${topicSlug} uses unknown level ${levelSlug}`);
    }
    for (const exerciseSlug of topicPolicy.exerciseTypes) {
      if (!exerciseSlugs.has(exerciseSlug)) {
        issues.push(`${topicSlug} uses unknown exercise type ${exerciseSlug}`);
      }
    }
    for (const field of [
      'useCase',
      'contraindication',
      'taskExample',
      'qualityCriterion',
      'referencePath',
      'referenceLabel',
    ]) {
      if (!topicPolicy[field]) issues.push(`${topicSlug} is missing ${field}`);
    }
  }

  for (const [personaSlug, personaPolicy] of Object.entries(policy.personas)) {
    if (!personaSlugs.has(personaSlug)) issues.push(`Unknown persona ${personaSlug}`);
    for (const field of [
      'useCase',
      'contraindication',
      'taskExample',
      'qualityCriterion',
      'referencePath',
      'referenceLabel',
    ]) {
      if (!personaPolicy[field]) issues.push(`${personaSlug} is missing ${field}`);
    }
  }

  if (issues.length) throw new Error(issues.join('\n'));
  return { matrix, policy };
}

export function getPseoRouteInventory({ root }) {
  const { matrix, policy } = validatePseoPolicy({ root });
  const indexableTopicLevelRoutes = Object.entries(policy.topics).flatMap(
    ([topicSlug, topicPolicy]) =>
      topicPolicy.validLevels.map((levelSlug) => `/esl-worksheets/${topicSlug}/${levelSlug}`),
  );
  const indexableExerciseTopicRoutes = Object.entries(policy.topics).flatMap(
    ([topicSlug, topicPolicy]) =>
      topicPolicy.exerciseTypes.map((exerciseSlug) => `/worksheets/${exerciseSlug}/${topicSlug}`),
  );
  const indexablePersonaRoutes = Object.keys(policy.personas)
    .map((personaSlug) => `/english-for/${personaSlug}`);

  const allTopicLevelRoutes = matrix.topics.flatMap((topic) =>
    matrix.levels.map((level) => `/esl-worksheets/${topic.slug}/${level.slug}`),
  );
  const allExerciseTopicRoutes = matrix.exerciseTypes.flatMap((exerciseType) =>
    matrix.topics.map((topic) => `/worksheets/${exerciseType.slug}/${topic.slug}`),
  );
  const allPersonaRoutes = matrix.personas.map((persona) => `/english-for/${persona.slug}`);

  const indexable = [
    ...indexableTopicLevelRoutes,
    ...indexableExerciseTopicRoutes,
    ...indexablePersonaRoutes,
  ];
  const indexableSet = new Set(indexable);
  const all = [...allTopicLevelRoutes, ...allExerciseTopicRoutes, ...allPersonaRoutes];
  const noindex = all.filter((route) => !indexableSet.has(route));

  return {
    indexable: [...new Set(indexable)].sort(),
    noindex: [...new Set(noindex)].sort(),
    indexableTopicLevelRoutes: [...new Set(indexableTopicLevelRoutes)].sort(),
    indexableExerciseTopicRoutes: [...new Set(indexableExerciseTopicRoutes)].sort(),
    indexablePersonaRoutes: [...new Set(indexablePersonaRoutes)].sort(),
  };
}
