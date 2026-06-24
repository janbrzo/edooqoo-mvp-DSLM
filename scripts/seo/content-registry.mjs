import fs from 'node:fs';
import path from 'node:path';
import { getPseoRouteInventory } from './pseo-index-policy.mjs';
import { getDecisionContentRoutes } from './decision-content.mjs';
import { legacyEditorialDecisions } from './x1000-editorial-plan.mjs';

export const CONTENT_STATES = ['keep', 'improve', 'merge', 'retire', 'hold', 'noindex'];
export const INDEXABLE_STATES = new Set(['keep', 'improve', 'hold']);

export const CONTENT_CLUSTERS = [
  'What Should I Teach Next?',
  'One-to-One Lesson Planning',
  'Student Evidence and Progress',
  'Homework and Retention',
  'Adult and Business English',
  'Tutor Business and Tools',
];

const STRATEGIC_BLOG_SLUGS = new Set([
  'adult-esl-student-profile-lesson-planning.html',
  'ai-worksheet-generator-mechanics-for-esl-teachers.html',
  'best-lesson-prep-tool-for-english-tutors.html',
  'business-english-material-generation-workflow.html',
  'can-ai-plan-one-to-one-english-lesson.html',
  'cefr-aligned-worksheet-generation-workflow.html',
  'english-homework-ai-grading-workflow.html',
  'english-tutor-material-organization-workflow.html',
  'esl-exercise-type-selection-guide.html',
  'homework-mistakes-next-english-lesson.html',
  'how-english-tutors-track-what-to-teach-next.html',
  'how-long-should-private-english-tutors-spend-on-lesson-prep.html',
  'learning-pacing-scientific-vs-pragmatic-esl.html',
  'lesson-sequencing-scaffolding-curriculum.html',
  'materials-design-principles-elt.html',
  'needs-analysis-esl-students.html',
  'one-minute-prep-workflow-for-esl-tutors.html',
  'personalized-learning-english-teaching.html',
  'public-esl-worksheet-gallery-quality-standards.html',
  'setting-up-freelance-esl-business.html',
  'spaced-repetition-vocabulary-learning.html',
  'student-progress-to-worksheet-feedback-loop.html',
  'task-based-language-teaching-worksheets.html',
  'teacher-burnout-prevention-esl.html',
  'teaching-business-english-guide.html',
  'teaching-english-online-complete-guide.html',
  'teaching-english-one-to-one.html',
  'what-should-adult-english-placement-test-include.html',
  'what-to-teach-next-private-english-student.html',
  'effective-esl-homework-strategies.html',
  'error-correction-techniques-esl.html',
  'formative-assessment-english-teaching.html',
  'how-to-plan-english-lessons-effectively.html',
  'writing-student-progress-reports-esl.html',
]);

const STRATEGIC_ROOT_HTML = new Set([
  'adult-business-english-lesson-prep.html',
  'ai-grading-tool-for-english-homework.html',
  'ai-lesson-planning-for-english-teachers.html',
  'ai-tools-for-private-english-tutors.html',
  'ai-worksheet-generator-for-english-teachers.html',
  'business-english-worksheet-generator.html',
  'cefr-progress-tracker-english-students.html',
  'cefr-worksheet-generator.html',
  'editable-esl-worksheet-generator.html',
  'english-placement-test-for-private-tutors.html',
  'one-minute-prep-for-english-tutors.html',
  'one-to-one-english-lesson-planner.html',
  'private-english-tutor-crm.html',
  'public-esl-worksheet-examples.html',
  'student-hub-for-english-tutors.html',
]);

