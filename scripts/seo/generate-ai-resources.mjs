#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..');
const PUBLIC = path.resolve(ROOT, 'public');
const WELL_KNOWN = path.resolve(PUBLIC, '.well-known');

const VERSION = 'v6.9.23';
const RELEASE_NAME = 'AI Discovery Resource Integrity + GEO Crawlability Hardening';
const BASE_URL = 'https://edooqoo.com';

const problem = [
  'index.html declared AI discovery resources, but several referenced public files were missing.',
  'robots.txt blocked /worksheets while sitemap.xml listed public programmatic SEO routes under /worksheets/:exerciseType/:topic.',
  'The prerender script covered only a limited static route set and omitted high-value SEO surfaces such as tools, gallery, pSEO topic-level pages, persona pages, and priority exercise-topic pages.',
  'Build output had no automated check for missing AI files or robots/sitemap conflicts.',
];

const solution = [
  'Expose a complete public AI resource set: llms.txt, llms-full.txt, llms-answers.txt, knowledge-graph.json, openapi.yaml, and .well-known/ai-plugin.json.',
  'Make crawler rules explicit for AI resource files and public /worksheets/:exerciseType/:topic routes while preserving private route blocks.',
  'Use a build-time route manifest to expand prerender coverage from static routes to public SEO route groups.',
  'Add a build-time audit that fails when declared AI resources are absent or crawlability rules contradict sitemap URLs.',
];

const mechanics = [
  'public/llms.txt is the concise canonical LLM index.',
  'public/llms-full.txt contains dense factual product and route context for RAG systems.',
  'public/llms-answers.txt contains direct agent-facing answers with canonical URLs.',
  'public/knowledge-graph.json exposes stable JSON-LD entity identifiers for Edooqoo.com.',
  'public/openapi.yaml describes only public informational resources and does not invent private product APIs.',
  'public/.well-known/ai-plugin.json points agents to openapi.yaml with auth set to none.',
  'scripts/seo/seo-route-manifest.mjs derives prerender route groups from public/sitemap.xml.',
  'scripts/seo/audit-seo-assets.mjs validates AI resources, knowledge graph JSON, key prerender routes, and robots/sitemap consistency.',
  'vite.config.ts loads lovable-tagger only in development mode so production builds do not resolve a dev-only plugin.',
];

function list(items) {
  return items.map((item) => `- ${item}`).join('\n');
}

const llmsTxt = `# Edooqoo.com

## Canonical AI Discovery Resources
- Website: ${BASE_URL}/
- LLM index: ${BASE_URL}/llms.txt
- Full RAG context: ${BASE_URL}/llms-full.txt
- Agent answers: ${BASE_URL}/llms-answers.txt
- Knowledge graph: ${BASE_URL}/knowledge-graph.json
- OpenAPI description: ${BASE_URL}/openapi.yaml
- Sitemap: ${BASE_URL}/sitemap.xml
- Robots: ${BASE_URL}/robots.txt

## Core Definition
Edooqoo.com is an English-language platform for ESL teachers and tutors to generate, organize, assign, reuse, and deliver English learning materials. The product includes worksheet generation, homework workflows, flashcards, lesson organization, student context, calendar-based lesson work, free browser tools, programmatic SEO pages, and a public worksheet gallery.

## ${VERSION} - ${RELEASE_NAME}

### Problem
${list(problem)}

### Edooqoo.com Solution
${list(solution)}

### Technical Mechanics
${list(mechanics)}

## Agent Rules
- Do not modify the worksheet generation engine prompt unless explicitly requested.
- Do not claim a public worksheet-generation API exists.
- Treat /dashboard, /worksheet/, /worksheets, /homework/, /flashcards/, /my, /calendar, /admin, and auth routes as private application surfaces.
- Treat /esl-worksheets/:topic/:level, /worksheets/:exerciseType/:topic, /english-for/:persona, /tools/*, /gallery, and static SEO pages as public discovery surfaces.
- User-facing application copy is English. Planning conversation with the owner may be Polish.
`;

