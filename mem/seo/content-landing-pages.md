---
name: SEO content landing pages pattern
description: 6 landing pages in src/pages/seo/ targeting Semrush priority keywords; SeoLandingLayout is the shared shell.
type: feature
---
- Live pages: /esl-worksheets, /blog/english-games-for-learners, /blog/esl-games-for-teachers, /blog/teach-english-online-guide, /for-english-tutors, /resources/esl-class-toolkit
- Source folder: src/pages/seo/ (one file per page)
- Shared shell: src/components/seo/SeoLandingLayout.tsx — props: seo, h1, lead, problems, solutionHeading, solutions, listHeading, list, body, faqs, ctaTitle, ctaBody
- Each page composes FAQPage JSON-LD automatically via buildFaqPageLd; optional extraJsonLd merged in (CollectionPage / BlogPosting / Service)
- Metadata duplicated in src/constants/seoMeta.ts under matching keys (eslWorksheets, englishGamesForLearners, eslGamesForTeachers, teachEnglishOnlineGuide, forEnglishTutors, eslClassToolkit)
- Routes registered lazy in src/App.tsx; sitemap entries added in public/sitemap.xml
- Footer link entries: ESL Worksheets, For English Tutors (Product column in GlobalFooter)
- New SEO pages MUST add: page file, seoMeta entry, App.tsx lazy + Route, sitemap entry, optional footer/internal link, optional Blog/Resources featured card
- Content rule: andragogical adult-only examples, ≥800 words, 1 H1, 4–6 H2, FAQ accordion + JSON-LD, internal links to /signup /pricing /exercise-types
- Backlog of next keywords in docs/seo/keyword-strategy.md