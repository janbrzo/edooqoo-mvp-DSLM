# SEO/GEO decisions: 2026-10-04

Approved by the owner on 2026-10-04 (proposals from the audit, accepted as stated; item 3 amended by the owner).

## 1. Pruning templated pages (staged)

Stage 1 (this list, below): templated pSEO pages (`maxContainment >= 0.5`) with fewer than 10 impressions in 3 months → `noindex,follow`, removed from the sitemap, removed from the indexable set in `src/data/pseoIndexPolicy.json`. 84 pages, 3 clicks and 125 impressions in total.
Stage 2 (only after 4 weeks and a look at indexing; candidate list and go/no-go in `docs/seo/stage2-prune-candidates-2026-11.md` and `docs/seo/checkpoint-2026-11.md`): profession scenario triplets → 1 page per profession, the rest `noindex`; "AI alternative" cluster → 3 pages (`edooqoo-vs-chatgpt`, `best-ai-tools-for-english-tutors`, `ai-worksheet-generator-for-english-teachers`); blog and root pages templated with < 10 impressions (212) → `noindex`.
Rule: a URL with >= 10 impressions in the last 90 days is never pruned.

## 2. Rewrite of "reframed" blog posts

53 of 79 identical "reframed" posts still get impressions. Rewrite in impression order: first the 10 listed below, each answering the query it ranks for, with a real example or worksheet from the app, passing the verifier (item 3). The other 43 wait for the results of the first 10 (check +28 days). The 26 "reframed" posts with zero impressions go to stage 2 pruning.

Status 2026-10-05: the first 10 rewrites are done (`scripts/seo/article-rewrites.mjs`): diagnostic-testing-english-learners, fill-in-the-blanks-exercises-best-practices, connected-speech-teaching-activities, current-events-esl-lessons, best-apps-learning-english-2026, how-to-create-grammar-worksheets-with-ai, error-correction-techniques-esl, cloze-test-design-esl, debate-activities-english-class, how-to-assess-english-level-cefr. All pass verifier layer 1 (`layer1-only`); layer 2 (LLM judges) has not been run. Examples in them are labelled "Constructed example". The other 43 wait for the +28-day read of these 10.
Site-wide at the same time: generated blog articles no longer render "When to cite this page", "Primary audience", a visible "RAG Keywords" section (keywords moved to Article JSON-LD) or the 55-link block (now at most 10 contextual links, spread by rotation to keep the link-graph audit green).

## 3. "Reviewed by Martha" → automated verification (amended)

Update 2026-10-05 (owner): Martha stays as a profile and "Built with Martha (10 yrs ESL)" stays because it is true; she does not review blog posts. `/authors/martha` is restored with a bio that says she is the quality benchmark and does not review or approve individual articles; no page carries `reviewedBy` or "Reviewed by". "15 ESL games tested by Martha" was changed (owner: the games were not tested) to "designed with Martha's criteria" in the games page copy and meta; the lead claim "tested across hundreds of 1-on-1 and small-group lessons" and the invented statistic "eliminates 80% of the games" were removed from the same page.

Martha will not review pages, so the claim "Reviewed by Martha" is removed everywhere (visible text and `reviewedBy` JSON-LD, in the four generators and `src/data/contentAuthors.ts`). It is replaced by an automated verifier whose result is shown honestly as **"Automated quality checks passed on <date>"**, linking to a methodology page that lists exactly what is checked. No wording may imply human review. Jan Brzostowski stays as the named author/publisher.  is removed (or kept only as the credited author of the "Martha Test" criteria, if she wrote them: owner to confirm).

