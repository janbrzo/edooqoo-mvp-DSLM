#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { getRoutingDecisions } from './content-registry.mjs';
import { getPseoRouteInventory } from './pseo-index-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BASE = 'https://edooqoo.com';
const DEFAULT_OUTPUT_JSON = path.join(ROOT, 'docs', 'seo', 'gsc-coverage-analysis.generated.json');
const DEFAULT_OUTPUT_MD = path.join(ROOT, 'docs', 'seo', 'gsc-coverage-analysis.generated.md');

const KNOWN_PROBLEMS = [
  'Nie znaleziono (404)',
  'Strona zawiera przekierowanie',
  'Alternatywna strona zawierająca prawidłowy tag strony kanonicznej',
  'Strona zeskanowana, ale jeszcze nie zindeksowana',
  'Duplikat, użytkownik nie oznaczył strony kanonicznej',
  'Strona zablokowana przez plik robots.txt',
  'Strona wykryta – obecnie niezindeksowana',
  'Pozorny błąd 404',
];

const PROBLEM_LABELS = {
  NOT_FOUND: 'Nie znaleziono (404)',
  REDIRECT: 'Strona zawiera przekierowanie',
  CANONICAL_ALT: 'Alternatywna strona zawieraj\u0105ca prawid\u0142owy tag strony kanonicznej',
  CRAWLED_NOT_INDEXED: 'Strona zeskanowana, ale jeszcze nie zindeksowana',
  DUPLICATE_NO_CANONICAL: 'Duplikat, u\u017Cytkownik nie oznaczy\u0142 strony kanonicznej',
  ROBOTS_BLOCKED: 'Strona zablokowana przez plik robots.txt',
  DISCOVERED_NOT_INDEXED: 'Strona wykryta \u2013 obecnie niezindeksowana',
  SOFT_404: 'Pozorny b\u0142\u0105d 404',
};

const NORMALIZED_PROBLEM_LABELS = [
  PROBLEM_LABELS.NOT_FOUND,
  PROBLEM_LABELS.REDIRECT,
  PROBLEM_LABELS.CANONICAL_ALT,
  PROBLEM_LABELS.CRAWLED_NOT_INDEXED,
  PROBLEM_LABELS.DUPLICATE_NO_CANONICAL,
  PROBLEM_LABELS.ROBOTS_BLOCKED,
  PROBLEM_LABELS.DISCOVERED_NOT_INDEXED,
  PROBLEM_LABELS.SOFT_404,
];

const PROBLEM_ALIASES = new Map();
KNOWN_PROBLEMS.forEach((problem, index) => {
  PROBLEM_ALIASES.set(problem, NORMALIZED_PROBLEM_LABELS[index] || problem);
});
for (const label of NORMALIZED_PROBLEM_LABELS) {
  PROBLEM_ALIASES.set(label, label);
  if (!KNOWN_PROBLEMS.includes(label)) KNOWN_PROBLEMS.push(label);
}

function normalizeProblemLabel(problem) {
  return PROBLEM_ALIASES.get(problem) || problem;
}

const argv = process.argv.slice(2);
const argValue = (name) => {
  const exactIndex = argv.indexOf(name);
  if (exactIndex >= 0) return argv[exactIndex + 1];
  const prefixed = argv.find((arg) => arg.startsWith(`${name}=`));
  return prefixed ? prefixed.slice(name.length + 1) : null;
};

const GSC_DIR = path.resolve(
  argValue('--dir') || process.env.GSC_EXPORT_DIR || ''
);
const PREVIOUS_REPORT_PATH = argValue('--previous') || argValue('--baseline') || process.env.GSC_PREVIOUS_REPORT || '';
const LIVE_CHECK = argv.includes('--live');
const WRITE_OUTPUT = !argv.includes('--no-write');

