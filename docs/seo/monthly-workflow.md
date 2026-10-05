# Monthly SEO/GEO Workflow (v2)

Zastępuje poprzedni flow „PROMPT 0–4”. Kontekst i powody: `docs/seo/audit-2026-10-04-seo-geo-direction.md`.

**Jedna miara sukcesu**: więcej nauczycieli z ruchu organicznego i z odpowiedzi AI, którzy zakładają konto i zaczynają pracę z uczniem. Liczba stron, zielone audyty i „pokrycie klastrów” nie są celem.

## Co się zmieniło względem v1 i dlaczego

| v1 | v2 | Powód |
|---|---|---|
| Pełny audyt source-of-truth co miesiąc | Tylko przy zmianie produktu (Prompt S), audyt diffu | Kosztowny, nie rusza ruchu; AGENTS.md i tak wymaga aktualizacji `llm-context.md` przy zmianach architektury |
| Macierz luk → „brakuje URL → nowa strona” | Kolejność **przytnij → popraw → stwórz**; nowa strona tylko po teście information gain | Pętla „brak URL = nowa strona” wyprodukowała 358 stron szablonowych |
| Tryb „CODE-ONLY” dozwolony bez końca | Bez danych GSC wolno tylko naprawiać szkody, nie wolno rozbudowywać | Brak danych przez 4 miesiące = zero korekty kursu |
| Audyty zgodności z planem | Audyty skutków (GSC, indeksacja, rejestracje, panel AI) + retro zmian | Plan był w 100% zielony, a ruch stał (Goodhart) |
| Bloki „When to cite / RAG Keywords” dla botów | Treść dla nauczyciela; struktura (odpowiedź na początku, tabele, FAQ) tylko tam, gdzie pomaga człowiekowi | Silniki AI wybierają źródła rankingiem, nie instrukcjami na stronie |
| Brak off-site | Co miesiąc min. 1 ruch poza stroną | Wzmianki o marce to najsilniejszy znany korelat widoczności w AI |

## Kadencja

```
JEDNORAZOWO (teraz):  Prompt R: Remediation (po decyzji właściciela)
CO MIESIĄC:           Prompt 0, Dane  →  Prompt 1, Diagnoza  →  Prompt 2, Decyzja  →  [CZŁOWIEK ZATWIERDZA]  →  Prompt 3, Wdrożenie + PR
PRZY ZMIANIE PRODUKTU: Prompt S, Sync prawdy o produkcie
```

Prompt 0 zawsze zaczyna się od retro zmian z poprzednich miesięcy, więc osobny prompt retro nie jest potrzebny.

---

## Operating Model (read by every prompt)

Agents: read this section before acting. It is the shared model of how search and answer engines pick sources. Reason from it; do not override it with generic SEO habits.

### How sources get selected (2026)

1. **Google Search, AI Overviews, AI Mode** draw from Google's index. AI features fan a query out into sub-queries and pick passages from pages that already rank. No ranking or indexing means no AI Overview citation. Google states no special markup or file is required for AI features, and it does not use `llms.txt`.
2. **ChatGPT search** relies heavily on Bing's index plus OpenAI's own crawler (`OAI-SearchBot`). Being indexed and ranking in Bing matters. Bing Webmaster Tools and IndexNow are cheap levers.
3. **Perplexity** uses its own index (`PerplexityBot`) and cites forums (Reddit), video and review/listicle pages unusually often. **Claude** web search uses Brave's index.
4. Only about 11% of domains cited by ChatGPT are also cited by Perplexity, so visibility must be measured per engine.
5. **Brand mentions on independent sites** (listicles, Reddit threads, directories, newsletters, YouTube) correlate with AI visibility far more than backlinks or on-site markup. Owned pages alone rarely get a small brand recommended in "best tool for X" answers.
6. **Scaled content abuse** (many pages with little unique value, made by AI, humans or templates) can demote the **whole site**, good pages included. Paraphrasing a template does not fix it; unique substance, merging or removal does.
7. Pages get cited when they hold something other pages do not (**information gain**): first-hand product output, real examples, numbers, worked cases, clear comparisons with honest limits, named accountable authors.

### Edooqoo's unfair advantage

Edooqoo can show **real product output**: generated, teacher-reviewed worksheets, exercise types, the student-context → next-lesson decision, homework review. Generic ESL blogs and chatbots cannot show this. Any page that only describes the product, without showing output, has thrown that advantage away.

### Hard rules

