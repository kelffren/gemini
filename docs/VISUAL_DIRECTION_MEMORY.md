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


## Validated Legacy Facade Ownership + LIVE Deployment Gate — V5.78 / 2026-09-02
- Manual inspection of the genuinely deployed V5.77 architecture capture proved that `legacyBrownPlaceholdersRemoved=true` was insufficient: a brown `Mercado` facade was still visibly drawn behind Kelo Luxe even though the matching obstacle rectangles had been removed.
- Repository-wide source inspection located the true visual owner in `engine-y.js`; it draws four late legacy facades (`Mercado`, `Banco`, `Atelier`, `Café Oro`) after the world renderer. Collision removal in `luxe-kiosk-atlas.js` therefore cannot remove these visuals.
- V5.78 adds a visual-only authored-overlap rule in `engine-y.js`: legacy facades are suppressed only when at least 35% of their area is covered by the current Kelo Luxe prefab bounds from TileRegistry. This suppresses `Mercado` and `Atelier` while leaving `Banco` and `Café Oro` visible. Gameplay collision, movement, interaction and unrelated systems are unchanged.
- The LIVE audit now explicitly certifies `KELO_LEGACY_HOUSE_RENDERER`, requiring `Mercado` and `Atelier` in `suppressedTitles` and absent from `visibleTitles`. The final V5.78 audit passed at 390x844 CSS / 780x1688 backing canvas with registry `1.10.10`, architecture renderer `v1.3`, boutique and market depth occlusion active, and zero console, failed-request or HTTP errors.
- Manual inspection of `live-architecture.png` confirms the prior brown Mercado/Atelier geometry and labels are gone from behind Kelo Luxe; the authored boutique is now visually isolated and readable against grass/marble.
- A separate QA defect was also validated and fixed: a LIVE run had previously passed while GitHub Pages still served V5.76 / architecture renderer v1.2. Both LIVE auditors now derive and require the source build title plus architecture renderer version/mode, in addition to TileRegistry, so stale Pages deployments cannot certify a newer visual change.
- Current next architecture bottleneck: `Banco` and `Café Oro` remain late procedural/legacy facades. Replace one with a registry-driven authored prefab using the generic architecture renderer rather than broadening the suppression rule.


