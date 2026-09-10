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

**CREATOR ACTIVE / DRAFT PREVIEW LIVE / ONLINE-FIRST.**

El core procedural es determinista y probado por Node/CI. Kelo Creators expone Map Forge, genera en Worker cuando está disponible, permite seleccionar candidatos, muestra una preview visual read-only reutilizando World Builder + Property y puede entregar el candidato al World Editor o a `world:preview:enter` sin publicar el LIVE.

La preview exterior es reversible: Map Forge se separa del DOM y libera su input lock antes de esperar el handoff, conserva la sesión generada en memoria y ofrece `VOLVER A MAP FORGE`. El retorno sale de la preview mediante `world:preview:exit` y restaura el mismo candidato sin regenerar.

## Owners y archivos

- Core procedural: `src/world/map-forge/map-forge-core.mjs`.
- Recipes: `src/world/map-forge/map-forge-recipes.mjs`.
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
- Contract audit: `scripts/map-forge-studio-handoff-audit.mjs`.
- Mobile visual smoke: `tests/map-forge-mobile-preview.spec.js`.
- CI: `.github/workflows/map-forge-studio-handoff-ci.yml`.

## Estado que posee el core

El core no posee estado mutable runtime. Produce un `MapDefinition` serializable con metadata, `worldBounds`, semantic graph, districts, terrain, roads, blocks, parcels, landmarks, prefab placements, decorations, interactions, spawns, exits, collision descriptors, navigation, scenic vistas, chunk index, generation stats, validation y quality.

El estado temporal de la interfaz —recipe, seed, candidates, selected candidate y sliders— pertenece al workspace de Creator, no al core ni al mundo LIVE.

## Estado que NO posee

- Render final: `KELO_WORLD_RENDERER` / World Builder overlay.
- Collision lifecycle: `KELO_COLLISION`.
- Camera/viewport: `KeloCamera`.
- Property ownership/build state: `KELO_PROPERTY_SYSTEM`.
- World draft/publish state: `KELO_WORLD_EDIT`.
- Player buildings, stalls, NPC runtime, resource state y eventos: runtime/server deltas.

## Determinismo

La identidad del Base Generated World usa `mapId`, `seed`, `generatorVersion`, `recipeId`, `recipeVersion`, `assetCatalogVersion` y `layoutHash`. El core no usa `Math.random()` ni tiempos de pared dentro del `MapDefinition`.

El mismo conjunto de inputs produce el mismo `layoutHash` y la misma serialización. Streams internos derivan del seed principal con nombres estables.

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

La preview principal ya no interpreta `terrain` con una tabla independiente de colores ni dibuja landmarks como círculos. El workspace crea el mismo World Draft Snapshot normalizado y delega en:

```text
KELO_WORLD_BUILDER.renderSnapshotPreview(canvas, snapshot, bounds)
```

World Builder reutiliza:

- su lógica de terrain/path;
- `KELO_TILE_REGISTRY` y `KELO_ATLAS_CONTRACT`;
- el atlas real de suelo aprobado por `surfaceGround` cuando el atlas legacy de terrain está retirado/reset;
- `KELO_PROPERTY_SYSTEM.drawPlacements()` para dibujar los mismos templates/parts reales de Property sin modificar state.

La carga de assets es asíncrona y la preview se redibuja por eventos de asset-ready; no depende de un timeout arbitrario.

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

Si el handoff falla, se restaura el mismo workspace y candidato. No se oculta el error ni se destruye la sesión.

`VOLVER A MAP FORGE` usa `world:preview:exit`, elimina el chrome temporal de preview y vuelve a montar el mismo shell y controles sin regenerar.

## World Editor

`ABRIR EN WORLD EDITOR` sigue siendo un flujo separado:

```text
Map Forge
→ importar nuevo draft
→ openKeloStudioLive()
```

No se mezcla con la preview exterior.

## Terrain y caminos

El runtime editable actual normaliza los materiales generados al conjunto que World Builder soporta hoy (`grass` y `marble`). Cuando existe un atlas aprobado y no retirado se utiliza el atlas real. Para grass, World Builder puede reutilizar `styles.surfaceGround`/`cesped`.