if (!GSC_DIR || !fsSync.existsSync(GSC_DIR)) {
  console.error('[gsc-analyze] Provide a valid GSC export directory with --dir or GSC_EXPORT_DIR.');
  process.exit(1);
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const normalized = text.replace(/^\uFEFF/, '');

  for (let index = 0; index < normalized.length; index++) {
    const char = normalized[index];
    const next = normalized[index + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        index++;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  if (!rows.length) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1)
    .filter((values) => values.some((value) => value.trim()))
    .map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function readUInt32LE(buffer, offset) {
  return buffer.readUInt32LE(offset);
}

function readUInt16LE(buffer, offset) {
  return buffer.readUInt16LE(offset);
}

function findEndOfCentralDirectory(buffer) {
  for (let offset = buffer.length - 22; offset >= Math.max(0, buffer.length - 65558); offset--) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error('ZIP end-of-central-directory record not found');
}

async function readZipEntries(zipPath) {
  const buffer = await fs.readFile(zipPath);
  const eocd = findEndOfCentralDirectory(buffer);
  const entryCount = readUInt16LE(buffer, eocd + 10);
  const centralOffset = readUInt32LE(buffer, eocd + 16);
  const entries = new Map();
  let cursor = centralOffset;

  for (let index = 0; index < entryCount; index++) {
    if (readUInt32LE(buffer, cursor) !== 0x02014b50) {
      throw new Error(`Invalid central directory entry at ${cursor}`);
    }
    const compression = readUInt16LE(buffer, cursor + 10);
    const compressedSize = readUInt32LE(buffer, cursor + 20);
    const fileNameLength = readUInt16LE(buffer, cursor + 28);
    const extraLength = readUInt16LE(buffer, cursor + 30);
    const commentLength = readUInt16LE(buffer, cursor + 32);
    const localOffset = readUInt32LE(buffer, cursor + 42);
    const name = buffer.slice(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');

    if (readUInt32LE(buffer, localOffset) !== 0x04034b50) {
      throw new Error(`Invalid local file header for ${name}`);
    }
    const localNameLength = readUInt16LE(buffer, localOffset + 26);
    const localExtraLength = readUInt16LE(buffer, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.slice(dataStart, dataStart + compressedSize);
    let content;
    if (compression === 0) content = compressed;
    else if (compression === 8) content = zlib.inflateRawSync(compressed);
    else throw new Error(`Unsupported ZIP compression ${compression} for ${name}`);

    entries.set(name.replace(/\\/g, '/'), content.toString('utf8'));
    cursor += 46 + fileNameLength + extraLength + commentLength;
  }

  return entries;
}

function detectProblem({ sourceName, metadataText, hasTable }) {
  if (/Coverage-Valid/i.test(sourceName)) return 'Zindeksowano';
  const problem = KNOWN_PROBLEMS.find((item) => metadataText.includes(item));
  if (problem) return normalizeProblemLabel(problem);
  if (!hasTable) return 'Coverage summary';
  return normalizeProblemLabel(sourceName);
}

async function readExportSource(sourcePath) {
  const stat = await fs.stat(sourcePath);
  const sourceName = path.basename(sourcePath, stat.isDirectory() ? '' : '.zip');
  let files;

  if (stat.isDirectory()) {
    const children = await fs.readdir(sourcePath);
    files = new Map();
    for (const child of children) {
      if (child.toLowerCase().endsWith('.csv')) {
        files.set(child, await fs.readFile(path.join(sourcePath, child), 'utf8'));
      }
    }
  } else if (sourcePath.toLowerCase().endsWith('.zip')) {
    files = await readZipEntries(sourcePath);
  } else {
    return null;
  }

  const metadataText = files.get('Metadane.csv') || '';
  const tableText = files.get('Tabela.csv') || '';
  const problem = detectProblem({ sourceName, metadataText, hasTable: Boolean(tableText) });
  const rows = tableText ? parseCsv(tableText) : [];

  return {
    sourceName,
    problem,
    rows,
    metadata: metadataText ? parseCsv(metadataText) : [],
  };
}

function routeFromUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.pathname.replace(/\/+$/, '') || '/';
  } catch {
    return '';
  }
}

function classifyUrl(url) {
  const route = routeFromUrl(url);
  if (!route) return 'invalid-url';
  if (route === '/') return 'home';
  if (route.startsWith('/blog/')) return 'blog';
  if (route === '/blog') return 'blog-index';
  if (route.startsWith('/worksheets/')) return 'worksheets-pseo';
  if (route.startsWith('/esl-worksheets/')) return 'esl-worksheets-pseo';
  if (route.startsWith('/english-for/')) return 'english-for-pseo';
  if (route === '/signup') return 'signup-query';
  if (route.endsWith('.html')) return 'static-html';
  if ([
    '/about',
    '/pricing',
    '/how-it-works',
    '/one-minute-prep',
    '/resources',
    '/demo',
    '/cookie-policy',
    '/privacy-policy',
    '/terms-of-service',
  ].includes(route)) return 'core-spa';
  if (/^\/(?:admin|dashboard|profile|homework|worksheet|student|my|my-lessons|my-flashcards|book|calendar|login|reset-password|forgot-password)(?:\/|$)/.test(route)) {
    return 'private';
  }
  return 'other-spa';
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function getSitemapSet() {
  const sitemap = fsSync.readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
  return new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1].trim()));
}