## Validated Banco Authored Prefab + Registry-Driven Legacy Suppression — V5.80 / Registry 1.10.11 / 2026-09-02
- Current Pixadom research reinforces replacing old placeholder spaces with authored destinations before adding indiscriminate environmental noise: its 2026 roadmap prioritizes environmental design/furnishing, decorative-object variety and mobile camera improvements, and its June 27, 2026 update explicitly replaces one of its oldest placeholder interiors with a complete authored shop. Use this as a density/readability/consistency reference only; do not copy assets or layouts.
- Added original static authored architecture asset `assets/banco-hall-v1.svg`, a crisp 160x128 pixel-style bank hall using ivory stone, dark green/teal roof massing, cool glass and restrained gold accents. It is data-driven through `architectureAssets.bancoHall` + `architecturePrefabs.bancoHall`.
- TileRegistry advanced to `1.10.11`. `banco-hall-central` preserves the exact prior Banco gameplay collider `{x:1664,y:1376,w:128,h:96}` and uses the existing generic architecture renderer/depth contract; movement and unrelated gameplay systems were not changed.
- `engine-y.js` legacy-facade suppression is now driven by all `legacyVisualReplacement` architecture prefabs instead of Kelo Luxe alone. The old public audit version/mode strings remain temporarily for backward certification compatibility, while `coverageSource='registry-prefabs-v1'` records the generalized source.
- Final deployment commit `39518f648805554e06ddeb923805c54465d3b112` passed Kelo CI and GitHub Pages. LIVE mobile audit also passed at 390x844 CSS / 780x1688 backing canvas with title `Kelo World — V5.80`, `world-v1.2`, registry `1.10.11`, architecture renderer `architecture-prefab-renderer-v1.3`, `prefabCount=4`, `ready=true`, and both render/depth wrappers active.
- LIVE runtime reported `suppressedTitles=['Mercado','Banco','Atelier','Café Oro']` and `visibleTitles=[]`. This is valid rather than accidental blanking: the generalized overlap check suppresses each late procedural facade only where a registry-authored replacement covers at least 35% of it; Kelo Luxe, Banco Hall and Commerce Arcade provide the corresponding authored coverage.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`; boutique and market depth captures remained occluding.
- Manual inspection of `live-mobile.png` confirms Banco is visibly present near the bottom of the 390px mobile viewport as a readable ivory/green landmark with windows, central doorway and gold detail; paths and hero sprites remain legible. Manual inspection of `live-architecture.png` confirms Kelo Luxe remains intact with no legacy brown facade reappearing.
- Error corrected during integration: generalizing the legacy facade renderer initially changed its audit-facing version/mode identifiers and would have failed the existing LIVE contract despite healthy rendering. The generalized implementation now preserves those historical identifiers while exposing `coverageSource='registry-prefabs-v1'`, and the final CI/Pages/LIVE sequence passed.
- Next visual bottleneck: architecture now covers the visible late legacy facades, so the next pass should stop replacing placeholders blindly and improve authored-building quality/variety itself—especially roof volume, corner modules and facade modularity for Commerce Arcade/Banco—while keeping the common TileRegistry prefab renderer and mobile readability.


## Validated Banco Hall Silhouette — V5.81 / Registry 1.10.12 / 2026-09-02
- `assets/banco-hall-v1.svg` keeps the existing 160x128 authored asset footprint and unchanged gameplay collider `{x:1664,y:1376,w:128,h:96}`, but now uses a stepped hip roof, central pediment, corner caps, deeper eaves and asymmetric window highlights to reduce the previous flat-box silhouette on mobile.
- `TileRegistry 1.10.12` cache-busts Banco Hall as `assets/banco-hall-v1.svg?v=2`; architecture remains registry-driven through the generic prefab renderer and no movement, collision, economy, combat, networking, chat or inventory behavior changed.
- LIVE V5.81 validation passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.2`, four architecture prefabs, architecture renderer `architecture-prefab-renderer-v1.3`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-mobile.png` confirms Banco Hall is visible at the bottom of the mobile frame and the roof now has a stronger tiered silhouette and central crown while the entrance remains aligned and readable.
- QA gap fixed: `.github/workflows/live-audit.yml` now watches `assets/banco-hall-v1.svg` directly, so future Banco art-only edits cannot bypass the mobile LIVE audit.
- Next largest bottleneck: Commerce Arcade remains a tall, long rectangular mass; the next safe visual pass should add modular roof/end-cap variation or split its facade rhythm without changing the existing gameplay footprint.


## Validated Commerce Arcade Silhouette — V5.82 / Registry 1.10.13 / 2026-09-02
- Current Pixadom reference still supports the same useful rule for Kelo World: dense authored social spaces remain readable because landmarks, paths, vegetation clusters and facade modules have distinct silhouettes rather than relying on uniform surface noise. Eldria's current 2026 presentation similarly emphasizes recognizable regions/landmarks in a top-down pixel world. These are density/readability references only; no art or layout was copied.
- `assets/commerce-arcade-v1.svg` was refined in place without changing its 160x432 asset bounds, world placement, 120x400 gameplay collider, interaction systems or renderer architecture.
- The arcade now uses stepped roof masses, wider terminal caps, inset roof planes, alternating facade projections/shop-bay widths, structural piers and sparse west-edge garden pockets. This breaks the former single long slab rhythm while preserving the existing registry-driven prefab contract.
- `TileRegistry` advanced to `1.10.13` and cache-busts the arcade asset as `assets/commerce-arcade-v1.svg?v=2`; the page build advanced to V5.82 and the registry script cache key was bumped with it.
- Kelo CI, GitHub Pages and the LIVE mobile screenshot audit all passed for commit `5931aced856be08b45482f52b750237879c0a5d0`.
- LIVE 390x844 CSS / 780x1688 canvas validation confirmed `world-v1.2`, architecture renderer `architecture-prefab-renderer-v1.3`, four prefabs, active arcade occlusion, registry/runtime geometry agreement, and zero console, failed-request or HTTP errors.
- Manual inspection of `live-commerce-arcade.png` confirms the new stepped end caps and alternating facade bays are legible on mobile and the arcade no longer reads as one completely uniform vertical rectangle. The large central roof mass is still visually heavy, so further improvement should come from modular courtyards/recesses or stronger side-volume segmentation rather than adding generic grass noise.
- Next visual bottleneck: the Commerce Arcade still occupies a very large continuous roof area compared with Kelo Luxe and Banco. A safe next pass should test one or two registry-driven roof/courtyard modules or facade recesses that preserve the exact collider and renderer contract, then re-audit mobile composition.


## Validated Commerce Arcade Courtyard — V5.83 / Registry 1.10.14 / 2026-09-02
- Commerce Arcade keeps the exact 160x432 authored asset footprint and the existing registry prefab placement/collision contract `{x:1530,y:1400,w:120,h:400}`; no gameplay coordinates, movement, networking, combat, economy, chat or inventory systems changed.
- Added a west-side stone-framed garden courtyard/recess in the central run, with restrained planting and a small water/fountain cue. The goal is to break the long continuous roof mass with one readable authored sub-space rather than add generic surface noise or another renderer special case.
- The asset is served as `assets/commerce-arcade-v1.svg?v=3`; TileRegistry is `1.10.14`; the live page contract is V5.83 and continues to use `architecture-prefab-renderer-v1.3` / `authored-prefab-no-legacy-buildings-v1`.
- LIVE mobile validation passed at 390x844 CSS / 780x1688 canvas. Commerce Arcade was ready, legacy replacement remained active, architecture and market occlusion remained active, and the final diagnostic report contained `consoleErrors=[]`, `failedRequests=[]`, and `httpErrors=[]`.
- Manual inspection of `live-commerce-arcade.png` confirms that the central green/ivory courtyard reads clearly at mobile scale and creates a strong pause in the formerly continuous dark-green mass while the ivory/glass shop frontage stays legible. It currently reads more like an inset roof garden than true negative-space architecture, so further carving should be incremental rather than enlarging it blindly.
- Research validation: Pixadom's current 2026 roadmap continues to prioritize environmental design/furnishing, decorative layout variety and mobile-facing improvements, while its June 27, 2026 update describes replacing an old placeholder interior with a fully authored destination. The transferable principle for Kelo World is to use small authored sub-spaces and clear landmarks to create density without noise, never copying Pixadom art or layouts.
- Next bottleneck: the east ivory/glass frontage of Commerce Arcade still repeats five vertically similar shop bays and reads more mechanically than the new west-side courtyard. The next safe pass should vary 1–2 frontage modules or add a small entrance canopy/signage hierarchy through the existing asset/registry contract, without changing the collider or generic architecture renderer.

## Validated Commerce Arcade Entrance Hierarchy — V5.84 / Registry 1.10.15 / 2026-09-02
- Current public Pixadom material still supports a browser/mobile-first readability rule: environmental density works best when important destinations and modules are easy to distinguish at a glance; its roadmap continues to emphasize environmental design/furnishing and mobile camera usability. Eldria's current top-down presentation similarly leans on recognizable region/landmark silhouettes. These are reference principles only; no external art or layout was copied.
- `assets/commerce-arcade-v1.svg` keeps its exact 160x432 asset bounds, world placement and preserved gameplay collider `{x:1530,y:1400,w:120,h:400}`. The existing generic architecture renderer and all unrelated gameplay systems remain unchanged.
- The previously equivalent central storefront was replaced by a taller double-door entrance with a dark-green canopy, ivory crown and restrained gold threshold/signage. The purpose is to establish one obvious primary entrance at mobile scale without increasing facade noise or creating another renderer special case.
- TileRegistry advanced to `1.10.15` and cache-busts Commerce Arcade as `assets/commerce-arcade-v1.svg?v=4`; the deployed page contract advanced to V5.84.
- Kelo CI passed all key-file, server-syntax and environment/visual-contract checks. The LIVE mobile workflow then waited for Pages convergence and passed both the world audit and dedicated authored-architecture audit.
- LIVE validation at 390x844 CSS / 780x1688 backing canvas confirmed `world-v1.2`, registry `1.10.15`, architecture renderer `architecture-prefab-renderer-v1.3`, four prefabs, arcade `ready=true`, arcade occlusion active, asset source `assets/commerce-arcade-v1.svg?v=4`, and unchanged runtime prefab/collider geometry.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-commerce-arcade.png` confirms the central frontage now has stronger entry hierarchy: the double doors/canopy read as a distinct destination while the courtyard and stepped roof still provide the larger massing breaks. The building remains visually dense but readable on the 390px mobile frame.
- Next bottleneck: the Arcade's lower and upper shop modules still share very similar glass proportions and gold strips. The next safe improvement should vary one secondary bay family or introduce a small corner/end-cap facade module, preserving the current collider and common registry-driven renderer.


