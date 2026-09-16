# IMP-2026-09-16 — Creator Appearance Authoring 010

## Status

`IMPLEMENTED_PENDING_VERIFY`

Branch: `creator-appearance-authoring-v2`

Pull request: `#339`

Stack base: `pvp-visual-presentation-bridge-v1` / PR #308.

## User continuation intent

After runtime-contract WYSIWYG authoring, continue the same pass with a **Character Test Chamber** that can visually exercise `idle / walk / run / attack / hit / death` before publication. It must reuse actual Kelo Character visual semantics, remain temporary/non-destructive, stay mobile-first, and never become a second gameplay/animation authority. Every material decision must remain documented for cross-agent continuation.

## Why this pass exists

The existing Appearance Creator had a schematic gold-box preview. Runtime Creator character presentation separately rebuilt its own `sheet` / `socket` descriptor inside `creator-character-state-bridge.js`. That meant authoring and live rendering could drift.

The required invariant remains:

> Character Creator authoring and Character runtime compile one shared visual descriptor. The Test Chamber may drive that descriptor with isolated visual motion inputs, but no second renderer or gameplay state machine is allowed.

A static descriptor preview also could not expose foot-anchor/frame problems while a spritesheet changes frame. The Test Chamber adds that missing pre-publication visual check.

A continuation review found one additional drift risk: LIVE Character rendering and the Test Chamber both understood `_visualMotion.face/frame`, but they normalized those values separately. The Chamber also defaulted a missing `characterVisual.columns` to **1** while the runtime visual contract defaults a sheet to **4 columns**. That could make an otherwise valid 4-frame sheet look static in Test Chamber. This continuation removes that mismatch.

## Implemented

### Shared pure contract

`src/characters/creator-character-visual-contract.js` owns pure descriptor compilation/validation and now also the canonical authoring/runtime-compatible visual-motion sample normalization:

- row → runtime payload;
- auto sheet/socket inference;
- sheet/socket/weapon descriptor normalization;
- four-face transforms;
- anchors/layer/grid/height scale;
- stable diagnostic fingerprint;
- validation warnings/errors;
- `normalizeFace(value, fallback)`;
- `normalizeFrame(value, columns)`;
- `resolveMotionSample({actor, visual, columns, fallbackFace, fallbackState})`;
- `frameColumns(row)` with the same default of 4 columns used by the sheet contract.

The contract still owns no rendering, animation loop, gameplay transition, entitlement, persistence or networking.

### Runtime bridge refactor

`src/characters/creator-character-state-bridge.js` no longer keeps private copies of:

- `inferredSheet()`;
- `rawSheet()`;
- `rawSocket()`;
- directional offset compilation.

It calls `KeloCreatorCharacterVisualContract.validate()` + `buildDescriptor()` for both local and remote Creator Character presentation.

### Loader order

`src/core/feature-registry.js` loads the shared visual contract before `character-visual-presets`, CharacterCustomization and CreatorCharacterBridge inside the lazy `appearance` feature.

Normal boot remains light; nothing moved into eager `index.html` boot.

### Authoring preview

`src/creators/appearance/creator-appearance-preview.mjs`:

- uses the same compiled descriptor;
- uses runtime anchors when available;
- uses the same sheet/socket geometry formulas as CharacterCustomization;
- remains persistence-free and owns no RAF/game loop;
- accepts explicit visual `motion` + `frame`;
- routes face/frame normalization through `KeloCreatorCharacterVisualContract.resolveMotionSample()`;
- uses `frameColumns(row)` instead of maintaining a second grid default;
- sheet rendering honors explicit `_visualMotion.frame` with the same modulo behavior used by the live Character appearance renderer.

Preview files remain object URLs only. They never become authoritative published sources and are revoked when replaced/closed.

### Character Test Chamber

New: `src/creators/appearance/creator-character-test-chamber.mjs`.

Whitelisted visual states:

- `idle`
- `walk`
- `run`
- `attack`
- `hit`
- `death`

It consumes the existing `Appearance.animationMapping[motion]` convention already used by `KeloAppearance.resolveLoadout()`.

Supported mapped-track values:

