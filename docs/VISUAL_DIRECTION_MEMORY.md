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

## Validated World Road Transitions — World v1.2 / Registry 1.10.0 / 2026-09-02
- `src/environment/world-map.js` now reuses the existing authored `assets/plaza-transitions-v1.png` atlas and `TileRegistry.transitionMasks` for world-road edges instead of ending marble roads as hard binary rectangles against grass.
- Each road tile computes the same top/right/bottom/left neighbour mask used by the plaza and draws the authored transition overlay after the base marble tile. The mask queries global world coordinates, so edge decisions remain coherent across cached 512px chunk boundaries.
- The change is visual-only: road rectangles, district coordinates, movement, collisions, farm state, combat, economy, networking, chat and inventory were not changed.
- The visual commit `8aa7d10828c8c4480f1f46129a774dfac9f701a9` passed Kelo CI. The audit infrastructure was then aligned with the current world contract in `c6c300dd233052597a73fd1e71e8d8471d6b89cb` because the previous LIVE gate still waited for the obsolete `V5.56`/depth contract.
- GitHub Pages deployment for the aligned audit commit succeeded. LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.2`, `transitionAssetLoaded=true`, `roadTransitionMode='authored-road-edge-overlay-v1'`, five districts, 512px chunks and registry `1.10.0`.
- Final LIVE diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-road.png` confirms that horizontal and vertical ivory routes now have an authored grass↔marble pixel edge rather than a perfectly hard rectangular boundary. Intersections remain easy to read, the hero silhouette remains clear, and no visible chunk seam appears in the inspected frame.
- The same screenshot exposes the next largest environment bottleneck: several legacy district buildings still read as large flat wall rectangles with simple polygon roofs/windows and labels, substantially below the hero and ground quality bar. The next safe pass should replace one high-visibility legacy building family with an authored modular architecture atlas/prefab and proper back/front depth layers rather than adding more grass noise.

## Validated Authored Architecture Depth — V5.65 / Registry 1.10.1 / 2026-09-02
- `TileRegistry` now owns an `architectureAssets` family and the `styles.architecture` contract. The existing authored Kelo Luxe boutique raster is registered as architecture rather than being hard-coded only inside its renderer.
- `src/environment/luxe-kiosk-atlas.js` keeps the same authored artwork, world footprint, interaction and collision, but adds actor-specific front occlusion with `depthMode='building-base-y-occlusion-v1'`. Only the actor-sized clipped region is repainted above actors that are physically behind the building, so foreground actors are not accidentally hidden.
- The change is visual/render-layer only: movement, collision geometry, farming, combat, economy, networking, chat and inventory were not modified.
- Commit `47e048f604bd036edc9ec7ff7037878852543cca` passed Kelo CI and GitHub Pages deployment.
- LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.2`, registry `1.10.1`, architecture mode `authored-layered-raster-v1`, `depthWrapped=true`, `depthOcclusion=true` and `architectureOccluding=true` in the dedicated behind-building capture.
- Final LIVE diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-architecture.png` confirms that the player's body is correctly hidden by the boutique volume while the authored facade remains crisp and intact. The name label remains visible, which preserves multiplayer identification without flattening the building depth cue.
- The same capture makes the next largest bottleneck unambiguous: the adjacent legacy brown building still reads as a flat placeholder rectangle with a simple window and roof, far below the authored boutique, hero and ground quality. The next safe pass should replace one legacy architecture family with an authored modular facade/prefab through the new architecture registry contract, rather than adding more ground decoration.

