# IMP-2026-09-16 — Creator Appearance Authoring 010

## Status

`IMPLEMENTED_PENDING_VERIFY`

Branch: `creator-appearance-authoring-v2`

Stack base: `pvp-visual-presentation-bridge-v1` / PR #308.

## Why this pass exists

The existing Appearance Creator had a schematic gold-box preview. Runtime Creator character presentation separately rebuilt its own `sheet` / `socket` descriptor inside `creator-character-state-bridge.js`. That meant authoring and live rendering could drift.

The required invariant for this pass is:

> Character Creator authoring and Character runtime must compile one shared visual descriptor. No second visual ruleset is allowed in the editor or bridge.

## Implemented

### Shared pure contract

New: `src/characters/creator-character-visual-contract.js`.

Owns only pure descriptor compilation/validation:

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

It now calls `KeloCreatorCharacterVisualContract.validate()` + `buildDescriptor()` for both local and remote Creator Character presentation.

### Loader order

`src/core/feature-registry.js` loads the new visual contract before `character-visual-presets`, CharacterCustomization and CreatorCharacterBridge inside the lazy `appearance` feature.

Normal boot remains light; nothing moved into eager `index.html` boot.

### Authoring preview

New: `src/creators/appearance/creator-appearance-preview.mjs`.

- event-driven canvas; no game loop;
- uses the same compiled descriptor;
- uses runtime anchors when available;
- same sheet/socket geometry formulas as CharacterCustomization;
- no persistence;
- image cache exists only for workspace lifetime.

### Appearance Creator V2

`src/creators/ui/appearance-creator.mjs` now gives Character authors:

- actual PNG/WebP/JPEG preview import;
- DOWN/LEFT/RIGHT/UP preview;
- auto/sheet/socket;
- front/back layer;
- socket selector;
- width/height;
- grid columns/rows;
- height scale;
- anchor X/Y;
- base rotation;
- per-face X/Y/scaleX/scaleY/rotation;
- runtime payload copy;
- visual fingerprint/contract diagnostics.

Preview files are object URLs only. They never become the authoritative published source and are revoked when replaced/closed.

### Correct auto inference

A runtime path may not have dimensions in the authoring row. The preview now waits for the image, reads `naturalWidth` / `naturalHeight`, enriches the ephemeral asset metadata, then compiles. This prevents `auto` from treating an unknown 4×4 sheet as a socket before the pixels are known.

## Tests added

New: `scripts/creator-appearance-authoring-audit.mjs`.

Pure contract tests cover:

- canonical 512×768 4×4 → sheet;
- 64×64 weapon → socket;
- per-face transforms;
- invalid sheet divisibility;
- row→payload preservation;
- deterministic fingerprint.

Static gates cover:

- shared contract loaded before bridge;
- bridge no longer owns duplicate raw sheet/socket compiler functions;
- Appearance Creator exposes image import / four faces / runtime payload;
- preview/editor contain no polling/render loops;
- preview contains no localStorage/IndexedDB persistence.

### Executed in this pass

The shared contract and preview were materialized into the available execution container and passed `node --check` under the available Node runtime. Pure contract assertions also passed:

```text
PASS pure authoring contract {
  version: creator-character-visual-contract-v2.0.0,
  sheet: sheet,
  weapon: socket,
  fingerprint: cv2:038203f0
}
```

Do not interpret this as full browser/LIVE validation.

## Architecture decisions

- Do not implement a second Character renderer for preview.
- Do not make a local preview file network authority.
- Do not attach cosmetic stats/gameplay fields to authoring.
- Do not copy editor transforms into a separate runtime schema.
- Do not add a polling loop to keep preview alive.
- Do not eagerly preload Appearance during normal game boot.
- Keep Mount preview explicitly separate until Mount runtime parity is implemented against its actual owner.

## Relationship to preceding passes

Social replication is owned by Creator Modular Appearance Replication (#301 stack).

PvP presentation delta is owned by PR #308.

This pass changes neither transport. Instead it moves the source of visual geometry earlier so the same descriptor exists before publication:

```text
AUTHORING CONTRACT V2
        ↓
Creator payload/revision
        ↓
review + publication + use authority
        ↓
CreatorCharacterBridge
        ↓
Social presentation / PvP presentation delta
```

## Remaining verification

Before merge/VALIDATED:

1. run `node scripts/creator-appearance-authoring-audit.mjs` in a full checkout;
2. run existing `audit:appearance`, Character customization and Creator bridge audits;
3. load Appearance Creator on mobile Safari/iPhone;
4. import a real canonical Character sheet and verify all four faces;
5. test weapon socket and back-layer item;
6. publish/equip exact revision and compare authoring preview → own social actor → second account social → second account PvP;
7. confirm no Creator library bulk preload, no second renderer and no input-lock leak;
8. verify Mount behavior was not regressed; Mount WYSIWYG remains unclaimed.

## Next logical pass

After validation, the same pattern can be extended to **Mount Appearance Preview Parity** or to a **Creator Character Test Chamber** that plays idle/walk/attack motions against the runtime descriptor before publication. Neither is implemented by this pass.