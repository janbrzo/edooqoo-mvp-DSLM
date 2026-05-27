---
name: Signup Return-To Flow v6.9.27
description: useSignupLinkState centralizes pre-auth context preservation across ~28 signup/login callsites
type: feature
---

## v6.9.27 — Anonymous → authenticated context preservation

- Source of truth: `src/hooks/useSignupLinkState.ts`. Exports `signupTo`, `loginTo`, `signupState` (`{from: pathname+search}`), `goToSignup(to?)`, `goToLogin(to?)`.
- All `<Link to="/signup">` / `<Link to="/login">` MUST pass `state={signupState}` (or equivalent `{from}` object).
- All `navigate('/signup' | '/login')` calls MUST go through `goToSignup` / `goToLogin` (or pass `{ state: { from } }`).
- `Signup.tsx` and `Login.tsx`: when `location.state?.from && from !== '/'`, render visible Back CTA top-left (`<ArrowLeft/> Back`, `variant="ghost"`) that navigates to `from`. After successful auth, redirect to `from` instead of `/dashboard`.
- Covered files: `GlobalFooter`, `StickyNav`, `LoginRequiredModal`, `WelcomeBackBanner`, `FeatureCTA`, `FeatureHero`, `FeaturePageLayout`, `PricingSection`, `Pricing`, `About`, `Blog`, `HowItWorks`, `Resources`, `Prompts`, `Glossary`, `ExerciseTypes`, `WorksheetExpiredPage`, `PublicGalleryWorksheetPage`, `tools/CefrLevelTest`, `tools/LessonPlanGenerator`, `tools/VocabCefrChecker`, `ProgrammaticSeoLayout`, `SeoLandingLayout`.

**Why:** without `state.from`, users lose discovery context after auth and bounce.