## Validated Authored Market Pavilion — V5.67 / 2026-09-02
- Added original `assets/market-pavilion-v1.png`, a 224x160 authored pixel-art architecture asset using an ivory-stone facade, dark green roof, restrained gold trim, teal glazing, striped awnings and small planters. It replaces one high-visibility flat south-plaza obstacle visually without copying any external reference art or layout.
- The existing gameplay collider remains exactly `{x:1300,y:1870,w:200,h:80}`. The integration only marks overlapping legacy obstacle visuals `noDraw`; it does not resize, remove or relocate collision geometry and does not alter movement or other gameplay systems.
- `src/environment/luxe-kiosk-atlas.js` renders the pavilion through the existing world architecture layer and applies `building-base-y-occlusion-v1` using actor-sized clipped repaint, matching the already validated boutique depth pattern.
- The first dedicated LIVE check found a brittle certification bug: the pavilion was visible and occluding, but `legacyHidden` required an exact obstacle match and remained false. The integration was hardened to suppress any visible legacy obstacle overlapping the preserved pavilion collider while leaving its geometry untouched.
- Deployment QA finding: changing a visual JS module without bumping its query key can make a long-lived mobile audit context observe an old cached script even after Pages updates. `index.html` now loads the hardened pavilion module with a new cache key; future visual module changes should bump their deployed query key deliberately.
- Final Kelo CI for V5.67 succeeded, GitHub Pages deployment succeeded, and the dedicated LIVE mobile audit succeeded at 390x844 CSS / 780x1688 backing canvas.
- LIVE runtime contract validated `authored-market-pavilion-v1.1`, `ready=true`, `rendererWrapped=true`, `depthWrapped=true`, `legacyHidden=true`, `failed=false`, and `depthMode='building-base-y-occlusion-v1'`.
- Exact-color screenshot evidence recorded 28,040 stone pixels, 23,320 roof pixels, 10,695 gold pixels and 14,477 glass pixels, proving that the authored pavilion is actually rendered on mobile rather than only loaded.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-market-pavilion.png` confirms a readable building silhouette on mobile, a clear entrance aligned to the ivory route, no visible flat legacy bar over the facade, and correct character/building depth with the actor partially obscured by the roof when behind it.
- Next bottleneck: architecture is still split between one TileRegistry-owned boutique and a second authored pavilion whose asset metadata remains local to its renderer. The next safe technical/visual pass should formalize a reusable `architectureAssets` family in TileRegistry for multiple prefab types, then migrate another remaining flat legacy obstacle through that data-driven path instead of adding more one-off wrappers.

## Validated Architecture Prefab Registry — V5.68 / Registry 1.10.2 / 2026-09-02
- `TileRegistry` now owns both the market pavilion asset metadata and its placement/collision metadata through `architectureAssets.marketPavilion` and `architecturePrefabs.marketPavilion`.
- The architecture contract is now explicit as `registry-asset-placement-collision-v1`; the pavilion renderer consumes its asset path, world position, dimensions, base-Y and preserved gameplay collider from the registry instead of duplicating those values locally.
- The visible building and gameplay footprint were intentionally unchanged. The preserved collider remains `{x:1300,y:1870,w:200,h:80}` and the authored raster remains 224x160 at world position `(1288,1790)`.
- Kelo CI and GitHub Pages both passed for commit `7d6897443017933b5841e68a6c829ebb86d91655`.
- LIVE mobile audit passed at 390x844 CSS / 780x1688 backing canvas with registry `1.10.2`, `world-v1.2`, architecture prefab contract active, pavilion source `tile-registry-architecture-prefab`, `prefabId='market-pavilion-south'`, `occluding=true`, `legacyHidden=true`, and no runtime geometry divergence from the registry.
- Screenshot evidence remained identical in authored material coverage: 28,040 stone pixels, 23,320 roof pixels, 10,695 gold pixels and 14,477 glass pixels. Manual inspection confirms the pavilion remains crisp, centered on the ivory route and correctly occludes the actor behind its roofline.
- Final diagnostics remained clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Validated technical direction: future authored buildings should be represented as TileRegistry asset + prefab placement/collision metadata rather than each renderer owning duplicated hard-coded geometry.
- Next bottleneck: the Luxe boutique asset is registry-owned but its placement/collision/interact geometry is still local to `luxe-kiosk-atlas.js`. The next safe refactor is to migrate that boutique into the same prefab contract, then extract a generic architecture renderer/list so future legacy-building replacements do not each add another wrapper.

## Validated Luxe Architecture Prefab — V5.69 / Registry 1.10.3 / 2026-09-02
- `TileRegistry` now owns Kelo Luxe placement, preserved collider, interaction anchor/radius and occlusion thresholds through `architecturePrefabs.luxeBoutique`, using the same `registry-asset-placement-collision-v1` architecture contract as the market pavilion.
- `src/environment/luxe-kiosk-atlas.js` consumes the prefab instead of duplicating boutique world coordinates, collision geometry and interaction geometry locally. The authored asset, world position `(1248,1050)`, collider `{x:1272,y:1362,w:336,h:132}`, interaction anchor `(1440,1532)` / radius `220`, and existing depth behavior were intentionally preserved.
- Kelo CI passed for the deployed migration. GitHub Pages deployment for the aligned final audit commit `42f175fa63f72d71daf07181528c56517a38b90c` also passed.
- The first LIVE run correctly reached V5.69 / registry 1.10.3 with clean runtime diagnostics but failed because `scripts/live-world-audit.mjs` still required the obsolete boutique source string `tile-registry-architecture-asset`. The runtime was healthy; the certification contract was stale. The audit was corrected to require `tile-registry-architecture-prefab` and `prefabId='luxe-boutique-central'`, then rerun.
- Final LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas. Both world and dedicated architecture-prefab audit steps passed with registry `1.10.3`, `world-v1.2`, `source='tile-registry-architecture-prefab'`, `prefabId='luxe-boutique-central'`, `ready=true`, `rendererWrapped=true`, `depthWrapped=true`, and boutique `occluding=true`.
- The dedicated audit additionally verifies that boutique runtime asset, position, collider and interaction geometry are identical to `TileRegistry` values; the market pavilion prefab remains valid in the same run.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-luxe-prefab.png` confirms no visual regression: the large Kelo Luxe silhouette remains crisp and centered on the ivory route, the doorway/detail remains readable on mobile, and the player/depth relationship remains intact. The adjacent flat brown legacy building is still visibly below the authored architecture quality bar.
- Current architecture bottleneck: boutique and market pavilion now share registry-owned prefab metadata, but rendering/depth installation is still duplicated as separate wrappers in `luxe-kiosk-atlas.js`. The next safe technical pass should extract a generic authored-architecture prefab renderer/list while preserving per-prefab interaction hooks; after that, migrate another visible legacy building through the common path.