export const CONTENT_OVERRIDES = {
  // Add measured keep/improve/merge/retire decisions here after GSC and backlink
  // evidence is recorded. Unknown content remains hold to prevent destructive
  // redirects based only on code inspection.
  '/blog/shadowing-technique-esl.html': {
    state: 'merge',
    redirectTo: '/blog/how-to-teach-english-pronunciation.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired pronunciation technique slug to the closest live adult ESL pronunciation guide.',
  },
  '/blog/teacher-talking-time-reducing.html': {
    state: 'merge',
    redirectTo: '/blog/teaching-english-one-to-one.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired TTT slug to the strategic adult 1:1 lesson-planning guide.',
  },
  '/blog/teaching-functional-language-esl.html': {
    state: 'merge',
    redirectTo: '/blog/teaching-pragmatics-esl.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired functional-language slug to the closest live pragmatics guide.',
  },
  '/blog/teaching-critical-reading-esl.html': {
    state: 'merge',
    redirectTo: '/blog/reading-comprehension-activities-english.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired critical-reading slug to the closest live reading guide.',
  },
  '/blog/conferencing-with-esl-students.html': {
    state: 'merge',
    redirectTo: '/blog/process-writing-approach-esl.html',
    cluster: 'Student Evidence and Progress',
    reason: 'GSC 404 repair: redirect retired writing-conference slug to the live process-writing guide.',
  },
  '/blog/concept-checking-questions-esl.html': {
    state: 'merge',
    redirectTo: '/blog/how-to-teach-english-grammar-effectively.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired CCQ slug to the closest live grammar-teaching guide.',
  },
  '/blog/fluency-activities-esl-classroom.html': {
    state: 'merge',
    redirectTo: '/blog/how-to-teach-speaking-esl.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired fluency activities slug to the live speaking guide.',
  },
  '/blog/teaching-skimming-scanning-esl.html': {
    state: 'merge',
    redirectTo: '/blog/reading-comprehension-activities-english.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired skimming/scanning slug to the closest live reading guide.',
  },
  '/blog/conversation-classes-esl-structure.html': {
    state: 'merge',
    redirectTo: '/blog/how-to-teach-speaking-esl.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired conversation-class slug to the live speaking guide.',
  },
  '/blog/classroom-language-esl-teachers.html': {
    state: 'merge',
    redirectTo: '/blog/teaching-english-one-to-one.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired classroom-language slug to the strategic adult 1:1 guide.',
  },
  '/blog/toeic-preparation-worksheets-guide.html': {
    state: 'merge',
    redirectTo: '/english-worksheets-for-exam-prep.html',
    cluster: 'Adult and Business English',
    reason: 'GSC 404 repair: redirect retired TOEIC worksheet slug to the live exam-prep worksheet page.',
  },
  '/blog/eliciting-techniques-esl-teaching.html': {
    state: 'merge',
    redirectTo: '/blog/how-to-plan-english-lessons-effectively.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired eliciting slug to the live adult lesson-planning guide.',
  },
  '/blog/positive-error-culture-esl.html': {
    state: 'merge',
    redirectTo: '/blog/error-correction-techniques-esl.html',
    cluster: 'Student Evidence and Progress',
    reason: 'GSC 404 repair: redirect retired error-culture slug to the live error-correction guide.',
  },
  '/blog/standardized-test-comparison-esl.html': {
    state: 'merge',
    redirectTo: '/english-worksheets-for-exam-prep.html',
    cluster: 'Adult and Business English',
    reason: 'GSC 404 repair: redirect retired standardized-test slug to the live exam-prep worksheet page.',
  },
  '/blog/toefl-preparation-strategies-teachers.html': {
    state: 'merge',
    redirectTo: '/english-worksheets-for-exam-prep.html',
    cluster: 'Adult and Business English',
    reason: 'GSC 404 repair: redirect retired TOEFL slug to the live exam-prep worksheet page.',
  },
  '/blog/teaching-test-taking-strategies-esl.html': {
    state: 'merge',
    redirectTo: '/english-worksheets-for-exam-prep.html',
    cluster: 'Adult and Business English',
    reason: 'GSC 404 repair: redirect retired test-taking slug to the live exam-prep worksheet page.',
  },
  '/blog/duolingo-english-test-preparation.html': {
    state: 'merge',
    redirectTo: '/english-worksheets-for-exam-prep.html',
    cluster: 'Adult and Business English',
    reason: 'GSC 404 repair: redirect retired Duolingo-test slug to the live exam-prep worksheet page.',
  },
  '/blog/teaching-reading-fluency-esl.html': {
    state: 'merge',
    redirectTo: '/blog/reading-comprehension-activities-english.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired reading-fluency slug to the closest live reading guide.',
  },
  '/blog/graded-readers-guide-esl-teachers.html': {
    state: 'merge',
    redirectTo: '/blog/extensive-reading-programs-esl.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired graded-readers slug to the live extensive-reading guide.',
  },
  '/blog/newspaper-articles-esl-lessons.html': {
    state: 'merge',
    redirectTo: '/blog/current-events-esl-lessons.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired newspaper-articles slug to the live current-events guide.',
  },
  '/blog/oral-correction-timing-techniques.html': {
    state: 'merge',
    redirectTo: '/blog/error-correction-techniques-esl.html',
    cluster: 'Student Evidence and Progress',
    reason: 'GSC 404 repair: redirect retired oral-correction slug to the live error-correction guide.',
  },
  '/blog/giving-instructions-esl-classroom.html': {
    state: 'merge',
    redirectTo: '/blog/how-to-plan-english-lessons-effectively.html',
    cluster: 'One-to-One Lesson Planning',
    reason: 'GSC 404 repair: redirect retired instructions slug to the live adult lesson-planning guide.',
  },
  '/blog/asynchronous-learning-esl.html': {
    state: 'merge',
    redirectTo: '/blog/effective-esl-homework-strategies.html',
    cluster: 'Homework and Retention',
    reason: 'GSC 404 repair: redirect retired asynchronous-learning slug to the live homework-strategy guide.',
  },
  '/blog/marking-codes-esl-writing.html': {
    state: 'merge',
    redirectTo: '/blog/error-correction-techniques-esl.html',
    cluster: 'Student Evidence and Progress',
    reason: 'GSC 404 repair: redirect retired marking-codes slug to the live error-correction guide.',
  },
  '/blog/adult-esl-student-profile-lesson-planning.html': {
    state: 'keep',
    cluster: 'Student Evidence and Progress',
    reason: 'Strategic adult 1:1 student-evidence resource.',
  },
  '/blog/best-lesson-prep-tool-for-english-tutors.html': {
    state: 'keep',
    cluster: 'Tutor Business and Tools',
    reason: 'Strategic English tutor tool-selection resource.',
  },
  '/blog/can-ai-plan-one-to-one-english-lesson.html': {
    state: 'keep',
    cluster: 'One-to-One Lesson Planning',
    reason: 'Strategic teacher-reviewed AI lesson-planning resource.',
  },
  '/blog/homework-mistakes-next-english-lesson.html': {
    state: 'keep',
    cluster: 'Homework and Retention',
    reason: 'Strategic homework-to-next-lesson evidence resource.',
  },
  '/blog/how-english-tutors-track-what-to-teach-next.html': {
    state: 'keep',
    cluster: 'Student Evidence and Progress',
    reason: 'Strategic compact progress-evidence resource.',
  },
  '/blog/how-long-should-private-english-tutors-spend-on-lesson-prep.html': {
    state: 'keep',
    cluster: 'Tutor Business and Tools',
    reason: 'Strategic recurring lesson-preparation benchmark resource.',
  },
  '/blog/teaching-english-one-to-one.html': {
    state: 'keep',
    cluster: 'One-to-One Lesson Planning',
    reason: 'Strategic complete guide for adult 1:1 lesson planning.',
  },
  '/blog/what-should-adult-english-placement-test-include.html': {
    state: 'keep',
    cluster: 'Student Evidence and Progress',
    reason: 'Strategic adult placement-test evidence resource.',
  },
  '/blog/what-to-teach-next-private-english-student.html': {
    state: 'keep',
    cluster: 'What Should I Teach Next?',
    reason: 'Strategic next-lesson decision framework.',
  },
  '/blog/how-to-plan-english-lessons-effectively.html': {
    state: 'keep',
    cluster: 'One-to-One Lesson Planning',
    reason: 'Strategic adult one-to-one lesson-planning workflow.',
  },
  '/blog/needs-analysis-esl-students.html': {
    state: 'keep',
    cluster: 'Student Evidence and Progress',
    reason: 'Strategic adult needs-analysis workflow.',
  },
  '/blog/lesson-sequencing-scaffolding-curriculum.html': {
    state: 'keep',
    cluster: 'One-to-One Lesson Planning',
    reason: 'Strategic lesson-sequencing and scaffolding resource.',
  },
  '/blog/formative-assessment-english-teaching.html': {
    state: 'keep',
    cluster: 'Student Evidence and Progress',
    reason: 'Strategic formative-assessment evidence cycle.',
  },
  '/blog/error-correction-techniques-esl.html': {
    state: 'keep',
    cluster: 'Student Evidence and Progress',
    reason: 'Strategic adult error-correction decision framework.',
  },
  '/blog/effective-esl-homework-strategies.html': {
    state: 'keep',
    cluster: 'Homework and Retention',
    reason: 'Strategic adult homework design workflow.',
  },
  '/blog/writing-student-progress-reports-esl.html': {
    state: 'keep',
    cluster: 'Student Evidence and Progress',
    reason: 'Strategic evidence-based progress-report workflow.',
  },
  '/blog/spaced-repetition-vocabulary-learning.html': {
    state: 'keep',
    cluster: 'Homework and Retention',
    reason: 'Strategic spaced-retrieval vocabulary resource.',
  },
  '/blog/teaching-business-english-guide.html': {
    state: 'keep',
    cluster: 'Adult and Business English',
    reason: 'Strategic adult one-to-one Business English guide.',
  },
  '/blog/teaching-english-online-complete-guide.html': {
    state: 'keep',
    cluster: 'Tutor Business and Tools',
    reason: 'Strategic adult online tutoring workflow.',
  },
  '/blog/setting-up-freelance-esl-business.html': {
    state: 'keep',
    cluster: 'Tutor Business and Tools',
    reason: 'Strategic freelance tutoring operations resource.',
  },
  '/blog/teacher-burnout-prevention-esl.html': {
    state: 'keep',
    cluster: 'Tutor Business and Tools',
    reason: 'Strategic tutor workload and burnout-prevention resource.',
  },
  '/blog/materials-design-principles-elt.html': {
    state: 'keep',
    cluster: 'One-to-One Lesson Planning',
    reason: 'Strategic adult materials-design framework.',
  },
  '/blog/task-based-language-teaching-worksheets.html': {
    state: 'keep',
    cluster: 'One-to-One Lesson Planning',
    reason: 'Strategic adult task-based worksheet framework.',
  },
  '/blog/personalized-learning-english-teaching.html': {
    state: 'keep',
    cluster: 'One-to-One Lesson Planning',
    reason: 'Strategic evidence-led personalization framework.',
  },
  ...Object.fromEntries(legacyEditorialDecisions.map((decision) => {
    const base = {
      cluster: 'Adult and Business English',
      reason: `x1000 editorial decision: ${decision.decision} toward ${decision.targetRoute}.`,
    };
    if (decision.decision === 'noindex-keep-accessible') {
      return [decision.route, {
        ...base,
        state: 'noindex',
      }];
    }
    if (['rewrite-new-url-and-301', 'redirect-to-existing'].includes(decision.decision)) {
      return [decision.route, {
        ...base,
        state: 'merge',
        redirectTo: decision.targetRoute,
      }];
    }
    return [decision.route, {
      ...base,
      state: 'keep',
    }];
  })),
};