- `frames` / `frame`;
- `frameMs`, `speedMs` or `ms`;
- `loop`.

Fallback policy is deterministic rather than fabricated:

- walk = declared/runtime-default columns as generic runtime stride;
- run = same columns at a faster preview cadence;
- missing idle/attack/hit/death = frame 0 and clearly marked FALLBACK.

The chamber now asks `KeloCreatorCharacterVisualContract.frameColumns(row)` and `resolveMotionSample()` for the canonical visual sample instead of owning private face/frame normalization. Missing columns therefore resolve to **4**, matching the runtime sheet contract.

The chamber owns one `requestAnimationFrame` while playing and invokes the event-driven preview only when the resolved frame changes. `dispose()` cancels it.

### Fresh-draft guarantee

`src/creators/ui/appearance-creator.mjs` obtains the selected row from `session.get(session.selectedId)` each time the preview is rebuilt and passes that exact row into `chamber.configure(...)`. The definition session calls `renderAll()` on change. Therefore edits are not tested against a stale snapshot kept by a previous Test Chamber instance; rebuilding disposes the previous Chamber/preview and creates the next one from current session state.

### Mobile Test Chamber UI

`src/creators/ui/appearance-creator.mjs` exposes touch controls for:

- IDLE
- WALK
- RUN
- ATTACK
- HIT
- DEATH

The preview diagnostic reports:

- current state;
- frame;
- MAPPED vs FALLBACK;
- mapping source;
- frame cadence;
- loop vs one-shot;
- runtime descriptor validity/fingerprint.

Changing direction rebuilds the isolated preview with the same current visual state. Closing the editor disposes both chamber and preview before revoking object URLs.

### Runtime safety boundary

The Test Chamber creates no world actor and never mutates `localPlayer` or remote actors. It does not write:

- HP/health/damage;
- inventory/equipment authority;
- collision;
- world position;
- AI;
- PvP state;
- networking;
- persistent storage.

`attack / hit / death` are visual authoring labels only. Gameplay transition authority remains outside Creator.

## Tests / audit

`scripts/creator-appearance-authoring-audit.mjs` now covers:

- canonical 512×768 4×4 → sheet;
- 64×64 weapon → socket;
- per-face transforms;
- invalid sheet divisibility;
- row→payload preservation;
- deterministic fingerprint;
- exact six Test Chamber states;
- mapped attack frames/timing/one-shot;
- generic walk fallback;
- deterministic death fallback;
- canonical `resolveMotionSample()` face/frame/state normalization;
- default `frameColumns()` = 4;
- live Character renderer explicit-frame modulo support;
- Test Chamber and preview consume shared motion helpers;
- Test Chamber receives the selected current draft and rebuilds on session changes;
- Test Chamber UI wiring;
- base preview/editor remain RAF-free;
- Test Chamber owns RAF + cancellation and contains no polling/persistence/live-actor references.

### Evidence already available from the earlier part of this pass

The shared contract and original static preview were materialized into the available execution container and passed `node --check`. Pure contract assertions passed before the Test Chamber continuation:

```text
PASS pure authoring contract {
  version: creator-character-visual-contract-v2.0.0,
  sheet: sheet,
  weapon: socket,
  fingerprint: cv2:038203f0
}
```

This evidence predates the Test Chamber and the `v2.1.0-motion-sample` contract change. **No Node/browser/iPhone/LIVE validation of the current Test Chamber continuation is claimed yet.**

A GitHub workflow lookup during this continuation found no `.github/workflows` directory on this branch, so no GitHub Actions CI result exists to substitute for those gates.

## Architecture decisions

- Do not implement a second Character renderer for preview.
- Do not implement a second combat/animation state machine in Creator.
- Canonicalize Creator visual `face/frame/state` through the shared pure visual contract instead of a Test Chamber-only helper.
- Keep the live Character renderer's explicit-frame semantic as the compatibility target; do not move gameplay motion ownership into Creator.
- Reuse `Appearance.animationMapping[motion]` rather than inventing a parallel track schema.
- Do not make a local preview file network authority.
- Do not attach cosmetic stats/gameplay fields to authoring.
- Do not copy editor transforms into a separate runtime schema.
- Keep the base preview event-driven; Test Chamber is the single owner of one cancellable RAF.
- Do not eagerly preload Appearance during normal game boot.
- Keep Mount preview explicitly separate until Mount runtime parity is implemented against its actual owner.