## Validated Generic Architecture Prefab Renderer — V5.70 / Registry 1.10.4 / 2026-09-02
- `src/environment/luxe-kiosk-atlas.js` now renders all registered authored architecture prefabs through one list-driven world wrapper and one shared depth wrapper instead of nesting one wrapper per building.
- `TileRegistry 1.10.4` owns the remaining per-prefab occlusion and actor-clip thresholds for both Kelo Luxe and the Market Pavilion; `styles.architecture.rendererMode='generic-prefab-list-v1'` makes the shared path explicit.
- `window.KELO_ARCHITECTURE_RENDERER` validated `mode='generic-prefab-list-v1'`, `prefabCount=2`, `ready=true`, `rendererWrapped=true` and `depthWrapped=true`. Existing boutique interaction/collision hooks and both authored asset placements were preserved.
- Implementation commit `c7b67bb892895ea35bfd77e038c0c912f1bebdfa` passed Kelo CI. The first LIVE run failed only because `.github/workflows/live-audit.yml` still forced `EXPECTED_REGISTRY=1.10.3`; runtime had already reached `V5.70 / 1.10.4` cleanly. Commit `573ae012925fc8acbc1bf8fb4d8b4af9b739f8f0` aligned that certification contract.
- The corrected Kelo CI, GitHub Pages deployment and LIVE mobile audit all passed. LIVE validated `world-v1.2`, registry `1.10.4`, two active authored prefabs, boutique occlusion and market occlusion, plus `legacyHidden=true` for the pavilion.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]` at 390x844 CSS / 780x1688 backing canvas.
- Manual inspection of `live-architecture.png` confirms Kelo Luxe remains crisp with its existing depth behavior. Manual inspection of `live-market-pavilion.png` confirms the market silhouette/entrance remain intact and the actor is correctly hidden behind the roof volume with only the upper head visible at the boundary; no legacy rectangle reappeared.
- Validated technical direction: future authored architecture should be added primarily as `architectureAssets + architecturePrefabs` data, with interaction hooks only where needed, rather than installing new world/depth wrappers.
- Next largest visual bottleneck: the flat brown legacy building still visible beside Kelo Luxe is now the clearest quality mismatch. The next safe pass should replace that one building/family with an original authored modular architecture prefab through the shared renderer, preserving its current gameplay footprint rather than adding more ground noise.


## Validated Architecture Depth Regression Guard — V5.76 / Registry 1.10.10 / 2026-09-02
- The LIVE workflow now derives `EXPECTED_REGISTRY` directly from `src/environment/tile-registry.js` instead of carrying a hard-coded registry version. This prevents certification drift when TileRegistry advances.
- The stricter gate immediately exposed a real Kelo Luxe regression introduced during the native-resolution PNG migration: the boutique prefab still advertised depth support, but its `occlusion` metadata had become `null`, so the shared architecture renderer loaded cleanly while `architectureOccluding=false`.
- Restored scale-adjusted TileRegistry occlusion metadata for the current native 192x222 Kelo Luxe asset: `sideInset=9`, `topInset=40`, `bottomPadding=4`, with actor clip padding `7/24/7`. Placement, interaction and gameplay collider were not changed.
- Registry advanced to `1.10.10` and the TileRegistry script cache key was bumped so GitHub Pages/mobile clients cannot retain the stale no-occlusion contract.
- Final deployed runtime commit `97c347b9321bb56828c202afa6a6bcda8ce88aac` passed Kelo CI, GitHub Pages and the complete LIVE mobile audit at 390x844 CSS / 780x1688 backing canvas. The audit validated `architectureOccluding=true`, `marketOccluding=true`, three registry-driven architecture prefabs, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the LIVE architecture and Luxe captures confirms that the player is again partially hidden by the boutique volume when physically behind it while the authored PNG remains crisp and readable.
- QA rule validated: audit expectations should come from the deployed source contract where possible, because a stale expected-version constant can hide newer runtime regressions instead of certifying them.
- Next largest visual bottleneck remains the flat brown legacy Mercado building directly beside/behind Kelo Luxe. It should be replaced through the existing `architectureAssets + architecturePrefabs` generic renderer while preserving its gameplay footprint.

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