const CORE_KEEP_ROUTES = new Set([
  '/',
  '/about',
  '/authors/jan-brzostowski',
  '/authors/martha',
  '/blog',
  '/esl-worksheets',
  '/exercise-types',
  '/features/calendar',
  '/features/dslm',
  '/features/flashcards',
  '/features/homework',
  '/features/live-sessions',
  '/features/placement-test',
  '/features/student-hub',
  '/for-english-tutors',
  '/gallery',
  '/glossary',
  '/how-it-works',
  '/one-minute-prep',
  '/pricing',
  '/resources',
  '/tools',
  '/tools/cefr-level-test',
  '/tools/lesson-plan-generator',
  '/tools/what-should-i-teach-next',
  '/tools/vocab-cefr-checker',
  '/what-to-teach-next',
]);

const PRIVATE_ROUTE_PATTERNS = [
  /^\/admin(?:\/|$)/,
  /^\/book(?:\/|$)/,
  /^\/calendar(?:\/|$)/,
  /^\/dashboard(?:\/|$)/,
  /^\/flashcards(?:\/|$)/,
  /^\/forgot-password(?:\/|$)/,
  /^\/gcal-student-callback(?:\/|$)/,
  /^\/homework(?:\/|$)/,
  /^\/login(?:\/|$)/,
  /^\/my(?:\/|$)/,
  /^\/my-flashcards(?:\/|$)/,
  /^\/my-lessons(?:\/|$)/,
  /^\/payment-success(?:\/|$)/,
  /^\/profile(?:\/|$)/,
  /^\/reset-password(?:\/|$)/,
  /^\/shared(?:\/|$)/,
  /^\/signup(?:\/|$)/,
  /^\/student(?:\/|$)/,
  /^\/success(?:\/|$)/,
  /^\/test(?:\/|$)/,
  /^\/welcome-test(?:\/|$)/,
  /^\/worksheet(?:\/|$)/,
  /^\/worksheets$/,
];
const CANONICAL_ALIAS_ROUTES = new Set([
  '/exercise-types.html',
  '/glossary.html',
  '/how-it-works.html',
  '/resources.html',
]);
const PUBLIC_NOINDEX_ROUTES = new Set([
  '/newsletter/confirmed',
  '/newsletter/unsubscribed',
]);

