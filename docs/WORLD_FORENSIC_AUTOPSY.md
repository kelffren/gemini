# World Forensic Autopsy

## Purpose

World Forensic Autopsy converts a vague regression such as **"World froze"** into a reproducible chain:

`LAST GOOD -> FIRST BAD -> changed files -> risky side effects -> probable later fix`

It automates the forensic procedure used to isolate the historical World Editor regression where:

- `ea14e48426ac20aff44da009f0d615d8562cf7cd` was the last confirmed GOOD boundary.
- `c13cceafecd4edc9144a99a108eb2851f88a7541` was the first BAD `WORLD_MOUNT` boundary.
- the first BAD commit was `studio: make paint copies interactive`.
- a later related fix was `51bd0453876296e1548b70e38f89338bfdb05f9a` — `fix(studio): stop Paint Copies DOM mutation storm`.

The forensic system does **not** automatically revert, patch, merge, force-push or change Pages.

---

## Ownership — one bisect engine only

Kelo World already has a canonical historical regression engine:

```text
Bug Intelligence / Recovery Mesh
└── scripts/recovery-bisect.mjs
    └── scripts/recovery-profile-runner.mjs
```

`recovery:bisect` is the **single owner** of commit binary search.

`World Forensic Autopsy` does not implement a second bisect. It wraps that owner and adds the forensic work that was previously manual:

1. validate GOOD/BAD assumptions;
2. run the canonical recovery bisect;
3. revalidate parent GOOD / child BAD repeatedly;
4. inspect only the boundary diff;
5. score newly added risky side effects;
6. search later commits touching the same files for likely fixes;
7. produce one evidence package.

---

## Mental map

There are two complementary diagnostic dimensions.

### A. Runtime Surgery — where did this build die?

Inside the current build:

```text
START module
↓
heartbeat
↓
DONE module
```

If Safari dies after START and before DONE, World Surgery preserves the last started module as a runtime suspect.

It can then disable modules or run module-level Auto Bisect.

### B. Historical Forensics — which code change introduced it?

Against Git history:

```text
KNOWN GOOD SHA
      ↓
recovery:bisect
      ↓
FIRST BAD candidate
      ↓
revalidate parent GOOD
revalidate child BAD
      ↓
boundary diff
      ↓
side-effect scanner
      ↓
probable later fixes
```

Together:

```text
runtime suspect
      +
historical first-bad commit
      ↓
small causal search space
```

---

## The original forensic method now encoded

The historical investigation effectively separated four jobs.

### 1. Cartographer

Owns:

- commit graph;
- GOOD/BAD refs;
- ancestry;
- first-bad search;
- exact boundary diff.

Automated owner: `scripts/recovery-bisect.mjs`.

### 2. Interpreter

Owns the meaning of the failing phase.

Available stable Recovery profiles:

- `BOOT` -> `boot`
- `WORLD_MOUNT` -> `world`
- `MOVEMENT` -> `movement`
- `FULL` -> `full`

The same frozen profile runner is used while the checked-out game code changes underneath it.

### 3. Devil's Advocate

The system tries to disprove its own answer.

Before accepting the boundary:

- input GOOD must PASS;
- input BAD must FAIL;
- FIRST BAD parent must repeatedly PASS;
- FIRST BAD must repeatedly FAIL.

Default boundary repetitions: `2`.

If this does not reproduce, the report is **UNCONFIRMED / FLAKY**.

### 4. Reporter

Produces evidence rather than a guess:

- `report.json`
- `REPORT.md`
- canonical Recovery bisect report/log
- revalidation evidence
- changed-file inventory
- side-effect findings
- probable later fix candidates

---

## Why phase selection matters

The forensic investigation taught us that a richer UI test can reveal a **secondary boundary** rather than the original freeze.

Example mental rule:

```text
UI behavior changed
!=
first boot/mount regression
```

Therefore use the smallest profile matching the observed symptom.

For a World Editor freeze, prefer `WORLD_MOUNT` first.

If needed, compare with `BOOT` or `FULL` afterwards to determine whether the regression is global boot, World-only, movement-related or a richer functional failure.

Do not promote a secondary UI boundary to root cause without the narrower probe.

---

## Side-effect scanner

Once FIRST BAD is confirmed, the autopsy only analyzes:

`PARENT -> FIRST_BAD`

Added lines receive diagnostic attention for patterns such as:

- `MutationObserver`
- broad `subtree:true` observation
- `document.body`
- `innerHTML` / `outerHTML`
- `replaceChildren`
- event listeners
- intervals / timeouts
- `requestAnimationFrame`
- Workers
- IndexedDB
- `structuredClone`
- dynamic imports
- `cloneNode`
- unbounded loops

Scores prioritize review. They do **not** prove causality.

The Paint Copies case is the model example: the first-bad diff introduced a broad DOM observation path and DOM writes, while a later commit explicitly referenced stopping a Paint Copies DOM mutation storm.

---

## Historical-fix search

For every file touched by FIRST BAD, the autopsy scans later commits touching that same file and prioritizes messages containing terms such as:

`fix, freeze, frozen, hang, storm, observer, loop, boot, mount, safari, iphone, performance, regression, deadlock, stuck`

A matching later fix is supporting evidence, not independent proof.

---

## Automatic Regression Watch

`World Forensic Regression Watch` observes selected World workflows after this capability reaches the default branch.

When a monitored push workflow changes to FAILURE:

1. current failing SHA becomes BAD;
2. the watch finds the most recent earlier SUCCESS on the same workflow/branch;
3. that SHA becomes GOOD;
4. it dispatches `World Forensic Autopsy`;
5. the autopsy validates the endpoints before trusting them;
6. the report is uploaded as a GitHub Actions artifact.

This means the future default workflow is intended to be:

```text
CI green
↓
new commit
↓
World gate red
↓
Regression Watch
↓
last green SHA + current red SHA
↓
Recovery bisect
↓
confirmed first bad
↓
diff + side effects + later fix candidates
```

No human has to manually try hundreds or thousands of hashes.

---

## Commands

Direct autopsy:

```bash
FORENSIC_GOOD=<good-sha> \
FORENSIC_BAD=<bad-sha> \
FORENSIC_MODE=WORLD_MOUNT \
FORENSIC_REPEAT=2 \
node scripts/world-forensic-autopsy.mjs
```

Canonical lower-level bisect:

```bash
npm run recovery:bisect -- --good=<good-sha> --bad=<bad-sha> --profile=world
```

Supported autopsy modes:

```text
BOOT
WORLD_MOUNT
MOVEMENT
FULL
```

Arbitrary shell probes are intentionally **not** exposed by World Forensic Autopsy. The Recovery Mesh uses allowlisted deterministic profiles so a workflow input cannot execute arbitrary repository commands.

---

## Safety / evidence rules

- Never force-push during forensic analysis.
- Never mutate archived historical branches.
- Never auto-merge a suspected fix.
- Never call a commit FIRST BAD unless the parent PASS / child FAIL boundary reproduces.
- `SKIP` is infrastructure uncertainty, not PASS or FAIL.
- Chromium/iPhone emulation is not REAL IPHONE evidence.
- Runtime `SUSPECT`, risk scores and fix-message matches are diagnostic leads, not causal verdicts.
- The final real-device gate remains Safari on a physical iPhone when the historical symptom was iPhone-specific.
