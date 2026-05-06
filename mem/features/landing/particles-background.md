---
name: Particles Landing Background
description: v6.9.8 animated tsparticles bg on anon landing + opt-in pattern for authenticated shell (default 'particles')
type: design
---
`src/components/landing/ParticlesBackground.tsx` uses `@tsparticles/react` + `loadSlim` (250 desktop / 80 mobile particles, color `#643cdd`, links `#9d8af5`). Mounted in two places:
1. `Index.tsx` (anonymous landing) — always on, sits at `fixed inset-0 -z-10 pointer-events-none`. Landing sections use translucent backgrounds (`bg-background/50-60 backdrop-blur-sm`) so particles remain visible behind every section.
2. `AuthenticatedPageShell` — rendered when `localStorage.edooqoo-bg-pattern === 'particles'` (the new default). Switching patterns via `BackgroundPatternSwitcher` dispatches `edooqoo-bg-pattern-changed` so the shell mounts/unmounts the canvas live.

`BackgroundPatternSwitcher` lists Particles first; CSS `[data-pattern="particles"]` suppresses the decorative `::after` pattern layer. **Constraint**: never bring back jQuery `particles.js`.
