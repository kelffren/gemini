# Kelo World — Visual Direction Memory

## Purpose
This file is persistent project memory for the visual direction of Kelo World. Every visual/environment research, implementation, refactor, debug pass, and live audit must read this file first and update it only when a finding is validated or a design decision is intentionally changed.

## North Star
Kelo World should feel like a bright, polished, cozy top-down pixel-art MMO with the readability, color discipline, density of detail, and environmental consistency associated with high-quality browser pixel MMOs such as Pixadom, while remaining visually original and not copying Pixadom assets, layouts, characters, or proprietary art.

## Current Exterior Direction
- Daytime, optimistic, colorful world.
- Vivid grass: saturated, fresh, lively green closer to classic Pokémon readability than muted realistic grass.
- White/ivory Roman marble as an accent and navigation material, not as the entire ground plane.
- Gold used as a premium accent, not repeated on every tile.
- Roman garden/plaza language: fountains, columns, statues, planters, benches, rugs/tapestries where appropriate, trimmed gardens, flowers, water, stone borders.
- Water should be bright cyan/blue and visually animated where possible.
- Vegetation should feel lush and layered.
- Avoid giant repeated marble blocks, wallpaper-like diamonds, flat placeholder circles, and overly geometric empty layouts.

## Quality Bar
The environment must visually hold up next to the hero sprite. Placeholder-looking trees, fountains, props, or procedural primitives are not acceptable as final art.

Quality should come from:
- coherent palette;
- strong silhouettes;
- readable tile edges;
- controlled pixel clusters;
- useful shadows;
- varied but coherent ground tiles;
- multiple transition tiles;
- layered props;
- focal points;
- asymmetry and controlled irregularity;
- enough small detail to avoid emptiness without creating noise.

## Technical Tile Rules
- Logical world tile remains 32x32 unless a deliberate migration is approved.
- Environment art may use multi-tile prefabs such as 2x2, 2x3, 3x3, etc.
- Do not stretch a whole atlas as a floor texture.
- Atlas dimensions must be exact multiples of 32.
- Prefer scalable atlas architecture (1024x1024 or multiple atlases) over a hard-coded single 512x512 sheet.
- Pixel rendering should preserve crisp edges; no unintended smoothing.
- Tile IDs must be data-driven and named through a registry rather than scattered numeric magic values.

## Target Architecture
Environment rendering should evolve toward:

atlas/assets
→ TileRegistry
→ biome/environment definitions
→ Map/Zone Generator
→ render layers
→ collisions/interaction metadata
→ live renderer

Preferred render order:
1. ground
2. ground variation
3. transitions
4. paths/floors
5. decals/details
6. props_back
7. actors/NPCs
8. props_front
9. VFX/weather/lighting
10. UI

## Asset Families
The system should support multiple modular families rather than one monolithic sheet:
- ground_grass
- ground_marble
- transitions
- paths
- water
- plaza_props
- nature_props
- architecture
- interiors
- furniture
- decals
- shadows
- vfx

## Minimum Exterior Variety Target
Before calling an exterior kit premium, aim for at least:
- 8–12 grass variants;
- 6–10 marble/floor variants;
- complete straight/inner/outer grass↔marble transitions;
- path straights, turns, T-junctions, crossings, ends;
- 2+ tree families;
- several bushes/flowerbeds/planters;
- columns and statues;
- benches/lamps;
- a real multi-tile fountain;
- reusable shadow tiles;
- several small ground details/decal tiles.

## Composition Rules
- Grass should dominate outdoor scenes unless the zone intentionally calls for stone.
- Marble should guide movement and define plazas, courtyards, and important architecture.
- Premium gold accents should be sparse enough to feel special.
- Do not repeat the same ornament every 1–2 tiles.
- Important spaces need a clear focal point.
- Build scenes, not just tiled carpets.
- Use controlled clusters of props and negative space.
- Prefer irregular garden edges and small asymmetries over perfect procedural symmetry everywhere.

## Pixadom Research Principle
Use Pixadom and other strong pixel MMOs as references for:
- visual density;
- readability;
- scene layering;
- palette discipline;
- prop variety;
- mobile legibility;
- environment consistency.

Never copy exact assets, maps, distinctive proprietary characters, or layouts.

## Mobile Standard
Visual decisions must be tested at a real mobile viewport. A change is not considered visually complete until a LIVE GitHub Pages screenshot is captured and inspected.

## Mandatory Live Audit Loop
For every meaningful visual implementation:
1. inspect current repo and this memory;
2. research if needed;
3. implement the smallest meaningful improvement;
4. run syntax/tests/CI;
5. commit and push to the Pages branch;
6. wait for deployment;
7. run the mobile live screenshot audit;
8. inspect screenshot and console errors;
9. if visually or technically wrong, fix and repeat before claiming success;
10. update this memory only with validated discoveries/decisions.

## Current Priority
Kelo World is no longer allowed to remain a single polished plaza floating in a dark test grid. The world renderer must support connected districts and chunk-based expansion while preserving the plaza quality bar. After the first world scaffold is validated, the next priority is authored district identity: modular nature/architecture props, stronger landmarks, irregular path edges and controlled environmental density outside the plaza.

