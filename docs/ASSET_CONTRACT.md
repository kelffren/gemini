# Kelo World Asset Contract v1

Purpose: make authored art replaceable without renderer-specific code. A final PNG should be describable by data, validated before deploy, registered, then rendered by the existing environment architecture.

## Global rules

- Logical world tile: 32x32 px.
- Pixel-art sampling: nearest-neighbour; Canvas 2D smoothing must remain disabled when scaling pixel art.
- Tile atlases must declare exact pixel dimensions and exact grid dimensions.
- Every asset has a stable id, path and kind in `src/environment/art-asset-manifest.json`.
- Runtime placement metadata belongs in TileRegistry / family registries, not inside renderer conditionals.
- Visual bounds, gameplay footprint/collider and interaction bounds are separate concepts.
- Assets that can occlude actors use the formal `props_back -> actors -> props_front` path instead of wrapping the renderer.
- Replacing an image file must not require district-specific renderer logic.

## Ground / ground variation atlas

Required metadata:

- `id`
- `path`
- `kind`
- `width`, `height`
- `cellWidth=32`, `cellHeight=32`
- `columns`, `rows`
- sampling inherited from the manifest (`nearest`)

The grid must cover the image exactly. Variant selection should remain deterministic and data-driven.

## Terrain transition atlas

Transition art is a separate family from base ground. Kelo currently uses a 4-neighbour topology contract for authored grass/marble transitions. A future final transition family must be representable as data for edge/corner/multi-edge connectivity; adding a new terrain pair must not require a new renderer branch.

Tiled's terrain/Wang model is the reference model for future generalization: terrain connectivity is metadata attached to tiles, supporting corner, edge or mixed terrain sets. Kelo does not need to adopt Tiled files directly, but the Asset Contract should remain compatible with that data model.

## Props and prefabs

A registry-owned prop/prefab should eventually declare:

- asset / atlas frame
- anchor or base-Y
- visual bounds
- footprint
- collider (optional and independent)
- layer (`props_back` or `props_front` when applicable)
- district/profile eligibility
- priority
- occlusion metadata

Large authored props can be single PNGs and are not required to use the 32x32 grid.

## Layered back/front art

If an actor can pass visually behind and in front of one object, represent that object through formal back/front layers. Back/front PNGs may be independent raster files. Gameplay collision remains separate from visual clipping.

## Atlas padding

Kelo's current renderer is Canvas 2D with nearest-neighbour sampling and exact source rectangles, so existing grid atlases can remain unpadded. The contract intentionally does not hard-code zero padding as a universal future rule. If a WebGL/mipmap pipeline is introduced, atlas metadata must add padding/extrusion requirements to prevent neighbouring-frame bleeding.

## Validation gate

`scripts/validate-art-assets.mjs` validates the manifest before deploy. v1 checks:

- manifest version and 32px logical tile contract
- PNG file existence and PNG signature
- declared dimensions vs actual dimensions
- exact grid coverage for tiled atlases
- alpha channel where explicitly required
- duplicate asset ids

Later contract versions can add frame-level anchors, bounds, padding, seam checks and transition completeness without changing renderer ownership.

## Integration target

For a future `grass-final-v1.png`, the intended path is:

1. add PNG;
2. declare it in the asset manifest;
3. pass asset validation;
4. register its family/frames in TileRegistry;
5. assign it through a district visual profile;
6. render through existing ground/layer contracts;
7. certify LIVE mobile.

If integrating that PNG requires a new `if (district === ...)` or asset-name branch in the renderer, the contract is not yet complete enough.
