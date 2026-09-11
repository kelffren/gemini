# Kelo Map Forge — System Contract

## Propósito

`KeloMapForge` genera **Base Generated Worlds** deterministas para Kelo World. El core sigue siendo data-only: no posee renderer, cámara, colisión runtime, Property ni autoridad de publicación.

La integración visible vive fuera del core y reutiliza los owners existentes:

```text
Map Forge Candidate
→ mapDefinitionToWorldDraftSnapshot()
→ World Draft Snapshot normalizado
   ├─ KELO_WORLD_BUILDER.renderSnapshotPreview()  [read-only]
   └─ KELO_WORLD_EDIT world:draft:import
      → world:preview:enter
      → KELO_WORLD_BUILDER.ingestViewSnapshot()
      → KELO_PROPERTY_SYSTEM replaceLayout
      → KeloCamera.focus()
```

La preview de Map Forge y la preview exterior consumen la misma proyección normalizada. No existe un segundo map engine, Property System, camera manager ni renderer.

## Estado actual

**CREATOR ACTIVE / DRAFT PREVIEW LIVE / EVOLUTION V2 GATED / ONLINE-FIRST.**

El core procedural es determinista y probado por Node/CI. Kelo Creators expone Map Forge, genera en Worker cuando está disponible, permite seleccionar candidatos, muestra una preview visual read-only reutilizando World Builder + Property y puede entregar el candidato al World Editor o a `world:preview:enter` sin publicar el LIVE.

La preview exterior es reversible: Map Forge se separa del DOM y libera su input lock antes de esperar el handoff, conserva la sesión generada en memoria y ofrece `VOLVER A MAP FORGE`. El retorno sale de la preview mediante `world:preview:exit` y restaura el mismo candidato sin regenerar.

Map Forge también consume `KeloEvolution` fuera del runtime crítico para enfrentar un champion contra challengers de recipe/genoma. Esa capa no reemplaza el scorer ni el generator owner y no puede publicar ni auto-mergear cambios.

## Owners y archivos

- Core procedural: `src/world/map-forge/map-forge-core.mjs`.
- Recipes: `src/world/map-forge/map-forge-recipes.mjs`.
- Champion overrides aprobados: `src/world/map-forge/map-forge-champion-overrides.mjs`.
- Evolution adapter: `src/world/map-forge/map-forge-evolution.mjs`.
- Golden seed corpus: `src/world/map-forge/map-forge-golden-seeds.mjs`.
- Builder: `src/world/map-forge/map-forge-builder.mjs`.
- Validator/scorer: `src/world/map-forge/map-forge-quality.mjs`.
- Worker: `src/world/map-forge/map-forge-worker.mjs` + `map-forge-worker-client.mjs`.
- Creator UI/lifecycle: `src/creators/ui/map-forge-workspace.mjs`.
- Creator routing: `src/creators/workspaces/map-forge-workspace.mjs`.
- World handoff: `src/creators/workspaces/world-workspace.mjs`.
- Normalización/import: `src/studio/adapters/map-forge-draft-importer.mjs`.
- Draft/preview authority: `KELO_WORLD_EDIT`.
- Runtime world projection + snapshot preview: `src/environment/world-builder-system.js`.
- Real placement rendering: `src/property/property-system.js`.
- Real placement catalog: `KELO_PROPERTY_CATALOG` / `src/property/property-asset-catalog.js`.
- Camera: `KeloCamera` / `src/core/camera-system.js`.
- Evolution memory artifact/source: `docs/evolution/map-forge-memory.json`.
- Autopilot runner: `scripts/map-forge-evolution-autopilot.mjs`.
- Core contract audit: `scripts/map-forge-core-audit.mjs`.
- Studio handoff audit: `scripts/map-forge-studio-handoff-audit.mjs`.
- Evolution audit: `scripts/kelo-evolution-audit.mjs`.
- Mobile visual smoke: `tests/map-forge-mobile-preview.spec.js`.
- Evolution visual evidence: `tests/map-forge-evolution-visual.spec.js`.

## Estado que posee el core

El core no posee estado mutable runtime. Produce un `MapDefinition` serializable con metadata, `worldBounds`, semantic graph, districts, terrain, roads, blocks, parcels, landmarks, prefab placements, decorations, interactions, spawns, exits, collision descriptors, navigation, scenic vistas, chunk index, generation stats, validation y quality.

El estado temporal de la interfaz —recipe, seed, candidates, selected candidate y sliders— pertenece al workspace de Creator, no al core ni al mundo LIVE.

La capa de evolución posee cero state runtime. Champion overrides son data de recipe versionada por Git y la memoria de experimentos pertenece al pipeline externo.

## Estado que NO posee

- Render final: `KELO_WORLD_RENDERER` / World Builder overlay.
- Collision lifecycle: `KELO_COLLISION`.
- Camera/viewport: `KeloCamera`.
- Property ownership/build state: `KELO_PROPERTY_SYSTEM`.
- World draft/publish state: `KELO_WORLD_EDIT`.
- Git merge/deploy authority.
- Player buildings, stalls, NPC runtime, resource state y eventos: runtime/server deltas.

