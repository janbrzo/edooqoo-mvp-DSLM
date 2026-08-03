#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CORE_SEO_ROUTES,
  getPrerenderRoutes,
  getPriorityExerciseTopicRoutes,
} from './seo-route-manifest.mjs';
import { getPseoRouteInventory } from './pseo-index-policy.mjs';
import { getDecisionContentRoutes } from './decision-content.mjs';
import { getRoutingDecisions } from './content-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.resolve(ROOT, 'public');
const DIST = path.resolve(ROOT, 'dist');
const BASE_URL = 'https://edooqoo.com';

const REQUIRED_AI_RESOURCES = [
  'llms.txt',
  'llms-full.txt',
  'llms-answers.txt',
  'knowledge-graph.json',
  'openapi.yaml',
  '.well-known/ai-plugin.json',
];

const ROOT_RAW_REQUIRED_SCHEMA_TYPES = [
  'SoftwareApplication',
  'Organization',
  'WebSite',
  'BreadcrumbList',
  'WebPage',
  'FAQPage',
];

const ROOT_FORBIDDEN_EVIDENCE_SCHEMA_TYPES = [
  'AggregateRating',
  'Review',
];

const ROOT_NOSCRIPT_REQUIRED_LINKS = [
  'href="/one-minute-prep"',
  'href="/ai-worksheet-generator-for-english-teachers.html"',
  'href="/esl-worksheets"',
  'href="/exercise-types"',
  'href="/tools"',
  'href="/gallery"',
  'href="/terms"',
  'href="/privacy-policy"',
  'href="/llms.txt"',
  'href="/knowledge-graph.json"',
];

const ROOT_NOSCRIPT_MIN_WORDS = 250;

const REQUIRED_PRERENDER_ROUTES = [
  '/esl-worksheets',
  '/for-english-tutors',
  '/resources/esl-class-toolkit',
  '/tools',
  '/tools/cefr-level-test',
  '/tools/lesson-plan-generator',
  '/tools/what-should-i-teach-next',
  '/tools/vocab-cefr-checker',
  '/gallery',
];

const REQUIRED_CITABLE_PAGES = [
  '/ai-worksheet-generator-for-english-teachers.html',
  '/one-minute-prep-for-english-tutors.html',
  '/english-placement-test-for-private-tutors.html',
  '/cefr-worksheet-generator.html',
  '/business-english-worksheet-generator.html',
  '/grammar-worksheet-generator.html',
  '/vocabulary-exercise-generator.html',
  '/fill-in-the-blanks-worksheet-generator.html',
  '/reading-comprehension-worksheet-maker.html',
  '/listening-comprehension-exercises-esl.html',
  '/multiple-choice-quiz-generator-english.html',
  '/ai-lesson-planning-for-english-teachers.html',
  '/ai-grading-tool-for-english-homework.html',
  '/best-ai-tools-for-esl-teachers.html',
  '/private-english-tutor-crm.html',
  '/online-esl-homework-tool.html',
  '/editable-esl-worksheet-generator.html',
  '/adult-business-english-lesson-prep.html',
  '/one-to-one-english-lesson-planner.html',
  '/english-tutor-calendar-booking-software.html',
  '/cefr-progress-tracker-english-students.html',
  '/student-hub-for-english-tutors.html',
];

const EVIDENCE_ONLY_CITABLE_PAGES = new Set([
  '/one-minute-prep-for-english-tutors.html',
  '/english-placement-test-for-private-tutors.html',
]);

const FEATURE_AND_TOOL_PAGES = [
  '/features/dslm',
  '/features/homework',
  '/features/flashcards',
  '/features/calendar',
  '/features/live-sessions',
  '/features/placement-test',
  '/features/student-hub',
  '/tools',
  '/tools/cefr-level-test',
  '/tools/lesson-plan-generator',
  '/tools/what-should-i-teach-next',
  '/tools/vocab-cefr-checker',
];

const CANONICAL_ALIASES = [
  ['/resources.html', '/resources'],
  ['/glossary.html', '/glossary'],
  ['/how-it-works.html', '/how-it-works'],
  ['/exercise-types.html', '/exercise-types'],
];

const REQUIRED_HOMEPAGE_CANONICAL_LINKS = [
  '/one-minute-prep',
  '/ai-worksheet-generator-for-english-teachers.html',
  '/esl-student-progress-tracking-tool.html',
  '/ai-grading-tool-for-english-homework.html',
  '/vocabulary-exercise-generator.html',
];

const REQUIRED_CITATION_ARTICLES = [
  '/blog/ai-worksheet-generator-mechanics-for-esl-teachers.html',
  '/blog/one-minute-prep-workflow-for-esl-tutors.html',
  '/blog/learning-pacing-scientific-vs-pragmatic-esl.html',
  '/blog/cefr-aligned-worksheet-generation-workflow.html',
  '/blog/business-english-material-generation-workflow.html',
  '/blog/english-homework-ai-grading-workflow.html',
  '/blog/english-tutor-material-organization-workflow.html',
  '/blog/esl-exercise-type-selection-guide.html',
  '/blog/student-progress-to-worksheet-feedback-loop.html',
  '/blog/public-esl-worksheet-gallery-quality-standards.html',
];