El pavimento cívico ya no nace de una probabilidad por celda. Los distritos `plaza`, `royal` y `commerce` declaran planes compactos y conectados (`terrain.pavingPlans`); cada celda de piedra conserva un `pavingIntent` que explica su plan, distrito y propósito. El validator invalida con códigos estables cualquier piedra sin intención (`paving_intent_missing`) o componente conectado que supere el 10 % del campo útil o duplique el footprint declarado (`paving_blob_excessive`). Como `generateBestOf()` solo conserva candidatos válidos, estos defectos bloquean AUTO en vez de limitarse a reducir el score.

El contrato actual no ofrece todavía un atlas marble/path activo y aprobado equivalente al suelo real; por eso World Builder conserva un fallback visual centralizado para esas celdas. Ese fallback pertenece al owner World Builder y no crea un segundo tileset ni un renderer paralelo.

## Online-first

Map Forge define solamente el **BASE GENERATED WORLD**. La arquitectura conserva:

```text
Base Generated World
+ Server / Runtime Deltas
```

El UI no publica ni muta LIVE directamente. Las mutaciones pasan por `KELO_WORLD_EDIT.request()`, cuya autoridad local puede ser sustituida por `RemoteWorldEditAuthority` manteniendo formatos y consumers.

## Invariantes

1. No `Math.random()` dentro del procedural core.
2. No DOM ni Canvas dentro del core.
3. No writes a `obstacles` desde Map Forge/importer.
4. No writes directos a `KELO_COLLISION` desde Map Forge/importer.
5. No mutación directa de Property desde el importer.
6. Camera solo mediante `KeloCamera`.
7. Preview Map Forge y exterior usan la misma proyección normalizada.
8. `VER EN MAPA EXTERIOR` quita el shell fullscreen antes del await de handoff.
9. El candidato debe sobrevivir a preview exterior/fallo/retorno.
10. Same inputs ⇒ same layoutHash y serialización.
11. Un candidato inválido no puede entrar en handoff.

## Tests y CI

`node scripts/map-forge-core-audit.mjs` valida determinismo, recipes, conectividad, quality y best-of.

`node scripts/map-forge-paving-intent-audit.mjs` ejecuta 300 mapas, conserva las seeds históricas de `PAVING_BLOB`, verifica planes conectados y demuestra que los hard gates rechazan pavimento no declarado y dominante.

`node scripts/map-forge-studio-handoff-audit.mjs` valida proyección determinista, terrain/path, semantic Property placements, uso del catálogo LIVE correcto, ausencia de mutaciones directas, orden del lifecycle exterior, restauración de sesión, reuse de World Builder/Property y foco por `KeloCamera`.

`tests/map-forge-mobile-preview.spec.js` ejecuta el flujo visible en viewport 390×844:

```text
Map Forge
→ generar
→ preview con assets reales
→ Ver en mapa exterior
→ shell fullscreen desaparece
→ world preview visible
→ camera dentro de bounds
→ Volver a Map Forge
→ mismo seed/layoutHash
```

El workflow guarda screenshots de la preview, exterior y sesión restaurada como evidencia visual.

## Deuda pendiente real

- WFC local con budget/retry/fallback.
- Lock + regenerate parcial.
- Golden seeds con `assetCatalogVersion` LIVE estable.
- Atlas/path authored activo para que roads/marble no necesiten fallback visual.
- Más templates reales para semantic landmark families que hoy no tengan match en Property Catalog.
- Validación online contra autoridad remota cuando exista servidor.

## Cómo extender sin duplicar owner

- Nueva recipe: `map-forge-recipes.mjs`.
- Nueva métrica: `map-forge-quality.mjs`.
- Nueva primitive geométrica: `map-forge-geometry.mjs`.
- Nueva fase procedural: builder manteniendo determinismo.
- Nueva traducción visual/editable: extender el importer o el owner runtime correspondiente, no el core.
- Nuevos assets: registrar en Property/Tile/Atlas owners existentes; Map Forge solo referencia semántica/data.
