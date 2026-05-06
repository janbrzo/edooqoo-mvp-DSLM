---
name: Welcome Email CTA = Add Student
description: v6.9.8 welcome email primary CTA goes to /dashboard?action=add-student which auto-opens AddStudentDialog
type: feature
---
`send-welcome-email/index.ts` — primary button → `${APP_BASE_URL}/dashboard?action=add-student`. `Dashboard.tsx` handles query param: opens `AddStudentDialog`, strips param via `setSearchParams(..., { replace: true })`. `reply_to: 'edooqoo@gmail.com'` (admin inbox). `from` stays `Edooqoo <hello@edooqoo.com>`. **Why**: Most-impactful first action for new teacher. **How to apply**: any change to onboarding email keeps Add Student as primary CTA.
