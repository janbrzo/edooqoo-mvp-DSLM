# Generation modal conversion

## Scope

During worksheet generation, reduce duplicate copy and support two outcomes: anonymous signup and signed-in use of the full learning loop. The worksheet engine, generation jobs, database writes and evaluation contracts remain unchanged.

## Presentation

- Left: learner context, progress, background-generation notice, exercise status and Expected time. No workflow summary below Expected time.
- Right: three short slides per audience, real existing product screenshots and one clear next action. No Did you know text or unverified learning statistics.
- Anonymous: Smart Memory / next prep / connected learner record; two benefits per slide. Keep the approved headline "A worksheet is just 10% of 1-minute prep." as promotional framing, not a measured performance claim. Primary signup CTA opens `/signup` in a protected new tab.
- Signed-in: homework / retention / teacher-reviewed next prep; three brief steps per slide. Personalize the first tag with the learner name when available. Open the selected learner's Learning Plan in a protected new tab, using the actual canonical `tab=model&view=pathway` contract rather than the nonexistent `tab=plan`. Without a learner ID, show the ready-to-assign hint.
- Slides rotate every eight seconds, pause on pointer hover or any keyboard focus within the panel, and support arrows, slide dots and explicit pause/resume. Reduced-motion preference disables automatic rotation, while manual navigation remains available.
- Use existing semantic colors and real product previews. Do not present screenshot data as the current learner's evidence or fetch private evidence for promotion.

## Evidence wording

Use evaluated answers, saved mastery, estimated retention and teacher-reviewed suggestions. Do not promise instant mastery updates, automatic worksheet generation, a fixed forgetting threshold after fourteen days, or one-click completion of the entire homework assignment workflow.

## Verification

Twelve executable tests cover the eight-second interval, three-slide wrapping, hover and focus pause, independent pause states, manual navigation, reduced motion, safe audience links, canonical Plan routing, learner changes, timer cleanup, modal job notifications and error/recovery retry handling. Browser verification covers actual anonymous generation, signup opening in a new tab and presentation-only teacher fixtures. Teacher fixtures are not authenticated production-session certification; that check is unavailable for external unmanaged Supabase.