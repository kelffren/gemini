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

## Implemented

### Shared pure contract

`src/characters/creator-character-visual-contract.js` owns only pure descriptor compilation/validation:

- row → runtime payload;
- auto sheet/socket inference;
- sheet/socket/weapon descriptor normalization;
- four-face transforms;
- anchors/layer/grid/height scale;
- stable diagnostic fingerprint;
- validation warnings/errors.

It owns no rendering, gameplay, entitlement, persistence or networking.

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
- now accepts an explicit visual `motion` + `frame`;
- sheet rendering honors `_visualMotion.frame` with the same modulo behavior used by the live Character appearance renderer.

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

- walk = declared columns as generic runtime stride;
- run = same columns at a faster preview cadence;
- missing idle/attack/hit/death = frame 0 and clearly marked FALLBACK.

The chamber owns one `requestAnimationFrame` while playing and invokes the event-driven preview only when the resolved frame changes. `dispose()` cancels it.

### Mobile Test Chamber UI

`src/creators/ui/appearance-creator.mjs` now adds touch controls for:

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

`scripts/creator-appearance-authoring-audit.mjs` was extended to cover:

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
- live Character renderer explicit-frame support;
- Test Chamber UI wiring;
- base preview/editor remain RAF-free;
- Test Chamber owns RAF + cancellation and contains no polling/persistence/live-actor references.

### Evidence already available from the earlier part of this pass

The shared contract and original static preview were materialized into the available execution container and passed `node --check`. Pure contract assertions passed:

```text
PASS pure authoring contract {
  version: creator-character-visual-contract-v2.0.0,
  sheet: sheet,
  weapon: socket,
  fingerprint: cv2:038203f0
}
```

This evidence predates the Test Chamber extension. **No Node/browser/iPhone/LIVE validation of the new Test Chamber is claimed yet.**

## Architecture decisions

- Do not implement a second Character renderer for preview.
- Do not implement a second combat/animation state machine in Creator.
- Reuse explicit `_visualMotion.frame` semantics from the Character renderer only on an isolated authoring actor.
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
AUTHORING CONTRACT V2
        ↓
Test Chamber visual frame/motion (ephemeral only)
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

- `src/creators/appearance/creator-character-test-chamber.mjs` — new isolated visual playback session.
- `src/creators/appearance/creator-appearance-preview.mjs` — explicit visual motion/frame input.
- `src/creators/ui/appearance-creator.mjs` — six-state mobile controls + diagnostics + cleanup.
- `scripts/creator-appearance-authoring-audit.mjs` — state/track/lifecycle static gates.
- `docs/systems/CREATOR_APPEARANCE_AUTHORING_CONTRACT.md` — technical boundary updated.
- this implementation pass — continuation intent/evidence/gates updated.

## Remaining verification

Before merge/`VALIDATED`:

1. run `node scripts/creator-appearance-authoring-audit.mjs` in a runnable checkout;
2. run existing `audit:appearance`, Character customization and Creator bridge audits;
3. load Appearance Creator on mobile Safari/iPhone;
4. import a real canonical Character sheet and verify all four faces;
5. exercise IDLE/WALK/RUN and verify stride/foot anchor remains visually stable;
6. provide a row with authored `animationMapping.attack` and verify one-shot frame order/timing;
7. verify HIT/DEATH without authored mappings visibly report FALLBACK rather than pretending to have gameplay animation;
8. rapidly switch six states + four faces, close/reopen editor, and verify no RAF/input-lock leak;
9. test weapon socket and back-layer item;
10. publish/equip exact revision and compare authoring preview → own social actor → second account social → second account PvP;
11. confirm no Creator library bulk preload, no second renderer and no normal-game regression;
12. verify Mount behavior was not regressed; Mount WYSIWYG remains unclaimed.

## Next logical pass

After this PR is actually validated, the next focused authoring layer is a **visual Animation Mapping Editor** that writes the existing `animationMapping` contract (frame ranges/order/timing) instead of hardcoding tracks in the Test Chamber. Do not add gameplay attack/hit/death transition authority to Creator.

## Handoff prompt

> Continue PR #339 / branch `creator-appearance-authoring-v2` and this exact pass. Read `docs/systems/CREATOR_APPEARANCE_AUTHORING_CONTRACT.md`, `src/characters/creator-character-visual-contract.js`, `src/characters/character-appearance.js`, `src/creators/appearance/creator-character-test-chamber.mjs`, the preview and Appearance Creator. Preserve one descriptor compiler, one existing Character renderer and one isolated cancellable Test Chamber RAF. Do not mutate live actors or add HP/inventory/collision/network/persistence authority. First run the updated audit and existing appearance/bridge gates, then iPhone/LIVE six-state interaction. Fix failures in this same PR. Keep status `IMPLEMENTED_PENDING_VERIFY` until those gates actually pass. After validation, build an authoring UI for the existing `animationMapping` contract rather than another animation/runtime schema.
