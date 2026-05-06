---
name: Particles Landing Background
description: v6.9.8 animated tsparticles bg on anon landing only (250 desktop / 80 mobile, #643cdd nodes, #9d8af5 links)
type: design
---
`src/components/landing/ParticlesBackground.tsx` uses `@tsparticles/react` + `loadSlim`. Mounted in `Index.tsx` AFTER the `isRegisteredUser` early return so authenticated dashboard never gets it. `pointer-events-none` so clicks pass through. Mobile (`<640px`) reduces particle count. **Constraint**: never bring back jQuery `particles.js`. Never enable for authenticated users.
