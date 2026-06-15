import fs from 'node:fs';
import path from 'node:path';

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
  'one-minute-prep-workflow-for-esl-tutors.html',
  'public-esl-worksheet-gallery-quality-standards.html',
  'student-progress-to-worksheet-feedback-loop.html',
  'teaching-english-one-to-one.html',
  'what-should-adult-english-placement-test-include.html',
  'what-to-teach-next-private-english-student.html',
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
  if (route.startsWith('/blog/') && STRATEGIC_BLOG_SLUGS.has(sourceName)) return 'keep';
  if (route.endsWith('.html') && STRATEGIC_ROOT_HTML.has(sourceName)) return 'keep';
  if (CORE_KEEP_ROUTES.has(route)) return 'keep';
  return 'hold';
}

function entryForRoute(route, base = {}) {
  const override = CONTENT_OVERRIDES[route] || {};
  const state = override.state || defaultState(route, base.sourceName);
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
    ...base,
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

  for (const route of sitemapRoutes(root)) {
    entries.set(route, entryForRoute(route));
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

  for (const route of CORE_KEEP_ROUTES) {
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