- Worksheet Generation Engine (`supabase/functions/generateWorksheet`, `format-worksheet-prompt`) is never modified without the literal instruction "update the Worksheet Generation Engine". Using the app's normal output for public examples is allowed.
- `public/llms.txt` and root `llms.txt` change only via `scripts/seo/generate-ai-resources.mjs`. Generated files change only via their generator.
- Public claims must match production behavior. BETA/ROADMAP features are never presented as available.
- Never delete or noindex a URL that received impressions in the last 90 days without an explicit human decision naming it.
- No new indexable page unless it passes the **Information Gain Test** (below) and `npm run seo:audit-uniqueness` shows `maxContainment < 0.3` for it.
- No visible text addressed to bots ("When to cite this page", "Primary audience: AI agents", visible "RAG Keywords"). Machine context goes in JSON-LD, `llms*.txt` or docs.
- No fabricated authority: no fake reviewers, ratings, testimonials, stats or "updated" dates without real content change.
- Without real GSC data for the period, only harm-reduction moves are allowed, no expansion.

### Information Gain Test (every new or rewritten page)

Answer all five in the PR. Any "no" means the page is not created.

1. What will a teacher find here that is **not** in the current top 5 Google results for the target query? Name it concretely.
2. What will they find here that is not on any other edooqoo.com page? (Otherwise improve that page instead.)
3. Does the page **show** product output or first-hand evidence (real worksheet, screenshot, worked case, data), not only describe it?
4. Is there demand evidence: GSC impressions, a real query observed in the AI panel, or a recurring teacher question from a public forum?
5. Would a working ESL tutor bookmark or share it?

### Page portfolio actions (use these labels)

| Label | Rule |
|---|---|
| KEEP | Impressions or clicks stable or growing; nothing to fix |
| IMPROVE-CTR | Position ≤ 10, CTR below site median for that position → title, meta, first paragraph |
| IMPROVE-DEPTH | Position 8–25 on a relevant query → add the missing substance, real example, better answer |
| MERGE | Two or more URLs compete for the same queries or share ≥ 50% text → one canonical URL; others redirect, or noindex + canonical where 301 is impossible |
| PRUNE | Indexable ≥ 90 days, < 10 impressions in 90 days, and templated or off-ICP → noindex + remove from sitemap (or delete + redirect) |
| WAIT | Published or materially changed < 60 days ago |

### Metric hierarchy

1. **North star**: organic + AI-referred teacher signups that create a first student or worksheet (per month).
2. **Leading**: non-branded clicks to product pages; branded search impressions (proxy for brand demand); indexed share of sitemap URLs; AI panel mention rate per engine; referral sessions from `chatgpt.com`, `perplexity.ai`, `gemini.google.com`, `copilot.microsoft.com`.
3. **Hygiene** (must not regress, but never a goal): uniqueness audit, sitemap integrity, structured data, live routing.

### Change log

Every implemented move adds a row to `docs/seo/change-log.md`: date, URLs, move, hypothesis, metric, check date (+28 / +56 days). Prompt 0 uses this table for the retro.

---

## Prompt R: Remediation (one-off, after owner decisions)

