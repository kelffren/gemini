# Creator Appearance Authoring Contract V2

## Status

**IMPLEMENTED_PENDING_VERIFY.** Character appearance authoring compiles the same declarative visual descriptor consumed by the live Creator character bridge. The same PR now also contains a visual-only **Character Test Chamber** for `idle / walk / run / attack / hit / death`. Mount authoring remains on the older schematic preview and is not claimed WYSIWYG.

## Problem closed

The old Appearance Creator showed a gold placeholder box. That let an author edit X/Y/scale but did not prove that the piece would appear the same after publication. Runtime Creator character rendering separately inferred whether an asset was a sheet or socket and rebuilt its own visual descriptor.

That split created two risks:

1. an editor could look correct while social/PvP looked different;
2. future fixes could drift because authoring and runtime encoded the same rules in different places.

V2 removes the duplicate descriptor compiler for Character content.

A second authoring problem remained after descriptor parity: a static pose cannot reveal how a sheet behaves while the visual motion frame changes. The Test Chamber closes that authoring gap without creating a second gameplay state machine.

## Single source of truth

`src/characters/creator-character-visual-contract.js` owns the pure conversion:

```text
Appearance row / published Creator payload
  + asset dimensions
  + runtime source
  + character slot
        ↓
KeloCreatorCharacterVisualContract
        ↓
validated sheet/socket descriptor
        ↓
┌────────────────────────────┬────────────────────────────┐
│ Appearance Creator preview │ CreatorCharacterBridge     │
│ + Test Chamber frame input │ local + remote runtime     │
└────────────────────────────┴────────────────────────────┘
        ↓                                  ↓
preview geometry                    CharacterVisualStack
                                            ↓
                                      KeloAvatar
                                            ↓
                                     social + PvP
```

The contract never draws, persists, grants ownership or changes gameplay.

## Contract API

Global: `KeloCreatorCharacterVisualContract`.

- `buildDescriptor({source,payload,asset,slot,presets})`
- `rowToPayload(row)`
- `compileRow({row,source,asset,presets})`
- `validate({payload,asset,slot})`
- `presentationFingerprint(input)`
- `inferredSheet(asset,visual)`
- `directionalOffsets(payload)`

The same `buildDescriptor()` call is used by `creator-character-state-bridge.js` for local and remote Creator visuals.

## Descriptor families

### Sheet

Auto mode selects sheet when real asset dimensions can be divided by the declared grid and the resulting frame is approximately the canonical 2:3 Character ratio. Authors can also explicitly choose `sheet`.

Supported data:

- columns / rows;
- face rows;
- foot-root anchor;
- height scale;
- layer front/back;
- base rotation;
- per-face X/Y/rotation/scale.

The canonical Kelo Character contract remains 512×768, 4×4, 128×192 frames, with down/left/right/up rows.

### Socket

Assets that are not sheets use socket placement. Authors can explicitly choose `socket`.

Supported data:

- socket name;
- width / height;
- anchor;
- layer;
- base rotation;
- per-face X/Y/rotation/scale.

`weaponMain` and `weaponSecondary` retain the existing weapon defaults when no custom transforms are supplied.

## Authoring preview

`src/creators/appearance/creator-appearance-preview.mjs` is an authoring-only canvas. It does not install a game renderer or own a render loop.

It intentionally reproduces the live CharacterCustomization geometry formulas:

- `KeloAnchors.presentation(actor, face)` when available;
- `KeloAnchors.get(actor, socket)` when available;
- the same fallback actor presentation geometry when those owners are absent;
- `imageSmoothingEnabled = false`;
- the same sheet frame, anchor, heightScale and face offsets;
- the same socket width/height, anchor, rotation and offsets;
- explicit `_visualMotion.frame` selection using the same modulo rule used by the live Character appearance renderer.

`render()` accepts authoring-only `motion` and `frame` inputs. The isolated preview actor receives `_visualMotion.face/frame/on/state`; no live actor is touched.

## Character Test Chamber

`src/creators/appearance/creator-character-test-chamber.mjs` owns the temporary motion playback session. It is intentionally **not** a combat/gameplay state machine.

Whitelisted visual states:

- `idle`
- `walk`
- `run`
- `attack`
- `hit`
- `death`

Track resolution follows the existing Appearance contract: `row.animationMapping[motion]` first, then `animationMapping.default` if present. A mapping may provide `frames`, `frameMs`/`speedMs`/`ms`, and `loop`.

Fallback is deterministic:

- `walk` uses the declared sheet columns as the same generic stride sequence the Character renderer uses when moving;
- `run` uses the same columns with a faster preview cadence;
- missing `idle / attack / hit / death` mappings hold frame `0` rather than inventing gameplay animation data.

The UI labels each state as **MAPPED** or **FALLBACK** so a creator cannot mistake a fallback pose for an authored attack/hit/death animation.

