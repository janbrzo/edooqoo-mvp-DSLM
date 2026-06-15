#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NEWSLETTER_EMBED_CSS, renderNewsletterEmbed } from './newsletter-embed.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const SOURCE_PATH = path.join(ROOT, 'docs', 'seo', 'external-seo-ai-visibility-2026-06-14.md');
const BLOG_DIR = path.join(ROOT, 'public', 'blog');
const SITEMAP_PATH = path.join(ROOT, 'public', 'sitemap.xml');
const BASE = 'https://edooqoo.com';
const PUBLISHED = '2026-06-14';
const MODIFIED = '2026-06-14';

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

const SOURCES = [
  {
    label: 'Council of Europe: Common European Framework of Reference for Languages',
    url: 'https://www.coe.int/en/web/common-european-framework-reference-languages',
  },
  {
    label: 'Dunlosky et al. (2013): Improving Students’ Learning With Effective Learning Techniques',
    url: 'https://doi.org/10.1177/1529100612453266',
  },
  {
    label: 'Roediger and Karpicke (2006): Test-Enhanced Learning',
    url: 'https://doi.org/10.1111/j.1467-9280.2006.01693.x',
  },
];

const CONTENT = [
  {
    marker: '### Article 1',
    nextMarker: '### Article 2',
    slug: 'what-to-teach-next-private-english-student.html',
    metaTitle: 'What to Teach Next in a One-to-One English Lesson',
    metaDescription: 'A practical decision framework for private English tutors using goals, recent performance, recurring errors, retention, and lesson context.',
    cluster: 'What Should I Teach Next?',
    minimumWords: 1200,
    directAnswer: 'Choose the next lesson by connecting the adult learner’s current real-world goal with the strongest recent evidence, then decide whether to continue, repair, or advance.',
    teachingDecision: 'Use the priority ladder in this article, define one observable performance outcome, and record the evidence that will decide the following lesson.',
    related: [
      ['/what-to-teach-next', 'What Should I Teach Next? hub'],
      ['/blog/adult-esl-student-profile-lesson-planning.html', 'Adult ESL student profile'],
      ['/blog/homework-mistakes-next-english-lesson.html', 'Homework evidence workflow'],
    ],
  },
  {
    marker: '### Article 2',
    nextMarker: '### Article 3',
    slug: 'adult-esl-student-profile-lesson-planning.html',
    metaTitle: 'Adult ESL Student Profiles for Better Lesson Planning',
    metaDescription: 'Build a concise adult learner profile that improves one-to-one English lesson decisions without collecting irrelevant personal data.',
    cluster: 'Student Evidence and Progress',
    minimumWords: 1200,
    directAnswer: 'An adult ESL student profile should contain only the stable context and changing evidence that alter lesson objectives, task design, support, and progress decisions.',
    teachingDecision: 'Keep stable context separate from weekly evidence, then retrieve only the goal, current friction, constraint, and success condition needed for the next lesson.',
    related: [
      ['/what-to-teach-next', 'What Should I Teach Next? hub'],
      ['/blog/what-to-teach-next-private-english-student.html', 'Next-lesson decision framework'],
      ['/english-placement-test-for-private-tutors.html', 'Welcome Test reference'],
    ],
  },
  {
    marker: '### Article 3',
    nextMarker: '### Ultimate Guide',
    slug: 'homework-mistakes-next-english-lesson.html',
    metaTitle: 'Turn ESL Homework Mistakes Into the Next Lesson',
    metaDescription: 'A private-tutor workflow for converting adult ESL homework evidence into focused, useful, teacher-reviewed lesson decisions.',
    cluster: 'Homework and Retention',
    minimumWords: 1200,
    directAnswer: 'Turn homework into the next lesson by classifying errors, finding recurring goal-relevant patterns, and promoting only the evidence that changes the learner’s next performance objective.',
    teachingDecision: 'Distinguish slips, knowledge gaps, retrieval gaps, task misunderstandings, and low-priority errors before deciding whether the next lesson should continue, repair, or advance.',
    related: [
      ['/what-to-teach-next', 'What Should I Teach Next? hub'],
      ['/blog/what-to-teach-next-private-english-student.html', 'Next-lesson decision framework'],
      ['/features/homework', 'Edooqoo homework workflow'],
    ],
  },
  {
    marker: '### Ultimate Guide',
    nextMarker: '### Micro Article 1',
    slug: 'teaching-english-one-to-one.html',
    metaTitle: 'One-to-One English Lesson Planning for Adults: Complete Guide',
    metaDescription: 'A complete system for planning one-to-one adult English lessons using goals, evidence, CEFR, retrieval, realistic tasks, homework, and review.',
    cluster: 'One-to-One Lesson Planning',
    minimumWords: 2500,
    directAnswer: 'Plan recurring one-to-one adult English lessons by defining a real-world performance, using current evidence to choose the next focus, and building a short sequence from retrieval to independent transfer.',
    teachingDecision: 'Use the full system as a planning reference, but make each weekly decision from one current goal, one evidence pattern, one performance outcome, and one next-evidence condition.',
    related: [
      ['/what-to-teach-next', 'What Should I Teach Next? hub'],
      ['/blog/what-to-teach-next-private-english-student.html', 'Next-lesson decision framework'],
      ['/one-minute-prep', 'Edooqoo recurring prep workflow'],
    ],
  },
  {
    marker: '### Micro Article 1',
    nextMarker: '### Micro Article 2',
    slug: 'how-long-should-private-english-tutors-spend-on-lesson-prep.html',
    metaTitle: 'How Long Should Private English Tutors Spend on Lesson Prep?',
    metaDescription: 'A direct benchmark and workflow for reducing recurring one-to-one English lesson preparation without lowering instructional quality.',
    cluster: 'Tutor Business and Tools',
    minimumWords: 400,
    directAnswer: 'For an established student with maintained context and reusable structures, focused recurring lesson preparation can often take 5–15 minutes; new, technical, or high-stakes contexts require longer.',
    teachingDecision: 'Measure where preparation time goes and reduce retrieval, formatting, and broad content search before reducing pedagogical review.',
    related: [
      ['/one-minute-prep', '1-Minute Prep workflow'],
      ['/blog/teaching-english-one-to-one.html', 'One-to-one planning guide'],
    ],
  },
  {
    marker: '### Micro Article 2',
    nextMarker: '### Micro Article 3',
    slug: 'best-lesson-prep-tool-for-english-tutors.html',
    metaTitle: 'What Is the Best Lesson Prep Tool for English Tutors?',
    metaDescription: 'The criteria private English tutors should use to choose a lesson-prep tool for recurring adult one-to-one teaching.',
    cluster: 'Tutor Business and Tools',
    minimumWords: 400,
    directAnswer: 'The best lesson-prep tool connects student goals and recent evidence to an editable next lesson while preserving teacher control, delivery, and continuity across recurring lessons.',
    teachingDecision: 'Test tools with one real learner across four lessons and compare the full path from evidence to teachable material, not the speed of a single generated draft.',
    related: [
      ['/one-minute-prep', '1-Minute Prep workflow'],
      ['/tools', 'Free tools for English teachers'],
    ],
  },
  {
    marker: '### Micro Article 3',
    nextMarker: '### Micro Article 4',
    slug: 'can-ai-plan-one-to-one-english-lesson.html',
    metaTitle: 'Can AI Plan a One-to-One English Lesson?',
    metaDescription: 'What AI can automate in private English lesson planning and which decisions must remain under teacher review.',
    cluster: 'One-to-One Lesson Planning',
    minimumWords: 400,
    directAnswer: 'AI can draft and organize a one-to-one English lesson, but the tutor must own the objective, appropriacy, factual accuracy, adult relevance, and final response to live learner evidence.',
    teachingDecision: 'Approve the teaching decision first, the material second, and the live adaptation plan third.',
    related: [
      ['/blog/what-to-teach-next-private-english-student.html', 'Next-lesson decision framework'],
      ['/ai-worksheet-generator-for-english-teachers.html', 'Worksheet generator reference'],
    ],
  },
  {
    marker: '### Micro Article 4',
    nextMarker: '### Micro Article 5',
    slug: 'how-english-tutors-track-what-to-teach-next.html',
    metaTitle: 'How Do English Tutors Track What to Teach Next?',
    metaDescription: 'A compact evidence system for choosing the next lesson in recurring private English tutoring.',
    cluster: 'Student Evidence and Progress',
    minimumWords: 400,
    directAnswer: 'Track one goal, one independent success, one consequential gap, one delayed-retrieval item, and one upcoming event after each lesson, then choose continue, repair, or advance.',
    teachingDecision: 'Use short comparable evidence statements and review priorities every four to eight lessons.',
    related: [
      ['/what-to-teach-next', 'What Should I Teach Next? hub'],
      ['/esl-student-progress-tracking-tool.html', 'Student progress tracking reference'],
    ],
  },
  {
    marker: '### Micro Article 5',
    nextMarker: '## Area 2 - Link Building',
    slug: 'what-should-adult-english-placement-test-include.html',
    metaTitle: 'What Should an Adult English Placement Test Include?',
    metaDescription: 'The essential components of an adult English placement test for private tutors and how to use the evidence afterward.',
    cluster: 'Student Evidence and Progress',
    minimumWords: 400,
    directAnswer: 'An adult English placement test should combine goals, speaking, listening, reading, writing, focused language sampling, uncertainty signals, and teacher review so the result can guide the first lessons.',
    teachingDecision: 'Select no more than two initial priorities from the diagnostic and verify both through live performance before treating them as stable needs.',
    related: [
      ['/english-placement-test-for-private-tutors.html', 'Welcome Test reference'],
      ['/tools/cefr-level-test', 'Public CEFR level test'],
    ],
  },
];

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.replace(/\r/g, '').split('\n');
  const output = [];
  let paragraph = [];
  let listType = null;

  const flushParagraph = () => {
    if (!paragraph.length) return;
    output.push(`<p>${inlineMarkdown(paragraph.join(' '))}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    output.push(`</${listType}>`);
    listType = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    const unordered = line.match(/^-\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    const quote = line.match(/^>\s?(.*)$/);

    if (!line) {
      flushParagraph();
      closeList();
      continue;
    }

    if (heading) {
      flushParagraph();
      closeList();
      const level = Math.min(4, heading[1].length);
      output.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    if (unordered || ordered) {
      flushParagraph();
      const nextType = unordered ? 'ul' : 'ol';
      if (listType !== nextType) {
        closeList();
        output.push(`<${nextType}>`);
        listType = nextType;
      }
      output.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
      continue;
    }

    if (quote) {
      flushParagraph();
      closeList();
      output.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  closeList();
  return output.join('\n');
}

function plainText(markdown) {
  return markdown
    .replace(/[`*_>#-]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractFaq(markdown) {
  const faqStart = markdown.indexOf('## FAQ');
  if (faqStart < 0) return [];
  const faqMarkdown = markdown.slice(faqStart + '## FAQ'.length);
  return faqMarkdown
    .split(/^###\s+/m)
    .slice(1)
    .map((entry) => {
      const [question, ...answerLines] = entry.split('\n');
      return [plainText(question), plainText(answerLines.join('\n'))];
    })
    .filter(([question, answer]) => question && answer);
}

function extractContent(source, item) {
  const start = source.indexOf(item.marker);
  const end = source.indexOf(item.nextMarker, start + item.marker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not locate source boundaries for ${item.slug}`);
  }

  const section = source.slice(start, end);
  const h1Match = section.match(/^#\s+(.+)$/m);
  if (!h1Match) throw new Error(`Missing H1 for ${item.slug}`);
  const body = section.slice(h1Match.index + h1Match[0].length).trim();
  const words = plainText(`${item.directAnswer} ${body} ${item.teachingDecision}`)
    .split(/\s+/)
    .filter(Boolean)
    .length;
  if (words < item.minimumWords) {
    throw new Error(`${item.slug} has ${words} words; expected at least ${item.minimumWords}`);
  }

  return {
    ...item,
    h1: h1Match[1].trim(),
    body,
    words,
    faq: extractFaq(body),
  };
}

function articleJsonLd(article) {
  const url = `${BASE}/blog/${article.slug}`;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: article.h1,
        description: article.metaDescription,
        datePublished: PUBLISHED,
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
        wordCount: article.words,
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
      ...(article.faq.length
        ? [{
            '@type': 'FAQPage',
            '@id': `${url}#faq`,
            mainEntity: article.faq.map(([question, answer]) => ({
              '@type': 'Question',
              name: question,
              acceptedAnswer: { '@type': 'Answer', text: answer },
            })),
          }]
        : []),
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

function renderArticle(article) {
  const canonical = `${BASE}/blog/${article.slug}`;
  const related = article.related
    .map(([href, label]) => `<li><a href="${escapeHtml(href)}">${escapeHtml(label)}</a></li>`)
    .join('\n');
  const sources = SOURCES
    .map((source) => `<li><a href="${source.url}" rel="noreferrer">${escapeHtml(source.label)}</a></li>`)
    .join('\n');
  const jsonLd = JSON.stringify(articleJsonLd(article)).replace(/</g, '\\u003c');

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
    h2{font-size:1.65rem;line-height:1.25;margin:2.2em 0 .65em}h3{font-size:1.2rem;line-height:1.35;margin:1.6em 0 .45em}
    p,li{font-size:1.05rem}.eyebrow{font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#6d28d9}
    .answer{margin:24px 0 36px;padding:22px 24px;border-left:4px solid #7c3aed;background:#f5f3ff;font-size:1.16rem}
    .byline{display:flex;flex-wrap:wrap;gap:8px 18px;color:#4b5563;font-size:.93rem}.byline a{font-weight:650}
    blockquote{margin:24px 0;padding:16px 20px;border-left:3px solid #c4b5fd;background:#fafafa}
    code{padding:.1em .3em;background:#f3f4f6;border-radius:4px}li{margin:.35em 0}
    .decision,.sources,.related{margin:40px 0;padding:24px;border:1px solid #e5e7eb;border-radius:16px;background:#fafafa}
    .next-step{margin:48px 0;padding:28px;border-radius:18px;background:#111827;color:#fff}.next-step a{color:#ddd6fe;font-weight:700}
${NEWSLETTER_EMBED_CSS}
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
        <span>Published ${PUBLISHED}</span>
        <span>Updated ${MODIFIED}</span>
      </div>
      <p class="answer"><strong>Direct answer:</strong> ${escapeHtml(article.directAnswer)}</p>
    </header>
    <article>
${markdownToHtml(article.body)}
    </article>
    <section class="decision">
      <h2>Teaching decision</h2>
      <p>${escapeHtml(article.teachingDecision)}</p>
    </section>
    <section class="sources">
      <h2>Sources and methodology references</h2>
      <ul>${sources}</ul>
      <p>Product workflow statements are checked against the public Edooqoo source-of-truth documentation and reviewed for adult 1:1 ESL relevance.</p>
    </section>
    <section class="related">
      <h2>Related resources</h2>
      <ul>${related}</ul>
    </section>
${renderNewsletterEmbed(`article:${article.slug.replace(/\.html$/, '')}`)}
    <section class="next-step">
      <h2>Next step</h2>
      <p>Use the <a href="/what-to-teach-next">What Should I Teach Next?</a> framework to turn this guidance into one bounded decision for your next adult 1:1 lesson.</p>
    </section>
    <footer>
      Authored by ${AUTHOR.name}. Methodology review by ${REVIEWER.name}, ${REVIEWER.role}, ${REVIEWER.experience}.
    </footer>
  </main>
</body>
</html>
`;
}

async function ensureSitemapRoutes(routes) {
  let sitemap = await fs.readFile(SITEMAP_PATH, 'utf8');
  const entries = routes
    .filter((route) => !sitemap.includes(`<loc>${BASE}${route}</loc>`))
    .map((route) => `  <url>\n    <loc>${BASE}${route}</loc>\n    <lastmod>${MODIFIED}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.8</priority>\n  </url>`)
    .join('\n');

  if (entries) {
    sitemap = sitemap.replace('</urlset>', `${entries}\n</urlset>`);
    await fs.writeFile(SITEMAP_PATH, sitemap, 'utf8');
  }
}

async function main() {
  const source = await fs.readFile(SOURCE_PATH, 'utf8');
  const articles = CONTENT.map((item) => extractContent(source, item));

  await fs.mkdir(BLOG_DIR, { recursive: true });
  for (const article of articles) {
    await fs.writeFile(path.join(BLOG_DIR, article.slug), renderArticle(article), 'utf8');
  }

  await ensureSitemapRoutes([
    '/what-to-teach-next',
    '/authors/jan-brzostowski',
    '/authors/martha',
  ]);

  const summary = articles.map((article) => `${article.slug}:${article.words}`).join(', ');
  console.log(`[strategic-content] Wrote ${articles.length} articles (${summary})`);
}

main().catch((error) => {
  console.error('[strategic-content] Failed:', error);
  process.exit(1);
});