function expectedActionFor({ url, problem, type, route, inSitemap, redirectTo, noindex, policyIndexable }) {
  const normalizedProblem = normalizeProblemLabel(problem);
  const notIndexedProblem = [
    PROBLEM_LABELS.DISCOVERED_NOT_INDEXED,
    PROBLEM_LABELS.CRAWLED_NOT_INDEXED,
  ].includes(normalizedProblem);

  if (redirectTo) return 'validate-redirect';
  if (normalizedProblem === PROBLEM_LABELS.REDIRECT) return 'accept-host-redirect';
  if (normalizedProblem === PROBLEM_LABELS.CANONICAL_ALT) return 'accept-or-force-host-canonical';
  if (type === 'signup-query') return 'keep-noindex';
  if (noindex && !inSitemap) return 'keep-noindex-follow';
  if (noindex && inSitemap) return 'fix-sitemap-noindex-conflict';
  if (['worksheets-pseo', 'esl-worksheets-pseo', 'english-for-pseo'].includes(type) && !policyIndexable) {
    return 'keep-out-of-index-policy';
  }
  if (inSitemap && notIndexedProblem) {
    return 'strengthen-prerender-internal-links';
  }
  if (!inSitemap && notIndexedProblem) {
    return 'decide-promote-or-noindex';
  }
  if (normalizedProblem === PROBLEM_LABELS.NOT_FOUND) return 'repair-or-redirect-404';
  return 'review';
}

async function liveCheck(url) {
  try {
    const response = await fetch(url, { redirect: 'manual' });
    return {
      status: response.status,
      location: response.headers.get('location') || '',
      xRobotsTag: response.headers.get('x-robots-tag') || '',
      contentType: response.headers.get('content-type') || '',
    };
  } catch (error) {
    return { error: error.message };
  }
}

const sources = [];
for (const entry of await fs.readdir(GSC_DIR)) {
  const source = await readExportSource(path.join(GSC_DIR, entry));
  if (source && source.rows.length) sources.push(source);
}

const sitemapSet = getSitemapSet();
const routing = getRoutingDecisions({ root: ROOT });
const pseoInventory = getPseoRouteInventory({ root: ROOT });
const indexablePseo = new Set(pseoInventory.indexable);
const noindexRoutes = new Set(routing.noindex);
const rawRows = [];

for (const source of sources) {
  for (const row of source.rows) {
    const url = row.URL || row.Url || row.url || '';
    const route = routeFromUrl(url);
    const type = classifyUrl(url);
    const redirectTo = routing.redirects[route] || '';
    const inSitemap = sitemapSet.has(url);
    const noindex = noindexRoutes.has(route);
    const policyIndexable = indexablePseo.has(route);
    const item = {
      problem: source.problem,
      source: source.sourceName,
      url,
      route,
      type,
      inSitemap,
      redirectTo,
      noindex,
      policyIndexable,
      lastCrawled: row['Ostatnio zeskanowano'] || row['Ostatnie skanowanie'] || row['Last crawled'] || '',
    };
    item.expectedAction = expectedActionFor(item);
    rawRows.push(item);
  }
}