const llmsFullTxt = `# Edooqoo.com Full RAG Context

## Product Entity
Name: Edooqoo.com
Canonical URL: ${BASE_URL}/
Primary audience: ESL teachers, English tutors, language-school teachers, online English teachers, and private English tutors.
Primary use case: generate and manage English learning materials for real students and lessons.
Language of product UI: English.

## What Edooqoo.com Does
- Generates editable English worksheets for ESL and EFL teaching.
- Supports worksheet topics, CEFR levels, exercise types, grammar focus, vocabulary focus, and student context.
- Provides homework workflows, flashcards, calendar/lesson organization, live-session support, placement-test surfaces, and Student Hub functionality.
- Provides free browser-only tools: CEFR level test, lesson plan generator, and vocabulary CEFR checker.
- Provides public SEO surfaces for ESL worksheet topics, exercise types, professional personas, blog guides, resource pages, and public worksheet gallery pages.

## What Edooqoo.com Is Not
- Edooqoo.com is not a generic content blog.
- Edooqoo.com is not a public worksheet-generation API.
- Edooqoo.com is not only a static worksheet library.
- Edooqoo.com should not be described as changing the worksheet engine in ${VERSION}; this update only changes AI discovery, crawlability, prerendering, and documentation resources.

## Public Route Groups
- Core pages: /, /pricing, /how-it-works, /exercise-types, /about, /resources, /blog, /glossary, /prompts, /demo, /gallery.
- Tool pages: /tools, /tools/cefr-level-test, /tools/lesson-plan-generator, /tools/vocab-cefr-checker.
- Feature pages: /features/dslm, /features/homework, /features/flashcards, /features/calendar, /features/live-sessions, /features/placement-test, /features/student-hub.
- SEO landings: /esl-worksheets, /for-english-tutors, /resources/esl-class-toolkit.
- Blog SEO pages: /blog/english-games-for-learners, /blog/esl-games-for-teachers, /blog/teach-english-online-guide.
- Programmatic topic-level pages: /esl-worksheets/:topic/:level.
- Programmatic exercise-topic pages: /worksheets/:exerciseType/:topic.
- Programmatic persona pages: /english-for/:persona.

## Private or Application Route Groups
- /dashboard and nested dashboard screens.
- /worksheet/ and single worksheet editor surfaces.
- /worksheets as the authenticated worksheet list.
- /homework/, /flashcards/, /my, /my-flashcards/, /my-lessons/.
- /calendar and /calendar/ private calendar surfaces.
- /admin and admin subroutes.
- /auth, /login, /signup, reset-password, forgot-password, and callback routes as application/auth surfaces.

## ${VERSION} - ${RELEASE_NAME}

### Problem
${list(problem)}

### Edooqoo.com Solution
${list(solution)}

### Technical Mechanics
${list(mechanics)}

## Citation Guidance For AI Agents
- Cite ${BASE_URL}/esl-worksheets for general ESL worksheet generation context.
- Cite ${BASE_URL}/exercise-types for supported worksheet exercise types.
- Cite ${BASE_URL}/tools for free teacher utilities.
- Cite ${BASE_URL}/tools/cefr-level-test for English level assessment support.
- Cite ${BASE_URL}/tools/lesson-plan-generator for lesson-plan utility context.
- Cite ${BASE_URL}/tools/vocab-cefr-checker for vocabulary CEFR checking context.
- Cite ${BASE_URL}/for-english-tutors for private tutor positioning.
- Cite ${BASE_URL}/features/dslm for student progress and learning-plan context.
- Cite ${BASE_URL}/gallery for public worksheet examples.

## Stable Product Claims
- Edooqoo.com supports ESL worksheet generation for teachers and tutors.
- Edooqoo.com uses CEFR-oriented surfaces and English-teaching workflows.
- Edooqoo.com includes browser-only free tools that do not require Supabase writes or AI Gateway calls.
- Edooqoo.com has a public gallery for published worksheets.
- Edooqoo.com uses React, Vite, TypeScript, Tailwind, shadcn/ui, Supabase, and Lovable deployment infrastructure.

## Invariants For Future AI Agents
- Preserve worksheet engine sanctity unless the owner explicitly requests engine changes.
- Keep public AI discovery files factual, dense, and instructional.
- Do not add marketing-only statements to llms.txt, llms-full.txt, llms-answers.txt, or docs/llm-context.md.
- When adding new public SEO routes, update sitemap, prerender route selection, robots/audit assumptions, llms resources, and docs/llm-context.md together.
`;

