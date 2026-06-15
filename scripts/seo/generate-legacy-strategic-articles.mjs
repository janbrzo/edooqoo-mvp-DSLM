#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const CONFIG_PATH = path.join(__dirname, 'legacy-strategic-articles.json');
const BLOG_DIR = path.join(ROOT, 'public', 'blog');
const BASE = 'https://edooqoo.com';
const MODIFIED = '2026-06-15';
const MINIMUM_WORDS = 900;

const AUTHOR = {
  name: 'Jan Brzostowski',
  url: `${BASE}/authors/jan-brzostowski`,
};

const REVIEWER = {
  name: 'Martha',
  role: 'ESL Methodology Reviewer',
  experience: '10 years of experience',
  url: `${BASE}/authors/martha`,
};

const SOURCE_LIBRARY = {
  cefr: {
    label: 'Council of Europe: Common European Framework of Reference for Languages, Companion Volume',
    url: 'https://www.coe.int/en/web/common-european-framework-reference-languages',
  },
  nation: {
    label: 'Nation (2007): The Four Strands',
    url: 'https://doi.org/10.1017/S0261444806004050',
  },
  retrieval: {
    label: 'Roediger and Karpicke (2006): Test-Enhanced Learning',
    url: 'https://doi.org/10.1111/j.1467-9280.2006.01693.x',
  },
  long: {
    label: 'Long (2005): Second Language Needs Analysis',
    url: 'https://doi.org/10.1017/CBO9780511667299',
  },
  vygotsky: {
    label: 'Vygotsky (1978): Mind in Society',
    url: 'https://www.hup.harvard.edu/books/9780674576292',
  },
  'black-wiliam': {
    label: 'Black and Wiliam (1998): Assessment and Classroom Learning',
    url: 'https://doi.org/10.1080/0969595980050102',
  },
  'lyster-ranta': {
    label: 'Lyster and Ranta (1997): Corrective Feedback and Learner Uptake',
    url: 'https://doi.org/10.1017/S0272263197001034',
  },
  dunlosky: {
    label: 'Dunlosky et al. (2013): Improving Students Learning With Effective Learning Techniques',
    url: 'https://doi.org/10.1177/1529100612453266',
  },
  cepeda: {
    label: 'Cepeda et al. (2006): Distributed Practice in Verbal Recall Tasks',
    url: 'https://doi.org/10.1111/j.1467-9280.2006.01764.x',
  },
  'community-inquiry': {
    label: 'Garrison, Anderson, and Archer (2000): Critical Inquiry in a Text-Based Environment',
    url: 'https://doi.org/10.1016/S1096-7516(00)00016-6',
  },
  'adult-learning': {
    label: 'UNESCO Institute for Lifelong Learning: Adult Learning and Education',
    url: 'https://www.uil.unesco.org/en/adult-education',
  },
  'service-design': {
    label: 'U.S. Small Business Administration: Plan Your Business',
    url: 'https://www.sba.gov/business-guide/plan-your-business',
  },
  'who-burnout': {
    label: 'World Health Organization: Burn-out as an Occupational Phenomenon',
    url: 'https://www.who.int/standards/classifications/frequently-asked-questions/burn-out-an-occupational-phenomenon',
  },
  'job-demands': {
    label: 'Demerouti et al. (2001): The Job Demands-Resources Model of Burnout',
    url: 'https://doi.org/10.1016/S0001-8791(00)00049-9',
  },
  tomlinson: {
    label: 'Tomlinson (2011): Materials Development in Language Teaching',
    url: 'https://www.cambridge.org/core/books/materials-development-in-language-teaching/0F21EA3B3829346604AC45D6E6E4AEB0',
  },
  ellis: {
    label: 'Ellis (2003): Task-based Language Learning and Teaching',
    url: 'https://global.oup.com/academic/product/task-based-language-learning-and-teaching-9780194421591',
  },
  willis: {
    label: 'British Council TeachingEnglish: A Task-Based Approach',
    url: 'https://www.teachingenglish.org.uk/professional-development/teachers/knowing-subject/t-w/task-based-approach',
  },
  'universal-design': {
    label: 'CAST: Universal Design for Learning Guidelines',
    url: 'https://udlguidelines.cast.org/',
  },
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function visibleWordCount(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z0-9#]+;/gi, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .length;
}

async function existingPublishedDate(slug) {
  try {
    const current = await fs.readFile(path.join(BLOG_DIR, slug), 'utf8');
    return current.match(/"datePublished"\s*:\s*"([^"]+)"/i)?.[1] || '2025-06-01';
  } catch {
    return '2025-06-01';
  }
}

