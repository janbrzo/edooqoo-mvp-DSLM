# November checkpoint (return here on 2026-11-02, second read 2026-11-30)

Start the session by reading this file, then `docs/seo/decisions-2026-10.md`, `docs/seo/change-log.md` and `docs/seo/monthly-workflow.md` (Prompt 0, then 1, 2, 3).

**The clock starts when PR #49 is merged and deployed, not when it was written.** Record the deploy date here: `____-__-__`. If it is later than 2026-10-05, shift both read dates by the same number of days. Nothing in the PR has any effect on Google until it is live.

## 1. Data to bring (owner, about 20 minutes)

- GSC Performance, last 3 months and last 28 days vs the previous 28 days: Pages and Queries (CSV), plus the chart.
- GSC Performance with the **Page + Query** dimension for `/tools/*`, `/modal-verbs-worksheets-esl`, `/features/*` (needed to attribute queries like "cefr level checker" to a page).
- GSC Page indexing (Coverage) export and the Manual actions status.
- Bing Webmaster Tools numbers, or "not set up".
- Signups by source and how many created a first student or worksheet; referral sessions from chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com.
- AI panel answers for the 30 queries in `docs/seo/ai-search-query-set.md`, if you have run them.

## 2. Baselines (from the 2026-10-04 export, window 2026-06-30..2026-09-29)

| Metric | Baseline |
|---|---|
| Clicks / impressions, 3 months | 297 / 10,773 (CTR 2.8%) |
| Clicks per week (weeks of 09-07 to 09-21) | 21 to 34 |
| Impressions per week (September) | 761 to 815 |
| Indexed pages (GSC, 2026-09-21) | 559 (was 622 on 2026-07-10) |
| Not indexed | 523 |
| Crawled, currently not indexed | 128 (was 27 in June) |
| Discovered, currently not indexed | 143 |
| 404 | 26 |
| Sitemap URLs before PR #49 | 552 (473 after stage 1, 472 after retiring `/authors/martha`) |
| URLs with impressions returning 404 | 38 (34 clicks, 1,042 impressions) |

## 3. What to read, per change

| Change (see `docs/seo/change-log.md`) | Read | Success looks like |
|---|---|---|
| 38 redirects (`scripts/seo/gsc-404-repair.json`) | Clicks and impressions on the 38 source URLs and on their targets; GSC 404 count | 404 count falling toward 0; targets gain impressions |
| 5 pSEO routes unlocked | Clicks, impressions, indexed status of the 5 URLs | Still getting clicks (baseline 23 clicks / 147 impressions in 3 months) and shown as indexed |
| Stage-1 prune (84 pages) | Indexed count, crawled-not-indexed count, clicks on the 16 remaining pSEO routes | Crawled-not-indexed no longer growing; clicks per week not below baseline |
| Martha claim removed | Nothing quantitative; check no page shows "Reviewed by" (`seo:audit` guards it) | n/a |
| 10 rewrites (2026-10-05) | Table below, vs the 43 untouched "reframed" posts as control | Position improves by 2 or more places, or impressions and clicks rise faster than the control |

Rewrites, 3-month baseline (2026-06-30..2026-09-29); compare per 28 days (divide by about 3.3):

| Page | Impressions | Position | Clicks |
|---|---:|---:|---:|
| `/blog/diagnostic-testing-english-learners` | 292 | 9.1 | 1 |
| `/blog/fill-in-the-blanks-exercises-best-practices` | 108 | 12.5 | 0 |
| `/blog/connected-speech-teaching-activities` | 100 | 10.0 | 7 |
| `/blog/current-events-esl-lessons` | 82 | 40.2 | 0 |
| `/blog/best-apps-learning-english-2026` | 75 | 13.8 | 0 |
| `/blog/how-to-create-grammar-worksheets-with-ai` | 64 | 16.0 | 0 |
| `/blog/error-correction-techniques-esl` | 60 | 12.4 | 0 |
| `/blog/cloze-test-design-esl` | 56 | 8.4 | 1 |
| `/blog/debate-activities-english-class` | 52 | 11.9 | 2 |
| `/blog/how-to-assess-english-level-cefr` | 50 | 38.4 | 2 |

## 4. Go / no-go for stage 2 pruning (`docs/seo/stage2-prune-candidates-2026-11.md`)

Go if all of these hold:
- "Crawled, currently not indexed" is at or below 128 (not growing).
- Average clicks per week over the last 4 weeks is at least 22 (about 75% of the September average); if it is lower, find out why before pruning anything else, because stage 1 may have hurt.
- No manual action.
- Before executing, recompute the candidate list from a fresh Pages export and drop any URL that gained 10 or more impressions after 2026-09-29.

If clicks fell more than 25% and the drop lines up with pages removed in stage 1, restore those pages (revert in `src/data/pseoIndexPolicy.json`) before doing anything else.

Also decide in November, with the PROTECTED list from the stage-2 file: rewrite, merge or noindex.

## 5. Next batch of rewrites

If at least 6 of the 10 rewrites improved position by 2 or more places or beat the control on impressions, write the next 10 from the "reframed" queue in impression order (`scripts/seo/article-rewrites.mjs`); otherwise change the format first (ask what the pages that did work have in common). Each rewrite uses a constructed example unless you supply real worksheets or screenshots from the app.

## 6. Open items waiting for the owner

- API key for the paid verifier layer (`ANTHROPIC_API_KEY` or `ant auth login`); cost estimate: about 3 to 6 USD for the 10 rewrites, 15 to 30 USD for all 53 "reframed" posts; set a monthly limit in the Console first. Until then no page is `verified` and no quality label is shown.
- Martha: "Built with Martha" stays (decided 2026-10-05). Still open: "15 ESL games tested by Martha" (games page copy and meta description). Keep only if such testing happened.
- Off-site and infrastructure: follow `docs/seo/off-site-and-infra-runbook.md` (Bing Webmaster Tools, IndexNow submit, brand mentions, mention log). The Cloudflare Worker is deliberately not being deployed for now (hosting change, small gain). GSC API token for `npm run seo:fetch-gsc-performance` is still open.
- Possible title and description test for `/modal-verbs-worksheets-esl` (364 impressions, position 8.3, 1 click) and `/features/flashcards` (90 impressions, position 10.4, 0 clicks).
