# Landing Worksheet Generator Hero

## Approved direction

The public homepage must name the searched product category immediately while preserving 1-Minute Prep as the differentiator. The H1 is "AI Worksheet Generator for 1:1 English Teachers". The first screen is aimed at freelance teachers of adults and leads into the existing anonymous worksheet form.

## First-screen contract

- Left column: 1-Minute Prep badge, explicit H1, adult-focused product description, one lesson-topic input and a primary CTA to the existing form.
- Trust copy is limited to existing product behavior: no signup needed, no credit card and two free worksheets.
- A secondary link opens the existing 1-Minute Prep explanation. The retired `/demo` route remains redirected and is not presented as an available action.
- Right column: a visible example worksheet on first render, with optional Welcome Test and 1-Minute Loop previews. All learner names, levels and results are explicitly examples, not testimonials or measured claims.
- The preview does not promise a fixed generation time or automatic teaching decisions.

## Topic handoff

Submitting the hero form trims the topic, caps it at 200 characters and emits `worksheet:heroTopicPrefill`. The mounted worksheet form updates only `lessonTopic`. It does not submit, call generation, consume tokens or change the protected Worksheet Generation Engine. The page then scrolls to and focuses the existing topic field so the teacher can review all options.

## Out of scope

- No changes to `generateWorksheet`, prompt wording, exercise selection, generation parameters or saved worksheet contracts.
- No changes to canonical URLs, public generated resources, pricing logic or the pricing calculator.
- No changes to registered-user generation, worksheet claim flow or post-generation views.

## Verification

- Unit coverage passed for topic normalization, the 200-character cap and malformed-event handling.
- Playwright passed on desktop 1280x889 and mobile 390x844: first-render worksheet, all three tabs, exact topic handoff and focus, no `generateWorksheet` request, 1-Minute Prep navigation, zero horizontal overflow and zero console/page errors.
- `seo:audit`, TypeScript, the no-em-dash test and the automatic preview build passed.
- The initially proposed `/demo` action was replaced because the route is intentionally disabled by a hard redirect. No demo behavior was re-enabled.
