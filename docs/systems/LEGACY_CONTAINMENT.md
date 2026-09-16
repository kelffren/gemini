# Legacy Containment

## Purpose

Kelo World is migrating from broad legacy engines toward explicit Foundation owners. This system turns the rule **legacy can only shrink** into an automated architecture fitness function.

It does not rewrite `engine-a.js` or `engine-c.js`. It prevents new responsibility from being accumulated there while existing behavior is migrated incrementally through validated owners.

## Owner

- Contract owner: **Kelo Legacy Containment**
- Auditor: `scripts/legacy-containment-audit.mjs`
- Protected legacy targets: `engine-a.js`, `engine-c.js`
- CI integration: `.github/workflows/main-stability-gate.yml`
- Runtime ownership: **none**. This is build/QA infrastructure and is never loaded by the game.

## Invariant

For every candidate relative to the exact base commit being integrated:

```text
legacy metric after <= legacy metric before
```

The rule is monotonic. Once a metric decreases on `main`, the smaller value becomes the next maximum automatically. There is no manually maintained numeric budget that can become stale.

## Gated metrics

Per protected legacy file the audit measures:

- semantic/executable bytes after removing comments and insignificant whitespace;
- top-level declaration count;
- explicit writes through `window.*`, `globalThis.*` or `root.*`;
- writes/mutations to critical legacy authority roots such as player state, camera, `STATE`, `CONFIG`, `obstacles` and core loop functions;
- event listeners;
- `setInterval` and `setTimeout` calls;
- `requestAnimationFrame` calls;
- `localStorage.setItem` writes;
- DOM mutation primitives.

Comments and formatting may grow without consuming executable legacy budget.

In addition to numeric non-growth, introducing a new explicit global writer name or a new critical authority key/mutator is an immediate failure even if another writer is removed in the same change. Examples explicitly covered include nested `STATE.*`/`CONFIG.*` writes, `STATE.*.push(...)`, and direct `obstacles.push(...)` mutation.

## Base selection

The comparison source is deliberately derived from the code GitHub actually tests:

- pull request: `HEAD^1`, the first parent of GitHub's synthetic PR merge commit. This remains exact even when `main` advances after the PR event payload was created;
- push to `main`: previous `main` SHA supplied through `KELO_LEGACY_BASE_SHA` from the push event;
- explicit diagnostic/local run: `--base=<sha>` overrides automatic selection;
- final local fallback: parent commit (`HEAD^`).

The auditor reads the previous version directly from Git history using `git show`; it never needs to mutate the working tree. The JSON evidence records both `base` and `baseSource`.

## Flow

```text
branch candidate
  -> resolve exact tested base
  -> inspect engine-a.js / engine-c.js
  -> inspect same files at exact base SHA
  -> compute deterministic metrics
  -> compare monotonically
  -> write artifacts/legacy-containment/report.json
  -> PASS: same or smaller legacy surface
     FAIL: any protected dimension grew
```

## Failure policy

A failing containment audit means the change must not be integrated as normal production work.

Preferred fixes, in order:

1. move the new behavior into the correct modern owner;
2. reuse an existing owner/primitive;
3. remove equivalent legacy responsibility so the legacy surface still decreases;
4. for a genuine incident, follow the repository incident-recovery path and then migrate the emergency code back out of legacy immediately.

There is intentionally no hidden allow-list or `skipLegacyGate` flag in the auditor.

## Migration strategy

Use incremental strangler/branch-by-abstraction behavior:

```text
CHARACTERIZE -> IDENTIFY OWNER -> ADD/EXTEND OWNER -> MIGRATE CONSUMERS
-> VERIFY -> REDUCE LEGACY -> RETIRE ADAPTER WHEN CONSUMERS = 0
```

Do not rewrite `engine-a.js` wholesale. The containment gate makes every successful extraction permanent by preventing a later PR from silently re-inflating the legacy surface.

## Evidence

The Main Stability Gate uploads `artifacts/legacy-containment/report.json` with the rest of its evidence. The report includes base/head SHAs, base-selection source, before/after metrics, deltas, newly introduced authority names and all violations.

## Online-first

This system does not decide gameplay authority. Its role is architectural: it prevents new client-global authority from accumulating in legacy while gameplay/economy state moves toward explicit owners and eventual server-authoritative boundaries.

## Tests / acceptance

A valid implementation must prove:

- unchanged legacy files pass with zero deltas;
- deleting executable legacy code passes and establishes a lower future ceiling;
- adding executable legacy code fails;
- adding a new explicit global writer fails;
- adding a new critical writer fails;
- nested state/config and direct obstacle mutations fail;
- comments/formatting alone do not consume executable budget;
- PR comparison uses the actual synthetic merge commit's first parent;
- the contract runs inside Main Stability Gate before user-visible browser smoke.

## Remaining debt

Containment is not completion. `engine-a.js` remains broad and must be reduced incrementally. The gate prevents regression while later phases extract persistence, movement/base physics and any remaining authority into documented owners.
