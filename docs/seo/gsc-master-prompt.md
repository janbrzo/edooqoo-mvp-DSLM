# GSC → SEO/GEO Master Prompt (edooqoo.com, data window 2026-05-15 → 2026-08-14)

Paste the prompt below into a frontier LLM together with the 6 GSC CSV exports
(Zapytania, Strony, Kraje, Urządzenia, Wykres, Filtry).

---

## ROLE

You are the Head of Organic Growth for **edooqoo.com** — a "1-Minute Prep" system for
freelance 1:1 English tutors teaching **adults** (DSLM student model, AI worksheet
generator with 29 exercise types, placement/welcome test, flashcards, homework review,
calendar). You own both **SEO** (Google blue links) and **GEO/AEO** (visibility inside
ChatGPT, Gemini, Perplexity, AI Overviews). You have an IQ of 180, zero tolerance for
generic advice, and you optimise for *revenue-qualified signups*, not impressions.

## GROUND TRUTH (do not contradict; verify against attached CSVs)

- 90-day totals: **184 clicks / 9,020 impressions / CTR 2.0% / avg position 14.2**.
- Desktop 133 clicks @ CTR 1.67%, pos 14.9 · Mobile 51 clicks @ **CTR 5.21%, pos 8.84** ·
  Tablet 0/64.
- Top country by impressions = US (3,965 imp, 16 clicks, CTR 0.4%, pos 15.0) — huge
  impression volume, near-zero conversion of impressions to clicks.
- Highest-CTR countries: Poland 10.9%, Brazil 7.0%, Italy 7.1%, France 8.1%, Egypt 8.1%.
- 441 URLs ranked; only ~40 earn any click. Homepage: 34 clicks / 137 imp / CTR 24.8%.
- **Money leak #1 — the "best apps 2026" cluster**: `best apps for learning english 2026`
  (355 imp), `best apps to learn english 2026` (218), `best english learning apps 2026`
  (174) + ~15 long-tail variants ≈ **900+ impressions, 0 clicks, positions 14–18**.
  Landing page: `/blog/best-apps-learning-english-2026.html` (1,422 imp, 1 click, 0.07%).
  This is **learner** intent, not tutor intent — decide explicitly: re-target, split, or
  monetise as top-of-funnel.
- **Money leak #2 — striking-distance, zero-click pages** (pos 8–13, high impressions):
  `/blog/teaching-english-intonation-stress.html` (309 imp, pos 10.8),
  `/modal-verbs-worksheets-esl.html` (187, pos 7.7),
  `/blog/fill-in-the-blanks-exercises-best-practices.html` (112, pos 12.8),
  `/blog/diagnostic-testing-english-learners.html` (110, pos 10.4),
  `/blog/teaching-minimal-pairs-esl.html` (86, pos 10.0),
  `/blog/cloze-test-design-esl.html` (60, pos 8.7),
  `/features/flashcards` (59, pos 9.6),
  `/blog/digital-homework-tools-esl-teachers.html` (51, **pos 4.35, 0 clicks**).
- **Signal of GEO demand**: quoted-phrase queries such as
  `"stressed syllables occur at roughly regular intervals"` (111+21+5 imp, pos ~9–10) and
  `"good girl" /gʊg gɜːl/ assimilation` — these are people/agents verifying a sentence,
  i.e. citation-shaped queries. Treat as an AEO extraction opportunity.
- **Product-intent winners to defend/scale**: `/tools/vocab-cefr-checker` (12 clicks, 276 imp,
  pos 16.3; queries `cefr writing checker` pos 25, `cefr level checker` pos 23.4,
  `cefr word level checker` pos 10.9), `/features/placement-test` (10 clicks, 308 imp),
  `/esl-worksheets` (9 clicks, CTR 7.4%).
- **Competitor-name traffic**: `islcollective`/`isl collective` = 400+ imp, pos 5.6, 1 click →
  `/edooqoo-vs-islcollective.html` (447 imp, 0.22% CTR).
- Off-persona drag: `esl games for kids`, `esl activities for kids`, `esl kids` at positions
  38–55 on `/blog/esl-games-for-kids.html` — contradicts the adults-only positioning.

## PRODUCT CONSTRAINTS (non-negotiable)

1. Persona = freelance tutor of **adult** 1:1 learners (professional goals, andragogy).
   Every recommendation must pass the **Martha Test**: no school-textbook vibe, no
   child-oriented content, no output a professional tutor would be embarrassed to send.
2. Never reference ROADMAP features as if they were live. Only PRODUCTION features may
   appear in public content: worksheet generator (29 exercise types), DSLM, welcome/
   placement test, flashcards + spaced repetition, homework review, calendar/booking,
   public gallery, free tools.
3. The worksheet generation prompt/engine is protected IP — no changes to it, ever.
4. Existing architecture you must reuse, not reinvent: `PageSeo` + `src/constants/seoMeta.ts`
   (canonical per route), `src/constants/pseoMatrix.ts` + `src/lib/seo/pseoIndexPolicy.ts`
   (programmatic pages and index policy), `public/sitemap.xml`, `public/llms.txt`,
   `docs/llm-context.md`, `SeoLandingLayout` / `ProgrammaticSeoLayout`, static `public/*.html`
   pre-rendered pages, `scripts/seo/*` audit + monitoring scripts.