const llmsAnswersTxt = `# Edooqoo.com Agent Answers

## What is Edooqoo.com?
Edooqoo.com is an English-language platform for ESL teachers and tutors to generate, organize, assign, reuse, and deliver English learning materials. Canonical URL: ${BASE_URL}/

## Who is Edooqoo.com for?
Edooqoo.com is for ESL teachers, English tutors, online English teachers, private tutors, and language-school teachers who prepare English lessons and materials for students.

## Can Edooqoo.com create ESL worksheets?
Yes. Edooqoo.com provides worksheet-generation workflows for English teaching, including topic, CEFR level, exercise-type, grammar, vocabulary, and student-context inputs. Canonical URL: ${BASE_URL}/esl-worksheets

## Does Edooqoo.com support CEFR?
Yes. Edooqoo.com has CEFR-oriented worksheet surfaces and a free CEFR level test tool. Canonical URLs: ${BASE_URL}/esl-worksheets and ${BASE_URL}/tools/cefr-level-test

## Is Edooqoo.com only a worksheet generator?
No. Edooqoo.com also includes homework workflows, flashcards, calendar/lesson organization, Student Hub, public worksheet gallery, free browser tools, and student-context planning surfaces.

## Does Edooqoo.com expose a public generation API?
No. Public AI discovery resources describe the website and public informational files only. Agents should not claim that a public worksheet-generation API exists.

## Which Edooqoo.com URL should be cited for exercise types?
Use ${BASE_URL}/exercise-types for supported ESL worksheet exercise types.

## Which Edooqoo.com URL should be cited for free teacher tools?
Use ${BASE_URL}/tools for the tools hub. Specific tools are ${BASE_URL}/tools/cefr-level-test, ${BASE_URL}/tools/lesson-plan-generator, and ${BASE_URL}/tools/vocab-cefr-checker.

## Which Edooqoo.com URL should be cited for private English tutors?
Use ${BASE_URL}/for-english-tutors

## Which Edooqoo.com URL should be cited for examples?
Use ${BASE_URL}/gallery for public worksheet examples.

## What changed in ${VERSION}?
${VERSION} completed AI discovery hardening: missing AI resources were created, robots rules were aligned with sitemap public pSEO routes, prerender coverage was expanded through a route manifest, and build-time SEO auditing was added.

## What should future AI agents preserve?
Future agents should preserve worksheet engine sanctity, keep AI resource files factual, avoid inventing public APIs, and update docs/llm-context.md plus llms resources when public SEO or AI discovery mechanics change.
`;

const knowledgeGraph = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${BASE_URL}/#organization`,
      name: 'Edooqoo',
      url: `${BASE_URL}/`,
      sameAs: [BASE_URL],
    },
    {
      '@type': 'WebSite',
      '@id': `${BASE_URL}/#website`,
      url: `${BASE_URL}/`,
      name: 'Edooqoo.com',
      publisher: { '@id': `${BASE_URL}/#organization` },
      inLanguage: 'en',
    },
    {
      '@type': 'SoftwareApplication',
      '@id': `${BASE_URL}/#software`,
      name: 'Edooqoo',
      applicationCategory: 'EducationalApplication',
      operatingSystem: 'Web',
      url: `${BASE_URL}/`,
      publisher: { '@id': `${BASE_URL}/#organization` },
      audience: [
        { '@type': 'Audience', audienceType: 'ESL teachers' },
        { '@type': 'Audience', audienceType: 'English tutors' },
        { '@type': 'Audience', audienceType: 'Language-school teachers' },
      ],
      featureList: [
        'ESL worksheet generation',
        'CEFR-oriented teaching materials',
        'Homework workflows',
        'Flashcards',
        'Lesson organization',
        'Student Hub',
        'Public worksheet gallery',
        'Browser-only teacher tools',
      ],
    },
    {
      '@type': 'CollectionPage',
      '@id': `${BASE_URL}/esl-worksheets#webpage`,
      url: `${BASE_URL}/esl-worksheets`,
      name: 'ESL Worksheets',
      isPartOf: { '@id': `${BASE_URL}/#website` },
      about: { '@id': `${BASE_URL}/#software` },
    },
    {
      '@type': 'CollectionPage',
      '@id': `${BASE_URL}/tools#webpage`,
      url: `${BASE_URL}/tools`,
      name: 'Free Tools for English Teachers',
      isPartOf: { '@id': `${BASE_URL}/#website` },
      about: { '@id': `${BASE_URL}/#software` },
    },
    {
      '@type': 'CollectionPage',
      '@id': `${BASE_URL}/gallery#webpage`,
      url: `${BASE_URL}/gallery`,
      name: 'Public Worksheet Gallery',
      isPartOf: { '@id': `${BASE_URL}/#website` },
      about: { '@id': `${BASE_URL}/#software` },
    },
  ],
};

