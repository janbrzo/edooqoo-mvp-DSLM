#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPrerenderRoutes, getPriorityExerciseTopicRoutes } from './seo-route-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.resolve(ROOT, 'public');
const BASE_URL = 'https://edooqoo.com';

const REQUIRED_AI_RESOURCES = [
  'llms.txt',
  'llms-full.txt',
  'llms-answers.txt',
  'knowledge-graph.json',
  'openapi.yaml',
  '.well-known/ai-plugin.json',
];

const REQUIRED_PRERENDER_ROUTES = [
  '/esl-worksheets',
  '/for-english-tutors',
  '/resources/esl-class-toolkit',
  '/tools',
  '/tools/cefr-level-test',
  '/tools/lesson-plan-generator',
  '/tools/vocab-cefr-checker',
  '/gallery',
];

const REQUIRED_CITABLE_PAGES = [
  '/ai-worksheet-generator-for-english-teachers.html',
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
];

const REQUIRED_CITATION_ARTICLES = [
  '/blog/ai-worksheet-generator-mechanics-for-esl-teachers.html',
  '/blog/cefr-aligned-worksheet-generation-workflow.html',
  '/blog/business-english-material-generation-workflow.html',
  '/blog/english-homework-ai-grading-workflow.html',
  '/blog/english-tutor-material-organization-workflow.html',
  '/blog/esl-exercise-type-selection-guide.html',
  '/blog/student-progress-to-worksheet-feedback-loop.html',
  '/blog/public-esl-worksheet-gallery-quality-standards.html',
];

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

function auditDeclaredAiResources() {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const declared = [...indexHtml.matchAll(/<link[^>]+rel=["']ai-(?:resource|plugin)["'][^>]+href=["']([^"']+)["']/g)]
    .map((m) => m[1].replace(/^\//, ''));

  for (const rel of REQUIRED_AI_RESOURCES) {
    if (!existsPublic(rel)) fail(`Missing public/${rel}`);
    else pass(`public/${rel} exists`);
  }

  for (const rel of declared) {
    if (!existsPublic(rel)) fail(`index.html declares /${rel}, but public/${rel} is missing`);
    else pass(`index.html declared /${rel}`);
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
  } catch (err) {
    fail(`knowledge-graph.json is invalid JSON: ${err.message}`);
  }
}

function auditRobotsAndSitemap() {
  const robots = readPublic('/robots.txt');
  const sitemap = readPublic('/sitemap.xml');

  if (!robots.includes('Allow: /worksheets/*/*')) {
    fail('robots.txt must explicitly allow public /worksheets/:exerciseType/:topic routes');
  } else {
    pass('robots.txt allows /worksheets/*/*');
  }

  if (!robots.includes('Disallow: /worksheets')) {
    fail('robots.txt must keep /worksheets private list blocked');
  } else {
    pass('robots.txt keeps /worksheets private list blocked');
  }

  if (!sitemap.includes('https://edooqoo.com/worksheets/')) {
    fail('sitemap.xml has no public /worksheets/ pSEO URLs');
  } else {
    pass('sitemap.xml contains public /worksheets/ pSEO URLs');
  }

  const priorityRoutes = getPriorityExerciseTopicRoutes({ root: ROOT });
  if (priorityRoutes.length < 200) {
    fail(`Expected at least 200 priority /worksheets/ prerender routes, got ${priorityRoutes.length}`);
  } else {
    pass(`priority /worksheets/ prerender routes: ${priorityRoutes.length}`);
  }
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
}

function auditCitablePages() {
  const sitemapUrls = getSitemapUrls();

  for (const route of REQUIRED_CITABLE_PAGES) {
    auditStaticCitationPage(route, ['WebPage', 'LearningResource', 'FAQPage', 'BreadcrumbList']);
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
}

function auditPrerenderManifest() {
  const routes = getPrerenderRoutes({ root: ROOT });
  for (const route of REQUIRED_PRERENDER_ROUTES) {
    if (!routes.includes(route)) fail(`Prerender manifest missing ${route}`);
    else pass(`Prerender manifest includes ${route}`);
  }

  if (routes.length < 500) fail(`Expected at least 500 prerender routes, got ${routes.length}`);
  else pass(`Prerender manifest route count: ${routes.length}`);
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
auditKnowledgeGraph();
auditRobotsAndSitemap();
auditCitablePages();
auditPrerenderManifest();
auditOpenApiAndPlugin();

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[seo:audit] Complete.');
