import fs from 'node:fs';
import path from 'node:path';

export const CORE_SEO_ROUTES = [
  '/about',
  '/pricing',
  '/one-minute-prep',
  '/how-it-works',
  '/blog',
  '/glossary',
  '/prompts',
  '/exercise-types',
  '/resources',
  '/cookie-policy',
  '/privacy-policy',
  '/features/dslm',
  '/features/homework',
  '/features/flashcards',
  '/features/calendar',
  '/features/live-sessions',
  '/features/placement-test',
  '/features/student-hub',
  '/esl-worksheets',
  '/for-english-tutors',
  '/resources/esl-class-toolkit',
  '/blog/english-games-for-learners',
  '/blog/esl-games-for-teachers',
  '/blog/teach-english-online-guide',
  '/tools',
  '/tools/cefr-level-test',
  '/tools/lesson-plan-generator',
  '/tools/vocab-cefr-checker',
  '/gallery',
];

export const PRIORITY_EXERCISE_TOPICS = [
  'present-perfect',
  'past-simple',
  'conditionals',
  'modal-verbs',
  'phrasal-verbs',
  'business-email',
  'job-interview',
  'meetings',
  'travel-vocabulary',
  'ielts-writing-task-2',
];

export function getSitemapRoutes({ root }) {
  const sitemapPath = path.resolve(root, 'public', 'sitemap.xml');
  const xml = fs.readFileSync(sitemapPath, 'utf8');
  const routes = [];
  const re = /<loc>https:\/\/edooqoo\.com([^<]+)<\/loc>/g;
  let match;

  while ((match = re.exec(xml))) {
    routes.push(match[1] === '' ? '/' : match[1]);
  }

  return [...new Set(routes)].sort();
}

export function getTopicLevelRoutes({ root }) {
  return getSitemapRoutes({ root }).filter((route) =>
    /^\/esl-worksheets\/[^/]+\/[^/]+$/.test(route)
  );
}

export function getPersonaRoutes({ root }) {
  return getSitemapRoutes({ root }).filter((route) =>
    /^\/english-for\/[^/]+$/.test(route)
  );
}

export function getPriorityExerciseTopicRoutes({ root }) {
  return getSitemapRoutes({ root }).filter((route) => {
    const match = route.match(/^\/worksheets\/[^/]+\/([^/]+)$/);
    return match ? PRIORITY_EXERCISE_TOPICS.includes(match[1]) : false;
  });
}

export function getPrerenderRoutes({ root }) {
  const routes = [
    ...CORE_SEO_ROUTES,
    ...getTopicLevelRoutes({ root }),
    ...getPersonaRoutes({ root }),
    ...getPriorityExerciseTopicRoutes({ root }),
  ];

  return [...new Set(routes)].sort();
}
