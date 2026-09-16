# Creator Animation Mapping Editor

## Status

**IMPLEMENTED_PENDING_VERIFY** on `creator-animation-mapping-editor-v1`, stacked on Creator Appearance Authoring V2 / PR #339.

## Purpose

Give mobile creators a visual way to author Character sprite-frame tracks without creating another animation schema or runtime.

The editor serializes only the existing Appearance field:

```js
row.animationMapping[state]
```

`KeloAppearance` remains the domain owner. Its existing `normalizeItem()` preserves `animationMapping`, and `resolveLoadout()` resolves `animationMapping[motion]` with `animationMapping.default` fallback.

## Supported authoring states

- `default`
- `idle`
- `walk`
- `run`
- `attack`
- `hit`
- `death`

A numeric authored track has this shape:

```js
{
  frames: [0, 1, 2, 3],
  frameMs: 140,
  loop: true
}
```

The editor preserves unknown/legacy mapping keys and values unless the creator explicitly edits that state.

## Shared contracts

The editor depends on, but does not duplicate:

- `KeloCreatorCharacterVisualContract.frameColumns(row)` for the effective sheet column count;
- `KeloCreatorCharacterVisualContract.normalizeFrame(frame, columns)` for canonical frame modulo semantics;
- `KeloAppearance.animationMapping` as persistence/domain data;
- `CreatorCharacterTestChamber` for temporary playback;
- the existing Appearance definition session for save/undo/redo/export.

It owns no renderer and no RAF.

## Mobile controls

`src/creators/appearance/creator-animation-mapping-editor.mjs` provides:

- state tabs;
- typed frame sequence;
- frame chips `F0..Fn`;
- `ALL`;
- `PING-PONG`;
- `HOLD 0`;
- frame timing;
- loop toggle;
- apply;
- clear override / remove default.

Bounds:

- max 64 frame references per track;
- `frameMs` is clamped to 70–2000 ms;
- out-of-range frame IDs normalize by the shared modulo rule, so frame `5` on four columns becomes frame `1`.

## Inheritance

For a selected state:

1. explicit `animationMapping[state]` wins;
2. otherwise `animationMapping.default` is displayed as inherited;
3. otherwise Test Chamber uses its existing deterministic fallback.

Clearing a state override deletes only that state. It does not delete `default` or unrelated/legacy mappings.

## Legacy values

Existing non-frame mappings such as:

```js
animationMapping.attack = 'slash_combo'
```

are treated as legacy/non-frame values. They are not converted or discarded merely by opening the editor. Explicitly applying a numeric ATTACK track replaces only that key.

## Test Chamber integration

Choosing `idle/walk/run/attack/hit/death` can select the same state in the current Character Test Chamber. Applying a mapping writes through the definition session. The existing session change flow rebuilds Preview + Chamber from the current row.

The mapping editor itself remains event-driven and loop-free.

## Authority boundary

This editor does not decide when gameplay becomes idle, walking, running, attacking, hit or dead. Those transitions remain runtime/gameplay authority.

The editor does not touch:

- HP/damage;
- collision;
- actor position or movement;
- PvP/combat state;
- equipment/inventory authority;
- network transport;
- publication/review;
- entitlements;
- marketplace/KC;
- localStorage/IndexedDB;
- live actors.

## Audit

Run:

```text
node scripts/creator-animation-mapping-editor-audit.mjs
```

The audit covers state shape, modulo frame normalization, sequence/timing bounds, inheritance, legacy preservation, targeted clearing, integration with Appearance/Test Chamber, and forbidden side effects.

No current-head Node/browser/iPhone/LIVE pass is claimed yet.

## Required interactive gate

Before `VALIDATED`:

- author WALK and ATTACK tracks on a real Character sheet;
- verify Test Chamber updates immediately;
- verify DEFAULT inheritance and override clearing;
- verify frame modulo and timing bounds;
- exercise undo/redo/save/export;
- preserve unrelated legacy mapping values;
- rapidly switch states and close/reopen on iPhone with no freeze/input-lock/RAF leak;
- only after upstream #339 validation, compare the exact published/equipped revision through social and PvP presentation.

## Extension rule

Future timeline/range/reorder UX must serialize back into this same `animationMapping[state]` object. Do not introduce a parallel animation document unless the canonical Appearance/runtime contract itself is intentionally versioned and migrated.
