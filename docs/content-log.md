# Public Content and Evidence Ownership Log

## Rules

- Generated files are changed through their owning generator.
- Canonical aliases remain accessible but use `noindex,follow` and are excluded from sitemap generation.
- Public claims must be visible, code-verifiable, and consistent across HTML, JSON-LD, sitemap, knowledge graph, and LLM files.
- `BETA`, `ROADMAP`, private app routes, and Worksheet Generation Engine internals are not public citation targets.

## URL Ownership

| Public URL or asset | Owner/generator | Canonical | Index policy | Last changed | Purpose |
|---|---|---|---|---|---|
| `/one-minute-prep-for-english-tutors.html` | `scripts/seo/generate-citable-pages.mjs` | Self | Index | 2026-06-13 | Evidence-first recurring prep citation page |
| `/english-placement-test-for-private-tutors.html` | `scripts/seo/generate-citable-pages.mjs` | Self | Index | 2026-06-13 | Teacher-issued Welcome Test citation page |
| Other top-level citation `.html` pages | `scripts/seo/generate-citable-pages.mjs` | Self | Index | 2026-06-13 | Generator, workflow, comparison, and proof evidence |
| `/resources.html` | Static compatibility alias | `/resources` | `noindex,follow` | 2026-06-13 | Legacy accessible alias |
| `/glossary.html` | Static compatibility alias | `/glossary` | `noindex,follow` | 2026-06-13 | Legacy accessible alias |
| `/how-it-works.html` | Static compatibility alias | `/how-it-works` | `noindex,follow` | 2026-06-13 | Legacy accessible alias |
| `/exercise-types.html` | Static compatibility alias | `/exercise-types` | `noindex,follow` | 2026-06-13 | Legacy accessible alias |
| `/sitemap.xml` | `public/sitemap.xml` plus `scripts/seo/build-blog-index.mjs` | N/A | Crawl discovery | 2026-06-13 | Sole committed sitemap source |
| Sitemap Edge payload | `scripts/seo/sync-sitemap-edge.mjs` | Mirrors `/sitemap.xml` | `X-Robots-Tag: noindex` | 2026-06-13 | XML response payload for Edge Function |
| `/llms.txt`, root `llms.txt` | `scripts/seo/generate-ai-resources.mjs` | N/A | Public AI discovery | 2026-06-13 | Production-only routing index |
| `/llms-full.txt` | `scripts/seo/generate-ai-resources.mjs` | N/A | Public AI discovery | 2026-06-13 | Expanded RAG context |
| `/llms-answers.txt` | `scripts/seo/generate-ai-resources.mjs` | N/A | Public AI discovery | 2026-06-13 | Direct agent answers |
| `/knowledge-graph.json` | `scripts/seo/generate-ai-resources.mjs` | N/A | Public structured discovery | 2026-06-13 | Product, citation, feature, and tool graph |
| `/openapi.yaml` | `scripts/seo/generate-ai-resources.mjs` | N/A | Public informational API description | 2026-06-13 | Discovery resources only; no generation API |
| `docs/source-of-truth-manifest.json` | `scripts/docs/generate-source-of-truth-manifest.mjs` | N/A | Internal documentation | 2026-06-13 | Code inventory and source-of-truth audit |
| `docs/seo/monthly-measurement-pack.md` | Human measurement operations | N/A | Internal documentation | 2026-06-13 | GSC, indexation, backlink, and AI citation cohorts |

## Change Procedure

1. Change the owning generator or source file.
2. Run the documented generation chain.
3. Verify deterministic regeneration with `git diff --exit-code`.
4. Run source audit, TypeScript, production build, SEO build, and SEO audit.
5. Record only verified measurement or outreach outcomes; leave unavailable values explicit.

## Manual Backlink Operations

The monthly operating target is 5-10 relevant outreach contacts, not 5-10 claimed backlinks. Prioritize independent ESL tutor directories, adult-learning newsletters, ELT communities, EdTech directories, and private-tutor business communities. Use a specific evidence asset and record a backlink only after a live referring URL is verified.
