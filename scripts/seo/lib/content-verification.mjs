/**
 * Content verification core (pure functions, no I/O, no network).
 *
 * Layer 1 = deterministic checks on one public HTML page.
 * Layer 2 = LLM judges (see llm-judges.mjs); this file only aggregates their verdicts.
 *
 * Spec and rationale: docs/seo/decisions-2026-10.md (item 3). A page is `verified`
 * only when layer 1 has no failing check AND every configured judge passes.
 * Fail closed: an error, refusal or missing verdict is never a pass.
 */
import crypto from 'node:crypto';

export const UNIQUENESS_MAX_CONTAINMENT = 0.3;
export const LINKS_WARN_ABOVE = 10;
export const LINKS_FAIL_ABOVE = 15;

/** Visible text addressed to bots instead of teachers. */
export const BOT_TEXT_PATTERNS = [
  [/when to cite this page/i, 'visible "When to cite this page" block'],
  [/primary audience[^.]{0,80}(ai agents|search systems)/i, 'visible "Primary audience: AI agents" block'],
  [/(^|\n)\s*RAG Keywords\b/i, 'visible "RAG Keywords" block'],
  [/for (ai|llm) (agents|crawlers|systems) (reading|citing|only)/i, 'text addressed to AI agents'],
];

/**
 * Claims that must not appear without a source (subset of audit-seo-assets). An optional third
 * element strips negated phrasing ("does not claim guaranteed outcomes") before matching.
 */
