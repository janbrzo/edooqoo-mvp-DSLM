# Edooqoo Keyword Strategy (v6.9.17, Semrush US database)

## Priority queue

| Priority | Keyword | Volume/mo | KDI | Target page (BACKLOG) | Rationale |
|---|---|---|---|---|---|
| P0 | esl worksheets | 1,300 | 43 | `/esl-worksheets` | Core product fit; competitors are static PDF libraries (esl-brains, teach-this, daves-esl-cafe) with no AI personalization. |
| P1 | english games for english learners | 2,900 | low | `/blog/english-games-for-learners` | High-volume informational; easy ranking; funnels to worksheet generator. |
| P1 | esl games | 2,400 | low | `/blog/esl-games-for-teachers` | Same niche as P1; sibling article. |
| P2 | teach english online | 4,400 | mid | `/blog/teach-english-online-guide` | Commercial intent; aligns with teacher persona. |
| P2 | english tutor | 3,600 | mid ($5 CPC) | Tutor landing variant | High CPC = high commercial value. |
| P3 | esl class / english as a second language classes | 3,700 combined | low | `/resources/esl-class-toolkit` | Resource hub anchor. |

## Out of scope (do NOT chase as a new site)

- `esl` (110,000/mo) — too broad, no commercial differentiation.
- `dave's esl cafe` (~70,000/mo) — branded competitor.
- `tefl` / `tesol` (~9,000/mo) — certification queries, not product.

## Implementation notes

- v6.9.17 ships ONLY metadata fixes (PageSeo, FAQPage schema). New landing pages above are deferred to v6.9.18+.
- Before building `/esl-worksheets`, re-check `serp_analysis("esl worksheets")` to confirm KDI 43 is current and identify top 3 competitors.
- Each new content page must register a sitemap entry in `public/sitemap.xml` AND link from `/how-it-works` or `/exercise-types` (internal link equity).