```
Read AGENTS.md, docs/codex-workflow.md and the "Operating Model" section of docs/seo/monthly-workflow.md. Sync main first.
Read docs/seo/audit-2026-10-04-seo-geo-direction.md. It is the diagnosis; do not re-litigate it unless the current code contradicts it.

GOAL
Remove the site-wide scaled-content signal without losing any URL that earns impressions.

INPUTS FROM THE OWNER (stop and ask if missing)
- GSC Performance export, Pages tab, last 3 months (CSV), or confirmation that GSC_ACCESS_TOKEN works for npm run seo:fetch-gsc-performance.
- Martha: decided 2026-10-04 (see docs/seo/decisions-2026-10.md): no human-review claim; automated verifier instead.
- Decision for the "AI alternative / limitations" cluster: which ~3 URLs survive.

STEPS
0. First, the zero-risk fixes from docs/seo/runs/monthly/2026-10.md:
   - Every URL in "404 URLs that earned impressions" gets a redirect (existing legacy-redirect mechanism) to the closest live page by topic; list the mapping in the PR.
   - The pSEO routes in "Noindexed pSEO routes that earn clicks" move to the indexable set in src/data/pseoIndexPolicy.json and get prerendered.
1. Run npm run seo:audit-uniqueness. Join docs/seo/content-uniqueness.generated.json with the GSC pages export on route.
2. Build a portfolio table for every templated page (maxContainment >= 0.5): route, maxContainment, nearest page, 90-day impressions, clicks, best position, proposed label (KEEP / IMPROVE-DEPTH / MERGE / PRUNE / WAIT), merge target.
   Any page with impressions >= 10 is never PRUNE; propose MERGE or IMPROVE-DEPTH instead.
   Templated pages whose URL still earns impressions (e.g. the "reframed" blog posts) get IMPROVE-DEPTH: real, unique content for the query they rank for, not noindex.
3. Present the table and the proposed counts per label. STOP and wait for owner approval.
4. After approval, implement at generator level (generate-strategic-content, generate-legacy-strategic-articles, generate-citable-pages, inject-citation-blocks, cluster hub injection, sitemap and pSEO policy sources):
   - PRUNE: noindex + remove from sitemap and llms resources + remove internal links to it.
   - MERGE: keep one canonical URL; old URLs get the existing redirect mechanism (cloudflare/_redirects or html stub with canonical + noindex) and leave the sitemap.
   - Remove visible bot-directed blocks site-wide ("When to cite this page", "Primary audience", visible "RAG Keywords") and cap related-link blocks at ~10 contextual links.
   - Stop emitting identical Published/Updated dates; dates change only with real content change.
   - Remove "Reviewed by Martha" (visible text and reviewedBy JSON-LD) per docs/seo/decisions-2026-10.md and replace it with the automated-verification label only when the verifier (same file, item 3) exists and has a passing record for the page.
5. Update audits so this cannot regress: baseline-lock the templated count in scripts/seo/audit-content-uniqueness.mjs (fail only if it rises) and add bot-directed phrases to the banned list in audit-duplicate-meta.mjs or a body-text audit.
6. Run npm run build:seo, npm run seo:audit, npm run content:audit, npm run build. Report failures honestly.
7. Add one change-log row per move to docs/seo/change-log.md with check dates.
8. Commit, push, open a PR. PR body: portfolio counts per label, list of PRUNE/MERGE URLs, verification results, confirmation that the Worksheet Generation Engine is untouched.

OUTPUT (in Polish; URLs and paths in English): PR link, counts per label, what was intentionally not done and why, what the owner should watch in GSC over the next 8 weeks.
```

---

## Prompt 0: Dane + retro

```
Read AGENTS.md, docs/codex-workflow.md and the "Operating Model" section of docs/seo/monthly-workflow.md. Sync main.

GOAL
Produce the month's evidence pack and judge last months' moves. Do not plan or change anything yet.

COLLECT (run what scripts can; ask the owner for the rest in ONE message listing exactly what to paste)
Scripts:
- npm run seo:fetch-gsc-performance (needs Search Console access: GSC_SERVICE_ACCOUNT_JSON or an access token; setup in docs/seo/gsc-api-access.md; it returns page x query rows, so ask the owner for CSV exports only if it reports `skipped`), npm run seo:audit-uniqueness, npm run seo:verify-live-routing -- --soft
Owner:
- GSC Performance: last 28 days vs previous 28 days, Queries and Pages tabs (CSV), plus the 16-month chart if anything looks like a step drop.
- GSC Pages (indexing) export and Manual actions status.
- Bing Webmaster Tools: clicks, impressions, indexed pages (or "not set up").
- Signups in the period by source/referrer, and how many created a first student or worksheet (Supabase or analytics), if tracked.
- Referral sessions from chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com.
- AI panel: the fixed 30-query set in docs/seo/ai-search-query-set.md (never reword it between months) run in ChatGPT, Perplexity, Gemini/AI Mode and Claude. For each answer: Edooqoo mentioned? linked? correct? which competitors and which sources were cited?
- Off-site: new third-party mentions, listicles, threads or directory listings found or created.
- git log on main since the last pack: product changes shipped (Lovable included).

ANALYSE
1. Retro: for each docs/seo/change-log.md row whose check date has passed, compare the metric before and after. Verdict: worked / no effect / harmed / too early. Account for seasonality (school calendar) and sitewide shifts; compare against a control group of untouched pages.
2. Step changes: any sitewide drop or rise that lines up with a known Google update date. Flag it explicitly.
3. Top movers: pages and queries with the largest impression and click changes.
4. Cannibalisation: queries where 2+ edooqoo URLs get impressions.
5. Striking distance: queries at position 5–25 with meaningful impressions and a relevant page.
6. AI panel: mention rate per engine; which sources engines cite instead of Edooqoo (these are the off-site targets).
7. Funnel: organic/AI sessions → signups → activated teachers, where data exists.

OUTPUT (Polish; URLs, queries and paths in English), saved to docs/seo/runs/monthly/YYYY-MM.md:
- DATA CONFIDENCE: FULL / PARTIAL / CODE-ONLY, and what is missing.
- Retro verdicts table.
- 5 key facts of the month, each with its number and source.
- Lists: top movers, cannibalised queries, striking-distance queries, AI panel gaps with the sources engines cited.
End with: "DATA PACK READY."
```

