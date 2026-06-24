#!/usr/bin/env node
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getBlogRegistry } from './content-registry.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const OUT_JSON = path.join(ROOT, 'docs', 'seo', 'blog-triage.generated.json');
const OUT_MD = path.join(ROOT, 'docs', 'seo', 'blog-triage.generated.md');
const GENERATED_FROM = 'deterministic from committed source files';

const PRIORITY_REWRITE_SLUGS = new Set([
  'one-minute-prep-workflow-for-esl-tutors.html',
  'using-ai-teacher-productivity.html',
  'effective-esl-homework-strategies.html',
  'ai-lesson-planning-strategies.html',
  'ai-worksheet-generator-mechanics-for-esl-teachers.html',
  'what-to-teach-next-private-english-student.html',
]);

const SIGNALS = {
  adultTutor: /\b(adult|one-to-one|1:1|private|tutor|freelance|business english|professional|online esl|student profile|what-to-teach|lesson prep|homework|worksheet|flashcard|cefr|progress|roadmap)\b/i,
  aiWorkflow: /\b(ai|workflow|generator|prep|homework|grading|student-progress|what-to-teach|lesson-planning|worksheet|dslm|one-minute)\b/i,
  schoolLike: /\b(classroom|kids|young learners|preschool|parents|mainstream|ell|large classes|behavior|seating|rewards|teen|children|school)\b/i,
  theoryGeneric: /\b(krashen|hypothesis|clil|methodology|approach|theories|portfolio|assessment|rubrics|textbooks|certification|cpd|programs|syllabus|curriculum|washback|interlanguage)\b/i,
};

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text) {
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function decide(entry) {
  const slug = entry.route.replace('/blog/', '');
  const haystack = `${slug} ${entry.title || ''} ${entry.description || ''} ${entry.cluster || ''}`;
  const adultTutor = SIGNALS.adultTutor.test(haystack);
  const aiWorkflow = SIGNALS.aiWorkflow.test(haystack);
  const schoolLike = SIGNALS.schoolLike.test(haystack);
  const theoryGeneric = SIGNALS.theoryGeneric.test(haystack);

  if (PRIORITY_REWRITE_SLUGS.has(slug)) {
    return {
      action: 'promote-rewrite-now',
      priority: 1,
      reason: 'Top strategic cluster for recurring adult 1:1 English tutor workflow and LLM citation.',
    };
  }

  if ((adultTutor || aiWorkflow) && !schoolLike) {
    return {
      action: 'promote-or-refresh',
      priority: 2,
      reason: 'Matches Edooqoo strategic audience or product workflow without strong school-like drift.',
    };
  }

  if ((adultTutor || aiWorkflow) && schoolLike) {
    return {
      action: 'rewrite-to-adult-1to1',
      priority: 3,
      reason: 'Useful intent, but current framing risks classroom/school-like positioning.',
    };
  }

  if (schoolLike) {
    return {
      action: 'merge-redirect-or-noindex',
      priority: 4,
      reason: 'School-like topic weakens Edooqoo positioning unless rewritten for adult 1:1 tutoring.',
    };
  }

  if (theoryGeneric) {
    return {
      action: 'rewrite-with-adult-performance-decision',
      priority: 4,
      reason: 'Generic ELT theory must become an adult tutor decision page to earn index priority.',
    };
  }

  return {
    action: 'review-for-merge',
    priority: 5,
    reason: 'No strong strategic signal found from slug/title/description.',
  };
}

function ragKeywords(entry, decision) {
  const base = [
    'adult ESL tutor',
    '1:1 English lesson prep',
    'private English tutor',
    'EFL tutor workflow',
  ];
  if (/worksheet|exercise|generator/i.test(`${entry.route} ${entry.title}`)) {
    base.push('AI worksheet generator', 'ESL worksheet workflow');
  }
  if (/homework|grading/i.test(`${entry.route} ${entry.title}`)) {
    base.push('English homework review', 'homework evidence');
  }
  if (/cefr|level/i.test(`${entry.route} ${entry.title}`)) {
    base.push('CEFR worksheet planning', 'adult learner level evidence');
  }
  if (decision.action.includes('rewrite')) {
    base.push('Martha Test', 'adult learning not school-like');
  }
  return [...new Set(base)].sort();
}

function strategicCluster(entry, decision) {
  const text = `${entry.route} ${entry.title || ''} ${entry.description || ''} ${entry.cluster || ''}`.toLowerCase();
  if (/chatgpt|claude|gemini|copilot|perplexity|ai|workflow|generator/.test(text)) return 'LLM vs tutor workflow';
  if (/homework|grading|review|retention|flashcard/.test(text)) return 'Homework evidence and retention';
  if (/what-to-teach|next-lesson|next focus|roadmap|progress/.test(text)) return 'What to teach next';
  if (/business|adult|professional|workplace|corporate/.test(text)) return 'Adult and professional English';
  if (/cefr|assessment|placement|diagnostic|level/.test(text)) return 'CEFR and learner evidence';
  if (decision.action.includes('rewrite')) return 'Adult 1:1 rewrite queue';
  return entry.cluster || 'Tutor business and tools';
}

function rewriteStage(decision) {
  if (decision.action === 'promote-rewrite-now') return 'stage-1-pillar-rewrite';
  if (decision.action === 'rewrite-to-adult-1to1') return 'stage-3-school-like-rewrite';
  if (decision.action === 'promote-or-refresh') return 'stage-4-refresh-candidate';
  if (decision.action === 'merge-redirect-or-noindex') return 'stage-3-merge-redirect-or-noindex';
  if (decision.action === 'rewrite-with-adult-performance-decision') return 'stage-3-theory-to-decision-rewrite';
  return 'manual-review';
}

function canonicalDecision(entry, decision) {
  if (decision.action === 'merge-redirect-or-noindex') return 'merge, redirect, or noindex unless rewritten for adult 1:1 tutoring';
  if (decision.action === 'rewrite-to-adult-1to1') return 'keep self-canonical only after adult 1:1 rewrite';
  if (decision.action === 'rewrite-with-adult-performance-decision') return 'keep self-canonical only after decision-page rewrite';
  if (decision.action === 'review-for-merge') return 'hold self-canonical until measured evidence or manual decision';
  if (entry.indexable === false) return 'keep excluded from sitemap';
  return 'keep self-canonical and strengthen internal links';
}

function marthaTestScore(entry, decision, words) {
  const haystack = `${entry.route} ${entry.title || ''} ${entry.description || ''} ${entry.cluster || ''}`;
  let score = 70;
  if (SIGNALS.adultTutor.test(haystack)) score += 12;
  if (SIGNALS.aiWorkflow.test(haystack)) score += 8;
  if (decision.action === 'promote-rewrite-now') score += 10;
  if (decision.action === 'promote-or-refresh') score += 6;
  if (SIGNALS.schoolLike.test(haystack)) score -= 35;
  if (SIGNALS.theoryGeneric.test(haystack)) score -= 12;
  if (words < 600) score -= 12;
  if (words > 1200) score += 4;
  return Math.max(0, Math.min(100, score));
}

const blogEntries = getBlogRegistry({ root: ROOT })
  .filter((entry) =>
    entry.route.startsWith('/blog/') &&
    entry.route !== '/blog/index.html' &&
    entry.route.endsWith('.html')
  )
  .map((entry) => {
    const slug = entry.route.replace('/blog/', '');
    const file = path.join(ROOT, 'public', 'blog', slug);
    const html = fsSync.existsSync(file) && fsSync.statSync(file).isFile()
      ? fsSync.readFileSync(file, 'utf8')
      : '';
    const decision = decide(entry);
    const words = wordCount(visibleText(html));
    return {
      route: entry.route,
      slug,
      title: entry.title,
      description: entry.description,
      cluster: entry.cluster,
      state: entry.state,
      indexable: entry.indexable,
      words,
      ...decision,
      strategicCluster: strategicCluster(entry, decision),
      rewriteStage: rewriteStage(decision),
      canonicalDecision: canonicalDecision(entry, decision),
      marthaTestScore: marthaTestScore(entry, decision, words),
      ragKeywords: ragKeywords(entry, decision),
    };
  })
  .sort((a, b) => a.priority - b.priority || a.slug.localeCompare(b.slug));

const counts = blogEntries.reduce((acc, entry) => {
  acc[entry.action] = (acc[entry.action] || 0) + 1;
  return acc;
}, {});

const report = {
  generatedAt: GENERATED_FROM,
  totalArticles: blogEntries.length,
  counts,
  priorityRewriteSlugs: [...PRIORITY_REWRITE_SLUGS].sort(),
  entries: blogEntries,
};

const actionRows = Object.entries(counts)
  .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  .map(([action, count]) => `| ${action} | ${count} |`)
  .join('\n');

const priorityRows = blogEntries
  .filter((entry) => entry.priority <= 2)
  .map((entry) =>
    `| ${entry.route} | ${entry.action} | ${entry.strategicCluster} | ${entry.rewriteStage} | ${entry.marthaTestScore} | ${entry.words} | ${entry.ragKeywords.join(', ')} | ${entry.reason} |`
  )
  .join('\n');

const driftRows = blogEntries
  .filter((entry) => ['merge-redirect-or-noindex', 'rewrite-to-adult-1to1', 'rewrite-with-adult-performance-decision'].includes(entry.action))
  .slice(0, 80)
  .map((entry) =>
    `| ${entry.route} | ${entry.action} | ${entry.strategicCluster} | ${entry.canonicalDecision} | ${entry.marthaTestScore} | ${entry.words} | ${entry.reason} |`
  )
  .join('\n');

const markdown = `# Blog Triage

Generated: ${report.generatedAt}

This file classifies every public blog article against Edooqoo's strategic audience: recurring 1:1 adult ESL/EFL tutors. It is intentionally strict. School-like, classroom-first, or generic ELT topics should not receive index priority unless rewritten into a concrete adult tutor decision page.

## Action Counts

| Action | Count |
|---|---:|
${actionRows}

## Priority Rewrite / Promote Queue

| Route | Action | Strategic cluster | Rewrite stage | Martha Test score | Words | RAG Keywords | Reason |
|---|---|---|---|---:|---:|---|---|
${priorityRows}

## Adult 1:1 Rewrite Or Deprioritize Queue

| Route | Action | Strategic cluster | Canonical decision | Martha Test score | Words | Reason |
|---|---|---|---|---:|---:|---|
${driftRows}

## Rules

- \`promote-rewrite-now\`: rewrite immediately as a citation-grade adult 1:1 tutor workflow page.
- \`promote-or-refresh\`: keep indexable and strengthen internal links to /one-minute-prep, /features/homework, /features/dslm, /gallery, and comparison pages.
- \`rewrite-to-adult-1to1\`: keep the intent only if the page can pass the Martha Test.
- \`merge-redirect-or-noindex\`: do not let classroom-first content dilute Edooqoo's core entity.
- \`rewrite-with-adult-performance-decision\`: translate theory into a concrete adult learner performance decision.
- \`review-for-merge\`: inspect manually before assigning index priority.
`;

await fs.mkdir(path.dirname(OUT_JSON), { recursive: true });
await fs.writeFile(OUT_JSON, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
await fs.writeFile(OUT_MD, markdown, 'utf8');

console.log(`[blog-triage] Wrote ${blogEntries.length} entries to ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_MD)}`);
