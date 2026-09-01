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
Refactor the environment renderer so it is no longer tied to a single hard-coded 512x512 atlas and scattered numeric IDs. Move toward TileRegistry + modular atlases + environment definitions + layered rendering, then rebuild the Roman garden plaza using a higher-quality environment kit.

## Validated Architecture State — 2026-09-01
- `src/environment/tile-registry.js` is now the live source of atlas metadata, named tile IDs, reusable tile families, and transition-style metadata for the plaza renderer.
- `engine-l.js` consumes `KELO_TILE_REGISTRY` instead of owning scattered tile IDs and hard-coded atlas dimensions.
- The renderer remains on the current 512x512 production atlas for visual compatibility, but atlas width/height/columns/source are registry data, so a future 1024x1024 or modular-atlas migration no longer requires rewriting the plaza selection logic.
- LIVE mobile audit V5.43 validated the registry-driven architecture at 390x844 CSS / 780x1688 backing canvas.
- LIVE mobile audit V5.44 validated a dedicated `transitionLayer` between ground and props, with registry-driven grass↔marble edge styling, `registryVersion=1.1.0`, `sourceMode=layered-registry-v2`, `assetLoaded=true`, and `fallbackActive=false`.
- The V5.44 screenshot showed a materially clearer grass/marble boundary on mobile: the hard tile seam now has a pixel-clustered green edge plus a warm marble inset shadow. This is a valid intermediate visual improvement, but it does not replace the need for authored straight/inner/outer transition tiles in the premium environment kit.
- Registry `1.2.0` is now weighted toward the cleaner marble variants, keeping patterned marble sparse instead of selecting all marble variants uniformly. LIVE mobile validation confirmed the deployed registry and showed a quieter floor with more negative-space tiles, reducing wallpaper-like repetition without changing gameplay or map geometry.
- `marbleAccent` now exists as a separate named family for future authored composition instead of forcing decorative patterns into the base material pool.
- The live-audit workflow now validates both `KELO_PLAZA_AUDIT.version` and `KELO_PLAZA_AUDIT.registryVersion`. This caught a real stale-registry false positive during the 1.2.0 rollout; the registry script cache key was then bumped and the final audit confirmed `registryVersion=1.2.0` LIVE.
- Registry `1.3.1` now uses a dedicated authored atlas variant, `assets/tileset-vclean.png`, with four low-noise ivory marble base tiles at IDs 80–83. Long-diagonal marble motifs remain available only in `marbleAccent` instead of being part of the broad base-floor pool.
- LIVE mobile validation of registry `1.3.1` confirmed `V5.44`, `assetLoaded=true`, `fallbackActive=false`, 32x32 tiles, and 390x844 CSS / 780x1688 backing canvas. The plaza reads quieter and less wallpaper-like while retaining sparse gold/green accents.
- Visual QA rule validated: `assetLoaded=true` and `fallbackActive=false` are necessary but not sufficient. A decodable but visually incorrect atlas passed readiness checks during this rollout; manual screenshot inspection caught it. Every meaningful art change must therefore include actual LIVE screenshot inspection, and future automation should add visual-regression/crop/hash checks where practical.
- Deployment rule validated: when changing atlas content or registry definitions, bump both the authored asset query/cache key and the registry script cache key so GitHub Pages/CDN cannot mix old registry code with new art.
- Current audit still reports four generic 404 resource errors and one unrelated `appendChild` page error. These remain outside the visual transition change and should be handled as a separate debugging pass rather than mixed into environment art work.
- Current largest visual bottleneck after registry 1.3.1 is authored transition/composition quality: proper straight/inner/outer grass↔marble tiles are still missing, the remaining high-contrast diagonal/gold accent squares now look comparatively sticker-like, and props/vegetation remain simpler than the character art.

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