---

## Prompt 1: Diagnoza: co szkodzi, co jest blisko

```
Read AGENTS.md, the "Operating Model" section of docs/seo/monthly-workflow.md and this month's docs/seo/runs/monthly/YYYY-MM.md. Sync main. Do not modify files.

GOAL
Find what currently holds Edooqoo back and where the nearest wins are, judged by the north-star metric. Harm comes before opportunity.

PART A: HARM CHECK (each item: status OK / RISK / HARM, with evidence)
1. Scaled or templated content: npm run seo:audit-uniqueness; trend vs last month.
2. Indexation health: indexed share of sitemap URLs; trend of "crawled – currently not indexed"; strategic product pages in "discovered/crawled – not indexed".
2b. Lost equity: fetch every URL from the GSC Pages export live. Any URL with impressions that now returns 404, a homepage shell, a canonical to another page, or noindex is HARM unless a human decided it. List it with clicks/impressions and the closest live target.
3. Cannibalisation from GSC (same query, several URLs).
4. Intent mismatch: pages ranking for queries they do not answer (e.g. a "worksheet" query landing on a page with no worksheet).
5. Trust signals: unverifiable authors or reviewers, fake freshness, claims not supported by production code (spot-check 10 pages against src/ and docs/llm-context.md), bot-directed visible text.
6. Technical: soft 404s, redirect chains, canonical conflicts, noindex pages in sitemap, private routes exposed, prerender missing on public SPA routes (check live HTML of 5 key routes), Core Web Vitals if data was provided.
7. Entity consistency: does the one-sentence description of Edooqoo match across the homepage, llms.txt, docs/seo/external-evidence-playbook.md and known third-party listings?
8. Bot access: robots.txt and headers allow Googlebot, Bingbot, OAI-SearchBot, PerplexityBot, Claude-SearchBot.

PART B: OPPORTUNITIES (only with evidence from the data pack)
- Striking-distance queries → which existing URL, what is missing from it versus the top 3 results (fetch them and compare; name the concrete gap).
- CTR gaps on pages already in the top 10.
- AI panel gaps: for each prompt where Edooqoo is absent, list the sources cited instead and classify them: owned-page gap / off-site gap (listicle, Reddit, directory, video) / not winnable.
- Product proof gaps: production features that teachers search for but no public page shows with real output.

For every finding: EVIDENCE (number + source), IMPACT ON NORTH STAR (high/med/low + why), CONFIDENCE (high/med/low).
Do not propose new pages here; that happens in Prompt 2 under the Information Gain Test.

OUTPUT (Polish), appended to this month's run file: harm table, opportunity table, the 3 findings that matter most and why.
End with: "DIAGNOSIS COMPLETE."
```

---

## Prompt 2: Decyzja (bramka dla człowieka)

```
Read the "Operating Model" section of docs/seo/monthly-workflow.md and this month's run file (data pack + diagnosis). Do not modify files.

GOAL
Choose at most 3 moves for this month that most increase activated teacher signups from search and AI answers.

SELECTION RULES
- Order of preference: fix HARM → improve pages that already earn impressions → off-site visibility → new pages (only after the Information Gain Test).
- At least 1 of the 3 moves is off-site/human-ops unless the owner has said otherwise.
- With DATA CONFIDENCE = CODE-ONLY, only harm-reduction moves are allowed.
- Reject any move whose success cannot be observed in GSC, Bing, the AI panel or signups within 8 weeks.
- Reject moves that mainly add pages, links, schema or llms.txt entries without a demonstrated gap.
- Before choosing, steelman one alternative per move and say why it loses.

For each move, exactly:
MOVE [N]: name
EVIDENCE: numbers from the run file that justify it
HYPOTHESIS: "If we X, then metric Y on URLs/queries Z moves by about W within N weeks, because ..."
WORK: code (files/generators) or human ops (who, where, what text)
INFORMATION GAIN: only for new/rewritten pages, the 5 answers
RISK + ROLLBACK: what could go wrong and how to undo it
MEASUREMENT: metric, baseline value, check dates (+28 / +56 days), control group
SCORE: impact, confidence, effort, risk (1–5) → (impact + confidence) − (effort + risk)

Then:
## Rejected ideas: one line each, why.
## Owner decisions needed: only what cannot be inferred (deletions, author identity, budget, tone, outreach).
## Prompt 3 input: a short block the owner can approve or edit.

Communicate in Polish; URLs, titles, queries and paths in English.
End with: "PLAN READY. Awaiting owner approval."
```

