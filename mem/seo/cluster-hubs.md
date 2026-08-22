---
name: Topical Cluster Hubs (Sprint 3)
description: Four hub-and-spoke SEO/GEO hubs, their routes, content source of truth, backlink injector and CI audit
type: feature
---

Sprint 3 (Faza 3, v6.9.97) added four topical cluster hubs:
`/cefr-assessment`, `/teaching-english-pronunciation`, `/esl-exercise-design`, `/tutor-operations`.

Rules:
- Hub content lives ONLY in `src/constants/clusterHubs.ts`; build scripts read the mirror
  `scripts/seo/cluster-hubs.mjs`. Both files must stay in sync (routes, spokes, tool funnel).
- Each hub must keep the `data-citation-block` paragraph (40-60 words, extractable definition for LLMs),
  the decision table, the spoke list, and 3 FAQs. Title <= 60 chars, description <= 155.
- Spoke -> hub backlinks are generated, never hand-written: `npm run seo:inject-cluster-hub-links`
  (idempotent, runs inside `build:seo`). Never edit the `<p data-cluster-hub="...">` block by hand.
- Hub links are part of `workflowLinks` (x1000-editorial-plan.mjs) and `productLinks`
  (generate-citable-pages.mjs); removing them drops hubs below the internal-link top-40 threshold.
- `npm run seo:audit-cluster-hubs` must pass; it is wired into CI and both build:seo scripts.
- After regenerating content, always run `seo:repair-snapshot-snippets` before `audit-duplicate-meta`,
  because generators reintroduce over-length titles/descriptions.
