# Retired branches

This repository treats retired branches as historical evidence, not integration sources.

## Policy

- New work starts from current `main` unless a task explicitly requires another active branch.
- A retired branch must never be merged wholesale back into `main`.
- Useful ideas or isolated changes from a retired branch must be re-evaluated against current `main` and reimplemented or selectively rescued on a fresh branch.
- `.github/retired-branches.json` is the machine-readable source of truth.
- `scripts/retired-branch-guard.mjs` enforces the registry in the Main Stability Gate.

## evergreen-migration-2026-09-15

Status: **RETIRED — HISTORICAL EVIDENCE ONLY**

Retired: 2026-09-17

Replacement: `main`

Reason: the branch had diverged heavily from current development. During the convergence audit it was measured at 159 commits ahead and 815 behind `main`, and it still contained stale Legacy/runtime assumptions. Low-risk Evergreen intent was converged through PR #379 instead of merging the historical branch.

Do not reopen this branch as the base for feature work. Do not merge it into `main`. If a useful historical change is found there, create a fresh branch from `main`, revalidate the change against current architecture, and pass the current Main Stability Gate.