function renderEvidence(items) {
  return items.map((item) => `
        <li>
          <strong>${escapeHtml(item.title)}.</strong>
          ${escapeHtml(item.body)}
        </li>`).join('');
}

function renderWorkflow(items) {
  return items.map((item, index) => `
        <li>
          <h3>${index + 1}. ${escapeHtml(item.title)}</h3>
          <p>${escapeHtml(item.body)}</p>
        </li>`).join('');
}

function renderFaq(faqs) {
  return faqs.map((faq) => `
        <details>
          <summary>${escapeHtml(faq.question)}</summary>
          <p>${escapeHtml(faq.answer)}</p>
        </details>`).join('');
}

function renderArticleBody(article) {
  return `
    <section>
      <h2>Start with the adult performance, not the topic list</h2>
      <p>${escapeHtml(article.why)}</p>
      <p>In adult one-to-one teaching, the useful unit of planning is a performance in context. The tutor defines what the learner must do, the audience or reader, the pressure or constraint, the support currently available, and the evidence that will count as independent success. This prevents a broad topic from becoming a sequence of school-like exercises with no clear transfer.</p>
      <p>The learner's profession or interest can make examples relevant, but relevance alone is not personalization. The material must respond to current evidence and make the next teaching decision easier. A lesson should therefore leave the tutor with a defensible answer to three questions: what changed, what still requires support, and what should happen next.</p>
    </section>
    <section>
      <h2>Evidence to collect before planning</h2>
      <p>Use a small evidence set. The aim is not to document everything about the learner; it is to retrieve only the information that changes the objective, task, support, feedback, or sequence.</p>
      <ul>${renderEvidence(article.evidence)}</ul>
      <p>When the evidence is weak or contradictory, use a short diagnostic attempt before adding new content. A direct sample is usually more useful than asking whether the learner understands a rule or feels confident. Confidence can affect participation, but it does not replace observable performance.</p>
    </section>
    <section class="decision">
      <h2>Teaching decision</h2>
      <p>${escapeHtml(article.decisionRule)}</p>
      <p>${escapeHtml(article.teachingDecision)}</p>
      <p>The decision should be narrow enough to test in the next task. Avoid labels such as 'work on fluency' or 'improve grammar.' Name the communication function, the relevant language or strategy, the conditions, and the quality criterion. This makes the plan editable when the learner's first attempt produces different evidence.</p>
    </section>
    <section>
      <h2>A practical one-to-one workflow</h2>
      <p>The following sequence protects teacher judgment while making preparation repeatable. Each stage has a specific evidence function, so an activity is not included merely because it is familiar or visually attractive.</p>
      <ol class="workflow">${renderWorkflow(article.workflow)}</ol>
      <p>Do not force every lesson through the same number of stages. If the opening retrieval shows independent control, shorten repair and move to transfer. If a prerequisite is missing, reduce the target rather than disguising the gap with permanent prompts.</p>
    </section>
    <section class="case">
      <h2>Adult one-to-one worked example</h2>
      <dl>
        <div><dt>Student context</dt><dd>${escapeHtml(article.case.context)}</dd></div>
        <div><dt>Evidence</dt><dd>${escapeHtml(article.case.evidence)}</dd></div>
        <div><dt>Continue, repair, or advance</dt><dd>${escapeHtml(article.case.decision)}</dd></div>
        <div><dt>Lesson objective</dt><dd>${escapeHtml(article.case.objective)}</dd></div>
        <div><dt>Activity sequence</dt><dd>${escapeHtml(article.case.sequence)}</dd></div>
        <div><dt>Evidence to collect next</dt><dd>${escapeHtml(article.case.nextEvidence)}</dd></div>
      </dl>
      <p>This is a worked example, not a claim about a real student's outcome. Its purpose is to show how context and evidence become a bounded teaching decision without inventing results.</p>
    </section>
    <section>
      <h2>Material and worksheet design</h2>
      <p>${escapeHtml(article.materialRule)}</p>
      <p>A useful worksheet creates a path from retrieval or diagnosis to supported rehearsal and independent transfer. Instructions should be clear on the learner's actual device, examples should be credible for an adult, and answer keys or model responses should be reviewed before use. When an exercise can be completed correctly without engaging the target decision, it is not valid evidence for that objective.</p>
      <p>Teacher control remains necessary. Generated or reusable material can reduce mechanical preparation, but the tutor still owns factual accuracy, appropriacy, level, sequencing, correction priorities, and the response to live learner evidence. The material should be easy to edit when the first attempt changes the plan.</p>
    </section>
    <section>
      <h2>What to avoid</h2>
      <ul>${article.avoid.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
      <p>These failures have the same root cause: the visible activity replaces the teaching decision. A professional adult lesson should make the reason for each stage clear to the tutor and, where useful, to the learner.</p>
    </section>
    <section>
      <h2>Evidence for the next lesson</h2>
      <p>${escapeHtml(article.nextEvidence)}</p>
      <p>Write evidence in comparable terms: task, conditions, support, observed performance, consequence, and next decision. A short statement such as 'completed the request independently but omitted the deadline in both attempts' is more actionable than a page of undifferentiated notes. Revisit the target after a delay before treating immediate success as stable learning.</p>
    </section>
    <section>
      <h2>Frequently asked questions</h2>
      <div class="faq">${renderFaq(article.faqs)}</div>
    </section>`;
}

