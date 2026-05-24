#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPrerenderRoutes, getPriorityExerciseTopicRoutes } from './seo-route-manifest.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.resolve(ROOT, 'public');

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

function fail(message) {
  console.error(`[seo:audit] FAIL ${message}`);
  process.exitCode = 1;
}

function pass(message) {
  console.log(`[seo:audit] OK   ${message}`);
}

function existsPublic(rel) {
  return fs.existsSync(path.join(PUBLIC, rel));
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
    const types = new Set((graph['@graph'] || []).map((node) => node['@type']));
    for (const type of ['Organization', 'WebSite', 'SoftwareApplication']) {
      if (!types.has(type)) fail(`knowledge-graph.json missing ${type}`);
      else pass(`knowledge-graph.json contains ${type}`);
    }
  } catch (err) {
    fail(`knowledge-graph.json is invalid JSON: ${err.message}`);
  }
}

function auditRobotsAndSitemap() {
  const robots = fs.readFileSync(path.join(PUBLIC, 'robots.txt'), 'utf8');
  const sitemap = fs.readFileSync(path.join(PUBLIC, 'sitemap.xml'), 'utf8');

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
  const openApi = fs.readFileSync(path.join(PUBLIC, 'openapi.yaml'), 'utf8');
  const plugin = JSON.parse(fs.readFileSync(path.join(PUBLIC, '.well-known', 'ai-plugin.json'), 'utf8'));

  if (!openApi.includes('/llms.txt') || !openApi.includes('/knowledge-graph.json')) {
    fail('openapi.yaml missing required informational resource paths');
  } else {
    pass('openapi.yaml describes public AI resources');
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
auditPrerenderManifest();
auditOpenApiAndPlugin();

if (process.exitCode) {
  process.exit(process.exitCode);
}

console.log('[seo:audit] Complete.');