## Validated Commerce Arcade Secondary Bay Family — V5.87 / Registry 1.10.16 / 2026-09-02
- Current public Pixadom material continues to support a browser/mobile-first environment rule: finish authored environmental design/furnishing and use decorative/layout variety to distinguish destinations rather than adding uniform noise. Its current roadmap also keeps mobile usability in scope. These are reference principles only; no external art or layout was copied.
- `assets/commerce-arcade-v1.svg` keeps its exact 160x432 asset bounds, world placement and preserved gameplay collider `{x:1530,y:1400,w:120,h:400}`. No movement, economy, combat, networking, chat, inventory or renderer behavior changed.
- The Arcade frontage now has two secondary shop-bay families: broad teal vitrines at the terminal bays and inset intermediate storefronts with ivory canopies plus restrained green/gold valances. The existing central primary entrance remains the strongest hierarchy point.
- TileRegistry advanced to `1.10.16`, serving the Arcade as `assets/commerce-arcade-v1.svg?v=5`; the deployed page contract is V5.87.
- The first V5.87 Kelo CI failed because its UI certification still required obsolete `luxe-shell-v2.0` / `forest-ivory-gold` strings after concurrent shell work had already moved to v3. The runtime visual change was healthy. The CI contract was minimally aligned to `kelo-luxe-v3-style` and `--lx-forest:#173f36`; the corrected Kelo CI and GitHub Pages build both passed.
- LIVE mobile validation passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.2`, registry `1.10.16`, architecture renderer `architecture-prefab-renderer-v1.3`, four prefabs, Arcade asset `?v=5`, intact collider geometry and active occlusion.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-commerce-arcade.png` confirms the intermediate canopy/inset modules are distinguishable from the wider terminal vitrines on mobile while the courtyard and primary entrance remain readable. No missing asset, seam or depth regression was visible.
- Next bottleneck: Commerce Arcade now has better storefront rhythm, but its top/bottom terminations still read as the same long vertical family. The next safe pass should make one end-cap/corner module more distinctive or add modest side-volume segmentation without changing collider, asset bounds or the common prefab renderer.


## Validated Commerce Arcade North Corner End-Cap — V5.89 / Registry 1.10.17 / 2026-09-02
- `assets/commerce-arcade-v1.svg` keeps its exact 160x432 authored bounds, world placement and preserved gameplay collider `{x:1530,y:1400,w:120,h:400}`. The common architecture renderer, movement and unrelated gameplay systems remain unchanged.
- The north termination is now intentionally asymmetric: a compact chamfered pavilion with an ivory frame, brighter teal glazing, stepped dark-green roof and restrained gold threshold replaces the former broad cap that visually repeated the south end.
- TileRegistry advanced to `1.10.17`, serves the Arcade as `assets/commerce-arcade-v1.svg?v=6`, and records `variant='north-corner-endcap-v1'` plus the authored module list. CI and the LIVE audit explicitly require that module, preventing a cached or older symmetrical asset from certifying the pass.
- The visual implementation commit `1a0d2ac2fcf54aef006d5c8efa361495f01397c7` passed Kelo CI. Compatible concurrent interface work then advanced the final deployed page to V5.89 at `574dac50cc3739ed7573d014ff52397daf9f4fb3`; its Kelo CI, GitHub Pages deployment and complete LIVE mobile audit all passed with the end-cap intact.
- LIVE validation at 390x844 CSS / 780x1688 backing canvas confirmed registry `1.10.17`, architecture renderer `architecture-prefab-renderer-v1.3`, four prefabs, Arcade asset `?v=6`, intact runtime geometry, active actor/building occlusion and 2,232 exact pixels from the new end-cap glass marker.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Manual inspection of `live-commerce-arcade.png` confirms the north pavilion reads as a separate corner destination at mobile scale. The top and bottom now have visibly different silhouettes, while the courtyard, primary entrance and secondary shop families remain readable and no seam or depth regression appeared.
- Direction after validation: Commerce Arcade now has enough hierarchy to stop spending passes on small internal decoration. The next visual pass should compare the surrounding scene and improve the weakest neighboring landmark or route-to-entrance relationship, rather than adding indiscriminate detail to this building.


