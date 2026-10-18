# Human-facing SEO content

## Scope

Public instructional and comparison pages serve adult English tutors. Remove visible citation instructions, bot-only FAQs and keyword dumps. Preserve substantive explanations, teacher-review boundaries, useful related links, canonical URLs, indexation policy, valid structured data and factual citation paragraphs.

## Boundaries

- JSON-LD keywords and educational audiences are not visible bot blocks.
- Dedicated llms resources and internal RAG documentation are separate discovery/context surfaces, not human-facing HTML.
- FAQPage and visible FAQs share the same data after removing citation questions.
- This change does not consolidate URLs, change indexation, alter worksheet generation or prove a search-ranking penalty.

## Verification

Focused content-verification tests cover detection in headers, footers and body content, and exclusion of structured-data keywords. Remaining review: full unit suite, SEO and content audits, sitemap/JSON-LD coverage, deterministic regeneration and production checks after publication.