function buildJsonLd(article, published, words) {
  const url = `${BASE}/blog/${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: article.h1,
        description: article.metaDescription,
        datePublished: published,
        dateModified: MODIFIED,
        author: { '@type': 'Person', '@id': `${AUTHOR.url}#person`, name: AUTHOR.name, url: AUTHOR.url },
        reviewedBy: {
          '@type': 'Person',
          '@id': `${REVIEWER.url}#person`,
          name: REVIEWER.name,
          jobTitle: REVIEWER.role,
          description: REVIEWER.experience,
          url: REVIEWER.url,
        },
        publisher: { '@type': 'Organization', '@id': `${BASE}/#organization`, name: 'Edooqoo' },
        mainEntityOfPage: { '@id': `${url}#webpage` },
        inLanguage: 'en',
        wordCount: words,
        articleSection: article.cluster,
      },
      {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: article.metaTitle,
        description: article.metaDescription,
        inLanguage: 'en',
      },
      {
        '@type': 'Person',
        '@id': `${AUTHOR.url}#person`,
        name: AUTHOR.name,
        url: AUTHOR.url,
        description: 'Founder of Edooqoo and author of product workflow documentation.',
      },
      {
        '@type': 'Person',
        '@id': `${REVIEWER.url}#person`,
        name: REVIEWER.name,
        url: REVIEWER.url,
        jobTitle: REVIEWER.role,
        description: REVIEWER.experience,
      },
      {
        '@type': 'FAQPage',
        '@id': `${url}#faq`,
        mainEntity: article.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: { '@type': 'Answer', text: faq.answer },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${BASE}/` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${BASE}/blog` },
          { '@type': 'ListItem', position: 3, name: article.h1, item: url },
        ],
      },
    ],
  };
}

