# Creator Appearance Authoring Contract V2

## Status

**IMPLEMENTED_PENDING_VERIFY.** Character appearance authoring now compiles the same declarative visual descriptor consumed by the live Creator character bridge. Mount authoring remains on the older schematic preview and is not claimed WYSIWYG in this pass.

## Problem closed

The old Appearance Creator showed a gold placeholder box. That let an author edit X/Y/scale but did not prove that the piece would appear the same after publication. Runtime Creator character rendering separately inferred whether an asset was a sheet or socket and rebuilt its own visual descriptor.

That split created two risks:

1. an editor could look correct while social/PvP looked different;
2. future fixes could drift because authoring and runtime encoded the same rules in different places.

V2 removes the duplicate descriptor compiler for Character content.

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
│ authoring                   │ local + remote runtime     │
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

The same `buildDescriptor()` call is now used by `creator-character-state-bridge.js` for local and remote Creator visuals.

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

`src/creators/appearance/creator-appearance-preview.mjs` is an authoring-only canvas. It does not install a game renderer or a render loop.

It intentionally reproduces the live CharacterCustomization geometry formulas:

- `KeloAnchors.presentation(actor, face)` when available;
- `KeloAnchors.get(actor, socket)` when available;
- the same fallback actor presentation geometry when those owners are absent;
- `imageSmoothingEnabled = false`;
- the same sheet frame, anchor, heightScale and face offsets;
- the same socket width/height, anchor, rotation and offsets.

It is event-driven. There is no `setInterval()` or `requestAnimationFrame()` loop.

## Mobile editor

`src/creators/ui/appearance-creator.mjs` now exposes Character controls for:

- DOWN / LEFT / RIGHT / UP preview;
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
- stable presentation fingerprint shown with the preview.

Imported preview files are memory-only object URLs. They are revoked on replacement or close and are never written to the exported definition.

## Auto mode and real dimensions

Auto inference must use actual image dimensions. If metadata does not already contain `pixelWidth` / `pixelHeight`, the preview loads the image, reads its natural dimensions, and only then compiles the descriptor. This prevents a 4×4 sheet from being misclassified as a socket merely because metadata was incomplete.

Published runtime still uses the dimensions delivered in the server-authorized asset manifest; the local imported file is not network authority.

## Stable fingerprint

`presentationFingerprint()` produces a deterministic `cv2:<hash>` for the compiled descriptor. It is a diagnostic/cache identity only. It is not an entitlement, publication signature, security token or PvP authority.

A byte-equivalent visual descriptor must produce the same fingerprint. A visual change should produce a different fingerprint.

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
- No polling or animation loop was added.
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
- loader order contract-before-bridge;
- bridge consumes the shared contract rather than rebuilding raw sheet/socket descriptors;
- editor exposes image import + runtime payload + four faces;
- preview/editor introduce no polling/render loop or persistent browser store.

Before status becomes **VALIDATED**, also verify on LIVE iPhone:

1. import a real 4×4 clothing sheet;
2. adjust each face and compare editor versus social actor;
3. publish/equip the same revision and compare another account's social view;
4. enter PvP and confirm the same visual through PR #308's presentation bridge;
5. test a socket weapon and a back-layer cosmetic;
6. rotate portrait/landscape and confirm no freeze/input lock leak;
7. confirm closing the workspace releases imported preview object URLs.

## Explicit limitation

Character has runtime-contract preview parity in this pass. Mount stays on the existing definition/schematic preview until a future Mount runtime-contract preview reuses the same strategy with `KeloMounts`/mount anchors.