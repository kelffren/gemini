# Kelo Frame Surgery — Research Quality Bar

Frame Surgery is intentionally not a general Photoshop clone. It is a finger-first repair workstation for irregular AI-generated sprites that must compile into Kelo World's canonical avatar runtime.

## External references used for the v2 hardening pass

- Aseprite selection docs: https://www.aseprite.org/docs/selecting/
  - relevant behavior: exact active-cel selection; replace/add/subtract/intersect operations; transform the selected content.
- Aseprite onion skin docs: https://www.aseprite.org/docs/onion-skinning/
  - relevant behavior: several previous/next frames visible as animation reference.
- Aseprite layers docs: https://www.aseprite.org/docs/layers/
  - relevant behavior: independent transparent layers, visibility, selection-to-new-layer workflow.
- Aseprite transformations docs: https://www.aseprite.org/docs/transformations/
  - relevant behavior: move/scale/rotate the active selection/cel without affecting unrelated content.
- Aseprite pixel-perfect context-bar docs: https://www.aseprite.org/docs/context-bar/
  - relevant behavior: pixel-perfect strokes are a first-class mode for pixel art.
- MDN Pointer Events: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events
  - relevant behavior: pointer capture, pointer cancellation, device-independent touch/pen/mouse handling, large finger targets.
- MDN pinch gesture guidance: https://developer.mozilla.org/en-US/docs/Web/API/Pointer_events/Pinch_zoom_gestures
  - relevant behavior: cache independent pointer identities and derive two-pointer scale gestures from their geometry.

## What v2 adopts

1. Exact RLE selection masks instead of bounding-box-only magic selection.
2. Replace/Add/Subtract/Intersect/Invert selection algebra.
3. Exact selection-to-piece extraction: unselected pixels inside the bounding rectangle remain transparent.
4. Multi-frame onion skin for previous/next frames.
5. Pixel-perfect rasterization of erase/restore strokes on integer pixels.
6. Pixel-snap for committed translation, scale and rotation, enabled by default but reversible.
7. Clone stamp whose sampled source follows the destination path delta.
8. Safe small-gap fill that refuses a transparent component touching the frame edge or exceeding its bounded repair area.
9. Piece controls for visibility, lock, order, selection and deletion.
10. Explicit pointercancel rollback and multi-touch commit suppression so lifting one finger cannot double-commit a pinch.
11. Original PNG remains immutable; every repair remains a reversible patch.
12. Runtime acceptance still belongs to Universal Sprite Ingestion + Frame Doctor, never to the editor alone.

## What v2 deliberately rejects

- Freehand painting features unrelated to repairing imported sprites.
- Destructive mutation of the source PNG.
- Generative reconstruction of missing anatomy without an explicit replacement piece.
- Soft antialiased brush edges as the default for pixel art.
- A second sprite renderer or second avatar runtime.
- A UI-only quality gate that can pass while Avatar Quick Import compatibility is broken.

## Release gate

`Kelo Frame Surgery Guardian` owns a 35-capability contract. Its advanced checks exercise mask algebra, pixel snapping, raster line continuity, enclosed-gap detection, locked piece behavior and real selective-frame-patch compatibility in addition to the original feature wiring checks.

The Guardian must pass together with:

- adversarial sprite ingestion corpus;
- Frame Doctor audit;
- Avatar Quick Import audit.

A 35/35 Guardian result is necessary but not sufficient if a regression audit is red.