## Relationship to preceding passes

Social replication is owned by Creator Modular Appearance Replication (#301 stack).

PvP presentation delta is owned by PR #308.

This pass changes neither transport nor gameplay authority:

```text
AUTHORING CONTRACT V2.1
        ↓
shared face/frame/state visual sample
        ↓
Test Chamber visual motion (ephemeral only)
        ↓
Creator payload/revision
        ↓
review + publication + use authority
        ↓
CreatorCharacterBridge
        ↓
Social presentation / PvP presentation delta
```

## Files/contracts touched by the Test Chamber continuation

- `src/characters/creator-character-visual-contract.js` — shared pure face/frame/state normalization + sheet-column default helper.
- `src/creators/appearance/creator-character-test-chamber.mjs` — isolated playback now consumes the shared helpers.
- `src/creators/appearance/creator-appearance-preview.mjs` — explicit visual motion/frame input now consumes the shared helpers.
- `src/creators/ui/appearance-creator.mjs` — six-state mobile controls + diagnostics + cleanup; current draft is passed on every rebuild.
- `scripts/creator-appearance-authoring-audit.mjs` — descriptor, motion parity, current-draft and lifecycle static gates.
- `docs/systems/CREATOR_APPEARANCE_AUTHORING_CONTRACT.md` — technical boundary.
- this implementation pass — continuation intent/evidence/gates.

## Remaining verification

Before merge/`VALIDATED`:

1. run `node scripts/creator-appearance-authoring-audit.mjs` in a runnable checkout;
2. run existing `audit:appearance`, Character customization and Creator bridge audits;
3. load Appearance Creator on mobile Safari/iPhone;
4. import a real canonical Character sheet and verify all four faces;
5. exercise IDLE/WALK/RUN and verify stride/foot anchor remains visually stable, including a row with omitted `columns` resolving to the runtime default 4;
6. provide a row with authored `animationMapping.attack` and verify one-shot frame order/timing;
7. verify HIT/DEATH without authored mappings visibly report FALLBACK rather than pretending to have gameplay animation;
8. rapidly switch six states + four faces, close/reopen editor, and verify no RAF/input-lock leak;
9. edit the selected definition, apply it, and confirm Chamber immediately uses the new transform/grid without stale state;
10. test weapon socket and back-layer item;
11. publish/equip exact revision and compare authoring preview → own social actor → second account social → second account PvP;
12. confirm no Creator library bulk preload, no second renderer and no normal-game regression;
13. verify Mount behavior was not regressed; Mount WYSIWYG remains unclaimed.

## Next logical pass

After this PR is actually validated, the next focused authoring layer is a **visual Animation Mapping Editor** that writes the existing `animationMapping` contract (frame ranges/order/timing) instead of hardcoding tracks in the Test Chamber. Do not add gameplay attack/hit/death transition authority to Creator.

## Handoff prompt

> Continue PR #339 / branch `creator-appearance-authoring-v2` and this exact pass. Read `docs/systems/CREATOR_APPEARANCE_AUTHORING_CONTRACT.md`, `src/characters/creator-character-visual-contract.js`, `src/characters/character-appearance.js`, `src/creators/appearance/creator-character-test-chamber.mjs`, the preview and Appearance Creator. Preserve one descriptor compiler, canonical face/frame normalization in the shared contract, one existing Character renderer and one isolated cancellable Test Chamber RAF. Do not mutate live actors or add HP/inventory/collision/network/persistence authority. First run the updated audit and existing appearance/bridge gates, then iPhone/LIVE six-state interaction including omitted-columns=4 and fresh-draft edits. Fix failures in this same PR. Keep status `IMPLEMENTED_PENDING_VERIFY` until those gates actually pass. After validation, build an authoring UI for the existing `animationMapping` contract rather than another animation/runtime schema.
