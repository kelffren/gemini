# World Forensic Autopsy

## Purpose

World Forensic Autopsy turns a vague regression such as **"World froze"** into a reproducible boundary:

`LAST GOOD -> FIRST BAD -> changed files -> risky side effects -> likely fix candidates`

It automates the forensic procedure used to isolate the historical World Editor regression where `ea14e48426ac20aff44da009f0d615d8562cf7cd` was GOOD and `c13cceafecd4edc9144a99a108eb2851f88a7541` was the first BAD boundary for `WORLD_MOUNT`.

This system does **not** automatically modify production. It only checks out historical commits inside CI, runs probes, and uploads evidence.

## Mental model

There are two complementary diagnostic layers.

### Layer A — Runtime Surgery

Runs inside the current build.

- records `START module`
- records `DONE module`
- writes heartbeat every ~400 ms
- persists last started/completed module
- can disable modules with kill switches
- can run module Auto Bisect

This answers:

> Which subsystem was executing when this build died?

### Layer B — Git Forensic Autopsy

Runs against repository history.

- receives a known GOOD SHA and BAD SHA
- validates both endpoints
- walks the ancestry using binary search
- executes the same deterministic probe at every candidate SHA
- finds the first BAD commit
- re-tests the parent and first BAD multiple times
- diffs only that boundary
- scores risky side effects added by that commit
- searches later commits touching the same files for likely fixes

This answers:

> Which historical code change introduced the regression?

Together they create a two-dimensional diagnosis:

`runtime module suspect + historical first-bad commit`.

## Historical procedure being automated

The original forensic investigation deliberately separated four roles:

1. **Cartographer** — commit graph, SHAs, ancestry, diffs.
2. **Interpreter** — execution path and boot/mount phases.
3. **Devil's Advocate** — tries to disprove the current hypothesis.
4. **Reporter** — records evidence and a reproducible experiment.

The automated implementation preserves those responsibilities as phases instead of pretending one test proves everything.

## Phases

### 0. Inputs

Required:

- `GOOD_SHA`
- `BAD_SHA`
- probe mode

Probe modes:

- `BOOT` — page reaches a responsive boot state.
- `WORLD_MOUNT` — Creator Hub opens and `#kelo-studio-live` mounts and remains responsive.
- `CUSTOM` — caller supplies a shell command as the probe.

### 1. Endpoint validation

Before bisecting:

- GOOD must pass.
- BAD must fail.
- GOOD must be an ancestor of BAD.

If those assumptions are false, the run stops. We do not manufacture a boundary from invalid endpoints.

### 2. Binary search over hashes

The engine obtains the ordered ancestry path from GOOD to BAD and tests the midpoint.

- PASS -> move toward BAD.
- FAIL -> move toward GOOD.

Continue until one candidate remains.

This is equivalent to the manual hash-by-hash forensic process but requires approximately `log2(N)` probes rather than testing every commit.

### 3. Boundary revalidation

The alleged boundary is never accepted immediately.

The engine re-runs:

- parent of FIRST_BAD: must repeatedly PASS.
- FIRST_BAD: must repeatedly FAIL.

Default: 2 repetitions each.

If the boundary is flaky, the report says **FLAKY / UNCONFIRMED**, not FIRST BAD CONFIRMED.

### 4. Failure-layer separation

A UI-level failure can be a secondary boundary rather than the original freeze.

When investigating boot regressions, prefer this sequence:

1. `BOOT`
2. `WORLD_MOUNT`
3. richer placement/functional probes

A commit that merely hides an Assets row is not automatically the first boot regression.

### 5. Diff autopsy

For `PARENT -> FIRST_BAD`, collect:

- commit message/date
- changed files
- additions/deletions
- zero-context diff
- added side effects

Risk scanner highlights additions such as:

- `MutationObserver`
- global/subtree DOM observation
- `innerHTML` / `outerHTML`
- `replaceChildren`
- `addEventListener`
- intervals/timeouts
- `requestAnimationFrame`
- Workers
- IndexedDB
- `structuredClone`
- dynamic imports
- `cloneNode`
- direct `document.body` mutation
- unbounded loops

A risk hit is a **lead**, not proof of causality.

### 6. Historical-fix search

For every file changed by FIRST_BAD, inspect later commits touching the same file and prioritize commit messages containing terms such as:

`fix, freeze, frozen, hang, storm, observer, loop, boot, mount, safari, iphone, performance, regression`

This is how a later fix such as `fix(studio): stop Paint Copies DOM mutation storm` becomes supporting evidence rather than coincidence.

### 7. Evidence package

Every run produces:

- `report.json`
- `REPORT.md`
- tested SHA sequence
- endpoint results
- boundary revalidation results
- changed-file inventory
- risky-side-effect findings
- probable later fix candidates

## Example: historical Paint Copies regression

Known historical evidence:

- GOOD: `ea14e48426ac20aff44da009f0d615d8562cf7cd`
- FIRST BAD: `c13cceafecd4edc9144a99a108eb2851f88a7541`
- first-bad message: `studio: make paint copies interactive`
- changed runtime area: Paint Copies
- high-risk side effect: broad `MutationObserver` plus DOM writes
- later related fix: `51bd0453876296e1548b70e38f89338bfdb05f9a`
- fix message: `fix(studio): stop Paint Copies DOM mutation storm`

The purpose of this example is to test the forensic engine against a regression whose answer is already known.

## Automatic regression watch

Once the workflows live on the default branch, `World Forensic Regression Watch` can observe selected World gates.

When a monitored workflow changes from a previous SUCCESS to a new FAILURE:

1. failing run SHA becomes BAD.
2. most recent earlier successful run on the same branch becomes GOOD.
3. the watch dispatches `World Forensic Autopsy` automatically.
4. the generated report is uploaded as a workflow artifact.

No production code is reverted or modified.

## Safety rules

- Never force-push during forensic analysis.
- Never mutate historical archive branches.
- Never automatically merge a suspected fix.
- Never call a commit FIRST BAD unless parent GOOD / child BAD is reproducible.
- A Chromium result is not REAL IPHONE evidence.
- Runtime `SUSPECT` and historical risk scores are diagnostic rankings, not certainty.

## Commands

Manual local/CI invocation:

```bash
FORENSIC_GOOD=<good-sha> \
FORENSIC_BAD=<bad-sha> \
FORENSIC_MODE=WORLD_MOUNT \
node scripts/world-forensic-autopsy.mjs
```

Custom probe:

```bash
FORENSIC_GOOD=<good-sha> \
FORENSIC_BAD=<bad-sha> \
FORENSIC_MODE=CUSTOM \
FORENSIC_PROBE_COMMAND='npm test -- my-regression-test' \
node scripts/world-forensic-autopsy.mjs
```
