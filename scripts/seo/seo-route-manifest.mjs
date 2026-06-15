import fs from 'node:fs';
import path from 'node:path';
import { getPseoRouteInventory } from './pseo-index-policy.mjs';

export const CORE_SEO_ROUTES = [
  '/about',
  '/pricing',
  '/one-minute-prep',
  '/how-it-works',
  '/blog',
  '/what-to-teach-next',
  '/authors/jan-brzostowski',
  '/authors/martha',
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
  return getPseoRouteInventory({ root }).indexableTopicLevelRoutes;
}

export function getPersonaRoutes({ root }) {
  return getPseoRouteInventory({ root }).indexablePersonaRoutes;
}

export function getPriorityExerciseTopicRoutes({ root }) {
  return getPseoRouteInventory({ root }).indexableExerciseTopicRoutes;
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
