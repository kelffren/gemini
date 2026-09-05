# Kelo World Asset Contract v2

Purpose: make final authored PNGs replaceable through data instead of renderer-specific code.

The production path is:

`PNG → validate → manifest → TileRegistry / profile metadata → generic render layers → LIVE`

## Global invariants

- Logical world tile: `32x32`.
- Pixel sampling: `nearest`.
- Every production PNG has a stable `id`, `family`, semantic `version`, file `path`, `kind`, dimensions and alpha policy.
- Every asset explicitly declares padding/spacing and frame mode, even when both are zero or the PNG is a single frame.
- Asset semantics and instance placement are separate. The manifest declares what an asset can do; TileRegistry/profile/prefab data owns concrete world coordinates and per-instance values.
- Visual bounds, gameplay footprint, collider and interaction are independent concepts.
- Runtime layer names are contract data and must exactly match the formal environment layer stack.
- District compatibility is declared as data. `*` means reusable in every district.
- Cache metadata is executable: for TileRegistry-owned PNGs, CI verifies the manifest cache key/value against the query string used by TileRegistry.
- Fallback behavior is explicit. Silent renderer-specific fallbacks are not part of the production contract.

## Required per-asset metadata

Every entry in `src/environment/art-asset-manifest.json` must declare:

- `id`
- `family`
- `version`
- `path`
- `kind`
- `width`, `height`
- `requireAlpha`
- `sampling`
- `padding`, `spacing`
- `frames`
- `anchor`
- `visualBounds`
- `footprint`
- `collider`
- `ownership`
- `layers`
- `priority`
- `occlusion`
- `districtCompatibility`
- `cache`
- `fallback`

Grid atlases additionally declare `cellWidth`, `cellHeight`, `columns` and `rows`.

## Placement modes

The contract deliberately does not duplicate world coordinates into the asset manifest.

`anchor`, `visualBounds`, `footprint`, `collider` and `occlusion` declare whether their values come from:

- the tile/cell itself;
- the whole asset;
- a registry frame;
- a registry instance;
- or `none`.

This keeps one asset reusable across many placements while making ownership explicit and machine-checkable.

## Formal layers

`layerPhases` in the manifest is checked against `src/environment/environment-layer-stack.js`.

Current phases:

1. `ground`
2. `ground_variation`
3. `transitions`
4. `paths_floors`
5. `decals_details`
6. `props_back`
7. `props_front`
8. `vfx_weather_lighting`

Actors remain between the pre-actor and post-actor passes; they are not an environment asset phase.

## Frames, padding and spacing

Grid coverage is validated with:

`2*padding + columns*cellWidth + (columns-1)*spacing = PNG width`

and the equivalent height formula.

This preserves the current zero-padding Canvas 2D atlases while allowing future atlases to add spacing/extrusion without changing validator ownership.

`frames.count` must equal the grid cell count for grid atlases. Single-image prefabs must declare exactly one frame.

## Cache contract

TileRegistry PNGs use:

```json
"cache": {
  "strategy": "query",
  "key": "art",
  "value": "191"
}
```

CI reads TileRegistry and verifies that the runtime source contains the same query key/value. A PNG replacement therefore cannot accidentally ship with stale registry cache metadata.

Assets loaded by another formal owner may use `runtime-owner` with an explicit version until that owner is migrated to a shared asset loader.

## Fallback contract

Fallback is always explicit:

```json
{"mode":"none"}
```

or:

```json
{"mode":"asset","assetId":"tileset-vclean"}
```

The referenced fallback asset must exist in the manifest.

## Validation gate

`scripts/validate-art-assets.mjs` now validates:

- contract version;
- world tile and sampling invariants;
- formal layer-stack parity;
- known district compatibility;
- required production metadata;
- duplicate ids and paths;
- PNG signature;
- actual vs declared dimensions;
- alpha / `tRNS` support;
- frame count;
- padding / spacing / grid coverage;
- placement mode validity;
- ownership, layers and priority;
- cache metadata;
- fallback references;
- TileRegistry PNG parity;
- TileRegistry ↔ manifest cache-key parity.

This is a CI gate, not documentation-only guidance.

## Integration rule

A future final asset such as `oak-tree-v1.png` should require:

1. add the PNG;
2. add one manifest entry;
3. pass the validator;
4. register frame/instance metadata;
5. assign it to a district/profile or prefab definition;
6. render through the existing generic layer path;
7. certify LIVE mobile.

If a new authored PNG requires an asset-name or district-specific branch in the renderer, the pipeline is still incomplete and the next contract layer must be generalized instead of adding that branch.

## Phase status

Asset Contract v2 closes the asset-level metadata and validation portion of Phase 1.

It does **not** claim the entire art factory is finished. Terrain topology, generic props, prefabs, district profiles and the final A→B substitution test remain later phases and must build on this contract rather than bypass it.
