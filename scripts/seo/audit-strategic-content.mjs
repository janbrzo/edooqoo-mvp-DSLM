#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const BLOG_DIR = path.join(ROOT, 'public', 'blog');

const strategicArticles = [
  ['what-to-teach-next-private-english-student.html', 1200, 5],
  ['adult-esl-student-profile-lesson-planning.html', 1200, 5],
  ['homework-mistakes-next-english-lesson.html', 1200, 5],
  ['teaching-english-one-to-one.html', 2500, 5],
  ['how-long-should-private-english-tutors-spend-on-lesson-prep.html', 400, 2],
  ['best-lesson-prep-tool-for-english-tutors.html', 400, 2],
  ['can-ai-plan-one-to-one-english-lesson.html', 400, 2],
  ['how-english-tutors-track-what-to-teach-next.html', 400, 2],
  ['what-should-adult-english-placement-test-include.html', 400, 2],
  ['how-to-plan-english-lessons-effectively.html', 900, 5],
  ['needs-analysis-esl-students.html', 900, 5],
  ['lesson-sequencing-scaffolding-curriculum.html', 900, 5],
  ['formative-assessment-english-teaching.html', 900, 5],
  ['error-correction-techniques-esl.html', 900, 5],
  ['effective-esl-homework-strategies.html', 900, 5],
  ['writing-student-progress-reports-esl.html', 900, 5],
  ['spaced-repetition-vocabulary-learning.html', 900, 5],
  ['teaching-business-english-guide.html', 900, 5],
  ['teaching-english-online-complete-guide.html', 900, 5],
  ['setting-up-freelance-esl-business.html', 900, 5],
  ['teacher-burnout-prevention-esl.html', 900, 5],
  ['materials-design-principles-elt.html', 900, 5],
  ['task-based-language-teaching-worksheets.html', 900, 5],
  ['personalized-learning-english-teaching.html', 900, 5],
];

function extractJsonLd(html) {
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  return scripts.map((match) => JSON.parse(match[1]));
}

function graphNodes(documents) {
  return documents.flatMap((document) => document['@graph'] || [document]);
}

async function main() {
  const failures = [];

  for (const [slug, minimumWords, expectedFaqs] of strategicArticles) {
    const filePath = path.join(BLOG_DIR, slug);
    const html = await fs.readFile(filePath, 'utf8');
    const nodes = graphNodes(extractJsonLd(html));
    const article = nodes.find((node) => node['@type'] === 'Article');
    const faq = nodes.find((node) => node['@type'] === 'FAQPage');
    const breadcrumb = nodes.find((node) => node['@type'] === 'BreadcrumbList');

    if (!article) failures.push(`${slug}: Article schema missing`);
    if (Number(article?.wordCount || 0) < minimumWords) failures.push(`${slug}: word count below ${minimumWords}`);
    if (article?.author?.['@type'] !== 'Person' || article?.author?.name !== 'Jan Brzostowski') {
      failures.push(`${slug}: Jan Brzostowski Person author missing`);
    }
    if (article?.reviewedBy?.['@type'] !== 'Person' || article?.reviewedBy?.name !== 'Martha') {
      failures.push(`${slug}: Martha reviewedBy missing`);
    }
    if (!breadcrumb) failures.push(`${slug}: BreadcrumbList schema missing`);
    if ((faq?.mainEntity?.length || 0) < expectedFaqs) {
      failures.push(`${slug}: expected ${expectedFaqs} FAQ items`);
    }
    if (!html.includes('<strong>Direct answer:</strong>')) failures.push(`${slug}: direct answer missing`);
    if (!html.includes('Sources and methodology references')) failures.push(`${slug}: sources section missing`);
    if (!html.includes('href="/authors/jan-brzostowski"')) failures.push(`${slug}: visible author link missing`);
    if (!html.includes('href="/authors/martha"')) failures.push(`${slug}: visible reviewer link missing`);
    if (!html.includes(`<link rel="canonical" href="https://edooqoo.com/blog/${slug}">`)) {
      failures.push(`${slug}: canonical mismatch`);
    }
    if (minimumWords === 900 && article?.dateModified !== '2026-06-15') {
      failures.push(`${slug}: dateModified must be 2026-06-15`);
    }
  }

  const sitemap = await fs.readFile(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8');
  for (const route of ['/what-to-teach-next', '/authors/jan-brzostowski', '/authors/martha']) {
    if (!sitemap.includes(`<loc>https://edooqoo.com${route}</loc>`)) {
      failures.push(`${route}: missing from sitemap`);
    }
  }

  if (failures.length) {
    console.error(`[strategic-content-audit] FAIL\n- ${failures.join('\n- ')}`);
    process.exit(1);
  }

  console.log(`[strategic-content-audit] PASS ${strategicArticles.length} articles, 2 author profiles, 1 hub`);
}

main().catch((error) => {
  console.error('[strategic-content-audit] Failed:', error);
  process.exit(1);
});