## Determinismo

La identidad del Base Generated World usa `mapId`, `seed`, `generatorVersion`, `recipeId`, `recipeVersion`, `assetCatalogVersion` y `layoutHash`. El core no usa `Math.random()` ni tiempos de pared dentro del `MapDefinition`.

El mismo conjunto de inputs produce el mismo `layoutHash` y la misma serialización. Streams internos derivan del seed principal con nombres estables.

Cuando una champion override aprobada existe, `map-forge-recipes.mjs` deriva una versión efectiva `recipeVersion-evo.<revision>` para que un cambio de genoma no quede escondido detrás de la misma identidad de recipe.

## Pipeline procedural

```text
Map Intent
→ Semantic Graph
→ region anchors + deterministic relaxation
→ weighted power-Voronoi field
→ hero landmark placement
→ Delaunay candidate graph
→ Minimum Spanning Tree
→ strategic loop reinsertion
→ curved road polylines
→ blocks
→ road-facing parcels
→ semantic terrain + compact civic paving plans
→ Poisson-style decoration placement
→ scenic vistas
→ navigation graph
→ chunk index
→ pure validator
→ weighted quality scorer
→ best-of-N
→ MapDefinition
```

## Evolution V2

`map-forge-evolution.mjs` trata la recipe actual como champion y propone challengers deterministas. El genoma V2 puede expresar:

```text
style.monumentality / organicRoads / density / vegetation / exploration / decoration
road.loopRatio / road.curvature
district.<id>.weight
landmark.<id>.keepClearRadius
```

La recipe original nunca se muta. `applyMapForgeGenome()` deriva una recipe candidata y luego reutiliza **el mismo** `generateBestOf()`, validator y scorer de Map Forge.

### Golden seeds + validation seeds

`map-forge-golden-seeds.mjs` fija casos representativos por recipe. Cada challenger se evalúa con golden seeds más validation seeds derivadas. `validRate` tiene hard gate de 100 %.

### Evolución parcial

La búsqueda admite `lockedGenes`, `focusScopes` y `focusGenes`. Esto permite congelar partes ya buenas y trabajar, por ejemplo, solo roads, solo landmarks o el peso espacial de un distrito concreto.

La regeneración computacional sigue reconstruyendo el candidato completo; todavía no existe un regenerador físico de chunk/district que recalcule únicamente esa subregión.

### Métricas de evolución

La decisión combina calidad media y peor caso, visual medio y peor caso, floor de navegación, safety de complejidad, estabilidad y valid rate. Tiempos reales de generación se registran como telemetría pero no pesan el score determinista porque dependen del runner.

### Champion overrides

`map-forge-champion-overrides.mjs` solo contiene overrides que hayan llegado a `main`. Empieza vacío en V2. El autopilot puede proponer una nueva revision, pero el runtime únicamente la consume después del flujo normal de PR/CI/merge.

### Autopilot

`.github/workflows/kelo-evolution-autopilot.yml` ejecuta champion vs challengers sobre `main`. Si ningún challenger supera `minImprovement`, no crea cambios. Si uno gana, vuelve a correr Map Forge core + Evolution + docs, crea una rama/commit y abre PR. **No existe paso de auto-merge.**

## Proyección a World Draft Snapshot

`mapDefinitionToWorldDraftSnapshot()` es la única traducción compartida entre Map Forge y el World Draft actual.

Responsabilidades:

- rasteriza terrain y roads al contrato de celdas editable existente;
- conserva `prefabPlacements` explícitos;
- resuelve landmarks/decorations semánticas contra el catálogo real `KELO_PROPERTY_CATALOG` cuando existe un template compatible;
- crea placements de Property deterministas;
- proyecta collision descriptors sin mutar colisión LIVE;
- no llama directamente a Property authority ni a `KELO_COLLISION`.

Los tipos semánticos sin template real compatible se omiten de forma segura en vez de inventar un asset inexistente.

## Preview visual dentro de Map Forge

La preview principal no interpreta `terrain` con una tabla independiente de colores ni dibuja landmarks como círculos. El workspace crea el mismo World Draft Snapshot normalizado y delega en:

```text
KELO_WORLD_BUILDER.renderSnapshotPreview(canvas, snapshot, bounds)
```

World Builder reutiliza su terrain/path, `KELO_TILE_REGISTRY`, `KELO_ATLAS_CONTRACT`, el suelo aprobado y `KELO_PROPERTY_SYSTEM.drawPlacements()` sin modificar state. La carga de assets es asíncrona y la preview se redibuja por eventos asset-ready.

`tests/map-forge-evolution-visual.spec.js` reutiliza exactamente esta ruta para capturar baseline/champion, no un renderer especial de test.

## Preview exterior