## Validated Authored Grass Variation — V5.91 / Registry 1.10.19 / World v1.3 / 2026-09-02
- Current repo state is intentionally Luxe-only after the Market/Arcade/Banco authored prefabs were removed by the player. The previous CI and LIVE gates still required those deleted assets/prefabs, so certification was stale rather than representative of the current world. The gates now validate the actual Luxe-only renderer (`architecture-prefab-renderer-v1.4`, `mode='luxe-only-v1'`, one prefab) and keep the removed market disabled.
- Added original modular raster `assets/grass-variation-v1.png`, 128x64 with eight 32x32 grass variants. The variants use a consistent vivid-green base with sparse authored light/dark grass clusters and very restrained flower pixels, replacing the more uniformly noisy world-grass rhythm without changing roads, district geometry, movement, collisions or unrelated gameplay systems.
- TileRegistry advanced to `1.10.19`, owns `atlases.grassVariation`, exposes eight `grassAuthored` variants, and records `grassMode='authored-eight-variant-atlas-v1'`. `world-map.js` advanced to `world-v1.3` and renders non-road world tiles from that atlas while preserving the existing authored marble/transition path system and 512px chunk cache.
- Final deployed audit commit `590c218f81646b780444524a5e77bb21950159cf` passed Kelo CI, GitHub Pages and the complete LIVE mobile audit at 390x844 CSS / 780x1688 backing canvas.
- LIVE runtime validated `grassVariationAssetLoaded=true`, `grassVariationCount=8`, registry `1.10.19`, world `v1.3`, Luxe-only architecture ready and Kelo Luxe depth occlusion active. Exact screenshot evidence found 1,028,856 base-green pixels, 7,003 light grass pixels, 4,549 dark grass pixels, 396 pink flower pixels and 387 blue flower pixels in the dedicated grass frame.
- Final diagnostics were clean: `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-grass.png` confirms the field now reads as a calmer continuous lawn with small clustered blades/flowers instead of every tile carrying the same confetti-like detail. Manual inspection of `live-mobile.png` confirms paths and hero silhouettes remain highly legible; no chunk seam or road regression appeared.
- Next bottleneck: after simplifying the grass, the remaining simple environmental props (especially the small round tree/sign family visible around Plaza Central) now stand out more strongly against the high-quality hero and Kelo Luxe art. The next safe visual pass should replace one of those prop families with authored transparent pixel-art assets through TileRegistry/prop layers rather than adding more ground noise.


## Validated Plaza Nature Prop Family — V5.92 / Registry 1.10.20 / 2026-09-02
- Current Pixadom/top-down research reinforces a useful Kelo World rule: dense social spaces remain readable when environmental detail is concentrated in authored prop clusters with distinct silhouettes and calm negative space, rather than by increasing uniform ground noise. This is a density/readability/consistency reference only; no external art or layout was copied.
- Added original transparent `assets/plaza-nature-v1.svg`, a 192x96 authored atlas containing two 96x96 plaza tree variants. TileRegistry `1.10.20` owns the atlas, four visual-only Plaza Central placements and the explicit `actor-base-y-v1` depth contract; collision and movement are unchanged.
- Added `src/environment/plaza-nature.js` as a dedicated prop render/depth layer. The tree family renders after the base world and re-renders only overlapping actors whose base-Y is in front, preserving the expected behind/in-front relationship without changing gameplay footprints.
- Page contract advanced to `Kelo World — V5.92`; the authored asset is loaded with exact 192x96 dimension validation and exposes `KELO_PLAZA_NATURE_AUDIT` rather than silently falling back.
- Implementation commits `76452fd2a8010a169439f84d902f1097880230a6`, `4d1c38e4324deb4656d4b444986ed8df29ca4943`, `1a658f52d3fb60a8e62c03703194c8c2c49ce175` and `31eb947f84b6c1fda9f1293c8155fd5c8b3eaa9f` reached main. Final validation/audit guard commit `537ac28f4a32aeb2128a81f5e9a6c5f6940de7ec` passed Kelo CI and the LIVE mobile workflow.
- The first green LIVE capture did not actually frame a new tree, so it was not accepted as sufficient visual evidence. `scripts/live-world-audit.mjs` was hardened to require `plaza-nature-v1`, `assetLoaded=true`, four registry props and `depthMode='actor-base-y-v1'`, and now emits a dedicated `live-plaza-tree.png` frame.
- Corrected LIVE validation passed at 390x844 CSS / 780x1688 backing canvas with `ready=true`, `assetLoaded=true`, `failed=false`, `propCount=4`, registry `1.10.20`, world `v1.3`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-plaza-tree.png` confirms the new authored block-cluster tree renders crisply on grass and remains legible beside the high-detail hero/Kelo Luxe art. The same frame also proves the next bottleneck: a legacy small round tree and simple sign remain visible nearby and now look substantially weaker than the new family.
- Next safe visual pass: remove/replace the remaining legacy round-tree/sign prop family through the same TileRegistry/prop-layer contract, or connect the approved authored plaza-ground asset as the next major floor upgrade. Do not add more uniform grass noise.


## Validated Active District Label Density — world-v1.5 — 2026-09-02

- Public Pixadom references reinforced a useful composition rule for mobile top-down scenes: dense props and focal points read best when circulation space stays visually quiet; persistent global labels compete with that hierarchy instead of helping it.
- `src/environment/world-map.js` now renders only the district label for the district containing the camera, rather than drawing all five labels continuously. The active label uses a compact 13px mono treatment with a restrained dark backing, thin gold accent, and ivory text.
- The change is visual-only: district geometry, roads, movement, collisions, economy, combat, networking, chat, and inventory are unchanged.
- `KELO_WORLD_AUDIT` is now `world-v1.5` and exposes `districtLabelMode: active-district-only-v1` plus `activeDistrictLabel` for LIVE verification.
- First LIVE run correctly failed because GitHub Pages/browser cache still served `world-v1.4`; `index.html` had not advanced the `world-map.js` cache key. Bumping the script URL from `?v=174` to `?v=175` fixed deployment freshness. This validates a general rule: every renderer behavior/version change must advance its HTML script cache key, not only internal atlas query keys.
- Final validation: Kelo CI passed, Pages passed, mobile LIVE audit passed at 390x844 CSS / 780x1688 canvas, `world-v1.5` was active, and console errors, failed requests, and HTTP errors were all empty.
- Next visual bottleneck visible in the validated Plaza capture: legacy round trees / debug-like world markers and NPC labels still contrast sharply with the authored plaza ground, Luxe boutique, and authored plaza-nature family. Replace or suppress these incrementally without touching gameplay semantics.


## Validated World Placard Cleanup — World v1.6 / 2026-09-02
- Current public Pixadom/browser MMO references reinforce a mobile readability rule: authored environment landmarks and focal props should carry place identity; persistent prototype-style labels drawn directly into the world compete with scenery at small viewports. This is a readability/density reference only; no external art or layout was copied.
- `src/environment/world-map.js` no longer paints the active district's dark rectangular name placard into the world canvas. District detection remains intact for audit/navigation state; only the decorative world overlay was removed.
- World audit advanced to `world-v1.6` with `districtLabelMode='world-placards-removed-v1'`; `index.html` cache-busts the renderer as `world-map.js?v=176`.
- Final deployed visual commit `b8b0628b5373bb8d6df9c1cd2687abd4b21e65fd` passed Kelo CI, GitHub Pages and the LIVE mobile audit at 390x844 CSS / 780x1688 backing canvas.
- LIVE runtime validated registry `1.10.21`, authored plaza ground loaded with no fallback, four plaza-nature props, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-plaza.png` confirms the district placard is gone with no regression to plaza/road readability. The next largest visual bottleneck is now clearer: legacy flat circular environment/NPC markers and primitive tree/dummy visuals still read as placeholders beside the authored plaza, nature and architecture. The next safe pass should replace or suppress one high-visibility placeholder family through data-driven props/layers rather than adding more ground noise.