const MOJIBAKE_PATTERN = /â€”|Â·|â†[’]|âťŚ|âś…|â­|←[’]|�/;

function readFileSafe(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function normalizeDate(value) {
  if (!value) return '';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString().slice(0, 10);
}

function extractMetadata(html) {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/\s+[—|]\s+Edooqoo.*$/i, '')
    .trim();
  const description = (
    html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] ||
    html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i)?.[1] ||
    ''
  ).trim();
  const canonical = (
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["']canonical["']/i)?.[1] ||
    ''
  ).trim();
  const datePublished = normalizeDate(html.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1]);
  const dateModified = normalizeDate(html.match(/"dateModified"\s*:\s*"([^"]+)"/i)?.[1]);
  const author = (html.match(/"author"\s*:\s*\{[\s\S]{0,500}?"name"\s*:\s*"([^"]+)"/i)?.[1] || '').trim();
  const reviewer = (html.match(/"reviewedBy"\s*:\s*\{[\s\S]{0,500}?"name"\s*:\s*"([^"]+)"/i)?.[1] || '').trim();
  const visibleText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title,
    description,
    canonical,
    datePublished,
    dateModified,
    author,
    reviewer,
    wordCount: visibleText ? visibleText.split(/\s+/).length : 0,
    hasEncodingIssue: MOJIBAKE_PATTERN.test(html),
  };
}

