# Creator Asset Bridge V1 — Raw Sheet to Gallery

## Status

- owner: `Kelo Creator Asset Bridge`
- compiler: `src/creators/assets/asset-sheet-compiler.mjs`
- browser adapter: `src/creators/assets/asset-sheet-browser.mjs`
- semantic file bridge: `src/creators/assets/kelo-creator-asset-bridge.mjs`
- creator UI: `src/creators/ui/asset-sheet-workspace.mjs`
- existing byte transport: `CHATGPT_ASSET_UPLOAD_BRIDGE.md`
- playerVisible: false
- status: creator-local-file-bridge-v1

## Product contract

The creator can provide one raw PNG, WebP or JPEG containing many unrelated 2D game assets. Kelo detects the artwork, proposes irregular frame rectangles, organizes candidates into rows and families, and exports one clean atlas plus a manifest with galleries and prefab suggestions.

The normal path is:

`RAW SHEET → ANALYZE → NUMBERED PREVIEW → REVIEW NAMES/FAMILIES → CLEAN ATLAS + MANIFEST`

The image stays on the creator device during analysis. There is no ChatGPT, PixelLab or other generation API inside the game.

## Natural ChatGPT bridge

The bridge is deliberately file-based:

1. Asset Sheet Studio analyzes the source locally.
2. `DOWNLOAD REVIEW JSON` exports only geometry and semantic suggestions.
3. `COPY CHATGPT PROMPT` produces a strict review instruction.
4. The creator attaches the original image and review JSON to the existing ChatGPT conversation.
5. ChatGPT returns `kelo-asset-review-result` JSON.
6. `IMPORT CHATGPT JSON` applies names, family, category, layer, confidence and notes.
7. Compiler rectangles, anchors and footprints remain unchanged by that semantic review.

`OPEN IN WORLD` converts the reviewed manifest into temporary templates through the existing `KELO_ATLAS_CONTRACT` and `KELO_PROPERTY_CATALOG`, then opens the existing World workspace. The assets appear immediately in the normal Studio palette for placement. This is an explicitly non-durable session preview; exporting/publishing is still required before those placements can become a persistent map revision.

This is the same natural handoff philosophy as the existing Dropbox/GitHub byte bridge: files cross an explicit user-controlled boundary. No model credential, prompt endpoint or hidden remote authority is added to the browser.

## Ownership and reuse

- `sprite-foreground-analysis.mjs` remains the sole deterministic owner of foreground/background analysis and connected components.
- `asset-sheet-compiler.mjs` composes that owner and adds only heterogeneous-asset grouping, screenshot-chrome filtering, geometry classification suggestions, frame anchors and footprint suggestions.
- `kelo-creator-asset-bridge.mjs` owns review packet validation and semantic merge. It cannot change compiler rectangles.
- `Asset Sheet Studio` owns presentation and local file actions only.
- `asset-sheet-catalog-preview-adapter.mjs` translates a reviewed draft into the existing atlas/catalog contracts; it owns neither registry.
- `Property Asset Catalog` remains the catalog owner.
- `Map Forge` remains the map composition and placement owner.
- runtime renderers remain unchanged; this system creates import metadata, not a second renderer.

## Compiler behavior

1. Reuse edge-connected foreground cleanup so dark outlines inside a sprite survive.
2. Detect native transparency or a dominant border background.
3. Identify connected components and discard configured noise.
4. Detect a dense content band so phone screenshot controls outside the asset sheet can be ignored.
5. Keep large components as candidate assets and attach small nearby decorations to the nearest primary component.
6. Sort candidates into visual rows.
7. Generate deterministic IDs (`asset-001`, `asset-002`, ...).
8. Suggest `tree`, `hedge`, `plant`, `planter`, `flower`, `rock`, `ground-cluster`, `structure` or `unknown` from geometry.
9. Reuse the existing single-world-asset compiler to infer a lower-support ground pivot, visual bounds, scale, variants, placement rules and conservative footprint/collider suggestions for every detected frame.
10. Mark low-confidence semantics for review instead of silently declaring them correct.

The generated image pixels remain source truth. The compiler removes connected background and crops; it does not redraw the art.

## Manifest contract

`buildAssetSheetManifest(...)` emits:

- `atlas.kind = prop-atlas-irregular`;
- one immutable source rectangle per frame;
- `visualBounds`, lower-support ground `anchor`, `footprint`, portal profile and review-only `collider`;
- one gallery per semantic family;
- one optional family-cluster prefab suggestion;
- an explicit import policy naming Map Forge / Property Catalog as placement owners.

The manifest is a draft. It does not become public runtime content merely because it was downloaded. Existing Creator review/publication or repository asset registration remains the durable boundary.

## UEFN-inspired creator speed

The workflow borrows two useful product patterns from UEFN without copying its renderer or visual style:

- a gallery is a searchable collection of related assets;
- a prefab is a reusable group that can later expose its individual parts.

Kelo applies those ideas to irregular 2D atlas frames. The output groups tree, hedge, planter and ground-detail assets so creators can find and place families quickly through the existing Studio palette and Map Forge flow.

References: [Using Prefabs and Galleries](https://dev.epicgames.com/documentation/fortnite/using-prefabs-and-galleries-in-fortnite-creative?lang=en-US) and [Importing Assets in UEFN](https://dev.epicgames.com/documentation/fortnite/importing-assets-in-unreal-editor-for-fortnite?lang=en-US).

## Failure behavior

- No foreground: analysis returns zero assets and UI blocks export.
- Ambiguous geometry: family becomes `unknown` or receives confidence below `0.8`.
- Invalid review JSON: nothing is applied.
- Unknown or duplicate asset IDs in review: ignored with warnings.
- Review tries to change rectangles/colliders: those fields are ignored.
- Unsupported or oversized source: browser adapter rejects before decoding.
- Screenshot chrome cannot be isolated confidently: full source is retained and the numbered preview remains the manual gate.

## Online boundary

V1 analysis and semantic review are local. Durable publication remains online-first through existing repository/Supabase owners. Local downloads are creator drafts, not authoritative public content.

The next online adapter may ingest the clean atlas and manifest into immutable Creator Asset revisions. It must reuse the existing content repository and approval boundary rather than adding browser-only publication state.

## Tests / CI

- `npm run audit:asset-sheet`
- `npm run audit:docs`
- `Asset Sheet Compiler CI`
- deterministic opaque-background fixture verifies multiple assets, tree/hedge/detail suggestions, bounded rectangles, gallery/prefab generation and immutable rectangle review merge;
- native-alpha fixture verifies transparent-source handling;
- Creator Hub integration audit verifies the workspace is registered and visible.

## Extension rule

New foreground/background logic extends `sprite-foreground-analysis.mjs`. New heterogeneous grouping or category suggestions extend `asset-sheet-compiler.mjs`. New persistent upload/publication behavior must extend Universal Content Studio or the existing natural asset bridge. Do not create another foreground detector, renderer, catalog owner or direct ChatGPT API client.
