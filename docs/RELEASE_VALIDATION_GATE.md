# KELO Release Validation Gate

This document defines when a user-facing change may be called fixed, complete, validated, done, or ready.

## Non-negotiable rule

**MERGED is not VERIFIED.**

A user-facing change is not `FIXED`, `DONE`, `VALIDATED`, or `READY` merely because code exists, a PR merged, unit tests passed, or GitHub Pages deployed.

For World / Studio / Creator mobile flows, the minimum release contract is:

`PR candidate -> deterministic CI -> real iPhone flow -> merge -> exact Pages deployment -> real iPhone LIVE flow -> VERIFIED`

Any red, skipped, cancelled, timed-out, missing, or unavailable required verification leaves the change unverified.

## Allowed status vocabulary

Use these states literally when reporting work:

- `CODE COMPLETE` — implementation exists; runtime behavior is not yet proven.
- `PR CANDIDATE` — code is in a PR and waiting for required gates.
- `PR VERIFIED` — required pre-merge real-device gate passed on the exact candidate SHA.
- `MERGED / LIVE UNVERIFIED` — merged or deployed, but the post-deploy LIVE gate has not passed.
- `LIVE VERIFIED` — exact deployed candidate passed the required LIVE real-device flow.
- `LIVE BROKEN` — deployment or required real-device flow failed.

Only `LIVE VERIFIED` may be described to the user as fixed, done, validated, or working for a deployed user-facing bug.

## World / Studio real-iPhone gate

Changes touching the World launch path, Creator Hub, Studio runtime, Studio launcher, or their mobile tests must run `.github/workflows/browserstack-map-forge.yml`.

The gate must prove on a real iPhone Safari session that:

1. Kelo World loads without an HTTP failure.
2. Creator Hub opens.
3. tapping `World` mounts `#kelo-studio-live` within the test timeout.
4. the Creator Hub closes after Studio mounts.
5. a stale/disconnected Studio shell can be reopened.
6. guarded World/Studio runtime errors are absent.
7. screenshot/Playwright evidence is uploaded.

The PR run tests the checked-out candidate through BrowserStack Local. The `main` run waits until the relevant deployed files on GitHub Pages exactly match the checked-out commit, then repeats the real-iPhone test against LIVE.

## Evidence requirement

A completion report for a deployed user-facing fix must identify:

- tested commit SHA;
- release-gate result;
- target (`PR candidate` or `deployed LIVE`);
- real-device/browser used when applicable;
- saved evidence location or workflow run;
- any remaining failed or skipped gate.

If the evidence is unavailable, say `UNVERIFIED`; never infer success from merge state.

## Merge protection

The check name intended for branch protection is:

`KELO RELEASE GATE / World real iPhone`

Repository administrators should configure this check as required for `main`. If branch protection is unavailable or not configured, agents and maintainers must still treat a failed or missing gate as a hard no-merge condition.

## Failure handling

When the post-deploy gate fails:

1. classify the deployed SHA as `LIVE BROKEN`;
2. do not call the original issue fixed;
3. inspect the failing stage and evidence;
4. repair through a new candidate;
5. rerun both candidate and LIVE gates.

Never weaken, skip, delete, or replace the failing real-device assertion merely to make the gate green unless the product contract itself intentionally changed and that change is separately justified and reviewed.
