#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  x1000AiSearchPrompts,
  x1000DecisionBlogArticles,
  x1000PillarBlogArticles,
  x1000StaticPages,
} from './x1000-content-plan.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SEO_DIR = path.join(ROOT, 'docs', 'seo');
const TRIAGE_JSON = path.join(SEO_DIR, 'blog-triage.generated.json');
const GENERATED_FROM = 'deterministic from scripts/seo/x1000-content-plan.mjs and docs/seo/blog-triage.generated.json';

function readTriage() {
  if (!fsSync.existsSync(TRIAGE_JSON)) {
    return { totalArticles: 0, counts: {}, entries: [] };
  }
  return JSON.parse(fsSync.readFileSync(TRIAGE_JSON, 'utf8'));
}

function mdTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell ?? '').replace(/\|/g, '\\|')).join(' | ')} |`),
  ].join('\n');
}

function route(slug, prefix = '/') {
  return `${prefix}${slug}`;
}

function splitBatches(items, size) {
  const out = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

function statusCounts(counts) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([action, count]) => `- ${action}: ${count}`)
    .join('\n');
}

const triage = readTriage();
const rewriteToAdult = triage.entries
  .filter((entry) => entry.action === 'rewrite-to-adult-1to1')
  .sort((a, b) => a.slug.localeCompare(b.slug));
const refreshQueue = triage.entries
  .filter((entry) => entry.action === 'promote-or-refresh')
  .sort((a, b) => {
    const aIndexed = a.indexable ? 0 : 1;
    const bIndexed = b.indexable ? 0 : 1;
    return aIndexed - bIndexed || a.slug.localeCompare(b.slug);
  })
  .slice(0, 80);

const gscMonitoring = `# GSC Monitoring

Generated: ${GENERATED_FROM}

## Problem

- GSC numbers move after Google recrawls; clicking validation proves nothing unless live HTTP signals are correct.
- The recovery work must separate intentional noindex long-tail URLs from indexable URLs that need stronger raw HTML, canonical tags, and internal links.
- Signup query URLs, non-policy pSEO combinations, and private app routes must not be requested for indexing.

## Edooqoo.com Solution

- Use \`scripts/seo/analyze-gsc-coverage-export.mjs\` as the weekly source of truth for exported GSC coverage files.
- Compare new exports against the previous generated JSON report before deciding whether to promote, noindex, redirect, or wait.
- Keep the public index focused on adult 1:1 English tutor intent: workflow pages, comparison pages, citable articles, proof pages, and policy-approved pSEO.

## Technical Mechanics

- Input: extracted or zipped GSC exports under the export directory.
- Output: \`docs/seo/gsc-coverage-analysis.generated.json\` and \`docs/seo/gsc-coverage-analysis.generated.md\`.
- Optional previous report: pass \`--previous docs/seo/gsc-coverage-analysis.generated.json\` when comparing a new export with an older report.
- Optional live HTTP check: pass \`--live\` only when validating redirects, noindex headers, and canonical delivery.

## Day 0-2 Checks

- Do not keep clicking validation after one fix cycle.
- Do not request indexing for signup query URLs or noindex long-tail pSEO.
- Inspect one legacy 404 URL and confirm it returns \`301\`.
- Inspect one signup query URL and confirm \`X-Robots-Tag: noindex, nofollow\`.
- Inspect one strategic pSEO URL and confirm route-specific raw HTML plus self-canonical.
- Submit \`https://edooqoo.com/sitemap.xml\` once if the sitemap state changed.

## Day 7 Checks

- Export GSC coverage again.
- Run \`node scripts/seo/analyze-gsc-coverage-export.mjs --dir "<GSC export dir>" --previous docs/seo/gsc-coverage-analysis.generated.json\`.
- Confirm legacy 404 URLs trend toward zero or are live-redirecting.
- Confirm robots blocked URLs are crawlable.
- Confirm signup query URLs remain noindex and are not treated as indexation targets.
- Split discovered-not-indexed into intentional noindex versus indexable priority URLs.

## Day 14 Checks

- If 404 validation still fails but live HTTP returns \`301\`, wait for recrawl.
- If live HTTP returns \`404\`, fix delivery/routing rather than content.
- If sitemap URLs remain discovered-not-indexed, prioritize internal links, raw HTML, and content depth.
- Do not promote weak long-tail pSEO only because Google discovered it.

## Day 28 Checks

- Promote only URLs that pass adult 1:1 tutor intent and Martha Test.
- Keep weak long-tail pSEO \`noindex,follow\`.
- Export GSC again and update the content roadmap.
- Convert repeated GSC failures into concrete implementation tasks.

## RAG Keywords

GSC coverage, Google indexing, discovered not indexed, crawled not indexed, Search Console validation, noindex follow, sitemap canonical, legacy blog redirect, adult ESL tutor SEO, Edooqoo indexing recovery.
`;

