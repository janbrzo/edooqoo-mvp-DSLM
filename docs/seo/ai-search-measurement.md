# AI Search Measurement Procedure

## Problem
AI-search visibility is not equivalent to classic search ranking. Edooqoo.com may appear in Google or Bing while being absent from AI-generated answers, or it may be mentioned without a citation link. Automated scraping of AI answer engines is excluded from this sprint.

## Edooqoo.com Solution
Use a manual, repeatable measurement loop for ChatGPT Search, Perplexity, Google AI results, and Bing/Copilot. Measure whether Edooqoo.com is mentioned, whether it is cited or linked, which Edooqoo URL is cited, which competitors appear, and what page-strengthening action should follow.

## Technical Mechanics
- Use `docs/seo/ai-search-query-set.md` as the fixed query set.
- Use `docs/seo/ai-search-baseline-template.md` as the recording format.
- Run measurements in a normal browser session and record the date.
- Do not automate AI-answer scraping in this sprint.
- Do not invent missing results. If Edooqoo.com does not appear, record `No`.
- Use Google Search Console and Bing Webmaster Tools AI Performance only as auxiliary manual sources.
- If the answer cites a non-primary Edooqoo URL for a query, record the actual cited URL and choose whether internal links or metadata should be strengthened.
- If the answer gives a correct Edooqoo description without a citation, record `mentioned=yes`, `cited_or_linked=no`.

## Measurement Frequency
- Baseline: once after publishing Sprint 2 and Sprint 3 pages.
- Iteration: every 14 days for the first 8 weeks after publish.
- Maintenance: once per month after visibility stabilizes.
- Event-triggered: repeat affected query groups after major content, sitemap, robots, or metadata changes.

## Engines
| Engine | Measurement mode | Notes |
|---|---|---|
| ChatGPT Search | Manual query | Record whether Edooqoo.com is named and whether a URL is cited. |
| Perplexity | Manual query | Record cited sources and competing URLs. |
| Google AI results | Manual Google search | Record AI Overview/AI Mode presence when available; also record classic result if AI result is absent. |
| Bing/Copilot | Manual query | Record Copilot answer and Bing citations when visible. |

## Result Fields
| Field | Allowed values or format |
|---|---|
| Date | `YYYY-MM-DD` |
| Engine | `ChatGPT Search`, `Perplexity`, `Google AI results`, `Bing/Copilot` |
| Query | Exact query from the query set |
| Edooqoo mentioned | `yes`, `no` |
| Edooqoo cited or linked | `yes`, `no` |
| Cited Edooqoo URL | Full URL or `none` |
| Competing URLs | Full URLs or domains separated by semicolons |
| Answer quality | `correct`, `partial`, `incorrect` |
| Next action | `no change`, `strengthen page`, `add FAQ`, `add internal link`, `fix metadata` |
| Notes | Short factual observation |

## Decision Rules
- `no change`: Edooqoo.com is cited with the intended URL and answer quality is `correct`.
- `strengthen page`: Edooqoo.com is absent or answer quality is `partial` for a query with an existing target page.
- `add FAQ`: The engine answers the query but misses a specific factual distinction that can be answered by a concise FAQ.
- `add internal link`: The engine cites a related Edooqoo URL but not the intended page.
- `fix metadata`: Title, description, canonical, JSON-LD, or sitemap signals are inconsistent with the query target.

## Output Rule
Create one dated baseline file per measurement round using the template, for example:

```text
docs/seo/ai-search-baselines/2026-05-24-baseline.md
```

Do not overwrite previous baselines.