function renderDocument(article, published, body, words) {
  const canonical = `${BASE}/blog/${article.slug}`;
  const sourceItems = article.sources.map((key) => SOURCE_LIBRARY[key]);
  const sources = sourceItems
    .map((source) => `<li><a href="${source.url}" rel="noreferrer">${escapeHtml(source.label)}</a></li>`)
    .join('');
  const related = article.related
    .map(([href, label]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`)
    .join('');
  const jsonLd = JSON.stringify(buildJsonLd(article, published, words)).replace(/</g, '\\u003c');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(article.metaTitle)}</title>
  <meta name="description" content="${escapeHtml(article.metaDescription)}">
  <meta name="robots" content="index,follow">
  <link rel="canonical" href="${canonical}">
  <meta property="og:type" content="article">
  <meta property="og:title" content="${escapeHtml(article.metaTitle)}">
  <meta property="og:description" content="${escapeHtml(article.metaDescription)}">
  <meta property="og:url" content="${canonical}">
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    :root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#1f2937;background:#fff}
    *{box-sizing:border-box}body{margin:0;line-height:1.72}a{color:#6d28d9}a:hover{text-decoration-thickness:2px}
    nav,main{max-width:820px;margin:0 auto;padding:0 24px}nav{padding-top:24px;font-size:.92rem;color:#6b7280}
    header{padding:48px 0 24px}h1{font-size:clamp(2.25rem,6vw,4rem);line-height:1.08;letter-spacing:-.035em;margin:.25em 0}
    h2{font-size:1.65rem;line-height:1.25;margin:2.2em 0 .65em}h3{font-size:1.15rem;line-height:1.35;margin:1.35em 0 .35em}
    p,li,dd{font-size:1.05rem}.eyebrow{font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6d28d9}
    .answer{margin:24px 0 36px;padding:22px 24px;border-left:4px solid #7c3aed;background:#f5f3ff;font-size:1.16rem}
    .byline{display:flex;flex-wrap:wrap;gap:8px 18px;color:#4b5563;font-size:.93rem}.byline a{font-weight:650}
    li{margin:.45em 0}.decision,.case,.sources,.related{margin:40px 0;padding:24px;border:1px solid #e5e7eb;border-radius:16px;background:#fafafa}
    .workflow{padding-left:24px}.workflow h3{margin-bottom:0}.workflow p{margin-top:.25em}
    dl{display:grid;gap:14px}dl div{padding-bottom:12px;border-bottom:1px solid #e5e7eb}dt{font-weight:700}dd{margin:4px 0 0;color:#4b5563}
    details{border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin:10px 0}summary{cursor:pointer;font-weight:700}
    .next-step{margin:48px 0;padding:28px;border-radius:18px;background:#111827;color:#fff}.next-step a{color:#ddd6fe;font-weight:700}
    footer{margin-top:64px;padding:32px 0 48px;border-top:1px solid #e5e7eb;color:#6b7280;font-size:.9rem}
    @media(max-width:640px){nav,main{padding-left:18px;padding-right:18px}header{padding-top:32px}h1{font-size:2.35rem}}
  </style>
</head>
<body>
  <nav><a href="/">Edooqoo</a> / <a href="/blog">Blog</a> / ${escapeHtml(article.cluster)}</nav>
  <main>
    <header>
      <p class="eyebrow">${escapeHtml(article.cluster)}</p>
      <h1>${escapeHtml(article.h1)}</h1>
      <div class="byline">
        <span>By <a href="/authors/jan-brzostowski">${AUTHOR.name}</a></span>
        <span>Reviewed by <a href="/authors/martha">${REVIEWER.name}, ${REVIEWER.role}</a></span>
        <span>Published ${published}</span>
        <span>Updated ${MODIFIED}</span>
      </div>
      <p class="answer"><strong>Direct answer:</strong> ${escapeHtml(article.directAnswer)}</p>
    </header>
    <article>${body}</article>
    <section class="sources">
      <h2>Sources and methodology references</h2>
      <ul>${sources}</ul>
      <p>Product workflow statements are checked against public Edooqoo source-of-truth documentation. Methodology decisions are reviewed for adult one-to-one ESL relevance.</p>
    </section>
    <section class="related">
      <h2>Related resources</h2>
      <ul>${related}</ul>
    </section>
    <section class="next-step">
      <h2>Next step</h2>
      <p>Use the <a href="/what-to-teach-next">What Should I Teach Next?</a> framework to convert the evidence into one bounded decision for the next adult one-to-one lesson.</p>
    </section>
    <footer>Authored by ${AUTHOR.name}. Methodology review by ${REVIEWER.name}, ${REVIEWER.role}, ${REVIEWER.experience}.</footer>
  </main>
</body>
</html>
`;
}

async function main() {
  const articles = JSON.parse(await fs.readFile(CONFIG_PATH, 'utf8'));
  const summaries = [];

  for (const article of articles) {
    article.teachingDecision = `For this topic, make the next lesson decision from the stated criterion and current evidence rather than from content coverage.`;
    for (const sourceKey of article.sources) {
      if (!SOURCE_LIBRARY[sourceKey]) throw new Error(`${article.slug}: unknown source ${sourceKey}`);
    }

    const published = await existingPublishedDate(article.slug);
    const body = renderArticleBody(article);
    const words = visibleWordCount(`${article.directAnswer} ${body}`);
    if (words < MINIMUM_WORDS) {
      throw new Error(`${article.slug}: ${words} words; expected at least ${MINIMUM_WORDS}`);
    }

    await fs.writeFile(
      path.join(BLOG_DIR, article.slug),
      renderDocument(article, published, body, words),
      'utf8',
    );
    summaries.push(`${article.slug}:${words}`);
  }

  console.log(`[legacy-strategic-content] Wrote ${articles.length} articles (${summaries.join(', ')})`);
}

main().catch((error) => {
  console.error('[legacy-strategic-content] Failed:', error);
  process.exit(1);
});