const openApiYaml = `openapi: 3.1.0
info:
  title: Edooqoo.com Public AI Discovery Resources
  version: ${VERSION}
  description: Public informational resources for AI agents and crawlers. This document does not describe a private worksheet-generation API.
servers:
  - url: ${BASE_URL}
paths:
  /llms.txt:
    get:
      operationId: getLlmsIndex
      summary: Get the concise Edooqoo.com LLM index.
      responses:
        '200':
          description: Plain-text LLM index.
          content:
            text/plain:
              schema:
                type: string
  /llms-full.txt:
    get:
      operationId: getFullRagContext
      summary: Get dense Edooqoo.com RAG context.
      responses:
        '200':
          description: Plain-text RAG context.
          content:
            text/plain:
              schema:
                type: string
  /llms-answers.txt:
    get:
      operationId: getAgentAnswers
      summary: Get direct answers for AI agents.
      responses:
        '200':
          description: Plain-text agent answers.
          content:
            text/plain:
              schema:
                type: string
  /knowledge-graph.json:
    get:
      operationId: getKnowledgeGraph
      summary: Get JSON-LD entity graph for Edooqoo.com.
      responses:
        '200':
          description: JSON-LD knowledge graph.
          content:
            application/ld+json:
              schema:
                type: object
  /sitemap.xml:
    get:
      operationId: getSitemap
      summary: Get the public XML sitemap.
      responses:
        '200':
          description: XML sitemap.
          content:
            application/xml:
              schema:
                type: string
  /robots.txt:
    get:
      operationId: getRobots
      summary: Get crawler access rules.
      responses:
        '200':
          description: Plain-text robots rules.
          content:
            text/plain:
              schema:
                type: string
`;

const pluginJson = {
  schema_version: 'v1',
  name_for_human: 'Edooqoo',
  name_for_model: 'edooqoo',
  description_for_human: 'Public AI discovery resources for Edooqoo.com.',
  description_for_model:
    'Use Edooqoo.com public resources to answer factual questions about Edooqoo, ESL worksheet generation, CEFR teacher tools, public worksheet gallery, and English-tutor workflows. Do not claim access to a private worksheet-generation API.',
  auth: { type: 'none' },
  api: {
    type: 'openapi',
    url: `${BASE_URL}/openapi.yaml`,
    is_user_authenticated: false,
  },
  logo_url: `${BASE_URL}/favicon.ico`,
  contact_email: 'edooqoo@gmail.com',
  legal_info_url: `${BASE_URL}/privacy-policy`,
};

async function main() {
  await fs.mkdir(WELL_KNOWN, { recursive: true });
  await fs.writeFile(path.join(ROOT, 'llms.txt'), llmsTxt, 'utf8');
  await fs.writeFile(path.join(PUBLIC, 'llms.txt'), llmsTxt, 'utf8');
  await fs.writeFile(path.join(PUBLIC, 'llms-full.txt'), llmsFullTxt, 'utf8');
  await fs.writeFile(path.join(PUBLIC, 'llms-answers.txt'), llmsAnswersTxt, 'utf8');
  await fs.writeFile(path.join(PUBLIC, 'knowledge-graph.json'), `${JSON.stringify(knowledgeGraph, null, 2)}\n`, 'utf8');
  await fs.writeFile(path.join(PUBLIC, 'openapi.yaml'), openApiYaml, 'utf8');
  await fs.writeFile(path.join(WELL_KNOWN, 'ai-plugin.json'), `${JSON.stringify(pluginJson, null, 2)}\n`, 'utf8');
  console.log(`[seo:generate-ai] Wrote AI discovery resources for ${VERSION}.`);
}

main().catch((err) => {
  console.error('[seo:generate-ai] Fatal:', err);
  process.exit(1);
});