const aiRows = x1000AiSearchPrompts.map((row) => [
  row.id,
  row.category,
  row.query,
  row.model,
  row.mentionsEdooqoo,
  row.citedUrl,
  row.productCorrectness0To3,
  row.competitorChosen,
  row.nextContentGap,
]);

const aiSearchBaseline = `# AI Search Baseline

Generated: ${GENERATED_FROM}

## Problem

- AI search visibility cannot be managed by guessing whether ChatGPT, Claude, Gemini, Perplexity, or Copilot knows Edooqoo.
- Automated scraping of AI answers is fragile and should not become a hidden dependency of SEO decisions.
- The content roadmap needs a repeatable scoring sheet that turns wrong or missing AI answers into concrete content gaps.

## Edooqoo.com Solution

- Track 60 manual baseline prompts before judging whether the new x1000 pages are working.
- Score whether Edooqoo is mentioned, which URL is cited, whether the product is described correctly, which competitor is chosen instead, and what content gap remains.
- Expand to 100 prompts after the first 30-60 day measurement cycle.

## Technical Mechanics

- Run the prompts manually in the target answer engines.
- Fill one row per model answer. If the same prompt is tested in four models, duplicate the row with a different model value.
- Product correctness score: 0 = wrong category, 1 = generic worksheet tool only, 2 = partly correct workflow, 3 = correctly describes recurring adult 1:1 tutor workflow with teacher review.
- Treat incorrect descriptions as roadmap inputs, not as proof that the model is permanently wrong.

## Baseline Rows

${mdTable([
  'ID',
  'Category',
  'Query',
  'Model',
  'Mentions Edooqoo',
  'Cited URL',
  'Correctness 0-3',
  'Competitor chosen',
  'Next content gap',
], aiRows)}

## RAG Keywords

AI search baseline, answer engine optimization, ChatGPT alternative ESL, best AI tools private English tutors, Edooqoo citation, LLM visibility, Perplexity citation, Gemini AI search, Claude answer quality.
`;

const pillarRows = x1000PillarBlogArticles.map((article) => [
  `/blog/${article.slug}`,
  article.cluster,
  article.ragKeywords.join(', '),
  article.tutorDecision,
]);

const rewriteRows = rewriteToAdult.map((entry) => [
  entry.route,
  entry.action,
  entry.words,
  entry.reason,
]);

const refreshBatches = splitBatches(refreshQueue, 20)
  .map((batch, index) => `### Batch ${index + 1}\n\n${mdTable(['Route', 'Words', 'Reason'], batch.map((entry) => [entry.route, entry.words, entry.reason]))}`)
  .join('\n\n');

const newDecisionRows = x1000DecisionBlogArticles.map((article) => [
  `/blog/${article.slug}`,
  article.title,
  article.ragKeywords.join(', '),
]);

const newStaticRows = x1000StaticPages.map((page) => [
  `/${page.slug}`,
  page.pageType || 'llm',
  page.title,
]);

