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

## Validated District Ground Identity — 2026-09-02 / Registry 1.5.0 / World v1.1
- `TileRegistry` now owns `styles.districtGround` with five named ground profiles plus a default profile; the world renderer no longer owns district-specific density constants as scattered rendering policy.
- `world-map.js` applies deterministic, cache-stable ground rhythms per district while preserving the same atlas families and 512x512 chunk architecture: Rural and Gardens use clustered flower details; Arena and Commerce use sparser grass details and restrained marble accents; Central remains quieter.
- This is intentionally a low-risk identity layer rather than a new art pack. It gives districts different visual rhythm without changing movement, collisions, economy, combat, networking, chat or inventory.
- LIVE audit validated registry `1.5.0`, `world-v1.1`, `districtStyleMode='district-profile-v1'`, five styled districts, all visual assets loaded, no fallback, and the existing 3600x3200 / 512-chunk world contract.
- QA finding validated: moving the audit player/camera and waiting before taking a screenshot can allow the live game loop to re-center the camera, producing a technically green but visually wrong capture. The audit now renders and serializes the off-plaza canvas immediately after positioning the camera.
- Manual inspection of the corrected 390x844 Distrito Rural capture confirms that flower details appear in controlled small clusters and the ivory route remains highly legible against vivid grass on mobile.
- The same capture exposes the next larger bottleneck: the farm/field rectangles are still large flat brown blocks and read as placeholder geometry beside the hero sprite. The next safe visual pass should replace that geometry with authored soil/crop-edge tiles or a modular rural ground/prop atlas before adding more generic grass noise.
- The known page-level `appendChild` error and a small number of generic 404 console messages persist; the validated audit recorded zero `requestfailed` entries and no Kelo world/atlas/depth errors.

## Validated Rural Soil — V5.48 / Registry 1.6.0 / Rural v1
- Added the original modular atlas `assets/rural-soil-v1.png`: 128x128, sixteen 32x32 pixel-art cells, deterministic and reproducible through `scripts/generate_rural_soil.py`.
- `TileRegistry 1.6.0` owns the rural atlas metadata, named rural tile IDs and the `authored-nine-slice-v1` plot contract instead of leaving soil colors and geometry scattered in `renderFarm()`.
- Added `src/environment/rural-ground.js`. Each former 90x90 flat brown placeholder is now a 96x96 3x3 composition with authored grass lips, corner/edge tiles, continuous furrows, sparse soil variation and pixel-art crop rows.
- Farming state and interactions remain unchanged: the same four crop records, planting timers, harvesting and rewards are used; this pass only replaces visual rendering and keeps the legacy renderer as an asset-loading fallback.
- CI validates environment JavaScript plus the rural PNG signature and exact 128x128 / 4x4 / 32px contract.
- LIVE audit validated V5.48, registry 1.6.0, `rural-v1`, `renderingMode='authored-nine-slice-v1'`, `plotSize=96`, atlas loaded, fallback disabled, existing world v1.1 and plaza transitions/depth preserved.
- Manual inspection of the corrected 390x844 Distrito Rural capture confirms that the fields now read as cultivable modular soil rather than large flat rectangles. The hero remains legible over the darker plots and the road/grass contrast is intact.
- Known unrelated state is unchanged: generic 404 console messages and the pre-existing `appendChild` page error remain; `failedRequests` is still zero and no Kelo rural/world/atlas error appeared.
- Next largest rural bottleneck: the field art now works, but the surrounding district lacks spatial storytelling. The next safe pass should add a modular fence/gate perimeter, a barn or silo landmark, a dirt approach path and sparse rural vegetation before expanding other districts.

## Validated Error Cleanup — V5.49 / 2026-09-02
- Root cause of the repeated HTTP 404 console noise was legacy `engine-h.js` probing three removed plaza JPG paths even though the live plaza is atlas-owned by `engine-l.js`. Those probes were removed while retaining the procedural fallback and HiDPI wrapper.
- The remaining static missing path was a lowercase `assets/hero.png` retry while the production file is `assets/hero.PNG`; the nonexistent retry was removed and CI now rejects reintroducing it.
- The page-level `appendChild` crash came from `showToast()` targeting a nonexistent `#toast-container`, commonly triggered when timed farm/animal rewards matured during audit. `index.html` now owns the styled live region and `showToast()` also creates it defensively if absent.
- Added a data-URI favicon so browsers no longer request a missing `/favicon.ico`.
- The LIVE audit now performs a clean final reload after deployment convergence, records exact HTTP status URLs, failed request URLs and full page-error stacks, and fails on any entry in those buckets rather than tolerating generic errors.
- LIVE V5.49 validation passed with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`; CI and Pages deployment also succeeded. The V5.48 rural rendering, registry 1.6.0, world v1.1 and plaza transition/depth contracts remain intact.
- Quality gate: no future visual round is complete if the clean final LIVE diagnostic report contains any console, page, failed-request or HTTP error.

## Validated Rural Boundary & Road Clearance — Registry 1.7.1 / Rural v2.1 / 2026-09-02
- Added original `assets/rural-props-v1.png`, a 128x128 modular 32px atlas for wooden fence segments, corners, open/closed gates, field sign, damaged fence, dirt-path cells and sparse rural details. `TileRegistry` owns the atlas and named IDs rather than scattering prop coordinates through the renderer.
- `rural-ground.js` now draws a modular fence perimeter around the existing farm without altering farm state, planting, harvesting, movement or collisions. The final gate faces north with a one-tile dirt threshold toward the navigation route.
- Manual inspection of the first LIVE fence capture found a composition defect that readiness flags did not catch: the original 128px horizontal marble corridor crossed directly beneath the farm and the south dirt approach formed an oversized rigid T. That version was not accepted as final.
- `world-map.js` now uses `ruralRoadMode='farm-bypass-v1'`: the rural ivory branch runs above the farm and turns around its east edge before rejoining the main corridor. This changes visual ground geometry only; gameplay coordinates remain unchanged.
- The corrected LIVE 390x844 capture shows the four modular plots fully on grass, a legible wooden perimeter, a north-facing entrance adjacent to the ivory road and no marble running underneath crop beds.
- LIVE pixel evidence recorded 15,165 wood-colored pixels and 25,345 dirt-colored pixels in the rural frame, proving the new prop family is actually rendered on mobile rather than merely loaded.
- Registry `1.7.1`, rural `v2.1`, `world-v1.1`, 512px chunks, five districts, authored plaza transitions and depth occlusion all remained active. Final diagnostics again passed with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Validated composition rule: roads and district props must be checked against existing gameplay footprints before approval; visual ground should route around established interactive areas rather than visually slicing through them.
- Next rural bottleneck: the district now has a readable field boundary but still lacks a strong vertical landmark and layered edge density. A compact barn/silo cluster plus a restrained tree/hedge family is the next safe improvement; avoid adding generic noise to the central field.

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