## Validated Plaza Fountain Focal Point — V5.97 / Fountain v1.3 / 2026-09-03
- Current Pixadom reference reinforces replacing visibly weak placeholder/focal spaces with authored destinations before adding uniform environmental noise; this is used only as a density/readability/consistency principle, not as copied art or layout.
- The pre-existing V5.96 LIVE fountain gate exposed a real visual defect: the layered fountain compositor reported ready and depth-correct, but the mobile ROI contained only 30/29 qualifying water pixels behind/in front, so the central plaza focal point was effectively absent despite healthy runtime state.
- Added original transparent authored layer assets `assets/plaza-fountain-back-v2.svg` and `assets/plaza-fountain-front-v2.svg`, each 200x140 with crisp pixel-style ivory stone, restrained gold trim and high-contrast cyan water/jets. `src/environment/plaza-depth.js` advanced to `plaza-fountain-v1.3` / `authored-svg-layer-pair-v2` while preserving the exact existing world bounds `(1340,1450,200,140)`, `baseY=1555`, collider `{x:1390,y:1492,w:100,h:60}` and `final-composite-back-actor-front-v2` depth logic.
- The LIVE workflow now derives the expected fountain version from source and watches the v2 fountain SVGs directly; the dedicated fountain audit keeps its strict visual pixel gate instead of accepting asset-ready state alone.
- Final deployed commit `6e0b616ad8b1238d2de0eb5a3fce476b92d0db6f` passed Kelo CI, GitHub Pages and the complete LIVE mobile audit at 390x844 CSS / 780x1688 backing canvas.
- Corrected LIVE evidence measured 12,702 water / 14,881 gold pixels in the behind frame and 12,134 water / 14,438 gold pixels in the front frame, with `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`. Manual inspection confirms the fountain now reads immediately as the Plaza Central focal point and preserves actor front/behind depth.
- QA rule validated: for focal props, readiness flags and draw counters are insufficient; the LIVE gate should verify visible authored material in the exact prop ROI and the screenshot must still be manually inspected.
- Next visual bottleneck visible in the validated fountain capture is no longer the focal point: the procedural circular NPC markers/labels (`Portero`, `Maestro`) and the `DUMMY` training block/sign now read as the clearest prototype elements beside the authored plaza, fountain and hero sprites. Improve one of those presentation families without changing NPC/training gameplay semantics.


## Validated Authored Plaza Training Dummy — V5.98 / Registry 1.10.22 / 2026-09-03
- Current Pixadom roadmap continues to reinforce a useful Kelo World rule: finish authored environmental design/furnishing and improve decorative/layout variety while keeping mobile usability in scope. Applied here only as a density/readability/consistency principle; no external art or layout was copied.
- Replaced the Plaza Central training dummy's generic circular-avatar presentation and persistent `DUMMY` ground label with original `assets/training-dummy-v1.svg`, a 96x96 crisp pixel-style wooden/straw target prop using Kelo ivory/gold/forest accents.
- TileRegistry advanced to `1.10.22` and now owns `atlases.trainingDummy`, `trainingDummyProp`, and `styles.trainingDummy` with `mode='registry-authored-training-prop-v1'`.
- Gameplay semantics were intentionally preserved: the training target remains exactly at anchor `(1580,1680)` with radius `22`, 80 HP, the same hit/respawn logic and the same Maestro timed-trial integration. `engine-o.js` validates this anchor against TileRegistry before enabling the authored asset and retains a primitive fallback only for load failure.
- Final deployed commit `451373b03c1d987ee60a443d7b62084eca98df24` passed Kelo CI and GitHub Pages. The complete LIVE mobile workflow passed at 390x844 CSS / 780x1688 backing canvas with registry `1.10.22`, authored plaza/fountain/nature architecture intact and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the LIVE plaza frame confirms the authored wooden target is visible at the training area and the old `DUMMY` text is gone. The nearby `Maestro` circular NPC marker remains visually dominant and now reads as the clearest remaining prototype element in that corner.
- QA finding reinforced: changing a legacy engine visual requires bumping its script query key in `index.html`; V5.98 loads `engine-o.js?v=95` and `tile-registry.js?v=231` so Pages cannot certify stale visual code.
- Next visual bottleneck: replace or restyle the procedural circular NPC marker/label family (`Portero`, `Maestro`) without changing NPC interaction/dialogue semantics. Prefer a registry-driven authored NPC marker/body treatment and keep mobile label density restrained.