const REQUIRED_COMPARISON_PAGES = [
  '/edooqoo-vs-chatgpt.html',
  '/edooqoo-vs-claude.html',
  '/edooqoo-vs-general-purpose-ai.html',
  '/edooqoo-vs-gemini.html',
  '/edooqoo-vs-copilot.html',
  '/edooqoo-vs-perplexity.html',
  '/edooqoo-vs-twee.html',
  '/edooqoo-vs-islcollective.html',
  '/edooqoo-vs-liveworksheets.html',
  '/edooqoo-vs-wordwall.html',
  '/edooqoo-vs-quizlet.html',
  '/edooqoo-vs-magicschool.html',
  '/edooqoo-vs-kahoot.html',
  '/edooqoo-vs-busyteacher.html',
];

const REQUIRED_PROOF_PAGES = [
  '/public-esl-worksheet-examples.html',
];

const CLAIM_INTEGRITY_PAGES = [
  '/ai-tools-for-online-esl-teachers.html',
  '/ai-tools-for-private-english-tutors.html',
  '/chatgpt-alternative-for-english-tutors.html',
  '/ai-lesson-prep-tool-vs-chatbot.html',
  '/best-ai-tools-for-private-english-tutors.html',
  '/worksheet-generator-for-language-schools.html',
  ...REQUIRED_COMPARISON_PAGES,
  '/best-ai-tools-for-esl-teachers.html',
];

const UNSUPPORTED_CLAIM_PATTERNS = [
  [/Edooqoo\s+is\s+the\s+best/i, 'unsupported "Edooqoo is the best" claim'],
  [/Best AI Tool for English Teachers/i, 'unsupported title-style best-tool claim'],
  [/Which is Better for English Teachers/i, 'unsupported better-than comparison claim'],
  [/best AI tool(?!s for ESL teachers)/i, 'unsupported singular best-tool claim'],
  [/saves\s+hours/i, 'unsupported time-savings claim'],
  [/save\s+\d+\+?\s+hours/i, 'unsupported quantified time-savings claim'],
  [/saving significant time/i, 'unsupported quantified time-savings claim'],
  [/in\s+under\s+60\s+seconds/i, 'unsupported speed claim'],
  [/\b60 seconds\b/i, 'unsupported exact speed claim'],
  [/under\s+1\s+minute/i, 'unsupported exact speed claim'],
  [/guaranteed\s+1\s+minute/i, 'unsupported guaranteed one-minute claim'],
  [/always\s+in\s+1\s+minute/i, 'unsupported always-in-one-minute claim'],
  [/no\s+teacher\s+review\s+needed/i, 'unsupported no-teacher-review claim'],
  [/2,400\+/i, 'unsupported usage-count claim'],
  [/official\s+[A-Z0-9-]*\s*CEFR/i, 'unsupported official CEFR claim'],
  [/Martha[^.]*validated/i, 'unsupported external validation claim'],
  [/Gemini\s+2(?:\.5)?/i, 'unnecessary public model-version claim'],
];

const ALLOWED_CLAIM_CONTEXTS = [];

const CLAIM_INTEGRITY_SOURCE_FILES = [
  'index.html',
  'src/constants/seoMeta.ts',
  'src/constants/faqItems.ts',
  'src/components/seo/SeoLandingLayout.tsx',
  'src/components/seo/PageSeo.tsx',
  'src/components/landing/OneMinutePrepProofSection.tsx',
  'src/pages/OneMinutePrep.tsx',
  'src/pages/HowItWorks.tsx',
  'src/pages/features/FeatureHomework.tsx',
  'src/pages/gallery/PublicGalleryWorksheetPage.tsx',
  'src/pages/tools/CefrLevelTest.tsx',
  'src/pages/tools/LessonPlanGenerator.tsx',
  'src/pages/tools/VocabCefrChecker.tsx',
  'src/pages/seo/EslClassToolkit.tsx',
  'src/pages/seo/EslGamesForTeachers.tsx',
  'src/pages/seo/EslWorksheets.tsx',
  'src/pages/seo/EnglishGamesForLearners.tsx',
  'src/pages/seo/ForEnglishTutors.tsx',
  'src/pages/seo/TeachEnglishOnlineGuide.tsx',
  'src/pages/seo/programmatic/ExerciseTopicPage.tsx',
  'src/pages/seo/programmatic/PersonaPage.tsx',
  'src/pages/seo/programmatic/TopicLevelPage.tsx',
];

const HIGH_RISK_PUBLIC_CLAIM_PAGES = [
  '/online-english-teaching-tools.html',
  '/esl-homework-grading-tool.html',
  '/how-to-save-time-as-english-teacher.html',
  '/blog/ai-homework-grading-for-english-teachers.html',
  '/blog/how-to-create-grammar-worksheets-with-ai.html',
  '/blog/differentiated-instruction-english-classroom.html',
  '/blog/reading-comprehension-activities-english.html',
];

const PRIVATE_SITEMAP_PATTERNS = [
  /^https:\/\/edooqoo\.com\/(?:login|signup|demo|book)\/?$/,
  /^https:\/\/edooqoo\.com\/dashboard(?:\/|$)/,
  /^https:\/\/edooqoo\.com\/student\//,
  /^https:\/\/edooqoo\.com\/worksheet\//,
  /^https:\/\/edooqoo\.com\/homework\//,
  /^https:\/\/edooqoo\.com\/my(?:\/|$)/,
  /^https:\/\/edooqoo\.com\/book\/[^/]+/,
  /^https:\/\/edooqoo\.com\/admin(?:\/|$)/,
];