const rowsByProblemAndUrl = new Map();
for (const item of rawRows) {
  const key = `${item.problem}\u0000${item.url}`;
  const existing = rowsByProblemAndUrl.get(key);
  if (!existing) {
    rowsByProblemAndUrl.set(key, {
      ...item,
      sources: [item.source],
      duplicateSourceRows: 1,
    });
    continue;
  }

  if (!existing.sources.includes(item.source)) {
    existing.sources.push(item.source);
  }
  existing.duplicateSourceRows++;
  if (!existing.lastCrawled && item.lastCrawled) {
    existing.lastCrawled = item.lastCrawled;
  }
}

const allRows = [...rowsByProblemAndUrl.values()].sort((a, b) =>
  a.problem.localeCompare(b.problem) || a.url.localeCompare(b.url)
);

if (LIVE_CHECK) {
  for (const item of allRows) {
    if ([
      'repair-or-redirect-404',
      'validate-redirect',
      'keep-noindex',
      'keep-noindex-follow',
      'strengthen-prerender-internal-links',
    ].includes(item.expectedAction)) {
      item.live = await liveCheck(item.url);
    }
  }
}

const problemNames = [...new Set(allRows.map((row) => row.problem))];
const sets = problemNames.map((problem) => {
  const rows = allRows.filter((row) => row.problem === problem);
  return {
    problem,
    sources: [...new Set(rows.flatMap((row) => row.sources))].sort(),
    rows: rows.length,
    rawRows: rows.reduce((sum, row) => sum + row.duplicateSourceRows, 0),
    byType: countBy(rows, (row) => row.type),
    byAction: countBy(rows, (row) => row.expectedAction),
    inSitemap: rows.filter((row) => row.inSitemap).length,
    noindex: rows.filter((row) => row.noindex).length,
    redirect: rows.filter((row) => row.redirectTo).length,
    samples: rows.slice(0, 10).map((row) => ({
      url: row.url,
      type: row.type,
      expectedAction: row.expectedAction,
      inSitemap: row.inSitemap,
      redirectTo: row.redirectTo,
    })),
  };
});

function loadPreviousReport() {
  if (!PREVIOUS_REPORT_PATH) return null;
  const resolved = path.resolve(PREVIOUS_REPORT_PATH);
  if (!fsSync.existsSync(resolved)) {
    console.warn(`[gsc-analyze] Previous report not found: ${resolved}`);
    return null;
  }
  try {
    return JSON.parse(fsSync.readFileSync(resolved, 'utf8'));
  } catch (error) {
    console.warn(`[gsc-analyze] Could not parse previous report ${resolved}: ${error.message}`);
    return null;
  }
}

function urlsForProblem(rows, problem) {
  return new Set(rows
    .filter((row) => normalizeProblemLabel(row.problem) === normalizeProblemLabel(problem))
    .map((row) => row.url)
    .filter(Boolean));
}

function intersection(a, b) {
  return [...a].filter((value) => b.has(value)).sort();
}

function difference(a, b) {
  return [...a].filter((value) => !b.has(value)).sort();
}

function sample(values, count = 20) {
  return values.slice(0, count);
}

function daysBetween(startIso, endIso) {
  if (!startIso || !endIso) return null;
  const start = Date.parse(startIso);
  const end = Date.parse(endIso);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.floor((end - start) / 86400000);
}