## Validated Authored Plaza NPC Family — V5.99 / Registry 1.10.23 / 2026-09-03
- Current Pixadom, Eldria and Thundoria references reinforce a transferable mobile top-down rule: dense social spaces stay readable when destinations and characters have distinct authored silhouettes and labels are restrained instead of permanently competing with scenery. These are density/readability/consistency references only; no external art or layout was copied.
- Added original transparent `assets/plaza-npcs-v1.svg`, a 288x96 atlas with three 96x96 Plaza NPC visual identities: blue/ivory Portero, forest/gold Joyero and burgundy/ivory Maestro. TileRegistry `1.10.23` owns the atlas, sprite mapping and `styles.plazaNpcs` contract with `mode='registry-authored-npc-visual-v1'` and `labelMode='proximity-name-v1'`.
- `engine-p.js` now consumes that registry family instead of presenting Plaza NPCs as white-stroked Canvas circles. Existing NPC coordinates, dialogue, Jeweler timing minigame, Maestro trial hookup and reward behavior remain unchanged; the previous circular renderer exists only as an asset-load fallback.
- Persistent NPC world labels were removed. A name now appears only when the local player is close to or actively talking to that NPC, reducing mobile text competition without changing interaction semantics.
- Page contract advanced to `Kelo World — V5.99`, with `tile-registry.js?v=232` and `engine-p.js?v=95` to prevent stale Pages certification.
- Kelo CI and GitHub Pages passed for final validation commit `2a9cc5f33d07574e0ef58e1b0bc2a7594a1a9275`. The complete LIVE mobile workflow also passed at 390x844 CSS / 780x1688 backing canvas: world, NPC, Luxe architecture and layered-fountain audits all succeeded.
- The first dedicated NPC audit correctly failed because one training-area frame contained Joyero/Maestro but did not actually frame Portero, despite healthy runtime state. The audit was corrected to capture a second Portero-specific frame rather than weakening its pixel gate.
- Final visible evidence measured 1,016 exact forest NPC pixels and 2,186 burgundy pixels in `live-plaza-npcs.png`, plus 1,501 exact blue Portero pixels in `live-plaza-portero.png`; `fallbackActive=false`, three NPCs were present, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection confirms the three NPCs now read as authored character/role silhouettes rather than debug circles. The same training-area frame exposes the next large mismatch: the brown `Café Oro`/legacy-looking volume and remaining world/player label clutter on the east side now compete more strongly with the refined plaza. The next safe pass should identify the actual renderer/ownership of that visible brown volume or further reduce nonessential label clutter, changing only presentation and preserving gameplay semantics.


## Validated Authored PNG Plaza Fountain — V6.00 / 2026-09-02
- The Plaza Central fountain now uses the user-selected authored uppercase PNG layer pair: `assets/plaza-fountain-back.PNG` and `assets/plaza-fountain-front.PNG`; the provisional SVG fountain pair is no longer the live source.
- The two production PNGs are 1254x1254 RGBA assets and render at a shared 200x200 world footprint centered at `(1440,1520)`, preserving their square aspect ratio instead of vertically compressing them.
- Layer order is validated as fountain back → actors → fountain front → actors whose base-Y is in front. The gameplay collider remains unchanged at `{x:1390,y:1492,w:100,h:60}`.
- `plaza-fountain-v1.5` exposes `assetMode='authored-png-layer-pair-v1'` and keeps `depthMode='final-composite-back-actor-front-v2'`.
- LIVE mobile audit at 390x844 CSS / 780x1688 canvas validated both behind/front depth captures, visible cyan water and gold/ivory materials, `ready=true`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- QA finding: GitHub initially contained the PNGs with accidental leading spaces in their filenames; the same binary blobs were normalized to clean uppercase paths. The first CI also exposed that the repo exports were 1254x1254, so runtime dimensions and aspect ratio were corrected before acceptance.
- Visual inspection confirms the two layers align cleanly in the circular court and the front railing provides believable player occlusion without changing movement or other gameplay systems.


## Validated Plaza Fountain Alignment — V6.05 / Fountain v1.6 / 2026-09-03
- The authored fountain remains exactly the existing `assets/plaza-fountain-back.PNG` and `assets/plaza-fountain-front.PNG`; neither source image was regenerated or replaced.
- Manual review of the previous LIVE composition found the root visual defect: drawing the front PNG at the same 200x200 placement as the already-complete back fountain made the front rim cut across the center instead of reading as the lower foreground edge.
- Validated placement keeps the back at world `{x:1340,y:1420,w:200,h:200}` and renders the front layer centered and reduced to 74% at `{x:1366,y:1508,w:148,h:148}`. Depth crossover is `baseY=1592`; gameplay collision remains unchanged at `{x:1390,y:1492,w:100,h:60}`.
- LIVE mobile inspection confirms the two authored PNGs now read as one coherent circular fountain: the lower rim and planters align with the back structure instead of slicing across the basin, while actors correctly pass behind the front layer and redraw in front after crossing its base-Y.
- Focused mobile LIVE audit validated `plaza-fountain-v1.6`, `alignmentMode='scaled-centered-lower-rim-v1'`, both 1254x1254 PNG sources loaded, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- QA decision: fountain-specific validation must be runnable independently of unrelated district audits so an unrelated failure cannot prevent inspection of a changed focal asset. The full global zero-error gate remains unchanged and separate.