export const CLAIM_PATTERNS = [
  [/Reviewed by\s+Martha|Methodology review by|ESL Methodology Reviewer/i, 'human-review attribution (no human review happens)'],
  [/\bguarantee[sd]?\b/i, 'guarantee language', /\b(?:not|no|never|without|nor)\b[^.]{0,80}?\bguarantee\w*/gi],
  [/\b(?:#1|number one|world'?s best|the best (?:ai )?(?:tool|platform|app))\b/i, 'unsupported superlative'],
  [/\b(?:testimonial|customers say|trusted by \d)/i, 'testimonial or usage claim'],
  [/\bcoming soon\b|\bplanned feature|\bon (?:our|the) roadmap\b|\bin beta\b|\bbeta (?:feature|version|access|users?)\b/i, 'BETA/ROADMAP wording on a public page'],
];

/** A bare percentage or "N times" statistic needs a source in the page. */
export const STATISTIC_PATTERN = /\b\d{1,3}(?:\.\d+)?\s?%|\b\d+(?:\.\d+)?x (?:faster|more|better)\b/i;

function decodeEntities(text) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;/gi, ' ');
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

export function extractPage(html) {
  const title = stripTags((html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const h1 = stripTags((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [])[1] || '');
  const robots = (html.match(/<meta[^>]+name=["']robots["'][^>]*content=["']([^"']*)["']/i) || [])[1] || '';
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i) || [])[1] || '';

  const jsonld = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      jsonld.push(JSON.parse(match[1]));
    } catch {
      jsonld.push({ __parseError: true });
    }
  }

  const main = (html.match(/<main[\s\S]*?<\/main>/i) || [html])[0];
  // Count only contextual links: site chrome (nav/header/footer/aside) is excluded, duplicates collapse.
  const mainContent = main.replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, ' ');
  const links = [...new Set([...mainContent.matchAll(/<a\b[^>]*href=["']([^"']+)["']/gi)].map((m) => m[1]))];
  const internalLinks = links.filter((href) => href.startsWith('/') || href.startsWith('https://edooqoo.com'));
  const externalLinks = links.filter((href) => /^https?:\/\//.test(href) && !href.startsWith('https://edooqoo.com'));

  const body = (html.match(/<body[\s\S]*<\/body>/i) || [html])[0]
    .replace(/<(script|style|nav|footer|header|aside|noscript)\b[\s\S]*?<\/\1>/gi, ' ');
  const text = stripTags(body);

  return {
    title,
    h1,
    robots,
    canonical,
    jsonld,
    internalLinks,
    externalLinks: [...new Set(externalLinks)],
    text,
    words: (text.match(/[A-Za-z0-9']+/g) || []).length,
  };
}

export function contentHash(text) {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

function flattenJsonLd(nodes) {
  const out = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) return node.forEach(visit);
    out.push(node);
    if (node['@graph']) visit(node['@graph']);
  };
  visit(nodes);
  return out;
}

const norm = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** Layer 1. `ctx.maxContainment` comes from docs/seo/content-uniqueness.generated.json. */
export function deterministicChecks(page, ctx = {}) {
  const checks = [];
  const add = (id, status, detail = '') => checks.push({ id, status, detail });

  if (typeof ctx.maxContainment === 'number') {
    add(
      'uniqueness',
      ctx.maxContainment < UNIQUENESS_MAX_CONTAINMENT ? 'pass' : 'fail',
      `maxContainment ${ctx.maxContainment} (limit < ${UNIQUENESS_MAX_CONTAINMENT}), nearest ${ctx.nearest || 'n/a'}`,
    );
  } else {
    add('uniqueness', 'fail', 'no uniqueness measurement; run npm run seo:audit-uniqueness first');
  }

  const bot = BOT_TEXT_PATTERNS.filter(([pattern]) => pattern.test(page.text)).map(([, label]) => label);
  add('no-bot-text', bot.length ? 'fail' : 'pass', bot.join('; '));

  const claims = CLAIM_PATTERNS
    .filter(([pattern, , negation]) => pattern.test(negation ? page.text.replace(negation, ' ') : page.text))
    .map(([, label]) => label);
  add('no-unsupported-claims', claims.length ? 'fail' : 'pass', claims.join('; '));

  const hasSource = page.externalLinks.length > 0 || /\bsources?\b/i.test(page.text);
  if (STATISTIC_PATTERN.test(page.text)) {
    add('statistics-sourced', hasSource ? 'warn' : 'fail', hasSource ? 'statistic present; judge must confirm its source' : 'statistic present and the page cites no source');
  } else {
    add('statistics-sourced', 'pass');
  }

  const linkCount = page.internalLinks.length;
  add(
    'link-count',
    linkCount > LINKS_FAIL_ABOVE ? 'fail' : linkCount > LINKS_WARN_ABOVE ? 'warn' : 'pass',
    `${linkCount} internal links in <main> (warn > ${LINKS_WARN_ABOVE}, fail > ${LINKS_FAIL_ABOVE})`,
  );

  const nodes = flattenJsonLd(page.jsonld);
  if (nodes.some((node) => node.__parseError)) {
    add('jsonld-matches-page', 'fail', 'invalid JSON-LD');
  } else {
    const problems = [];
    const visible = norm(page.text);
    for (const node of nodes) {
      const type = [].concat(node['@type'] || []);
      if (type.some((t) => t === 'Article' || t === 'BlogPosting') && node.headline) {
        const headline = norm(node.headline);
        if (!norm(page.h1).includes(headline) && !headline.includes(norm(page.h1)) && !norm(page.title).includes(headline)) {
          problems.push('Article headline does not match H1/title');
        }
      }
      if (type.includes('FAQPage')) {
        for (const item of node.mainEntity || []) {
          const question = norm(item.name);
          if (question && !visible.includes(question)) problems.push(`FAQ question not visible: ${item.name}`);
        }
      }
      if (node.reviewedBy) problems.push('reviewedBy present (no human review happens)');
    }
    add('jsonld-matches-page', problems.length ? 'fail' : 'pass', problems.slice(0, 3).join('; '));
  }

  // Interactive tools carry their value in the tool, so short copy is only a warning; near-empty pages fail.
  if (page.words < 100) add('substance', 'fail', `${page.words} words`);
  else if (page.words < 300) add('substance', 'warn', `${page.words} words (acceptable for tools; the judges decide for articles)`);
  else add('substance', 'pass', `${page.words} words`);

  if (/noindex/i.test(page.robots)) add('indexable-state', 'warn', 'page is noindex; verification is only needed to make it indexable');

  return checks;
}

export function layer1Status(checks) {
  if (checks.some((check) => check.status === 'fail')) return 'fail';
  return 'pass';
}

/** External citation check. `fetchImpl(url)` must resolve to `{ ok, status }`. Allowlist = hostnames or suffixes. */
export async function checkExternalLinks(urls, { allowlist, fetchImpl }) {
  const results = [];
  for (const url of urls) {
    let host = '';
    try {
      host = new URL(url).hostname.replace(/^www\./, '');
    } catch {
      results.push({ url, status: 'fail', detail: 'invalid URL' });
      continue;
    }
    const allowed = allowlist.some((entry) => host === entry || host.endsWith(`.${entry}`));
    if (!allowed) {
      results.push({ url, status: 'fail', detail: `host ${host} is not on the citation allowlist` });
      continue;
    }
    try {
      const response = await fetchImpl(url);
      // 401/403/429 usually mean the publisher blocks automated requests, not that the link is dead:
      // warn so a human opens it once; 404/410/5xx and network errors still fail.
      const botBlocked = [401, 403, 429].includes(response.status);
      results.push({ url, status: response.ok ? 'pass' : botBlocked ? 'warn' : 'fail', detail: `HTTP ${response.status}${botBlocked ? ' (blocked for automated requests; open it manually once)' : ''}` });
    } catch (error) {
      results.push({ url, status: 'fail', detail: `fetch error: ${error.message}` });
    }
  }
  return results;
}

/** Combine layers into one record. Layer 2 is `null` when judges were not run. */
export function buildRecord({ route, page, layer1, links, layer2, checkedAt }) {
  const checks = [...layer1];
  if (links) {
    const failing = links.filter((link) => link.status === 'fail');
    const warned = links.filter((link) => link.status === 'warn');
    const describe = (list) => list.map((link) => `${link.url} (${link.detail})`).join('; ');
    checks.push({
      id: 'external-citations',
      status: failing.length ? 'fail' : warned.length ? 'warn' : 'pass',
      detail: failing.length ? describe(failing) : warned.length ? describe(warned) : `${links.length} checked`,
    });
  }
  const l1 = layer1Status(checks);
  let status;
  if (l1 === 'fail') status = 'failed';
  else if (!layer2) status = 'layer1-only';
  else status = layer2.status === 'pass' ? 'verified' : 'failed';
  return {
    route,
    contentHash: contentHash(page.text),
    checkedAt,
    status,
    layer1: { status: l1, checks },
    layer2: layer2 || null,
  };
}