export function inferCluster(value) {
  const text = value.toLowerCase();
  if (/what-to-teach-next|next-lesson|next-focus|student-progress-to-worksheet|learning-pacing/.test(text)) {
    return CONTENT_CLUSTERS[0];
  }
  if (/one-to-one|lesson-plan|lesson-sequenc|needs-analysis|materials-design|task-based|personalized-learning/.test(text)) {
    return CONTENT_CLUSTERS[1];
  }
  if (/assessment|progress|placement|cefr|error-correction|diagnostic|rubric|feedback/.test(text)) {
    return CONTENT_CLUSTERS[2];
  }
  if (/homework|retention|spaced-repetition|flashcard|vocabulary/.test(text)) {
    return CONTENT_CLUSTERS[3];
  }
  if (/business|adult|workplace|professional|english-for|corporate/.test(text)) {
    return CONTENT_CLUSTERS[4];
  }
  return CONTENT_CLUSTERS[5];
}

function inferType(route) {
  if (route.startsWith('/blog/')) return 'blog';
  if (route.startsWith('/esl-worksheets/')) return 'topic-level';
  if (route.startsWith('/worksheets/')) return 'exercise-topic';
  if (route.startsWith('/english-for/')) return 'persona';
  if (route.endsWith('.html')) return 'static-landing';
  return 'spa-route';
}

function defaultState(route, sourceName = '') {
  if (CANONICAL_ALIAS_ROUTES.has(route)) return 'noindex';
  if (PRIVATE_ROUTE_PATTERNS.some((pattern) => pattern.test(route))) return 'noindex';
  if (route.startsWith('/what-to-teach-next/')) return 'keep';
  if (route.startsWith('/blog/') && STRATEGIC_BLOG_SLUGS.has(sourceName)) return 'keep';
  if (route.endsWith('.html') && STRATEGIC_ROOT_HTML.has(sourceName)) return 'keep';
  if (CORE_KEEP_ROUTES.has(route)) return 'keep';
  return 'hold';
}