Status 2026-10-05: the claim is already removed (generators, React pages, `reviewedBy` JSON-LD) and `/authors/martha` redirects to Jan's profile; `seo:audit` and the strategic-content audit now fail if a human-review attribution reappears. The verifier is built (2026-10-05): `npm run seo:verify-content -- --routes=... [--links] [--llm]` (layer 1 deterministic checks; layer 2 = two LLM judges, `claude-opus-5-5` and `claude-sonnet-5-5`, structured JSON verdict, pass/fail decided in code, fail closed on refusal/truncation/errors, no silent model fallback). Records go to `docs/seo/content-verification.generated.json` with a hash of the visible text; `npm run seo:audit-verification` (part of `content:audit`) fails if a page shows the label "Automated quality checks passed" without a matching `verified` record. **Not shipped yet:** the label itself and its methodology page, and the judges have not been run against the live API (no credentials in the build environment); they are covered by tests with a stubbed client only. Information gain is recorded but only gates when competitor excerpts are supplied (`--competitors=file.json`, route → excerpts), because the verifier does not fetch search results.
Operating rule: layer 1 runs without cost; `--llm` spends money and runs only on routes passed explicitly, and only when layer 1 already passes.

### Verifier spec (new pages and rewrites must pass; fail closed = page stays `noindex`)

| Layer | Check | Type |
|---|---|---|
| 1 | `seo:audit-uniqueness`: `maxContainment < 0.3` vs every other indexable page | deterministic |
| 1 | No bot-directed visible text ("When to cite", "Primary audience", "RAG Keywords"); max ~10 contextual links | deterministic |
| 1 | Product statements only from PRODUCTION list in `docs/llm-context.md`; no BETA/ROADMAP; no guarantees, stats, ratings or testimonials without a source | deterministic + LLM |
| 1 | Every external citation URL returns 200, is on an allowlist (CEFR/Council of Europe, peer-reviewed, publishers) and supports the sentence it is attached to | deterministic + LLM |
| 1 | JSON-LD matches visible content; dates change only with real content change | deterministic |
| 2 | LLM judge (a different model than the writer) against a fixed rubric: adult relevance, ELT accuracy, information gain vs the current top-5 results (fetched), no invented facts | LLM |
| 2 | Claim extraction: each factual claim is listed and verified against a source or code; unverifiable claims are removed, not softened | LLM |
| 2 | Second independent judge; pages pass only if both pass | LLM |
| 3 | Monthly: owner spot-checks 5 random verified pages (10 minutes); disagreement with the verifier tightens the rubric | human, sampled |
| 3 | Post-publish: GSC indexation and clicks at +28/+56 days; pages that stay "crawled – not indexed" go back to rewrite or noindex | data |

The result is stored in a generated file (`docs/seo/content-verification.generated.json`: route, date, per-check result, model names) and `seo:audit` fails if a page shows the label without a passing record.

## 4. Audience of top-of-funnel content

Product and conversion stay for adult 1:1 tutors. Top-of-funnel content (CEFR, grammar, tools, worksheets) serves general ESL teachers, with a clear next step: free tool → account → first student. First candidates: `/tools/vocab-cefr-checker` (25 clicks) and the CEFR level checker (94 impressions at position 26.6).

---

## Stage 1 prune list (84 pages)