`VER EN MAPA EXTERIOR` es una vista segura del draft, no Publish.

Flujo:

1. fija `busy` para impedir doble tap;
2. conserva el candidato seleccionado;
3. separa inmediatamente el shell fullscreen de Map Forge;
4. libera `KeloInputLocks`;
5. muestra un indicador pequeño no bloqueante;
6. crea/importa el draft mediante `KELO_WORLD_EDIT`;
7. entra mediante `world:preview:enter`;
8. exige un `viewSnapshot` válido y una proyección runtime con cells;
9. enfoca `KeloCamera` en el spawn principal o centro de bounds;
10. muestra `VOLVER A MAP FORGE`.

Si el handoff falla, se restaura el mismo workspace y candidato. `VOLVER A MAP FORGE` usa `world:preview:exit` y vuelve a montar la misma sesión sin regenerar.

## World Editor

`ABRIR EN WORLD EDITOR` sigue separado de preview exterior:

```text
Map Forge
→ importar nuevo draft
→ openKeloStudioLive()
```

## Terrain y caminos

El runtime editable actual normaliza materiales al conjunto que World Builder soporta hoy (`grass` y `marble`). Cuando existe atlas aprobado se utiliza; grass puede reutilizar `styles.surfaceGround`/`cesped`.

El pavimento cívico usa planes compactos y conectados (`terrain.pavingPlans`). Cada celda stone conserva `pavingIntent`. El validator invalida piedra sin intención (`paving_intent_missing`) o componentes excesivos (`paving_blob_excessive`). `generateBestOf()` solo conserva candidatos válidos.

El contrato actual todavía no ofrece un atlas marble/path authored activo equivalente al suelo real; World Builder conserva un fallback visual centralizado para esas celdas.

## Online-first

Map Forge define solamente el **BASE GENERATED WORLD**:

```text
Base Generated World
+ Server / Runtime Deltas
```

El UI no publica ni muta LIVE directamente. Las mutaciones pasan por `KELO_WORLD_EDIT.request()`, cuya autoridad local puede reemplazarse por `RemoteWorldEditAuthority` manteniendo formatos y consumers. Evolution tampoco obtiene autoridad gameplay ni publish.

## Invariantes

1. No `Math.random()` dentro del procedural core.
2. No DOM ni Canvas dentro del core.
3. No writes a `obstacles` desde Map Forge/importer.
4. No writes directos a `KELO_COLLISION` desde Map Forge/importer.
5. No mutación directa de Property desde importer.
6. Camera solo mediante `KeloCamera`.
7. Preview Map Forge, evidencia visual y exterior usan la proyección/renderer owners existentes.
8. El candidato debe sobrevivir a preview exterior/fallo/retorno.
9. Same inputs ⇒ same layoutHash y serialización.
10. Un candidato inválido no puede entrar en handoff ni ser champion.
11. Evolution no duplica Map Forge scorer/generator.
12. Autopilot nunca mergea su propio candidato.

## Tests y CI

- `node scripts/map-forge-core-audit.mjs`: determinismo, recipes, conectividad, quality y best-of.
- `node scripts/map-forge-paving-intent-audit.mjs`: corpus de pavimento y hard gates.
- `node scripts/map-forge-studio-handoff-audit.mjs`: proyección, handoff, owners y lifecycle.
- `npm run audit:evolution`: genome/golden seeds/locks/tournament/no-regression.
- `npm run audit:evolution:sandbox`: code-patch worktree aislado.
- `tests/map-forge-mobile-preview.spec.js`: preview/handoff móvil real.
- `tests/map-forge-evolution-visual.spec.js`: screenshots baseline/champion + telemetría de render/generación.

Los workflows guardan screenshots y JSON de evidencia como artifacts.

## Deuda pendiente real

- WFC local con budget/retry/fallback.
- Regeneración física parcial de chunks/distritos; V2 ya puede focalizar genes pero reconstruye el candidato completo.
- Atlas/path authored activo para que roads/marble no necesiten fallback visual.
- Más templates reales para semantic landmark families sin match en Property Catalog.
- Benchmark de FPS del runtime jugable como métrica adicional; V2 mide generation + preview render telemetry.
- Visual judge semántico externo como métrica secundaria.
- Validación online contra autoridad remota cuando exista servidor.

## Cómo extender sin duplicar owner

- Nueva recipe: `map-forge-recipes.mjs`.
- Nuevo gene de recipe: `map-forge-evolution.mjs`; no meter search logic en builder.
- Nueva métrica de calidad del mapa: `map-forge-quality.mjs`.
- Nueva métrica de tournament/evolution: perfil en `map-forge-evolution.mjs`.
- Nueva primitive geométrica: `map-forge-geometry.mjs`.
- Nueva fase procedural: builder manteniendo determinismo.
- Nueva traducción visual/editable: importer u owner runtime correspondiente.
- Nuevos assets: Property/Tile/Atlas owners; Map Forge solo referencia semántica/data.