## Validated Architecture State — 2026-09-01
- `src/environment/tile-registry.js` is now the live source of atlas metadata, named tile IDs, reusable tile families, and transition-style metadata for the plaza renderer.
- `engine-l.js` consumes `KELO_TILE_REGISTRY` instead of owning scattered tile IDs and hard-coded atlas dimensions.
- The renderer remains on the current 512x512 production atlas for visual compatibility, but atlas width/height/columns/source are registry data, so a future 1024x1024 or modular-atlas migration no longer requires rewriting the plaza selection logic.
- LIVE mobile audit V5.43 validated the registry-driven architecture at 390x844 CSS / 780x1688 backing canvas.
- LIVE mobile audit V5.44 validated a dedicated `transitionLayer` between ground and props, with registry-driven grass↔marble edge styling, `registryVersion=1.1.0`, `sourceMode=layered-registry-v2`, `assetLoaded=true`, and `fallbackActive=false`.
- Registry `1.2.0` weighted the cleaner marble variants and separated `marbleAccent` from the broad base material pool.
- Registry `1.3.1` introduced `assets/tileset-vclean.png` with four low-noise ivory marble base tiles at IDs 80–83.
- Visual QA rule validated: asset readiness flags are necessary but not sufficient; manual LIVE screenshot inspection remains mandatory.
- Deployment rule validated: when changing atlas content or registry definitions, bump the authored asset and registry cache keys together.

## Validated Visual State — V5.45 / Registry 1.4.0
- The renderer consumes a second modular atlas, `assets/plaza-transitions-v1.png`, independently from the 512x512 ground/prop atlas.
- `plaza-transitions-v1.png` is an original 128x128 transparent overlay atlas made from sixteen 32x32 cells. The registry maps all 4-neighbour top/right/bottom/left boundary masks to authored edge/corner/multi-edge tiles.
- `engine-l.js` selects authored grass↔marble transition overlays from neighbour topology rather than procedural fill strips.
- Automatic high-contrast gold/green decorative squares were removed from the broad marble floor composition.
- LIVE mobile audit validated V5.45, registry 1.4.0, authored transitions, both atlases loaded and mobile 390x844 CSS / 780x1688 backing canvas.

## Validated Visual State — V5.46 / Registry 1.4.1
- Added `src/environment/plaza-depth.js` as a dedicated front-occlusion pass.
- Registry `1.4.1` exposes `styles.propDepth` with `mode='y-occlusion-overlay-v1'` and identifies fountain, columns, trees and lamps as front-occluding prop families.
- The pass re-renders an occluding prop above the local actor only when the actor overlaps the footprint and is behind its base-Y.
- LIVE mobile audit validated V5.46, registry 1.4.1, `depthOcclusion=true`, `depthOccluderCount=11`, authored transitions active, and mobile 390x844 CSS / 780x1688 backing canvas.

## Validated World State — V5.47 / World Renderer v1
- Added `src/environment/world-map.js` as the first expandable world-ground layer driven by the existing TileRegistry atlas families.
- The previous dark test grid outside the plaza has been replaced by atlas-authored vivid grass and ivory marble navigation surfaces across the full existing 3600x3200 world bounds.
- The world is rendered in cached 512x512 chunks, with only camera-adjacent chunks built/drawn and a 24-chunk cache cap. This establishes the first scalable map architecture without changing movement, combat, economy, networking, chat or inventory.
- Five named districts are now represented in the world scaffold: Plaza Central, Distrito Rural, Distrito Arena, Distrito Comercio and Jardines del Sur, connected by four primary marble road corridors plus district pads.
- `engine-c.js`, the documented LIVE owner of the base world/plaza rendering, now delegates the world ground to `KELO_WORLD_RENDERER` before drawing the existing farm, plot, arena, particles and actors. This preserves gameplay systems while replacing only the old dark background/grid.
- LIVE audit V5.47 validated `world-v1`, `chunkSize=512`, `districtCount=5`, `roadCount=4`, `worldWidth=3600`, `worldHeight=3200`, `assetLoaded=true`, plaza registry 1.4.1, authored transitions and depth occlusion.
- Manual inspection of the 390x844 LIVE screenshot confirms that the player is now surrounded by continuous vivid terrain and connected ivory paths rather than a plaza floating in darkness. Plaza composition remains intact.
- The audit now records failed request URLs separately from console text. In the validated run there were no `requestfailed` entries, but the pre-existing generic 404 console messages and unrelated `appendChild` page error remain.
- Research validation: current Pixadom material continues to show dense but readable environments where connected spaces, clear paths, large props and landmarks make the world feel continuous. Kelo World should use that principle without copying maps or assets.
- Next largest bottleneck: district identity. The world scaffold is intentionally simple outside the plaza; Distrito Rural, Arena, Comercio and Jardines need authored landmark/prop kits and more irregular path edges so they stop reading as the same grass field with marble corridors.

## Non-goals During Visual Passes
Do not casually alter unrelated systems such as:
- core movement feel;
- combat/abilities;
- economy;
- login/networking;
- chat;
- inventory logic;
- PvP logic;
unless a minimal integration change is strictly required.

## Definition of Visual Success
A visual pass is successful only when:
- it improves the live screenshot, not just the source code;
- the scene reads clearly on mobile;
- environment quality approaches the hero sprite quality;
- there are no new console errors;
- no unrelated gameplay system regresses;
- the result remains original to Kelo World.
