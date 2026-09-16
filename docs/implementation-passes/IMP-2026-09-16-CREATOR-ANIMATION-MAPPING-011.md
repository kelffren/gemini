# IMP-2026-09-16 — Creator Animation Mapping Editor 011

## Status

`IMPLEMENTED_PENDING_VERIFY`

Branch: `creator-animation-mapping-editor-v1`

Stack base: `creator-appearance-authoring-v2` / PR #339.

## User continuation intent

Continue Creator Character authoring after the Test Chamber with a visual, mobile-first editor for the animation tracks creators actually need to author. Reuse the existing `Appearance.animationMapping` contract and the existing Test Chamber immediately; do not create a second animation runtime, renderer, gameplay state machine or persistence path.

## Contract decision

Inspection of `src/appearance/appearance-system.js` confirmed that `KeloAppearance.normalizeItem()` already preserves `animationMapping` as arbitrary JSON-compatible data and `resolveLoadout()` returns `item.animationMapping[motion] || item.animationMapping.default || null`.

Therefore this pass does **not** modify the Appearance foundation. The editor writes the already-existing contract.

## Implemented

### Visual Animation Mapping Editor

New: `src/creators/appearance/creator-animation-mapping-editor.mjs`.

Editable keys:

- `default`
- `idle`
- `walk`
- `run`
- `attack`
- `hit`
- `death`

Each authored frame track writes only:

```js
animationMapping[state] = {
  frames: [0, 1, 2, 3],
  frameMs: 140,
  loop: true
}
```

The editor also understands inherited `default` mappings and existing legacy/non-frame values. Unedited mapping keys are copied through untouched.

### Mobile controls

The Character Appearance inspector now exposes:

- state tabs;
- frame sequence field;
- one-tap `F0 ... Fn` chips based on the effective sheet columns;
- `ALL` sequence;
- `PING-PONG` sequence;
- `HOLD 0`;
- frame timing;
- loop toggle;
- apply mapping;
- clear state override / remove default.

Limits:

- maximum 64 authored frame references per track;
- timing clamped to 70–2000 ms;
- frame IDs normalized by the shared `KeloCreatorCharacterVisualContract.normalizeFrame()` semantics;
- effective columns come from the same visual contract used by Preview/Test Chamber.

### Immediate Test Chamber feedback

Selecting an actual visual state (`idle/walk/run/attack/hit/death`) can drive the existing Character Test Chamber. Applying a mapping updates the same selected Appearance definition through the existing definition session; the session change rebuilds Preview + Chamber from the new row.

The editor owns no RAF. Test Chamber remains the single temporary animation-loop owner.

### Legacy preservation

The editor clones the entire existing `animationMapping`, replaces or removes only the selected key, and returns the resulting object to the Appearance definition session.

This means an existing value such as:

```js
animationMapping.attack = 'slash_combo'
```

is preserved unless the creator explicitly edits the `attack` state. The UI identifies a non-frame mapping as legacy/non-frame instead of silently pretending it is a numeric track.

## Authority / safety boundary

The Animation Mapping Editor does not own or mutate:

- combat transitions;
- damage/HP/death authority;
- actor movement;
- collision;
- inventory/equipment authority;
- networking;
- publication/review;
- entitlements;
- KC/marketplace settlement;
- localStorage/IndexedDB;
- live actors.

`attack`, `hit`, and `death` are visual mapping labels. Gameplay systems still decide when those states happen.

## Files

New:

- `src/creators/appearance/creator-animation-mapping-editor.mjs`
- `scripts/creator-animation-mapping-editor-audit.mjs`
- this implementation pass.

Modified:

- `src/creators/ui/appearance-creator.mjs`
- `docs/systems/CREATOR_APPEARANCE_AUTHORING_CONTRACT.md`
- `docs/CODE_INDEX.md`
- `docs/system-catalog.json`

## Audit contract

`node scripts/creator-animation-mapping-editor-audit.mjs`

The gate checks:

- exact editable state set;
- frame modulo normalization;
- 64-frame bound;
- 70–2000 ms timing bounds;
- default inheritance;
- legacy/non-frame detection;
- editing one state preserves all other mapping keys;
- clear removes only the selected override;
- Appearance foundation preserves and resolves the same mapping object;
- UI writes through `session.upsert()`;
- Test Chamber consumes the same `animationMapping`;
- no RAF/polling/persistent browser store/live-actor references in the mapping editor.

## Verification truth

No current-head Node, browser, iPhone or LIVE run is claimed in this pass yet. The stack base also has no GitHub Actions workflow directory. Keep status `IMPLEMENTED_PENDING_VERIFY` until the audit and mobile interaction gates actually run.

## Required mobile/LIVE validation

1. open Appearance Creator on iPhone;
2. import/use a canonical 4-column Character sheet;
3. author WALK `0,1,2,3`, verify immediate Chamber playback;
4. author ATTACK `0,2,3`, one-shot, verify last-frame behavior;
5. enter frame `5` on a 4-column sheet and confirm it normalizes to frame `1`;
6. author a PING-PONG sequence and verify order;
7. verify timing lower/upper bounds;
8. create DEFAULT and verify an unmapped state inherits it;
9. clear a state override and verify DEFAULT/fallback becomes visible;
10. verify a legacy mapping in another state survives edits;
11. rapidly switch tabs, apply mappings, undo/redo, close/reopen and verify no freeze or input-lock/RAF leak;
12. export/save and confirm `animationMapping` contains only the intended changes;
13. publish/equip exact revision only after upstream #339 validation and compare authoring → social → PvP visual presentation.

## Next logical pass

After this editor and #339 are validated, the next authoring improvement should be **frame-range ergonomics / sprite-sheet timeline visualization** built on this exact mapping object, not a new animation schema. A timeline may visualize/reorder frames but must still serialize to `animationMapping[state]` and leave gameplay state transitions outside Creator.

## Handoff prompt

> Continue branch `creator-animation-mapping-editor-v1` stacked on PR #339. Read `docs/implementation-passes/IMP-2026-09-16-CREATOR-ANIMATION-MAPPING-011.md`, `docs/systems/CREATOR_APPEARANCE_AUTHORING_CONTRACT.md`, `src/creators/appearance/creator-animation-mapping-editor.mjs`, `creator-character-test-chamber.mjs`, and `appearance-system.js`. Preserve one existing `animationMapping` contract and one Test Chamber RAF. Do not create a second renderer, animation runtime, combat state machine or persistence store. Run the dedicated audit and iPhone interaction gates before changing status from `IMPLEMENTED_PENDING_VERIFY`.
