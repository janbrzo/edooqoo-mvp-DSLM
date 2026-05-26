# Codex Workflow (EDOOQOO)

This project is also modified via Lovable, which pushes directly to `main`.

## Rule: Always sync before analysis

Before doing any analysis, planning, debugging, or code changes in Codex:

1. `git fetch`
2. Ensure local `main` matches `origin/main` (prefer `git switch main` then `git pull --rebase`).
3. Only then read code, form a plan, and implement changes.

Rationale: avoid basing plans or fixes on a stale local checkout when `main` moves frequently.

## When main changes mid-task

If `main` advances while a task is in progress (Lovable or other source):

1. Sync again to the latest `origin/main`.
2. Re-validate the plan against the new commit SHA.
3. Continue only after reconciling differences/conflicts.