---

## Prompt 3: Wdrożenie + PR

```
Read AGENTS.md, docs/codex-workflow.md and the "Operating Model" section of docs/seo/monthly-workflow.md. Sync main; preserve any local changes. Work on the branch given by the session or repo convention.

APPROVED MOVES
[paste the owner-approved Prompt 3 input here]

RULES
- Implement only the approved moves. If the code shows a move is unsafe or impossible, stop and explain; do not improvise a replacement.
- Change generators, not generated output. Keep visible content, JSON-LD, sitemap, llms resources and internal links consistent.
- Every public claim must be verifiable in production code. No BETA/ROADMAP as live behavior.
- New or rewritten pages: include the Information Gain answers in the PR and confirm maxContainment < 0.3 via npm run seo:audit-uniqueness.
- Human-ops moves: deliver the ready-to-use text, target list and steps in docs/seo/runs/monthly/YYYY-MM.md. Do not post anything to external sites yourself.
- Worksheet Generation Engine untouched.
- New or rewritten indexable pages: run `npm run seo:audit-uniqueness`, then `npm run seo:verify-content -- --routes=<routes> --links` (add `--llm` once credentials exist). A page that does not reach `verified` stays `noindex` or unpublished; never add the "Automated quality checks" label by hand.

VERIFY
npm run build:seo (if SEO generators or public assets changed), npm run seo:audit, npm run content:audit, npm run seo:audit-uniqueness, npm run build. Do not commit build output unless the repo tracks it. Report any failure with its output.

FINISH
- Add one row per move to docs/seo/change-log.md (date, URLs, move, hypothesis, metric, baseline, check dates).
- git status and git diff --stat: only approved-scope files changed.
- One focused commit, push, open a PR. PR body: Summary (moves), Verification (each command + result), Scope guards (engine untouched, no BETA exposed, private routes private, generators used), Measurement (what to check and when).

OUTPUT (Polish): PR link, branch, commit SHA, what was done, what was not and why, what the owner should do (human-ops moves, GSC "Request indexing" for at most the changed key URLs).
```

---

## Prompt S: Sync prawdy o produkcie (przy zmianie produktu)

```
Read AGENTS.md and docs/codex-workflow.md. Sync main.

GOAL
Keep public claims and AI resources in line with what production actually does, at minimal cost.

1. List commits on main since the last sync (see the last "product-sync" row in docs/seo/change-log.md) and the changed files under src/, supabase/functions/ and supabase/migrations/.
2. For each user-facing change, classify it: new capability / changed behavior / removed / internal only. Decide PRODUCTION vs BETA from code (feature flags, admin-only, demo-only paths).
3. Find public pages, docs/llm-context.md sections and llms resource sources that now say something false or omit a PRODUCTION capability teachers would search for.
4. Fix only those: generator sources for llms files (npm run seo:generate-ai), docs/llm-context.md only for architectural changes in its PROBLEM -> EDOOQOO SOLUTION -> TECHNICAL MECHANICS -> RAG KEYWORDS format, and affected page generators.
5. Note in the output any new PRODUCTION capability that deserves a public page with real output. Do not create the page here; it goes to next month's Prompt 2.
6. Run npm run seo:audit and npm run build; commit, PR, and add a "product-sync" row to docs/seo/change-log.md.

Output in Polish.
```

---

## Off-site checklist (human ops, pick 1–2 per month)

- Bing Webmaster Tools: verify the domain, submit the sitemap, enable IndexNow (Cloudflare can send it automatically).
- Third-party listicles that answer engines cite for "best AI tools for ESL teachers / English tutors / Business English": find them via the AI panel's cited sources and ask the authors for inclusion, offering a demo account and real sample output.
- Reddit (r/TEFL, r/ESL_Teachers, r/OnlineESLTeaching) and teacher Facebook groups: genuine, disclosed answers to prep/homework/progress questions. No link drops, no sock puppets.
- YouTube: a 2–4 minute real walkthrough (student context → worksheet → homework review). Video is a frequently cited source type.
- Directories: AI tool directories, EdTech listings, G2/Capterra once real users can review.
- Every listing uses the same one-sentence entity description as `public/llms.txt`.