## Validated Rural Edge Density + Luxe Renderer Integration — V6.05 / 2026-09-03
- Fresh public reference review of Pixadom, Eldria and Thundoria reinforced a consistent top-down MMO composition rule for Kelo World: concentrate authored props at borders and district edges while keeping central circulation readable, and give regions their own prop/silhouette vocabulary instead of increasing uniform ground noise. These references were used only for density/readability/consistency; no external art or layouts were copied.
- `src/environment/rural-landmarks.js` now uses the existing TileRegistry-owned `ruralNature` atlas to place 17 low-profile authored hedge, flower, grass, stump and stone cells around the west/south/east farm edges. The farm center remains clear and the north gate/road approach is deliberately unobstructed. No collision, movement, farming state or unrelated gameplay system changed.
- LIVE validation exposed a pre-existing integration blocker that readiness flags did not reveal: `src/ui/luxe-shell.js` explicitly replaced `window.renderFarm` with an empty function to hide the old prototype farm overlay. That obsolete visual suppression was removed now that the modular rural soil/fence/nature renderer is production-ready; Luxe shell v3.2 records `hideFarmOverlay=false` and leaves the active environment hook intact.
- `engine-c.js` now invokes the active `window.renderFarm` hook at composition time, so modular environment wrappers are not bypassed by a stale lexical renderer binding. Script cache keys for both `engine-c.js` and `luxe-shell.js` were advanced during deployment verification.
- A dedicated 390x844 CSS / 780x1688 mobile rural audit now centers the real `STATE.farm`, requires the rural ground and edge atlases to be ready, checks 17 edge placements with `centerClear=true` and `northRoadClear=true`, verifies visible rural-material pixels, and fails on console/page/request/HTTP errors.
- Final Kelo CI for commit `c78dbcf4604bf9f371c2a91bf471cf641e948be5` passed. The complete LIVE mobile workflow also passed every world/rural/NPC/Luxe/fountain/Nobility step with `consoleErrors=[]`, `failedRequests=[]` and `httpErrors=[]`.
- Final rural screenshot evidence measured 130,767 qualifying rural-material pixels in the normal frame (up from ~4,322 while the Luxe suppression was active). Manual inspection confirms all four authored soil plots, the wooden perimeter/gate, sparse edge vegetation and clear north road are visible and legible beside the hero on mobile.
- QA rule validated: a module can report its atlas as loaded and still be fully suppressed by a later render/UI wrapper. Dedicated LIVE evidence must prove that the final composed frame—not only the module-local contract—contains the intended authored material.
- Next rural bottleneck: the farm now reads as a real authored destination, but the surrounding district still lacks a strong large-scale rural landmark. The next safe pass should add or restore one registry-driven barn/silo landmark with proper back/front depth while preserving open circulation, rather than adding more small grass decoration.


## Validated District Microdecals & Camera Culling — V6.07 / Registry 1.11.1 / 2026-09-02
- Current Pixadom and comparable top-down pixel MMO references reinforce a composition rule already useful for Kelo World: environmental density reads best when small details support the function and identity of a place instead of being distributed as uniform decorative noise. This pass uses that principle without copying external art or layouts.
- Added the original transparent modular atlas `assets/district-decals-v1.svg` (256x32, eight 32x32 cells) with separate microdetail families for Rural, Arena, Commerce and Gardens. Thirteen authored placements live in the registry extension and render in the intended `decals/details` layer above world ground and below gameplay props/actors; Central deliberately remains quiet.
- The first LIVE Gardens audit exposed a real camera/culling bug: `world-map.js` and the new decal layer consulted `window.camera`, while the game camera existed as a top-level lexical `const camera`. Off-plaza audit movement therefore did not drive chunk/decal culling and produced a large dark void even though asset readiness flags were green.
- The validated integration now exposes the existing camera reference to environment renderers without changing movement behavior. LIVE confirms `cameraBridge=true`, active district `gardens`, authored decal visibility, continuous terrain and no large dark void.
- Final 390x844 mobile LIVE diagnostics are clean: the district decal audit and the full world/rural/NPC/architecture/fountain suite passed with no console errors, failed requests or HTTP errors.
- Manual screenshot inspection shows the decals are appropriately subtle and preserve hero/path readability, but also confirms that surface microdetail is no longer the main Gardens bottleneck. The next safe high-value pass should add an authored multi-tile Gardens landmark/prop family (planters, hedges/flowerbeds, garden structure or water focal point) and less rectangular spatial composition before increasing generic ground noise.


## Validated Gardens Promenade Kit — V6.09 / World v1.7 / 2026-09-03
- Fresh public review of Pixadom, Eldria and comparable current top-down pixel MMO presentation reinforces a transferable composition rule for Kelo World: use clear circulation paths, clustered authored vegetation/props and recognizable sub-spaces instead of filling a district with uniform decorative noise. These references were used only for density, legibility and consistency; no external art or layout was copied.
- Added original modular `src/environment/gardens-atlas.js`, a 128x64 transparent pixel-art overlay atlas with eight 32x32 garden cells: horizontal/vertical hedges, flowerbed, water, hedge corner, stone plinth, stepping stones and flower tuft.
- `src/environment/world-map.js` advanced to `world-v1.7`. Jardines del Sur no longer depends on the previous single 704x352 marble pad; it now uses a forked promenade of smaller ivory path/court rectangles plus deterministic authored garden overlays on grass. The 512px chunk cache, world bounds, movement, collisions, economy, combat, networking, chat and inventory were not changed.
- Kelo CI passed for the deployed change. The first global LIVE audit correctly failed on an unrelated newly introduced equipment-system recursion (`ensure → recalculate → equippedItems → ensure`). The blocker was fixed minimally in `equipment-v1.0.1`, with a cache-key bump, without changing the visual feature or broader gameplay behavior.
- The corrected complete LIVE mobile audit passed at 390x844 CSS / 780x1688 backing canvas. Runtime validated `world-v1.7`, `gardensAssetLoaded=true`, `gardensMode='authored-garden-overlay-atlas-v1'`, `gardensPathMode='forked-promenade-v1'`, active district `gardens`, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of `live-district-decals.png` confirms the Gardens frame now has a readable cross/promenade hierarchy, repeated authored hedge rows, clustered flower beds, small stone/plinth details and open grass around the hero. The scene remains crisp on mobile and no dark culling void returned.
- Next Gardens bottleneck: the new path/hedge kit fixes the large rectangular-floor problem, but the district still lacks a strong multi-tile focal landmark and true vertical prop depth. The next safe pass should add one authored garden landmark such as a compact pond/fountain/pergola with back/front layers, rather than increasing generic grass noise.


