# Landing Worksheet Generator Hero

## Approved direction

The public homepage must name the searched product category immediately while preserving 1-Minute Prep as the differentiator. The approved H1 is "AI Worksheet Generator & Teaching Toolkit", followed by "Tailored to your 1:1 adult English students". The first screen is aimed at freelance teachers of adults and leads into the existing anonymous worksheet form.

## First-screen contract

- Left column: 1-Minute Prep kicker, explicit H1, adult-focused product description, one lesson-topic input and a primary CTA to the existing form.
- Trust copy emphasizes adult professionals, CEFR alignment, teacher editing and no credit card. The existing anonymous two-worksheet allowance remains unchanged.
- The secondary CTA opens a local Placement Test preview. The retired `/demo` route remains redirected and is not presented as an available action.
- Right column: a visible example worksheet on first render, with optional Placement Test, Homework, Flashcards and 1-Minute Loop film previews. All learner names, levels, scores and study results are explicitly illustrative examples, not testimonials or measured claims.
- The preview does not promise a fixed generation time or automatic teaching decisions.

## Five product previews and card actions

- Worksheet shows an adult B2/C1 business lesson with an illustrative audio track, vocabulary prompt and speaking roleplay. `Generate Worksheet on this Topic` passes `Cross-Cultural Negotiations in Tech` through the existing topic-prefill callback; it never starts generation.
- Placement Test shows Marta's explicitly illustrative B2 report, skill bars and suggested goals. `Send Placement to Student` opens `/dashboard?action=add-student`, whose existing teacher-auth redirect preserves the action for signed-out visitors. `Preview Placement Test` opens the existing local sample dialog.
- Homework is separate from Flashcards and shows a student voice answer, AI-assisted evaluation and teacher verification. Its CTA opens `/features/homework`.
- Flashcards shows `follow up`, pronunciation, an optional locally revealed definition/example and illustrative SM-2 progress. Revealing the card changes only component state and saves nothing. Its CTA opens `/features/flashcards`.
- 1-Minute Loop retains the explicit-play sandboxed Teacher Film and adds a direct link to `/one-minute-prep#interactive-tour`.
- All five panels share minimum heights at mobile and desktop widths so changing tabs does not move the worksheet form. Every CTA uses the existing public or authenticated route contract; no learner record, test, homework, flashcard set or generation job is created by a preview.

## Placement preview boundary

The overview covers language skills and learner context. "Try Placement Test as Student" opens four real questions (`wt_q3`, `wt_q22`, `wt_q17`, `wt_q16s`) in local component state. No test/student is created, no answers or events are saved, no AI evaluation runs, no CEFR is inferred and no microphone access is requested. The final speaking task is a prompt-only sample. Back preserves local choices; closing clears them. Signup uses the existing `/signup` path with the existing return-location state.

The earlier plan's 49-question and 15–20-minute claims are not reproduced: current banks and adaptive paths differ. The sample is explicitly short and not an adaptive/full assessment. Homework mistake-to-flashcard conversion remains qualified as beta; no automatic conversion claim is introduced.

## Teacher Film v3

- The original user upload is preserved. A source adaptation lives in `public/embeds/teacher-film-v3.html`, outside root indexable SEO pages, with `noindex,follow` and a restrictive CSP forbidding connections, forms and external resources.
- `TeacherFilmPlayer` mounts no iframe before explicit Play. The 4:3 frame stays fixed; switching tabs unmounts the film and stops work. No parent message bridge, storage access, forms, popups or same-origin capability is granted.
- The authored tour is 110 seconds, not the 60 seconds mistakenly assumed in the earlier plan. It is identified as an illustrative tour. Sample generation timings/source counts are not presented as guarantees.
- Play/pause, restart, keyboard seeking and fullscreen remain available. Controls retain touch-friendly dimensions outside the scaled scene. Reduced motion shows static chapter stills with no continuous render loop; the Play control advances a chapter. Offscreen and hidden pages suspend rendering; the tour stops at the end.
- A static poster is derived from the supplied film and stored through the app asset flow. The full-size player is inserted below the existing `/one-minute-prep` heading. Other page content, calculator, metadata and workflows remain unchanged.

## Topic handoff

Submitting the hero form trims the topic, caps it at 200 characters and emits `worksheet:heroTopicPrefill`. The mounted worksheet form updates only `lessonTopic`. It does not submit, call generation, consume tokens or change the protected Worksheet Generation Engine. The page then scrolls to and focuses the existing topic field so the teacher can review all options.

## Out of scope

- No changes to `generateWorksheet`, prompt wording, exercise selection, generation parameters or saved worksheet contracts.
- No changes to canonical URLs, public generated resources, pricing logic or the pricing calculator.
- No changes to registered-user generation, worksheet claim flow or post-generation views.
- Sublanding architecture remains deferred. No migrations, permissions, prompts or model changes.

## Verification

- 33 targeted Vitest tests passed across six suites: topic normalization/cap, malformed events, genuine preview-question selection, preview scoring-field exclusion, explicit-play iframe isolation, local-answer reset on close, the existing test flow, form safety and no-em-dash coverage.
- Playwright passed on desktop 1212x889 and mobile 390x844: all four tabs, no iframe request before Play, moving playback, pause, restart, keyboard seeking, full-size tour, local question selection/back/writing/speaking sample/completion, close/reopen reset, signup navigation and exact topic handoff/focus without generation or student-test requests. Existing tracking and subscription-check requests were not misclassified as student writes.
- Additional 360x800, 768x1024 and 1920x1080 layout checks passed with zero horizontal overflow. Switching among all panels moves the following form by exactly zero pixels at all five tested widths. Mobile uses a two-by-two tab layout. The first viewport retains a hint of subsequent content.
- Fullscreen playback passed. Reduced-motion playback remains still until an explicit chapter action, with no continuous rendering. Screenshots were inspected for desktop/mobile home, film, modal, full-size tour and fullscreen framing; page errors: zero.
- `seo:audit` and the automatic preview build passed. An independent source review found no blockers. All 107 protected engine and llms hashes remained unchanged.
- No full live placement test, AI evaluation, paid generation or authenticated learner workflow was run: these existing contracts were not changed. Public browser checks certify the preview paths only, not production teaching/evaluation outcomes. No publication was performed.
- `/demo` remains disabled; no demo behavior was re-enabled. The earlier 60-second film, fixed question count and sample-level claims were corrected against the actual source rather than implemented as unsupported promises.