function entryForRoute(route, base = {}) {
  const { forcedState, ...entryBase } = base;
  const override = CONTENT_OVERRIDES[route] || {};
  const state = override.state || forcedState || defaultState(route, entryBase.sourceName);
  return {
    route,
    canonical: `https://edooqoo.com${route === '/' ? '/' : route}`,
    type: inferType(route),
    state,
    indexable: INDEXABLE_STATES.has(state),
    cluster: inferCluster(`${route} ${base.title || ''}`),
    redirectTo: override.redirectTo || null,
    reason: override.reason || (state === 'hold'
      ? 'Awaiting GSC and backlink evidence; preserve current URL without destructive action.'
      : 'Strategic product, workflow, evidence, or public resource URL.'),
    ...entryBase,
    ...override,
  };
}

function sitemapRoutes(root) {
  const xml = readFileSafe(path.join(root, 'public', 'sitemap.xml'));
  return [...xml.matchAll(/<loc>https:\/\/edooqoo\.com([^<]*)<\/loc>/g)]
    .map((match) => match[1] || '/');
}

export function getContentRegistry({ root }) {
  const entries = new Map();
  const strategicRoutes = new Set([
    ...CORE_KEEP_ROUTES,
    ...getDecisionContentRoutes({ root }),
  ]);

  for (const route of sitemapRoutes(root)) {
    entries.set(route, entryForRoute(route));
  }

  for (const route of getPseoRouteInventory({ root }).noindex) {
    entries.set(route, entryForRoute(route, {
      forcedState: 'noindex',
      reason: 'Combination remains accessible but is excluded from indexing by the programmatic SEO quality policy.',
    }));
  }

  for (const route of PUBLIC_NOINDEX_ROUTES) {
    entries.set(route, entryForRoute(route, {
      forcedState: 'noindex',
      reason: 'Public newsletter lifecycle status route; accessible to confirmation links but excluded from indexing.',
    }));
  }

  const blogDir = path.join(root, 'public', 'blog');
  if (fs.existsSync(blogDir)) {
    for (const sourceName of fs.readdirSync(blogDir).filter((name) => name.endsWith('.html') && name !== 'index.html')) {
      const route = `/blog/${sourceName}`;
      const metadata = extractMetadata(readFileSafe(path.join(blogDir, sourceName)));
      entries.set(route, entryForRoute(route, {
        source: `public/blog/${sourceName}`,
        sourceName,
        ...metadata,
      }));
    }
  }

  const publicDir = path.join(root, 'public');
  for (const sourceName of fs.readdirSync(publicDir).filter((name) => name.endsWith('.html') && name !== 'index.html')) {
    const route = `/${sourceName}`;
    const metadata = extractMetadata(readFileSafe(path.join(publicDir, sourceName)));
    entries.set(route, entryForRoute(route, {
      source: `public/${sourceName}`,
      sourceName,
      ...metadata,
    }));
  }

  for (const route of Object.keys(CONTENT_OVERRIDES)) {
    if (!entries.has(route)) entries.set(route, entryForRoute(route));
  }

  for (const route of strategicRoutes) {
    if (!entries.has(route)) entries.set(route, entryForRoute(route));
  }

  return [...entries.values()].sort((a, b) => a.route.localeCompare(b.route));
}

export function getBlogRegistry({ root }) {
  return getContentRegistry({ root }).filter((entry) => entry.type === 'blog');
}

export function getRoutingDecisions({ root }) {
  const entries = getContentRegistry({ root });
  return {
    redirects: Object.fromEntries(
      entries.filter((entry) => entry.state === 'merge' && entry.redirectTo)
        .map((entry) => [entry.route, entry.redirectTo]),
    ),
    gone: entries.filter((entry) => entry.state === 'retire').map((entry) => entry.route),
    noindex: entries.filter((entry) => entry.state === 'noindex').map((entry) => entry.route),
  };
}
