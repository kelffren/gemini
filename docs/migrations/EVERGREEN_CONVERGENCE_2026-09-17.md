# Evergreen convergence — 2026-09-17

## Source audited

- Legacy Evergreen branch: `evergreen-migration-2026-09-15`
- Fresh convergence branch: `evergreen-convergence-2026-09-17`
- Target: `main`
- Audit snapshot: old Evergreen is **159 commits ahead / 815 commits behind** `main`.
- Merge base observed during audit: `c96b2f929d69765221fc6048a47dbb180e5bf683`.

The 159 historical commits collapse to a much smaller surviving net delta. Because `main` moved hundreds of commits forward, the old branch must not be merged wholesale. Rescue is performed by intent, on top of current `main`.

## RESCUED / ADAPTED

These are low-coupling Evergreen ideas that remain useful on current `main`.

1. `.nvmrc`
   - Old branch value `22` was **not copied** because current `main` CI explicitly runs Node 24.
   - Rescued intent: pin the local/runtime baseline to `24` so local tooling and CI agree.

2. `.github/dependabot.yml`
   - Restored weekly update checks for root npm, server npm, and GitHub Actions.
   - Old branch-only labels were intentionally omitted so the config does not depend on historical label state.

3. `scripts/ci-supply-chain-audit.mjs`
   - Restored as a standalone audit.
   - Detects `permissions: write-all`, missing action refs, and floating action refs instead of immutable commit SHAs.
   - Not wired into the main stability gate in this convergence step; it can be promoted only after the current workflow fleet is clean.

## SUPERSEDED / DO NOT RESCUE

These old Evergreen changes are now represented by newer or stronger contracts in `main`, or encode assumptions that are no longer true.

- `.github/workflows/evergreen-foundation.yml`
  - Superseded by the current `main-stability-gate.yml` plus the newer architecture, legacy-containment, performance, updater, Studio, Guardian and mobile/PvP gates.
- `.nvmrc` with Node 22
  - Superseded by current Node 24 CI policy.
- `ENGINE_MAP.md` and `docs/ARCHITECTURE_CURRENT.md` from the old branch
  - Stale after 815 commits of `main` evolution; never overwrite current architecture docs with these versions.
- `playwright.evergreen.config.js` and `tests/evergreen-webkit-smoke.spec.js`
  - The smoke test asserts historical `KeloPlayerPosition`, `KeloLegacyTransitionBridge`, legacy ability adapters and old module-loading behavior. Those assertions conflict with current convergence direction and the recent property-editor patch away from unsupported `KeloPlayerPosition` queries.
- `scripts/legacy-ability-consumer-audit.mjs`, `scripts/legacy-debt-audit.mjs`, `scripts/legacy-transition-bridge-audit.mjs`
  - Superseded by the current `audit:legacy-containment` contract (`legacy can only shrink`).
- Historical legacy parity tests (`tests/legacy-*` and related first-use tests)
  - Do not revive tests whose purpose is to preserve retired legacy behavior.

## REJECT — WOULD GROW OR REVIVE LEGACY

Do not transplant these runtime files from the old branch onto current `main`:

- `src/core/legacy-ability-aim-system.js`
- `src/core/legacy-transition-bridge.js`

Reason: current `main` has a hardening contract that Legacy may only shrink. Reintroducing new Legacy owners or bridges would move architecture in the wrong direction even if old tests pass.

## HIGH-RISK — MANUAL REIMPLEMENTATION ONLY

These files touch runtime ownership, boot order, gameplay, deployment or dependency state. Their old versions must not be copied/cherry-picked directly after an 815-commit divergence:

- `engine-f.js`, `engine-g.js`, `engine-l.js`, `engine-m.js`
- removal history for `engine-i.js`, `engine-j.js`, `engine-k.js`
- `index.html`
- `src/abilities/kelo-ability-boot.js`
- `src/core/asset-registry.js`
- `src/core/feature-registry.js`
- `src/core/module-loader.js`
- `src/core/state-store-bootstrap.js`
- `src/systems/pvp-combat-runtime-loader.js`
- `sw.js`
- `lite-shell-lab.html`, `zero-boot-lab.html`
- `netlify.toml`, `render.yaml`
- `package-lock.json`, `server/package-lock.json`
- `.github/workflows/dependency-lock.yml`
- `scripts/boot-surface-audit.mjs`
- `scripts/reproducible-build-audit.mjs`
- `scripts/service-worker-cache-audit.mjs`
- `tests/state-store-migration.test.cjs`

For any idea in this bucket, re-state the desired invariant against current `main`, implement it fresh, and require current stability/legacy-containment gates. Do not replay old commits.

## Convergence rule going forward

`evergreen-migration-2026-09-15` is historical evidence, not an integration branch.

All new Evergreen work starts from current `main`. A historical commit is eligible only when its architectural intent is still valid and the implementation is rebuilt or transplanted without reviving Legacy, replacing newer architecture, or weakening current gates.