const REQUIRED_PRERENDER_SCHEMA = new Map([
  ['/one-minute-prep', ['WebPage']],
  ...FEATURE_AND_TOOL_PAGES.map((route) => [route, ['WebPage']]),
  ['/tools/what-should-i-teach-next', ['SoftwareApplication', 'FAQPage', 'BreadcrumbList']],
]);

function fail(message) {
  console.error(`[seo:audit] FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[seo:audit] OK   ${message}`);
}

function publicPath(relOrUrlPath) {
  return path.join(PUBLIC, relOrUrlPath.replace(/^\//, ''));
}

function existsPublic(rel) {
  return fs.existsSync(path.join(PUBLIC, rel));
}

function readPublic(relOrUrlPath) {
  return fs.readFileSync(publicPath(relOrUrlPath), 'utf8');
}

function stripAllowedClaimContexts(text) {
  return ALLOWED_CLAIM_CONTEXTS.reduce(
    (next, allowed) => next.split(allowed).join(''),
    text
  );
}

function getSitemapUrls() {
  const sitemap = readPublic('/sitemap.xml');
  return [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim());
}

function countUrl(urls, url) {
  return urls.filter((item) => item === url).length;
}

function extractCanonical(html) {
  return html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] || null;
}

function extractTitle(html) {
  return html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || '';
}

function countH1(html) {
  return [...html.matchAll(/<h1\b/gi)].length;
}

function extractLdTypes(html) {
  const scripts = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const types = new Set();

  for (const script of scripts) {
    try {
      const json = JSON.parse(script[1].trim());
      const nodes = Array.isArray(json?.['@graph']) ? json['@graph'] : [json];
      for (const node of nodes) {
        const type = node?.['@type'];
        if (Array.isArray(type)) type.forEach((item) => types.add(item));
        else if (type) types.add(type);
      }
    } catch (err) {
      fail(`Invalid JSON-LD block: ${err.message}`);
    }
  }

  return types;
}

function stripHtmlTags(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text) {
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function extractNoscriptText(html) {
  return [...html.matchAll(/<noscript\b[^>]*>([\s\S]*?)<\/noscript>/gi)]
    .map((match) => stripHtmlTags(match[1]))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownAnchor(heading) {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function auditDeclaredAiResources() {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const declared = [...indexHtml.matchAll(/<link[^>]+rel=["']ai-(?:resource|plugin)["'][^>]+href=["']([^"']+)["']/g)]
    .map((m) => m[1].replace(/^\//, ''));
  const publicLlms = readPublic('/llms.txt');
  const docsContext = fs.readFileSync(path.join(ROOT, 'docs', 'llm-context.md'), 'utf8');
  const docsAnchors = new Set(
    [...docsContext.matchAll(/^##\s+(.+)$/gm)].map((match) => markdownAnchor(match[1]))
  );

  for (const rel of REQUIRED_AI_RESOURCES) {
    if (!existsPublic(rel)) fail(`Missing public/${rel}`);
    else pass(`public/${rel} exists`);
  }

  for (const rel of declared) {
    if (!existsPublic(rel)) fail(`index.html declares /${rel}, but public/${rel} is missing`);
    else pass(`index.html declared /${rel}`);
  }

  if (/status:\s*(BETA|ROADMAP)/i.test(publicLlms)) {
    fail('public/llms.txt must not expose BETA or ROADMAP capabilities as citable production behavior');
  } else {
    pass('public/llms.txt is production-only');
  }

  const privateCanonical = publicLlms.match(/canonical:\s*https:\/\/edooqoo\.com\/(?:login|signup|demo|book|dashboard|admin)(?:[\/\s]|$)/i);
  if (privateCanonical) {
    fail(`public/llms.txt exposes private canonical URL ${privateCanonical[0].trim()}`);
  } else {
    pass('public/llms.txt contains no private canonical URLs');
  }

  const refs = [...publicLlms.matchAll(/ref:\s*llm-context\.md#([a-z0-9-]+)/gi)].map((match) => match[1]);
  if (!refs.length) {
    fail('public/llms.txt contains no llm-context.md refs');
  }

  const llmsLines = publicLlms.split('\n');
  if (llmsLines.length > 150) {
    fail(`public/llms.txt must stay an index under 150 lines, got ${llmsLines.length}`);
  } else {
    pass(`public/llms.txt is index-sized (${llmsLines.length} lines)`);
  }

  const firstContentLines = llmsLines.filter((line) => line.trim().length > 0);
  if (!/^#\s+/.test(firstContentLines[0] || '')) {
    fail('public/llms.txt must start with an H1 site-name heading');
  } else if (!/^>\s+/.test(firstContentLines[1] || '')) {
    fail('public/llms.txt must have a blockquote summary directly after the H1');
  } else {
    pass('public/llms.txt follows the llmstxt.org H1 + blockquote shape');
  }

  if (!/^Last updated:\s*\d{4}-\d{2}-\d{2}/m.test(publicLlms)) {
    fail('public/llms.txt must declare a "Last updated: YYYY-MM-DD" line');
  } else {
    pass('public/llms.txt declares a last-updated date');
  }

  if (/status:\s*planned/i.test(publicLlms)) {
    fail('public/llms.txt must not list planned (non-existent) resources');
  } else {
    pass('public/llms.txt lists no planned resources');
  }

  if (/^##\s+.*\bv\d+\.\d+\.\d+/m.test(publicLlms) || /Reliability Notes/i.test(publicLlms)) {
    fail('public/llms.txt must not contain internal release notes');
  } else {
    pass('public/llms.txt contains no internal release notes');
  }

  for (const anchor of refs) {
    if (!docsAnchors.has(anchor)) fail(`public/llms.txt ref missing docs/llm-context.md anchor #${anchor}`);
    else pass(`public/llms.txt ref resolves #${anchor}`);
  }
}

function auditRootRawHtml() {
  const indexPath = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');
  const rootUrl = `${BASE_URL}/`;
  const canonical = extractCanonical(html);

  if (canonical !== rootUrl) fail(`index.html root canonical must be ${rootUrl}, got ${canonical || 'none'}`);
  else pass('index.html root has raw self-canonical');

  if (!/<title>[^<]*1-Minute Prep for 1:1 English Teachers[^<]*<\/title>/i.test(html)) {
    fail('index.html title must define the root product entity');
  } else {
    pass('index.html title defines the root product entity');
  }

  if (!/<meta\s+name=["']description["'][^>]+1-Minute Prep for 1:1 English teachers/i.test(html)) {
    fail('index.html meta description must describe the root product entity');
  } else {
    pass('index.html meta description describes the root product entity');
  }

  const types = extractLdTypes(html);
  for (const type of ROOT_RAW_REQUIRED_SCHEMA_TYPES) {
    if (!types.has(type)) fail(`index.html raw root missing JSON-LD ${type}`);
    else pass(`index.html raw root contains JSON-LD ${type}`);
  }

  for (const type of ROOT_FORBIDDEN_EVIDENCE_SCHEMA_TYPES) {
    if (types.has(type)) fail(`index.html must not include ${type} without verified public evidence`);
    else pass(`index.html avoids unverified ${type} schema`);
  }

  const noscriptText = extractNoscriptText(html);
  const words = wordCount(noscriptText);
  if (words < ROOT_NOSCRIPT_MIN_WORDS) {
    fail(`index.html noscript fallback must contain at least ${ROOT_NOSCRIPT_MIN_WORDS} words, got ${words}`);
  } else {
    pass(`index.html noscript fallback word count: ${words}`);
  }

  for (const link of ROOT_NOSCRIPT_REQUIRED_LINKS) {
    if (!html.includes(link)) fail(`index.html noscript fallback missing ${link}`);
    else pass(`index.html noscript fallback contains ${link}`);
  }
}

function auditHomepageCanonicalLinks() {
  const heroPath = path.join(ROOT, 'src', 'components', 'landing', 'HeroHeadline.tsx');
  const hero = fs.readFileSync(heroPath, 'utf8');

  for (const route of REQUIRED_HOMEPAGE_CANONICAL_LINKS) {
    if (!hero.includes(`href: '${route}'`) && !hero.includes(`href="${route}"`)) {
      fail(`HeroHeadline.tsx must link the homepage to ${route}`);
    } else {
      pass(`homepage canonical workflow link exists ${route}`);
    }
  }
}

function auditKnowledgeGraph() {
  const kgPath = path.join(PUBLIC, 'knowledge-graph.json');
  try {
    const graph = JSON.parse(fs.readFileSync(kgPath, 'utf8'));
    const nodes = graph['@graph'] || [];
    const types = new Set(nodes.map((node) => node['@type']));
    const ids = new Set(nodes.map((node) => node['@id']).filter(Boolean));

    for (const type of ['Organization', 'WebSite', 'SoftwareApplication']) {
      if (!types.has(type)) fail(`knowledge-graph.json missing ${type}`);
      else pass(`knowledge-graph.json contains ${type}`);
    }

    for (const route of REQUIRED_CITABLE_PAGES) {
      const id = `${BASE_URL}${route}#webpage`;
      if (!ids.has(id)) fail(`knowledge-graph.json missing citable page node ${id}`);
      else pass(`knowledge-graph.json contains citable page node ${route}`);
    }

    for (const route of REQUIRED_CITATION_ARTICLES) {
      const id = `${BASE_URL}${route}#article`;
      if (!ids.has(id)) fail(`knowledge-graph.json missing article node ${id}`);
      else pass(`knowledge-graph.json contains article node ${route}`);
    }

    for (const route of REQUIRED_COMPARISON_PAGES) {
      const id = `${BASE_URL}${route}#webpage`;
      if (!ids.has(id)) fail(`knowledge-graph.json missing comparison page node ${id}`);
      else pass(`knowledge-graph.json contains comparison page node ${route}`);
    }

    for (const route of REQUIRED_PROOF_PAGES) {
      const collectionId = `${BASE_URL}${route}#collection`;
      const resourceId = `${BASE_URL}${route}#learning-resource`;
      if (!ids.has(collectionId)) fail(`knowledge-graph.json missing proof collection node ${collectionId}`);
      else pass(`knowledge-graph.json contains proof collection node ${route}`);
      if (!ids.has(resourceId)) fail(`knowledge-graph.json missing proof learning-resource node ${resourceId}`);
      else pass(`knowledge-graph.json contains proof learning-resource node ${route}`);
    }

    for (const route of FEATURE_AND_TOOL_PAGES) {
      const id = `${BASE_URL}${route}#webpage`;
      const node = nodes.find((item) => item['@id'] === id);
      if (!node) fail(`knowledge-graph.json missing feature/tool WebPage node ${id}`);
      else if (node['@type'] !== 'WebPage') fail(`knowledge-graph.json ${id} must use WebPage`);
      else pass(`knowledge-graph.json contains WebPage node ${route}`);
    }
  } catch (err) {
    fail(`knowledge-graph.json is invalid JSON: ${err.message}`);
  }
}

function auditRobotsAndSitemap() {
  const robots = readPublic('/robots.txt');
  const sitemap = readPublic('/sitemap.xml');
  const sitemapUrls = getSitemapUrls();

  if (!robots.includes('Allow: /worksheets/*/*')) {
    fail('robots.txt must explicitly allow public /worksheets/:exerciseType/:topic routes');
  } else {
    pass('robots.txt allows /worksheets/*/*');
  }

  if (!/^Disallow:\s*\/worksheets\$/m.test(robots)) {
    fail('robots.txt must keep only exact /worksheets private list blocked');
  } else {
    pass('robots.txt keeps exact /worksheets private list blocked');
  }

  if (/^Disallow:\s*\/worksheets\s*$/m.test(robots)) {
    fail('robots.txt must not broadly block public /worksheets/:exerciseType/:topic routes');
  } else {
    pass('robots.txt does not broadly block public worksheet pSEO routes');
  }

  if (!sitemap.includes('https://edooqoo.com/worksheets/')) {
    fail('sitemap.xml has no public /worksheets/ pSEO URLs');
  } else {
    pass('sitemap.xml contains public /worksheets/ pSEO URLs');
  }

  for (const pattern of PRIVATE_SITEMAP_PATTERNS) {
    const match = sitemapUrls.find((url) => pattern.test(url));
    if (match) fail(`sitemap.xml must not include private route ${match}`);
    else pass(`sitemap.xml excludes private route pattern ${pattern}`);
  }

  for (const [alias] of CANONICAL_ALIASES) {
    const url = `${BASE_URL}${alias}`;
    const count = countUrl(sitemapUrls, url);
    if (count !== 0) fail(`sitemap.xml must exclude canonical alias ${alias}, found ${count}`);
    else pass(`sitemap.xml excludes canonical alias ${alias}`);
  }

  const inventory = getPseoRouteInventory({ root: ROOT });
  const sitemapPseoRoutes = sitemapUrls
    .map((url) => url.replace(BASE_URL, ''))
    .filter((route) =>
      /^\/(?:esl-worksheets\/[^/]+\/[^/]+|worksheets\/[^/]+\/[^/]+|english-for\/[^/]+)$/.test(route)
    )
    .sort();
  if (JSON.stringify(sitemapPseoRoutes) !== JSON.stringify(inventory.indexable)) {
    fail(`sitemap.xml pSEO set must match policy exactly (${sitemapPseoRoutes.length}/${inventory.indexable.length})`);
  } else {
    pass(`sitemap.xml contains exactly ${inventory.indexable.length} policy-approved pSEO routes`);
  }

  const priorityRoutes = getPriorityExerciseTopicRoutes({ root: ROOT });
  if (priorityRoutes.length !== inventory.indexableExerciseTopicRoutes.length) {
    fail(`Expected ${inventory.indexableExerciseTopicRoutes.length} priority /worksheets/ routes, got ${priorityRoutes.length}`);
  } else {
    pass(`priority /worksheets/ prerender routes: ${priorityRoutes.length}`);
  }
}

function auditPagesFallbackRouting() {
  const redirectsPath = path.join(PUBLIC, '_redirects');
  const headersPath = path.join(PUBLIC, '_headers');
  const decisions = getRoutingDecisions({ root: ROOT });

  if (!fs.existsSync(redirectsPath)) {
    fail('public/_redirects is missing');
    return;
  }
  if (!fs.existsSync(headersPath)) {
    fail('public/_headers is missing');
    return;
  }

  const redirects = fs.readFileSync(redirectsPath, 'utf8');
  const headers = fs.readFileSync(headersPath, 'utf8');

  for (const line of [
    'http://edooqoo.com/* https://edooqoo.com/:splat 301',
    'http://www.edooqoo.com/* https://edooqoo.com/:splat 301',
    'https://www.edooqoo.com/* https://edooqoo.com/:splat 301',
  ]) {
    if (!redirects.includes(line)) fail(`public/_redirects missing canonical host rule: ${line}`);
    else pass(`public/_redirects contains canonical host rule ${line}`);
  }

  for (const [from, to] of Object.entries(decisions.redirects)) {
    const line = `${from} ${to} 301`;
    if (!redirects.includes(line)) fail(`public/_redirects missing legacy redirect ${line}`);
  }
  if (Object.keys(decisions.redirects).length) {
    pass(`public/_redirects contains ${Object.keys(decisions.redirects).length} content redirects`);
  }

  for (const fragment of [
    '/signup\n  X-Robots-Tag: noindex, nofollow',
    '/signup/*\n  X-Robots-Tag: noindex, nofollow',
  ]) {
    if (!headers.includes(fragment)) fail(`public/_headers missing signup noindex rule ${fragment.split('\n')[0]}`);
    else pass(`public/_headers contains signup noindex rule ${fragment.split('\n')[0]}`);
  }

  const pseoNoindexRoutes = decisions.noindex.filter((route) =>
    /^\/(?:esl-worksheets\/[^/]+\/[^/]+|worksheets\/[^/]+\/[^/]+|english-for\/[^/]+)$/.test(route)
  );
  for (const route of pseoNoindexRoutes) {
    if (!headers.includes(`${route}\n  X-Robots-Tag: noindex, follow`)) {
      fail(`public/_headers missing noindex fallback for ${route}`);
    }
  }
  pass(`public/_headers contains ${pseoNoindexRoutes.length} pSEO noindex fallback rules`);
}

function auditCanonicalAliases() {
  for (const [alias, canonicalRoute] of CANONICAL_ALIASES) {
    const html = readPublic(alias);
    const canonical = extractCanonical(html);
    const expectedCanonical = `${BASE_URL}${canonicalRoute}`;
    if (canonical !== expectedCanonical) {
      fail(`public${alias} canonical must be ${expectedCanonical}, got ${canonical || 'none'}`);
    } else {
      pass(`public${alias} points to ${canonicalRoute}`);
    }

    if (!/<meta[^>]+name=["']robots["'][^>]+content=["']noindex,follow["']/i.test(html)) {
      fail(`public${alias} must use noindex,follow`);
    } else {
      pass(`public${alias} uses noindex,follow`);
    }
  }
}

function auditSitemapEdgePayload() {
  const generatedPath = path.join(
    ROOT,
    'supabase',
    'functions',
    'sitemap-xml',
    'sitemap.generated.ts',
  );
  if (!fs.existsSync(generatedPath)) {
    fail('Missing generated sitemap Edge Function payload');
    return;
  }

  const sitemap = readPublic('/sitemap.xml').replace(/\r\n?/g, '\n');
  const expected = `// AUTO-GENERATED by scripts/seo/sync-sitemap-edge.mjs. Do not edit manually.\n// Source of truth: public/sitemap.xml.\nexport const SITEMAP_XML = ${JSON.stringify(sitemap)};\n`;
  const actual = fs.readFileSync(generatedPath, 'utf8').replace(/\r\n?/g, '\n');
  if (actual !== expected) fail('sitemap Edge Function payload does not match public/sitemap.xml');
  else pass('sitemap Edge Function payload matches public/sitemap.xml');
}

function auditStaticCitationPage(route, requiredTypes) {
  const file = publicPath(route);
  const url = `${BASE_URL}${route}`;

  if (!fs.existsSync(file)) {
    fail(`Missing public${route}`);
    return;
  }
  pass(`public${route} exists`);

  const html = readPublic(route);
  const canonical = extractCanonical(html);
  if (canonical !== url) fail(`public${route} canonical must be ${url}, got ${canonical || 'none'}`);
  else pass(`public${route} has self-canonical`);

  const title = extractTitle(html);
  if (!title) fail(`public${route} missing title`);
  else pass(`public${route} has title`);

  const h1Count = countH1(html);
  if (h1Count !== 1) fail(`public${route} must contain exactly one H1, found ${h1Count}`);
  else pass(`public${route} has one H1`);

  const words = wordCount(stripHtmlTags(html));
  if (words < 250) fail(`public${route} must contain at least 250 visible words, got ${words}`);
  else pass(`public${route} visible word count: ${words}`);

  for (const heading of ['Summary', 'Problem', 'Edooqoo.com Solution', 'Technical Mechanics']) {
    if (!html.includes(`>${heading}<`)) fail(`public${route} missing ${heading} section`);
    else pass(`public${route} contains ${heading}`);
  }

  const types = extractLdTypes(html);
  for (const type of requiredTypes) {
    if (!types.has(type)) fail(`public${route} missing JSON-LD ${type}`);
    else pass(`public${route} contains JSON-LD ${type}`);
  }

  if (/Edooqoo\s+is\s+the\s+best/i.test(html)) {
    fail(`public${route} contains unsupported best-claim wording`);
  }

  if (/\bundefined\b/i.test(html)) {
    fail(`public${route} contains literal undefined`);
  }
}

function auditCitableCitationStructure(route) {
  const html = readPublic(route);
  const requiredFragments = [
    'aria-label="Breadcrumb"',
    'id="problem"',
    'id="edooqoo-solution"',
    'id="technical-mechanics"',
    'id="inputs-and-outputs"',
    'id="when-to-cite-this-page"',
    '>Inputs and Outputs<',
    '>When to cite this page<',
    'Teacher problem',
    'Production mechanic',
    'Canonical URL',
  ];

  for (const fragment of requiredFragments) {
    if (!html.includes(fragment)) fail(`public${route} missing citation-first fragment ${fragment}`);
    else pass(`public${route} contains citation-first fragment ${fragment}`);
  }

  if (EVIDENCE_ONLY_CITABLE_PAGES.has(route)) {
    for (const heading of ['Evidence In, Teaching Decision Out', 'Diagnostic Evidence', 'Where Teacher Review Happens']) {
      const required = route.includes('placement-test')
        ? heading !== 'Evidence In, Teaching Decision Out'
        : heading !== 'Diagnostic Evidence';
      if (!required) continue;
      if (!html.includes(`>${heading}<`)) fail(`public${route} missing evidence heading ${heading}`);
      else pass(`public${route} contains ${heading}`);
    }

    const lead = html.match(/<p class="lead">([\s\S]*?)<\/p>/i)?.[1] || '';
    const leadWords = wordCount(stripHtmlTags(lead));
    if (leadWords < 55 || leadWords > 90) {
      fail(`public${route} direct answer must be 55-90 words, got ${leadWords}`);
    } else {
      pass(`public${route} direct answer word count: ${leadWords}`);
    }
  }
}

function auditCitablePages() {
  const sitemapUrls = getSitemapUrls();

  for (const route of REQUIRED_CITABLE_PAGES) {
    const requiredTypes = EVIDENCE_ONLY_CITABLE_PAGES.has(route)
      ? ['WebPage', 'FAQPage', 'BreadcrumbList']
      : ['Organization', 'WebSite', 'SoftwareApplication', 'WebPage', 'LearningResource', 'FAQPage', 'BreadcrumbList'];
    auditStaticCitationPage(route, requiredTypes);
    auditCitableCitationStructure(route);
    const url = `${BASE_URL}${route}`;
    const count = countUrl(sitemapUrls, url);
    if (count !== 1) fail(`sitemap.xml must contain ${url} exactly once, found ${count}`);
    else pass(`sitemap.xml contains ${route} exactly once`);
  }

  for (const route of REQUIRED_CITATION_ARTICLES) {
    auditStaticCitationPage(route, ['Article', 'FAQPage', 'BreadcrumbList']);
    const url = `${BASE_URL}${route}`;
    const count = countUrl(sitemapUrls, url);
    if (count !== 1) fail(`sitemap.xml must contain ${url} exactly once, found ${count}`);
    else pass(`sitemap.xml contains ${route} exactly once`);
  }

  for (const route of REQUIRED_COMPARISON_PAGES) {
    auditStaticCitationPage(route, ['WebPage', 'FAQPage', 'BreadcrumbList']);
    for (const heading of ['Comparison Criteria', 'When to cite this page']) {
      const html = readPublic(route);
      if (!html.includes(`>${heading}<`)) fail(`public${route} missing ${heading} section`);
      else pass(`public${route} contains ${heading}`);
    }
    const url = `${BASE_URL}${route}`;
    const count = countUrl(sitemapUrls, url);
    if (count !== 1) fail(`sitemap.xml must contain ${url} exactly once, found ${count}`);
    else pass(`sitemap.xml contains ${route} exactly once`);
  }

  for (const route of REQUIRED_PROOF_PAGES) {
    auditStaticCitationPage(route, ['CollectionPage', 'LearningResource', 'BreadcrumbList']);
    for (const heading of ['Example Types', 'Quality Criteria', 'Related Citation URLs']) {
      const html = readPublic(route);
      if (!html.includes(`>${heading}<`)) fail(`public${route} missing ${heading} section`);
      else pass(`public${route} contains ${heading}`);
    }
    const url = `${BASE_URL}${route}`;
    const count = countUrl(sitemapUrls, url);
    if (count !== 1) fail(`sitemap.xml must contain ${url} exactly once, found ${count}`);
    else pass(`sitemap.xml contains ${route} exactly once`);
  }
}

function auditRenderedPreroutes() {
  const markerCandidates = [DIST, PUBLIC].map((snapshotRoot) => ({
    snapshotRoot,
    markerPath: path.join(snapshotRoot, '.seo-prerender-complete.json'),
  }));
  const markerCandidate = markerCandidates.find(({ markerPath }) => fs.existsSync(markerPath));
  if (!markerCandidate) {
    console.log('[seo:audit] SKIP rendered route audit: no complete-prerender marker');
    return;
  }
  const { snapshotRoot, markerPath } = markerCandidate;

  const issues = [];
  const routes = getPrerenderRoutes({ root: ROOT });
  const shellIndexPath = snapshotRoot === PUBLIC
    ? path.join(ROOT, 'index.html')
    : path.join(snapshotRoot, 'index.html');
  const rootTitle = extractTitle(fs.readFileSync(shellIndexPath, 'utf8'));
  try {
    const marker = JSON.parse(fs.readFileSync(markerPath, 'utf8'));
    if (marker.routeCount !== routes.length) {
      issues.push(`marker route count ${marker.routeCount} does not match manifest ${routes.length}`);
    }
  } catch (err) {
    issues.push(`invalid complete-prerender marker: ${err.message}`);
  }
  for (const route of routes) {
    const file = route === '/'
      ? shellIndexPath
      : path.join(snapshotRoot, route.replace(/^\//, ''), 'index.html');
    if (!fs.existsSync(file)) {
      issues.push(`${route}: missing snapshot`);
      continue;
    }

    const html = fs.readFileSync(file, 'utf8');
    const expectedCanonical = route === '/' ? `${BASE_URL}/` : `${BASE_URL}${route}`;
    const canonical = extractCanonical(html);
    if (canonical !== expectedCanonical) issues.push(`${route}: canonical ${canonical || 'missing'}`);
    const title = extractTitle(html);
    if (!title) issues.push(`${route}: missing title`);
    if (route !== '/' && title === rootTitle) issues.push(`${route}: retained homepage title`);
    const h1Count = countH1(html);
    if (h1Count !== 1) issues.push(`${route}: H1 count ${h1Count}`);
    const words = wordCount(stripHtmlTags(html));
    if (words < 120) issues.push(`${route}: only ${words} visible words`);

    const types = extractLdTypes(html);
    if (!types.size) issues.push(`${route}: no JSON-LD schema`);
    for (const type of REQUIRED_PRERENDER_SCHEMA.get(route) || []) {
      if (!types.has(type)) issues.push(`${route}: missing required ${type} schema`);
    }
  }

  if (issues.length) {
    for (const issue of issues.slice(0, 50)) fail(`prerender ${issue}`);
    if (issues.length > 50) fail(`prerender has ${issues.length - 50} additional issue(s)`);
  } else {
    pass(`all ${routes.length} prerender snapshots in ${path.relative(ROOT, snapshotRoot)} pass canonical, title, H1, content, and schema checks`);
  }
}

function auditPublicClaimIntegrity() {
  for (const route of CLAIM_INTEGRITY_PAGES) {
    const file = publicPath(route);
    if (!fs.existsSync(file)) {
      fail(`Claim-integrity page missing public${route}`);
      continue;
    }

    const html = readPublic(route);
    const claimScanHtml = stripAllowedClaimContexts(html);
    if (/\bundefined\b/i.test(html)) fail(`public${route} contains literal undefined`);
    for (const [pattern, label] of UNSUPPORTED_CLAIM_PATTERNS) {
      if (pattern.test(claimScanHtml)) fail(`public${route} contains ${label}`);
    }
    pass(`public${route} passes public claim-integrity scan`);
  }

  for (const rel of CLAIM_INTEGRITY_SOURCE_FILES) {
    const file = path.join(ROOT, rel);
    if (!fs.existsSync(file)) {
      fail(`Claim-integrity source missing ${rel}`);
      continue;
    }

    const text = stripAllowedClaimContexts(fs.readFileSync(file, 'utf8'));
    for (const [pattern, label] of UNSUPPORTED_CLAIM_PATTERNS) {
      if (pattern.test(text)) fail(`${rel} contains ${label}`);
    }
    pass(`${rel} passes source claim-integrity scan`);
  }

  for (const route of HIGH_RISK_PUBLIC_CLAIM_PAGES) {
    const file = publicPath(route);
    if (!fs.existsSync(file)) {
      fail(`High-risk public claim page missing public${route}`);
      continue;
    }

    const html = stripAllowedClaimContexts(readPublic(route));
    for (const [pattern, label] of UNSUPPORTED_CLAIM_PATTERNS) {
      if (pattern.test(html)) fail(`public${route} contains ${label}`);
    }
    pass(`public${route} passes high-risk public claim-integrity scan`);
  }
}

function auditPrerenderManifest() {
  const routes = getPrerenderRoutes({ root: ROOT });
  for (const route of REQUIRED_PRERENDER_ROUTES) {
    if (!routes.includes(route)) fail(`Prerender manifest missing ${route}`);
    else pass(`Prerender manifest includes ${route}`);
  }

  const expectedCount = new Set([
    ...CORE_SEO_ROUTES,
    ...getPseoRouteInventory({ root: ROOT }).indexable,
    ...getDecisionContentRoutes({ root: ROOT }),
  ]).size;
  if (routes.length !== expectedCount) {
    fail(`Expected ${expectedCount} policy-approved prerender routes, got ${routes.length}`);
  } else {
    pass(`Prerender manifest route count: ${routes.length}`);
  }
}

function auditOpenApiAndPlugin() {
  const openApi = readPublic('/openapi.yaml');
  const plugin = JSON.parse(readPublic('/.well-known/ai-plugin.json'));

  if (!openApi.includes('/llms.txt') || !openApi.includes('/knowledge-graph.json')) {
    fail('openapi.yaml missing required informational resource paths');
  } else {
    pass('openapi.yaml describes public AI resources');
  }

  if (openApi.includes('generateWorksheet') || openApi.includes('/generate-worksheet')) {
    fail('openapi.yaml must not expose a private worksheet-generation API');
  } else {
    pass('openapi.yaml does not expose worksheet generation API');
  }

  if (plugin?.api?.url !== 'https://edooqoo.com/openapi.yaml') {
    fail('ai-plugin.json api.url must be https://edooqoo.com/openapi.yaml');
  } else {
    pass('ai-plugin.json points to openapi.yaml');
  }
}

auditDeclaredAiResources();
auditRootRawHtml();
auditHomepageCanonicalLinks();
auditKnowledgeGraph();
auditRobotsAndSitemap();
auditPagesFallbackRouting();
auditCanonicalAliases();
auditSitemapEdgePayload();
auditCitablePages();
auditPublicClaimIntegrity();
auditPrerenderManifest();
auditRenderedPreroutes();
auditOpenApiAndPlugin();

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[seo:audit] Complete.');