## Validated Gardens Layered Fountain Landmark — V6.10 / Gardens v1.1 / 2026-09-03
- Current Pixadom/Eldria/top-down reference review reinforces using clear path axes, focal destinations and layered props with negative space rather than adding uniform ground noise; external references remain density/readability/consistency guides only and no external art or layout was copied.
- Added `src/environment/gardens-landmark.js` with an original embedded 320x128 modular 32px prefab atlas. The east fountain uses a 160x128 back composition plus a separate foreground-rim region in the same atlas and is rendered through `final-composite-back-actor-front-v1`.
- The landmark is visual-only: no collision, movement, economy, combat, networking, chat or inventory behavior was changed.
- Dedicated LIVE Playwright audit at 390x844 CSS / 780x1688 backing canvas validated `gardens-landmark-v1.1`, `assetLoaded=true`, `atlasMode='layered-prefab-atlas-v1'`, `prefabCount=1`, `frontOcclusionActive=true`, `world-v1.7`, `gardensAssetLoaded=true` and active district `gardens`.
- LIVE pixel evidence recorded 12,364 cyan pixels, 280,106 ivory pixels, 1,514 gold pixels and 968,237 green pixels; final diagnostics were `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection confirms the fountain reads as an immediate focal point from the forked promenade, the hero remains legible, and the foreground rim correctly occludes the actor when behind it.
- Validated direction: Jardines should now improve garden composition around this landmark (intentional hedge/flowerbed framing and cleaner transition from promenade to fountain) before adding another large prop. The largest remaining cross-district bottleneck is lower-quality legacy/procedural architecture elsewhere in the world.


## Validated Gardens Fountain Approach + Deployment-Aware Audit — World v1.8 / 2026-09-03
- Fresh public reference review reinforces a useful top-down pixel-world rule: high-density scenes stay readable when paths terminate deliberately at destinations and authored focal props sit inside clear negative space. Pixadom remains a reference for browser/mobile density and readability only; no external art or layout was copied. A current 32x32 top-down tileset reference also reinforces complete transition/autotile families and layered terrain over ad-hoc edge drawing.
- `src/environment/world-map.js` advanced to `world-v1.8`. The east Gardens fountain now has a one-tile-wide, two-tile-high ivory approach spur that closes the previous 32px grass gap between the forked promenade and the landmark. The fountain footprint is explicitly excluded from deterministic garden overlays so hedge/flower cells are not authored underneath the layered landmark.
- The change is visual-only: district bounds, chunk size, movement, collisions, economy, combat, networking, chat and inventory remain unchanged. Runtime exposes `gardensPathMode='fountain-connected-promenade-v2'` and `gardensLandmarkClearance='east-fountain-footprint-v1'`.
- The first Gardens LIVE workflow returned green while GitHub Pages was still serving `world-v1.7`. The resulting screenshot was valid for the old build but could not certify the new promenade connection. `scripts/live-gardens-audit.mjs` was hardened to wait for and require the exact world revision/path mode/landmark-clearance contract before accepting a final capture.
- Final Kelo CI passed for both the environment change and the audit hardening. The corrected dedicated Gardens LIVE audit passed at 390x844 CSS / 780x1688 backing canvas with `world-v1.8`, `gardens-landmark-v1.1`, `frontOcclusionActive=true`, 13 world road/path segments, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection of the corrected LIVE capture confirms that the fountain now reads as connected to the ivory circulation network instead of sitting one grass tile beyond it; the hero, cyan water, ivory stone and surrounding grass remain highly legible on mobile.
- QA rule validated: district-specific LIVE audits must certify the exact deployed renderer revision they intend to test, not only generic readiness/title flags, or a stale Pages build can produce a false-green result.
- Next Gardens bottleneck: the landmark connection is now coherent, but hedge rows and flower framing still read somewhat mechanically around the lower/east garden. The next safe pass should improve intentional asymmetry and framing around the fountain using the existing garden atlas/ground layers before adding another large landmark.


## Validated Gardens asymmetric framing and LIVE cache discipline — 2026-09-03

- `world-v1.9` replaces the rigid rectangular Gardens hedge frame with authored asymmetric hedge segments, corner pieces, and deliberately uneven flowerbed clusters using the existing modular Gardens atlas; the east fountain footprint remains reserved and gameplay systems are unchanged.
- Mobile LIVE at 390×844 CSS / 780×1688 canvas validated `gardensFramingMode: asymmetric-garden-framing-v1`, `fountain-connected-promenade-v2`, the layered fountain contract, and clean console/network results.
- The LIVE capture confirms that reducing repeated hedge lines and slightly lowering random flower-tuft density improves negative space and makes the fountain sector read less mechanically without requiring a new landmark.
- Audit retry loops must cache-bust the renderer subresource itself, not only the HTML URL; otherwise a single Playwright context can keep an older `world-map.js` while GitHub Pages has already deployed the new revision.
- The next visual bottleneck exposed by the mobile capture is the hard, staircase-like grass↔marble/path silhouette around Gardens. Prefer a small authored transition/edge treatment through the existing transition/TileRegistry architecture before adding more props or another landmark.


## Validated Gardens Path Topology — World v1.10 / 2026-09-03
- `world-map.js` now keeps the existing 32px TileRegistry-driven marble/grass materials and authored transition atlas, but changes the two small southern garden landing pads from full rectangles to authored chamfered footprints by cutting only their four 32x32 corner cells.
- The road classifier owns the cutouts through `gardenPath()`, so the existing 4-neighbour transition mask automatically follows the new topology; no gameplay collision, movement, combat, economy, networking, chat or inventory behavior changed.
- LIVE mobile audit validated `world-v1.10`, `fountain-connected-promenade-v3`, `authored-chamfered-path-topology-v1`, 390x844 CSS / 780x1688 backing canvas, the existing layered fountain contract, and `consoleErrors=[]`, `failedRequests=[]`, `httpErrors=[]`.
- Manual inspection confirms the small garden landings no longer read as perfect rectangular slabs; the route remains highly legible and the fountain stays the focal point.
- Research validation: Pixadom continues to show dense scenes with strong path hierarchy and negative space around focal landmarks; current modular top-down terrain references also emphasize transparent/overlay transition families and complete corner/edge coverage rather than relying on a single hard boundary tile.
- Next bottleneck exposed by the LIVE capture: the current grass↔marble transition artwork itself still produces a regular green tooth/checker fringe along long straight marble edges. The next safe visual pass should improve the transition atlas edge silhouette toward irregular grass tufts/encroachment while preserving the existing TileRegistry bitmask contract and mobile readability.

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