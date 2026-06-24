#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getContentRegistry } from './content-registry.mjs';
import {
  intentionalSchoolLikeRejectionSlugs,
  x1000EditorialBlogArticles,
  x1000EditorialStaticPages,
} from './x1000-editorial-plan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.join(ROOT, 'public');
const DOCS = path.join(ROOT, 'docs', 'seo');
const REPORT_JSON = path.join(DOCS, 'martha-test.generated.json');
const REPORT_MD = path.join(DOCS, 'martha-test.generated.md');

const workflowRoutes = [
  '/one-minute-prep',
  '/how-it-works',
  '/features/homework',
  '/features/dslm',
  '/gallery',
  '/what-to-teach-next',
  '/chatgpt-alternative-for-english-tutors.html',
  '/edooqoo-vs-chatgpt.html',
];

const dominantSchoolSignals = [
  /\bkids?\b/i,
  /\byoung learners?\b/i,
  /\bpreschool(?:ers?)?\b/i,
  /\bparents?\b/i,
  /\bclassroom management\b/i,
  /\bseating arrangements?\b/i,
  /\brewards?\b/i,
  /\bbehavior management\b/i,
  /\bmainstream teachers?\b/i,
  /\blarge classes\b/i,
  /\bteen(?:agers?|s)?\b/i,
];

