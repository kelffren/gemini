# Pixelorama Kelo — pinned integration contract

This directory documents Kelo World's reproducible Pixelorama integration. **The heavy Pixelorama Web binaries are intentionally not committed to `gemini`.**

## Upstream pins

- Source repository: `Orama-Interactive/Pixelorama`
- Source commit used for the Kelo patch profile: `da7b68f97806c461abde615d1d847af91921c37b`
- Web deployment commit used by the stock in-game fallback: `2af0e590b6f1dd8a9255686373c5831623bb03bd`
- License: MIT. Preserve Pixelorama's copyright/license notice in redistributed builds.
- Godot version at the pinned source: `4.7.2`.

## Runtime strategy

`tools/pixelorama/index.html` is the Kelo-owned same-origin shell. Today it can boot the full pinned upstream Web build from a CDN, so the ~40 MB WASM and ~6 MB PCK do not enter this repository or the normal game boot. The shell is created only after the player taps **PIXELORAMA PRO**.

The preferred production build is a Kelo-patched Pixelorama export. `scripts/prepare-pixelorama-kelo.mjs` applies only integration/performance patches and does **not** delete Pixelorama authoring features:

1. Web/mobile undo history defaults to 64 steps instead of unlimited.
2. Browser-side imported `fileData` is released after Godot copies it.
3. `KeloWebBridge.gd` exposes a tiny command bridge for direct in-game `open_path`, adaptive FPS and undo-limit control.
4. Pixelorama's own PWA/service worker is disabled so Kelo has one cache/update owner.
5. Web threads remain disabled for the iPhone-compatible profile.

## Build without polluting `gemini`

A builder should checkout the pinned Pixelorama source in a temporary workspace, run:

```bash
node scripts/prepare-pixelorama-kelo.mjs /path/to/Pixelorama
```

then export the `Web` preset with Godot 4.7.2. Publish the resulting `index.*` files outside normal `gemini` Git history (release artifact/runtime hosting) and point the Kelo shell at the immutable versioned build.

Do not commit `.wasm`, `.pck`, generated Pixelorama Web exports, Godot `.godot/` cache, or upstream source copies into this repository.

## Memory contract

Opening Pixelorama Pro acquires the Kelo Creators exclusive lifecycle. Input is locked, movement/render are intercepted, simulation is suspended by its owner, and unreferenced non-core atlases are evicted. Closing Pixelorama requests Godot quit/unload, blanks/removes the iframe and releases all Kelo owner claims.

Pixelorama project `.pxo` revisions live in IndexedDB through `pixelorama-project-store.mjs`, with a bounded revision count. Persistent browser storage is requested best-effort through the StorageManager API.

## Full-feature rule

Kelo optimizations may reduce idle CPU, history depth, duplicate buffers, boot cost and residency. They must **not** remove Pixelorama authoring capabilities merely to shrink memory. Heavy features remain lazy but available when the user asks for them.

## Deployment safety

The Kelo repository currently keeps GitHub Actions under `.github/workflows-paused-2026-09-15/` because Pages/workflow queue reliability was previously being repaired. Do not reactivate a Pixelorama build/deploy workflow casually. A paused blueprint may be kept there for later activation after Pages queue verification.