function compareReports(currentRows, previousReport, generatedAt) {
  const previousRows = previousReport?.rows || [];
  const previousIndexed = urlsForProblem(previousRows, 'Zindeksowano');
  const currentIndexed = urlsForProblem(currentRows, 'Zindeksowano');
  const ageDays = daysBetween(previousReport?.generatedAt, generatedAt);
  const currentSitemapUrls = [...sitemapSet].sort();
  const sitemapNotIndexed = currentSitemapUrls.filter((url) => !currentIndexed.has(url));
  const noindexAccidentallyIndexed = currentRows
    .filter((row) =>
      normalizeProblemLabel(row.problem) === 'Zindeksowano' &&
      (row.noindex || ['keep-noindex', 'keep-noindex-follow', 'keep-out-of-index-policy'].includes(row.expectedAction))
    )
    .map((row) => row.url)
    .sort();

  return {
    previousReportPath: PREVIOUS_REPORT_PATH ? path.resolve(PREVIOUS_REPORT_PATH) : '',
    previousGeneratedAt: previousReport?.generatedAt || '',
    ageDays,
    newIndexed: {
      count: previousReport ? difference(currentIndexed, previousIndexed).length : 0,
      samples: previousReport ? sample(difference(currentIndexed, previousIndexed)) : [],
    },
    stillDiscoveredNotIndexed: {
      count: previousReport ? intersection(
        urlsForProblem(currentRows, PROBLEM_LABELS.DISCOVERED_NOT_INDEXED),
        urlsForProblem(previousRows, PROBLEM_LABELS.DISCOVERED_NOT_INDEXED)
      ).length : 0,
      samples: previousReport ? sample(intersection(
        urlsForProblem(currentRows, PROBLEM_LABELS.DISCOVERED_NOT_INDEXED),
        urlsForProblem(previousRows, PROBLEM_LABELS.DISCOVERED_NOT_INDEXED)
      )) : [],
    },
    stillCrawledNotIndexed: {
      count: previousReport ? intersection(
        urlsForProblem(currentRows, PROBLEM_LABELS.CRAWLED_NOT_INDEXED),
        urlsForProblem(previousRows, PROBLEM_LABELS.CRAWLED_NOT_INDEXED)
      ).length : 0,
      samples: previousReport ? sample(intersection(
        urlsForProblem(currentRows, PROBLEM_LABELS.CRAWLED_NOT_INDEXED),
        urlsForProblem(previousRows, PROBLEM_LABELS.CRAWLED_NOT_INDEXED)
      )) : [],
    },
    still404: {
      count: previousReport ? intersection(
        urlsForProblem(currentRows, PROBLEM_LABELS.NOT_FOUND),
        urlsForProblem(previousRows, PROBLEM_LABELS.NOT_FOUND)
      ).length : 0,
      samples: previousReport ? sample(intersection(
        urlsForProblem(currentRows, PROBLEM_LABELS.NOT_FOUND),
        urlsForProblem(previousRows, PROBLEM_LABELS.NOT_FOUND)
      )) : [],
    },
    noindexAccidentallyIndexed: {
      count: noindexAccidentallyIndexed.length,
      samples: sample(noindexAccidentallyIndexed),
    },
    sitemapUrlsNotIndexed: {
      count: sitemapNotIndexed.length,
      samples: sample(sitemapNotIndexed),
      requires14DayReview: Boolean(previousReport && ageDays !== null && ageDays >= 14),
      requires28DayReview: Boolean(previousReport && ageDays !== null && ageDays >= 28),
    },
  };
}

const previousReport = loadPreviousReport();
const generatedAt = new Date().toISOString();
const comparison = compareReports(allRows, previousReport, generatedAt);

const report = {
  generatedAt,
  gscDirectory: GSC_DIR,
  liveCheck: LIVE_CHECK,
  totals: {
    rows: allRows.length,
    rawRows: rawRows.length,
    sources: sources.length,
    sitemapUrls: sitemapSet.size,
    byProblem: countBy(allRows, (row) => row.problem),
    byType: countBy(allRows, (row) => row.type),
    byAction: countBy(allRows, (row) => row.expectedAction),
  },
  comparison,
  sets,
  rows: allRows,
};

function formatCounts(counts) {
  return Object.entries(counts).map(([key, count]) => `${key}: ${count}`).join('<br>');
}