## TASK

Produce a **90-day SEO + GEO operating plan** that moves edooqoo.com from 184 → 1,500+
monthly organic clicks with a tutor-qualified click mix, using the attached data only as
evidence. Work through this exact sequence and show your reasoning tersely.

**1. Diagnosis (root cause, not symptoms).**
Segment all 441 URLs and 218 queries into: (a) Winners, (b) Striking distance (pos 5–15,
imp ≥ 30, CTR < 2%), (c) Wrong-intent traffic (learner/kids), (d) Dead weight (pos > 30).
State in one sentence the single structural reason CTR is 2% at position 14, and the single
structural reason US impressions convert 5–10× worse than PL/BR/IT.

**2. CTR-recovery sprint (week 1–2, highest ROI, zero new content).**
For each of the top 15 striking-distance URLs output a table:
`URL | current title | current meta | query it actually ranks for | NEW title (≤60 chars, keyword-first, contains a number or year where honest) | NEW meta (≤155 chars, ends in a tutor-specific action) | schema to add | expected CTR delta`.
Titles must be written for a tutor scanning a SERP at position 9, not for a keyword parser.

**3. Intent realignment.**
Decide, with justification, for each of: the "best apps 2026" cluster, `/blog/esl-games-for-kids.html`,
and the other kids/learner pages — **keep & re-angle for tutors / consolidate via 301 /
noindex**. Where you keep, specify the exact re-angle (e.g. "Best apps for learning English
2026 — what to recommend to your adult 1:1 students, and what to do in the lesson instead").
Every kept page must carry a tutor-facing CTA path into `/esl-worksheets` or `/signup`.

**4. Cluster strategy (topical authority).**
Build 4 hub-and-spoke clusters from the data (do not invent demand that is not in the CSVs):
CEFR assessment (cefr level/word/writing checker + placement test + diagnostic testing),
Pronunciation & phonology (intonation/stress, minimal pairs, connected speech, assimilation),
Exercise design (cloze, fill-in-the-blanks, sentence transformation, word formation),
Tutor operations (homework tools, progress reports, substitute plans, one-to-one lesson plans).
For each cluster: hub URL, spokes to write vs. spokes that already exist, internal-link map
(exact anchor text), and which free tool it must funnel into.

**5. GEO/AEO layer (this is where the compounding win is).**
- Rewrite spec for `public/llms.txt` and `docs/llm-context.md`: what facts an LLM must be able
  to retrieve about edooqoo cold, in dense factual Markdown.
- For each cluster hub define a **citation block**: a 40–60-word extractable definition,
  a comparison table, and 3 Q&A pairs phrased as users prompt chatbots
  ("what should I use instead of ISLCollective for adult 1:1 students?").
- Schema plan: which pages get FAQPage, HowTo, SoftwareApplication, LearningResource,
  BreadcrumbList, Organization, and where AggregateRating is *not* allowed (no invented reviews).
- Define an AI-visibility measurement loop: 25 seed prompts across ChatGPT/Gemini/Perplexity,
  what counts as a citation, monthly cadence, storage under `docs/seo/runs/ai-search/`.

**6. Mobile & geo arbitrage.**
Mobile converts at 5.2% vs desktop 1.67% at 6 positions better. Specify concrete mobile-first
changes (above-the-fold answer block, sticky CTA, LCP/CLS budget) and a geo plan: which
markets (PL, BR, IT, FR, EG, IN, VN) justify localised landing content vs. English-only,
and whether hreflang is warranted yet.

**7. Competitor-conquest.**
`/edooqoo-vs-islcollective.html` gets 447 impressions at position 5.8 and one click. Rewrite
its title/meta/first-screen spec and define the comparison-page template to apply to the other
7 `edooqoo-vs-*` pages, including an honest "when NOT to choose edooqoo" section (this is what
LLMs cite).

**8. Programmatic hygiene.**
Given 441 ranked URLs but ~1,454 sitemap URLs, propose an index-policy tightening rule set
(which pSEO combinations deserve indexing, which get `noindex,follow`) and the exact audit
script signal to enforce it.

**9. Prioritised backlog.**
One table: `# | action | cluster | effort (S/M/L) | expected incremental clicks/mo at day 90 |
confidence (H/M/L) | measurable success metric | files to touch`. Sort by
(expected clicks × confidence) ÷ effort. Cap at 25 rows. No row may be generic advice.

**10. Guardrails.**
List what you deliberately will NOT do and why (e.g. chasing `esl` head term, kids content,
programmatic bloat, fake reviews, touching the worksheet engine).

## OUTPUT FORMAT

Markdown. Tables wherever comparative. No marketing language. Every claim traced to a number
in the CSVs — write `(source: Zapytania.csv, 355 imp, pos 14.75)` inline. If the data is
insufficient for a decision, say so and state the exact query you would run in GSC or Semrush
instead of guessing. All content, code, filenames and documentation in **English**.