const bannedComparisonClaims = [
  {
    id: 'always-better',
    pattern: /\bedooqoo(?:\.com)?\s+(?:is|will be|was)\s+always\s+better\b/i,
    allowed: /\bdoes\s+this\s+page\s+claim\s+edooqoo(?:\.com)?\s+is\s+always\s+better\?\s+no\b/i,
  },
  {
    id: 'replaces-teacher-judgment',
    pattern: /\breplaces?\s+teacher\s+judg(?:e)?ment\b/i,
    allowed: /\bdoes\s+edooqoo(?:\.com)?\s+replace\s+teacher\s+judg(?:e)?ment\?\s+no\b|\b(?:does not|do not|doesn't|do not claim to|no\.)\s+replace\s+teacher\s+judg(?:e)?ment\b/i,
  },
  {
    id: 'guaranteed-learning-outcomes',
    pattern: /\bguarantee(?:s|d)?\s+learning\s+outcomes\b/i,
    allowed: /\b(?:does not|do not|cannot|no)\s+guarantee(?:s|d)?\s+learning\s+outcomes\b/i,
  },
];

const targetRoutes = new Set([
  ...x1000EditorialBlogArticles
    .filter((article) => !article.noindex)
    .map((article) => `/blog/${article.slug}`),
  ...x1000EditorialStaticPages.map((page) => `/${page.slug}`),
]);

const exceptionRoutes = new Set(
  [...intentionalSchoolLikeRejectionSlugs].map((slug) => `/blog/${slug}`),
);

function routeToFile(route) {
  if (route === '/') return path.join(PUBLIC, 'index.html');
  return path.join(PUBLIC, route.replace(/^\//, ''));
}

function readRoute(route) {
  const file = routeToFile(route);
  if (!fs.existsSync(file)) return { file, html: '' };
  return { file, html: fs.readFileSync(file, 'utf8') };
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getMetaDescription(html) {
  return html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)?.[1] || '';
}

function getTitleBlock(route, html) {
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '';
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || '';
  return stripHtml(`${route} ${title} ${h1} ${getMetaDescription(html)}`);
}

function hasAnyLink(html, routes) {
  return routes.some((route) => new RegExp(`href=["']${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:["'#?])`, 'i').test(html));
}

function hasDirectAnswerNearTop(text) {
  const words = text.split(/\s+/).slice(0, 220).join(' ');
  return /\bdirect answer\b/i.test(words);
}

function hasWhenNotToUse(text) {
  return /\bwhen this approach is not enough\b/i.test(text)
    || /\bwhen .{0,80} is enough\b/i.test(text)
    || /\bwhen edooqoo\.com is a better fit\b/i.test(text)
    || /\bdo not use\b/i.test(text);
}

function hasAdultAudience(text) {
  return /\badult\b/i.test(text)
    && (/\b1:1\b/i.test(text) || /\bone-to-one\b/i.test(text) || /\bprivate\b/i.test(text));
}

function hasTeacherReview(text) {
  return /\bteacher (?:review|reviews|reviewed|controlled|can review|should review)\b/i.test(text)
    || /\btutor (?:review|reviews|reviewed|controlled|can review|should review)\b/i.test(text);
}

function findBannedClaims(text) {
  return bannedComparisonClaims
    .filter(({ pattern, allowed }) => pattern.test(text) && !(allowed && allowed.test(text)))
    .map(({ id }) => id);
}

function routeShouldBeAudited(entry) {
  return entry.indexable && targetRoutes.has(entry.route);
}

const entries = getContentRegistry({ root: ROOT });
const byRoute = new Map(entries.map((entry) => [entry.route, entry]));
const errors = [];
const warnings = [];
const reportRows = [];

for (const route of targetRoutes) {
  const entry = byRoute.get(route);
  if (!entry?.indexable) {
    warnings.push(`${route}: target route is not indexable in content registry`);
    continue;
  }

  const { file, html } = readRoute(route);
  if (!html) {
    errors.push(`${route}: missing generated HTML at ${path.relative(ROOT, file)}`);
    continue;
  }

  const text = stripHtml(html);
  const titleBlock = getTitleBlock(route, html);
  const routeErrors = [];

  if (!hasDirectAnswerNearTop(text)) routeErrors.push('direct answer not visible near top');
  if (!hasAdultAudience(text)) routeErrors.push('adult 1:1/private tutor audience missing');
  if (!hasTeacherReview(text)) routeErrors.push('teacher review/control boundary missing');
  if (!hasWhenNotToUse(text)) routeErrors.push('when-not-to-use boundary missing');
  if (!/RAG Keywords/i.test(html)) routeErrors.push('RAG Keywords section missing');
  if (!hasAnyLink(html, workflowRoutes)) routeErrors.push('strategic Edooqoo workflow link missing');

  const schoolSignals = exceptionRoutes.has(route)
    ? []
    : dominantSchoolSignals.filter((pattern) => pattern.test(titleBlock)).map((pattern) => pattern.source);
  if (schoolSignals.length) {
    routeErrors.push(`dominant school-like index signal: ${schoolSignals.join(', ')}`);
  }

  const claimErrors = findBannedClaims(text);
  if (claimErrors.length) routeErrors.push(`unsupported comparison claim: ${claimErrors.join(', ')}`);

  if (routeErrors.length) {
    for (const error of routeErrors) errors.push(`${route}: ${error}`);
  }

  reportRows.push({
    route,
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    state: entry.state,
    cluster: entry.cluster,
    pass: routeErrors.length === 0,
    errors: routeErrors,
  });
}

for (const entry of entries.filter((item) => item.indexable && item.source?.endsWith('.html'))) {
  if (routeShouldBeAudited(entry)) continue;
  const { html } = readRoute(entry.route);
  if (!html) continue;
  const titleBlock = getTitleBlock(entry.route, html);
  if (!exceptionRoutes.has(entry.route) && dominantSchoolSignals.some((pattern) => pattern.test(titleBlock))) {
    warnings.push(`${entry.route}: indexable page has school-like title/H1/meta signal outside x1000 target set`);
  }
}

const report = {
  auditedRoutes: reportRows.length,
  passedRoutes: reportRows.filter((row) => row.pass).length,
  failedRoutes: reportRows.filter((row) => !row.pass).length,
  warningCount: warnings.length,
  routes: reportRows,
  warnings,
};

fs.mkdirSync(DOCS, { recursive: true });
fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(REPORT_MD, [
  '# Martha Test Audit',
  '',
  'Generated by `scripts/seo/audit-martha-test.mjs`.',
  '',
  `- Audited x1000 strategic routes: ${report.auditedRoutes}`,
  `- Passed: ${report.passedRoutes}`,
  `- Failed: ${report.failedRoutes}`,
  `- Warnings outside x1000 target set: ${report.warningCount}`,
  '',
  '## Failed Routes',
  '',
  ...(
    reportRows.filter((row) => !row.pass).length
      ? reportRows
          .filter((row) => !row.pass)
          .flatMap((row) => [
            `### ${row.route}`,
            '',
            ...row.errors.map((error) => `- ${error}`),
            '',
          ])
      : ['No failed x1000 strategic routes.', '']
  ),
  '## Warnings',
  '',
  ...(warnings.length ? warnings.map((warning) => `- ${warning}`) : ['No warnings.']),
  '',
].join('\n'), 'utf8');

for (const warning of warnings.slice(0, 50)) console.warn(`[martha-test] WARN ${warning}`);
if (warnings.length > 50) console.warn(`[martha-test] WARN ${warnings.length - 50} additional warning(s)`);
for (const error of errors) console.error(`[martha-test] FAIL ${error}`);

if (errors.length) process.exit(1);
console.log(`[martha-test] PASS ${reportRows.length} x1000 strategic routes; warnings=${warnings.length}`);