const markdown = [
  '# GSC Coverage Analysis',
  '',
  `Generated: ${report.generatedAt}`,
  `Source directory: \`${GSC_DIR}\``,
  `Live HTTP checks: \`${LIVE_CHECK ? 'enabled' : 'disabled'}\``,
  '',
  '## Summary',
  '',
  `- Unique problem URLs analyzed: ${report.totals.rows}`,
  `- Raw export rows read: ${report.totals.rawRows}`,
  `- Export sources read: ${report.totals.sources}`,
  `- Sitemap URLs: ${report.totals.sitemapUrls}`,
  '',
  '| Problem | Unique URLs | Raw rows | In sitemap | Noindex routes | Redirect routes | Type breakdown | Action breakdown |',
  '|---|---:|---:|---:|---:|---:|---|---|',
  ...sets.map((set) =>
    `| ${set.problem} | ${set.rows} | ${set.rawRows} | ${set.inSitemap} | ${set.noindex} | ${set.redirect} | ${formatCounts(set.byType)} | ${formatCounts(set.byAction)} |`
  ),
  '',
  '## Week-Over-Week Comparison',
  '',
  `- Previous report: ${report.comparison.previousReportPath ? `\`${report.comparison.previousReportPath}\`` : 'not provided'}`,
  `- Previous generated at: ${report.comparison.previousGeneratedAt || 'n/a'}`,
  `- Age in days: ${report.comparison.ageDays ?? 'n/a'}`,
  '',
  '| Metric | Count | Samples |',
  '|---|---:|---|',
  `| New indexed | ${report.comparison.newIndexed.count} | ${report.comparison.newIndexed.samples.join('<br>')} |`,
  `| Still discovered not indexed | ${report.comparison.stillDiscoveredNotIndexed.count} | ${report.comparison.stillDiscoveredNotIndexed.samples.join('<br>')} |`,
  `| Still crawled not indexed | ${report.comparison.stillCrawledNotIndexed.count} | ${report.comparison.stillCrawledNotIndexed.samples.join('<br>')} |`,
  `| Still 404 | ${report.comparison.still404.count} | ${report.comparison.still404.samples.join('<br>')} |`,
  `| Noindex URLs accidentally indexed | ${report.comparison.noindexAccidentallyIndexed.count} | ${report.comparison.noindexAccidentallyIndexed.samples.join('<br>')} |`,
  `| Sitemap URLs not indexed | ${report.comparison.sitemapUrlsNotIndexed.count} | ${report.comparison.sitemapUrlsNotIndexed.samples.join('<br>')} |`,
  '',
  `- 14-day sitemap review required: ${report.comparison.sitemapUrlsNotIndexed.requires14DayReview ? 'yes' : 'no'}`,
  `- 28-day sitemap review required: ${report.comparison.sitemapUrlsNotIndexed.requires28DayReview ? 'yes' : 'no'}`,
  '',
  '## Priority Samples',
  '',
  ...sets.flatMap((set) => [
    `### ${set.problem}`,
    '',
    '| URL | Type | In sitemap | Redirect target | Expected action |',
    '|---|---|---:|---|---|',
    ...set.samples.map((sample) =>
      `| ${sample.url} | ${sample.type} | ${sample.inSitemap ? 'yes' : 'no'} | ${sample.redirectTo || ''} | ${sample.expectedAction} |`
    ),
    '',
  ]),
  '## Action Legend',
  '',
  '- `validate-redirect`: generated redirect exists; production must return 301 and GSC validation should be requested.',
  '- `strengthen-prerender-internal-links`: indexable URL needs route-specific raw HTML and stronger internal links.',
  '- `decide-promote-or-noindex`: URL is known to Google but not in sitemap; either promote through policy or keep noindex.',
  '- `keep-noindex-follow`: intentional exclusion; do not request indexing.',
  '- `keep-out-of-index-policy`: crawlable long-tail pSEO route outside the index policy.',
  '- `keep-noindex`: auth/conversion URL should stay out of index.',
  '',
].join('\n');

if (WRITE_OUTPUT) {
  await fs.mkdir(path.dirname(DEFAULT_OUTPUT_JSON), { recursive: true });
  await fs.writeFile(DEFAULT_OUTPUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await fs.writeFile(DEFAULT_OUTPUT_MD, markdown, 'utf8');
  console.log(`[gsc-analyze] Wrote ${path.relative(ROOT, DEFAULT_OUTPUT_JSON)}`);
  console.log(`[gsc-analyze] Wrote ${path.relative(ROOT, DEFAULT_OUTPUT_MD)}`);
}

console.log(`[gsc-analyze] uniqueRows=${report.totals.rows} rawRows=${report.totals.rawRows} sources=${report.totals.sources} problemSets=${sets.length} live=${LIVE_CHECK ? 'yes' : 'no'}`);
console.log(`[gsc-analyze] actions=${JSON.stringify(report.totals.byAction)}`);
