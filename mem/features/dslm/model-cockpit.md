---
name: Model Cockpit
description: Learning model tab = cockpit header + 3 perspectives (Roadmap & Goals, Skills & Level, Learner DNA)
type: feature
---
- Learning model tab is a cockpit: always-visible health header + segmented control with 3 perspectives. No sidebar, no single scroll wall — do not reintroduce.
- Roadmap & Goals: main goal highlighted; rarely used goals/notes behind one "More goals & notes" disclosure.
- Skills & Level: heat map first; micro skills and notes collapsed.
- Learner DNA: AI Summary, Psych profile, Learning Patterns open; one Notes stream (no separate Personal Notes); event log is "Advanced", collapsed.
- Model health labels: Calibrating / Learning / Well tuned.
- Mobile (<640 px) perspective buttons use short labels Roadmap / Skills / DNA; full names stay as aria-labels.
- No main goal: cockpit shows "+ Set main goal", which switches to Roadmap & Goals and opens the main goal editor (not the supporting-goal modal).
- Demo mode: all student-knowledge mutations show the demo toast; useWorksheetHistory never leaves loading=true in demo.
