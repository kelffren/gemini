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
3. **legacy containment is monotonic: `engine-a.js` and `engine-c.js` cannot gain executable/authority surface**;
4. canonical documentation contracts still hold;
5. performance foundation has no contract failure;
6. online foundation remains valid;
7. Guardian distributed-compute contracts remain valid;
8. updater foundation remains valid;
9. Studio foundation remains valid;
10. Paint Copies regression contract remains valid;
11. PvP facing contract remains valid;
12. critical mobile boot/gameplay smoke passes in Playwright, including the mandatory 8-second sustained-walk freeze firewall.

Legacy-containment evidence is written to `artifacts/legacy-containment/report.json` and uploaded with the gate artifacts. Its technical contract is documented in `docs/systems/LEGACY_CONTAINMENT.md`.

## Failure policy

A local feature audit passing does not override a failing Main Stability Gate.

When this gate fails:

- do not merge the change as production-ready;
- inspect the failing step and Playwright evidence;
- fix the regression in the feature branch;
- rerun the gate against the latest commit.

A legacy-containment failure is not fixed by raising a numeric baseline. Move the new responsibility into its modern owner or reduce equivalent legacy responsibility. The protected ceiling follows `main` automatically and may only stay equal or decrease.

## Base freshness policy

A PASS is valid only for the exact merge candidate that was tested. If `main` advances after the latest successful run, the pull request must trigger and pass the gate again against the new `main` before merge. A previously green check against an older base is not sufficient evidence for production merge.

## CI reproducibility

Playwright runs in CI with one worker, one retry, a bounded global timeout, `forbidOnly`, and trace capture on the first retry. This keeps resource use deterministic and preserves debugging evidence without recording traces for every successful run.

The legacy-containment check receives the exact pull-request base SHA (or previous `main` SHA for push events) and reads the comparison version from Git history. It does not depend on a hand-maintained baseline file.

## Five-year rule

As legacy responsibilities move into modern owners, their ceiling becomes permanently lower. The gate should stay compact and high-signal: broad architecture/authority contracts plus user-visible critical-path smoke, not every exhaustive test in the repository.