| Clicks | Impr | maxContainment | Route |
|---:|---:|---:|---|
| 1 | 7 | 0.608 | /english-for/accountants |
| 2 | 7 | 0.891 | /esl-worksheets/business-email/c1-advanced |
| 0 | 7 | 0.892 | /esl-worksheets/job-interview/c1-advanced |
| 0 | 7 | 0.894 | /esl-worksheets/travel-vocabulary/a1-beginner |
| 0 | 7 | 0.868 | /worksheets/error-correction/modal-verbs |
| 0 | 7 | 0.868 | /worksheets/open-question/modal-verbs |
| 0 | 7 | 0.879 | /worksheets/rewriting/business-email |
| 0 | 6 | 0.697 | /english-for/marketing-managers |
| 0 | 6 | 0.871 | /worksheets/open-question/present-perfect |
| 0 | 6 | 0.868 | /worksheets/paragraph-writing/business-email |
| 0 | 6 | 0.864 | /worksheets/paragraph-writing/conditionals |
| 0 | 6 | 0.864 | /worksheets/transformation/conditionals |
| 0 | 5 | 0.871 | /worksheets/dialogue-completion/present-perfect |
| 0 | 4 | 0.895 | /esl-worksheets/past-simple/a1-beginner |
| 0 | 4 | 0.867 | /worksheets/picture-vocabulary/travel-vocabulary |
| 0 | 3 | 0.616 | /english-for/lawyers |
| 0 | 3 | 0.893 | /esl-worksheets/ielts-writing-task-2/c1-advanced |
| 0 | 3 | 0.895 | /esl-worksheets/past-simple/a2-elementary |
| 0 | 3 | 0.868 | /worksheets/dialogue-completion/past-simple |
| 0 | 3 | 0.868 | /worksheets/short-answer/business-email |
| 0 | 2 | 0.677 | /english-for/executives |
| 0 | 2 | 0.893 | /esl-worksheets/phrasal-verbs/b2-upper-intermediate |
| 0 | 2 | 0.864 | /worksheets/error-correction/conditionals |
| 0 | 2 | 0.864 | /worksheets/open-question/phrasal-verbs |
| 0 | 1 | 0.701 | /english-for/project-managers |
| 0 | 1 | 0.892 | /esl-worksheets/job-interview/b2-upper-intermediate |
| 0 | 1 | 0.893 | /esl-worksheets/meetings/b1-intermediate |
| 0 | 1 | 0.891 | /esl-worksheets/meetings/b2-upper-intermediate |
| 0 | 1 | 0.897 | /esl-worksheets/past-simple/b1-intermediate |
| 0 | 1 | 0.868 | /worksheets/error-correction/past-simple |
| 0 | 1 | 0.883 | /worksheets/matching/travel-vocabulary |
| 0 | 1 | 0.866 | /worksheets/open-question/meetings |
| 0 | 1 | 0.867 | /worksheets/open-question/travel-vocabulary |
| 0 | 1 | 0.882 | /worksheets/rewriting/ielts-writing-task-2 |
| 0 | 0 | 0.687 | /english-for/consultants |
| 0 | 0 | 0.68 | /english-for/entrepreneurs |
| 0 | 0 | 0.896 | /esl-worksheets/conditionals/b1-intermediate |
| 0 | 0 | 0.894 | /esl-worksheets/conditionals/b2-upper-intermediate |
| 0 | 0 | 0.89 | /esl-worksheets/conditionals/c1-advanced |
| 0 | 0 | 0.891 | /esl-worksheets/ielts-writing-task-2/b2-upper-intermediate |
| 0 | 0 | 0.893 | /esl-worksheets/ielts-writing-task-2/c2-proficiency |
| 0 | 0 | 0.892 | /esl-worksheets/job-interview/a2-elementary |
| 0 | 0 | 0.894 | /esl-worksheets/job-interview/b1-intermediate |
| 0 | 0 | 0.893 | /esl-worksheets/meetings/c1-advanced |
| 0 | 0 | 0.895 | /esl-worksheets/modal-verbs/a2-elementary |
| 0 | 0 | 0.897 | /esl-worksheets/modal-verbs/b1-intermediate |
| 0 | 0 | 0.895 | /esl-worksheets/modal-verbs/b2-upper-intermediate |
| 0 | 0 | 0.895 | /esl-worksheets/modal-verbs/c1-advanced |
| 0 | 0 | 0.895 | /esl-worksheets/past-simple/b2-upper-intermediate |
| 0 | 0 | 0.895 | /esl-worksheets/phrasal-verbs/b1-intermediate |
| 0 | 0 | 0.897 | /esl-worksheets/present-perfect/a2-elementary |
| 0 | 0 | 0.897 | /esl-worksheets/present-perfect/b1-intermediate |
| 0 | 0 | 0.895 | /esl-worksheets/present-perfect/b2-upper-intermediate |
| 0 | 0 | 0.897 | /esl-worksheets/present-perfect/c1-advanced |
| 0 | 0 | 0.894 | /esl-worksheets/travel-vocabulary/b1-intermediate |
| 0 | 0 | 0.892 | /esl-worksheets/travel-vocabulary/b2-upper-intermediate |
| 0 | 0 | 0.879 | /worksheets/collocations-match/phrasal-verbs |
| 0 | 0 | 0.879 | /worksheets/definition-match/phrasal-verbs |
| 0 | 0 | 0.866 | /worksheets/dialogue-completion/job-interview |
| 0 | 0 | 0.866 | /worksheets/dialogue-completion/meetings |
| 0 | 0 | 0.868 | /worksheets/dialogue-completion/modal-verbs |
| 0 | 0 | 0.864 | /worksheets/dialogue-completion/phrasal-verbs |
| 0 | 0 | 0.867 | /worksheets/dialogue-completion/travel-vocabulary |
| 0 | 0 | 0.871 | /worksheets/error-correction/ielts-writing-task-2 |
| 0 | 0 | 0.838 | /worksheets/fill-in-the-blanks/past-simple |
| 0 | 0 | 0.864 | /worksheets/gap-fill/phrasal-verbs |
| 0 | 0 | 0.871 | /worksheets/gap-fill/present-perfect |
| 0 | 0 | 0.88 | /worksheets/matching/conditionals |
| 0 | 0 | 0.882 | /worksheets/matching/job-interview |
| 0 | 0 | 0.868 | /worksheets/multiple-choice/modal-verbs |
| 0 | 0 | 0.864 | /worksheets/open-question/conditionals |
| 0 | 0 | 0.866 | /worksheets/open-question/job-interview |
| 0 | 0 | 0.879 | /worksheets/ordering/business-email |
| 0 | 0 | 0.882 | /worksheets/ordering/ielts-writing-task-2 |
| 0 | 0 | 0.868 | /worksheets/ordering/past-simple |
| 0 | 0 | 0.871 | /worksheets/paragraph-writing/ielts-writing-task-2 |
| 0 | 0 | 0.866 | /worksheets/pronunciation-drill/job-interview |
| 0 | 0 | 0.868 | /worksheets/rewriting/modal-verbs |
| 0 | 0 | 0.866 | /worksheets/short-answer/job-interview |
| 0 | 0 | 0.866 | /worksheets/short-answer/meetings |
| 0 | 0 | 0.868 | /worksheets/short-answer/past-simple |
| 0 | 0 | 0.871 | /worksheets/short-answer/present-perfect |
| 0 | 0 | 0.867 | /worksheets/short-answer/travel-vocabulary |
| 0 | 0 | 0.871 | /worksheets/word-formation/ielts-writing-task-2 |

## First 10 rewrites

| Clicks | Impr | maxContainment | Route |
|---:|---:|---:|---|
| 1 | 292 | 0.869 | /blog/diagnostic-testing-english-learners.html |
| 0 | 108 | 0.869 | /blog/fill-in-the-blanks-exercises-best-practices.html |
| 7 | 100 | 0.893 | /blog/connected-speech-teaching-activities.html |
| 0 | 82 | 0.889 | /blog/current-events-esl-lessons.html |
| 0 | 75 | 0.87 | /blog/best-apps-learning-english-2026.html |
| 0 | 64 | 0.872 | /blog/how-to-create-grammar-worksheets-with-ai.html |
| 0 | 60 | 0.878 | /blog/error-correction-techniques-esl.html |
| 1 | 56 | 0.882 | /blog/cloze-test-design-esl.html |
| 2 | 52 | 0.893 | /blog/debate-activities-english-class.html |
| 2 | 50 | 0.889 | /blog/how-to-assess-english-level-cefr.html |