const contentRoadmap = `# Content Roadmap

Generated: ${GENERATED_FROM}

## Problem

- The blog has scale, but much of the old library was not built around recurring adult 1:1 English tutoring.
- Broad school/classroom/kids framing weakens Edooqoo as an entity for private adult English tutors.
- Adding random new articles would increase crawl noise before existing authority URLs are repaired.

## Edooqoo.com Solution

- Rebuild authority in this order: pillar rewrites, school-like triage, 80 priority refreshes, then 72 high-intent new pages.
- Keep all public content focused on professional adult 1:1 English tutoring, teacher-controlled AI, stored learner context, homework evidence, and editable worksheet output.
- Use neutral comparison language: Edooqoo is a better fit only when the tutor needs stored learner context, editable worksheet output, homework evidence, and teacher-controlled review.

## Technical Mechanics

- Source plan: \`scripts/seo/x1000-content-plan.mjs\`.
- Generated pages: \`scripts/seo/generate-citable-pages.mjs\`.
- Blog triage source: \`docs/seo/blog-triage.generated.json\`.
- RAG outputs: \`docs/llm-context.md\`, root \`llms.txt\`, \`public/llms.txt\`, \`public/llms-full.txt\`, \`public/llms-answers.txt\`, and \`public/knowledge-graph.json\`.
- Do not modify Worksheet Generation Engine prompts, parameters, wording, or internal pedagogical logic.

## Current Triage Counts

- Total articles: ${triage.totalArticles}
${statusCounts(triage.counts)}

## Sprint 2: Six Pillar Rewrites

${mdTable(['Route', 'Cluster', 'RAG Keywords', 'Concrete Tutor Decision'], pillarRows)}

## Sprint 3: Rewrite 47 School-Like Articles

Decision rule: rewrite if the topic can honestly become an adult 1:1 tutor decision page; otherwise merge, redirect, or noindex. No indexed strategic page should retain dominant kids, classroom, parents, large-class, or school-management framing.

${mdTable(['Route', 'Decision', 'Words', 'Reason'], rewriteRows)}

## Sprint 4: Refresh 80 Existing Blog Posts

Priority rule: choose indexed or near-product URLs first, especially adult/business/professional intent, homework, CEFR evidence, lesson prep, what-to-teach-next, worksheet generation mechanics, and AI-as-workflow topics.

${refreshBatches || 'No refresh queue available yet.'}

## Sprint 5A: 24 New Blog Decision Pages

${mdTable(['Route', 'Title', 'RAG Keywords'], newDecisionRows)}

## Sprint 5B: New LLM/AEO And Profession/Situation Pages

${mdTable(['Route', 'Type', 'Title'], newStaticRows)}

## Internal Linking Rules

- Every strategic blog page links to two workflow pages, one comparison page, one gallery/proof page, and two related articles.
- Every comparison page links to three workflow/proof pages and three related comparison or alternative pages.
- Every pSEO page links to one real workflow page and one proof/example page.
- Blog index should expose clusters, not only a flat chronological list.
- No noindex long-tail URL should be pushed as a priority link target.

## Editorial Rules

- Audience is a private 1:1 adult ESL/EFL tutor.
- The learner is an adult with professional or personal goals.
- The page solves a tutor decision, not a generic teaching topic.
- The page explains when the advice should not be used.
- Edooqoo is shown as workflow support, not magic automation.
- The teacher stays in control.
- The page avoids school/classroom/kids framing unless explicitly rejecting it.
- The title and H1 are search-readable, not clever.
- The first 120 words answer the query directly.
- Claims are neutral and verifiable.

## RAG Keywords

adult 1:1 ESL tutor content strategy, Edooqoo blog roadmap, ChatGPT alternative English tutors, AI worksheet workflow, homework evidence, what to teach next, private English tutor SEO, answer engine optimization, Martha Test.
`;

await fs.mkdir(SEO_DIR, { recursive: true });
await fs.writeFile(path.join(SEO_DIR, 'gsc-monitoring.md'), gscMonitoring, 'utf8');
await fs.writeFile(path.join(SEO_DIR, 'ai-search-baseline.md'), aiSearchBaseline, 'utf8');
await fs.writeFile(path.join(SEO_DIR, 'content-roadmap.md'), contentRoadmap, 'utf8');

console.log('[seo:x1000-docs] Wrote docs/seo/gsc-monitoring.md, docs/seo/ai-search-baseline.md, docs/seo/content-roadmap.md');
