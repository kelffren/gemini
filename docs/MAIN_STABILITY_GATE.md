# Kelo World — Main Stability Gate

## Purpose

`main` must represent a globally coherent game build, not merely a set of locally passing feature audits.

The canonical GitHub Actions check is:

- workflow: `Main Stability Gate`
- job/check: `main-stability-gate`

It is designed to become a required status check for merges into `main`.

## What it protects

Every pull request targeting `main` must prove, as one integrated chain:

1. repository build succeeds;
2. Foundation ownership contracts still hold;
3. canonical documentation contracts still hold;
4. performance foundation has no contract failure;
5. online foundation remains valid;
6. updater foundation remains valid;
7. Studio foundation remains valid;
8. Paint Copies regression contract remains valid;
9. PvP facing contract remains valid;
10. critical mobile boot/gameplay smoke passes in Playwright.

## Failure policy

A local feature audit passing does not override a failing Main Stability Gate.

When this gate fails:

- do not merge the change as production-ready;
- inspect the failing step and Playwright evidence;
- fix the regression in the feature branch;
- rerun the gate against the latest commit.

## CI reproducibility

Playwright runs in CI with one worker, one retry, a bounded global timeout, `forbidOnly`, and trace capture on the first retry. This keeps resource use deterministic and preserves debugging evidence without recording traces for every successful run.

## Five-year rule

As legacy responsibilities move into modern owners, add their critical invariant to this gate before removing the corresponding legacy fallback. The gate should stay compact and high-signal: broad contract audits plus user-visible critical-path smoke, not every exhaustive test in the repository.