The Test Chamber owns one `requestAnimationFrame` only while its workspace preview is playing. It redraws only when the resolved frame changes. Closing/rebuilding the preview calls `dispose()` and `cancelAnimationFrame()`.

## Runtime boundary

The live Character appearance renderer already honors an explicit `actor._visualMotion.frame` before its generic movement-time frame selection. The Test Chamber reuses that visual semantic but never writes to a runtime actor.

It does **not** simulate or mutate:

- HP/health;
- damage;
- collision;
- inventory/equipment authority;
- actor world position;
- AI;
- PvP state;
- networking;
- persistence.

Therefore `attack`, `hit`, and `death` in the Test Chamber mean **visual track labels only**. Actual gameplay transition authority remains with existing combat/actor systems.

## Mobile editor

`src/creators/ui/appearance-creator.mjs` exposes Character controls for:

- DOWN / LEFT / RIGHT / UP preview;
- IDLE / WALK / RUN / ATTACK / HIT / DEATH Test Chamber buttons;
- auto / sheet / socket mode;
- front / back layer;
- socket selection;
- width / height;
- columns / rows;
- height scale;
- anchor X/Y;
- base rotation;
- per-face X/Y/scaleX/scaleY/rotation;
- local PNG/WebP/JPEG preview import;
- copy runtime payload;
- stable presentation fingerprint shown with the preview;
- current motion track source, frame cadence, loop/one-shot and mapped/fallback status.

Imported preview files are memory-only object URLs. They are revoked on replacement or close and are never written to the exported definition.

## Auto mode and real dimensions

Auto inference must use actual image dimensions. If metadata does not already contain `pixelWidth` / `pixelHeight`, the preview loads the image, reads its natural dimensions, and only then compiles the descriptor. This prevents a 4×4 sheet from being misclassified as a socket merely because metadata was incomplete.

Published runtime still uses the dimensions delivered in the server-authorized asset manifest; the local imported file is not network authority.

## Stable fingerprint

`presentationFingerprint()` produces a deterministic `cv2:<hash>` for the compiled descriptor. It is a diagnostic/cache identity only. It is not an entitlement, publication signature, security token or PvP authority.

A byte-equivalent visual descriptor must produce the same fingerprint. A visual change should produce a different fingerprint. Test Chamber state/frame is deliberately outside this descriptor fingerprint because it does not alter the authored geometry contract.

## Security boundaries

This phase does not change:

- KC settlement;
- entitlements;
- publication/review;
- gameplay equipment;
- damage/stats/abilities;
- PvP authority;
- server presentation authority.

The preview can consume a local object URL because it is private authoring state. `CreatorCharacterBridge` still consumes only exact Delivery/local-authorized content or the server-sanitized remote presentation envelope.

## Performance boundaries

- Appearance remains a first-use feature.
- Preview exists only while the workspace is open.
- The base preview remains event-driven and owns no RAF/polling loop.
- Test Chamber owns at most one RAF and only paints when the visible frame changes.
- No `setInterval()` polling is used.
- Image objects are cached only for the preview session.
- Object URLs are revoked on replacement/close.
- No Creator library bulk sync is required.
- No additional gameplay renderer exists.

## Validation

Static/pure gate: `node scripts/creator-appearance-authoring-audit.mjs`.

The gate checks:

- canonical 512×768 auto inference → sheet;
- 64×64 weapon auto inference → socket;
- directional transform preservation;
- invalid sheet divisibility rejection;
- deterministic fingerprint;
- exact six-state Test Chamber whitelist;
- mapped attack track preservation;
- deterministic walk/death fallbacks;
- live Character renderer explicit-frame support;
- loader order contract-before-bridge;
- bridge consumes the shared contract rather than rebuilding raw sheet/socket descriptors;
- editor exposes image import + runtime payload + four faces + Test Chamber;
- base preview/editor contain no RAF or polling loop;
- Test Chamber contains RAF + cancellation, no polling or browser persistence.

Before status becomes **VALIDATED**, also verify on LIVE iPhone:

1. import a real 4×4 clothing sheet;
2. adjust each face and compare editor versus social actor;
3. exercise IDLE/WALK/RUN and confirm columns/foot anchoring do not jump;
4. test an authored `attack` mapping and confirm one-shot/last-frame behavior;
5. verify HIT/DEATH without mappings are clearly labeled FALLBACK and do not pretend to be gameplay-complete;
6. rapidly switch all six states and faces, close the editor, and confirm no RAF/input-lock leak;
7. publish/equip the same revision and compare another account's social view;
8. enter PvP and confirm the same visual geometry through the presentation bridge;
9. test a socket weapon and a back-layer cosmetic;
10. rotate portrait/landscape and confirm no freeze;
11. confirm closing the workspace releases imported preview object URLs.

## Explicit limitations

Character has runtime-contract geometry/frame preview parity in this pass. Test Chamber is visual-only and does not claim combat-state-machine parity. Mount stays on the existing definition/schematic preview until a future Mount runtime-contract preview reuses the same strategy with `KeloMounts`/mount anchors.
