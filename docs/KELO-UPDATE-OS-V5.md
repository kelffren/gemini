# Kelo Update OS V5.1

## Mission

Make Kelo World updates feel near-instant on iPhone without trading away gameplay stability. The updater is not allowed to compete with movement, PvP, rendering, or module activation.

The target behavior for a small deploy is:

`version gate -> exact commit diff -> changed bytes only -> off-main-thread verify -> Safari HTTP cache warm -> READY -> normal reload -> health commit`

## Non-negotiable invariants

1. **No repo-wide tree walk for normal updates.** Use GitHub Compare between installed and deployed commit. A one-file deploy should plan one relevant changed file, not rediscover the whole repository.
2. **No mandatory Service Worker on iPhone.** Safari/iPhone must work with ordinary HTTP cache warming and normal same-origin URLs.
3. **Never execute update JS while staging.** Download and verify bytes only. Runtime evaluation remains owned by the normal boot/module loader.
4. **Verification must stay off the gameplay main thread.** `update-verifier-worker.js` computes Git blob SHA-1 and can parse classic scripts without running them.
5. **Never reload into a mixed CDN version.** Exact changed blobs are compared with GitHub's expected blob SHA. A mismatch emits `kelo:update:consistency-wait` and retries instead of declaring READY.
6. **Never download while gameplay is busy.** Movement/input, combat/PvP, hidden/offline state, manual critical priority, and ModuleLoader inflight work all block staging.
7. **No permanent polling loop.** Gate checks are one rescheduled timeout. Diagnostics are event-driven. No `setInterval`.
8. **The heavy updater is lazy.** `update-gate.js` is the normal post-boot resident. V5.1 wakes only for a new/pending/manual update.
9. **A new build is not installed merely because it downloaded.** `applyUpdate()` creates a pending health transaction. The installed-build pointer advances only after a healthy boot.
10. **Bad builds are quarantined, not repeatedly retried.** After repeated health failure the deployed build is recorded in `kelo.world.updater.blockedBuild.v5` until explicitly cleared or a different build arrives.
11. **Normal play trains the predictive hotset.** The gate observes resources once after boot and when leaving/hiding the page. No extra loop or script request is allowed for learning.
12. **Settings observability stays first-use.** Update Intelligence and Download Center must not add normal boot payload beyond the tiny existing lazy gate.

## Components

### `src/core/update-gate.js`
Tiny resident detector. It checks `version.json`, pauses around gameplay, trains the resource hotset, and hands the detected build to V5.1 through `window.__KELO_UPDATE_HINT__` so the heavy updater does not need to repeat the same version request.

### `src/core/update-system-v5.js`
Owns exact delta planning, changed-resource warming, bounded concurrency, CDN consistency retry, stage state, apply transaction, health commit, quarantine, and metrics.

### `src/core/update-verifier-worker.js`
Worker-only integrity layer. It has no DOM, gameplay, or networking ownership. It computes Git blob SHA-1 from downloaded bytes. Classic scripts referenced by the target index can be parse/compiled with `new Function` but are never invoked.

### Early health recorder in `index.html`
Only exists during a pending-update reload. It begins before external scripts and captures up to 10 `error` / `unhandledrejection` events. V5.1 consumes this evidence before promoting the build to installed.

### `src/core/update-intelligence-ui.js`
First-use Settings diagnostics. It is event-driven and exposes delta size, READY latency, verify count, syntax count, hotset hits, CDN retries, health attempts, build quarantine, and a one-tap JSON diagnostic copy workflow for iPhone.

### `scripts/update-v5-contract-test.mjs`
Executable architecture constitution. CI must fail if someone reintroduces a repo tree walk, mandatory Service Worker registration, permanent intervals, main-thread verification assumptions, old V4 wiring, or removes the health/predictive contracts.

## Storage keys

- `kelo.world.updater.installedBuild.v1` — currently committed healthy build.
- `kelo.world.updater.lastGoodBuild.v5` — most recent build that passed health commit.
- `kelo.world.updater.stage.v5` — short-lived READY metadata.
- `kelo.world.updater.pendingBuild.v5` — build currently undergoing post-reload health validation.
- `kelo.world.updater.blockedBuild.v5` — quarantined build.
- `kelo.world.updater.hotset.v1` — learned resource frequency/recency set.
- `kelo.world.updater.compare.v5.*` — short-lived commit compare cache in session storage.

## Main events

- `kelo:update:available`
- `kelo:update:staging`
- `kelo:update:delta-plan`
- `kelo:update:staging-progress`
- `kelo:update:consistency-wait`
- `kelo:update:staged`
- `kelo:update:applying`
- `kelo:update:health-committed`
- `kelo:update:health-hold`
- `kelo:update:blocked`
- `kelo:update:staging-error`

Gate events use `kelo:update-gate:*`, including `hotset-learned`.

## Performance interpretation

`timeToReadyMs` is the number that matters most. Break it down with:

- `compareMs` — commit-delta discovery.
- `indexMs` — target index fetch.
- `downloadMs` — changed-resource warmup.
- `verifiedFiles` — resources whose bytes matched exact Git blobs.
- `syntaxChecked` — classic scripts parse/compiled off-main-thread.
- `hotsetHits` — learned resources promoted into the changed-resource plan.
- `consistencyRetries` — times Pages/CDN was detected serving stale/mixed bytes.
- `hintUsed` — whether V5.1 avoided an extra version lookup using the gate handoff.
- `earlyBootErrors` — failures captured before V5.1 itself loaded after apply.

## What this system does NOT promise

- It does not make the physical network literally zero-latency.
- It does not guarantee Safari will retain HTTP cache forever; iOS may evict cached resources.
- It does not perform full byte-level rollback to a prior deployed GitHub Pages build. The health shield prevents promotion and quarantines a bad build. True previous-build serving would require a versioned runtime/snapshot delivery layer.
- It does not execute or gradually compile optional modules in the background. That would violate the anti-freeze architecture.

## Safe future evolution

High-value next steps, in order:

1. Generate a deploy-side compact delta feed so clients do not need GitHub Compare API at all.
2. Add immutable, build-addressed asset URLs for changed resources so Safari cache identity is deterministic.
3. Move large optional modules into versioned bundles with explicit dependency manifests.
4. Add a server-hosted last-known-good snapshot mechanism before calling the system a true rollback engine.
5. Measure p50/p95 `timeToReadyMs`, bytes/update, CDN retries, and health failures across real devices before increasing concurrency or shortening checks.

When changing this architecture, run `node scripts/update-v5-contract-test.mjs` and the boot-budget audit. If an optimization violates one of the invariants above, the optimization is rejected even if it benchmarks faster on one device.
