# Kelo Map Forge — System Contract

## Propósito

`KeloMapForge` es la capacidad data-driven que genera **Base Generated Worlds** deterministas para Kelo World. No es un renderer, no posee cámara, no posee colisión runtime, no posee propiedades de jugadores y no modifica gameplay LIVE por sí mismo.

Su responsabilidad actual es transformar una recipe + seed estable en un `MapDefinition` puro, serializable, validado y puntuado.

## Estado actual

**PREPARED / HEADLESS CORE.** El core está probado por Node/CI y todavía no está conectado al boot normal de `index.html` ni autorizado a sustituir el mundo LIVE. La integración con worker, Studio/Creators, renderer y `KELO_COLLISION` se hará en passes separados y debe reutilizar esos owners existentes.

## Owner y archivos

- Owner lógico: `KeloMapForge`.
- Recipes data-only: `src/world/map-forge/map-forge-recipes.mjs`.
- PRNG/hash: `src/world/map-forge/map-forge-prng.mjs`.
- Geometría reusable: `src/world/map-forge/map-forge-geometry.mjs`.
- Builder puro: `src/world/map-forge/map-forge-builder.mjs`.
- Validator/scorer: `src/world/map-forge/map-forge-quality.mjs`.
- Orchestrator/API: `src/world/map-forge/map-forge-core.mjs`.
- Audit: `scripts/map-forge-core-audit.mjs`.
- CI: `.github/workflows/map-forge-core-ci.yml`.

## Estado que posee

El core **no posee estado mutable runtime**. Todas sus funciones son puras.

Produce datos de base world como:

- metadata;
- worldBounds;
- semanticGraph;
- districts;
- terrain field;
- roads;
- blocks;
- parcels;
- landmarks;
- prefabPlacements;
- decorations;
- interactions;
- spawnPoints;
- exits;
- collisionDescriptors;
- navigation;
- scenicVistas;
- chunkIndex;
- generationStats;
- validation;
- quality.

## Estado que NO posee

- Render final: `KELO_WORLD_RENDERER`.
- Collision lifecycle runtime: `KELO_COLLISION`.
- Camera/viewport: `KeloCamera`.
- Property ownership/build state: Property System.
- Player buildings, stalls, NPC runtime, resource state, temporary events: authority/runtime deltas.
- Studio history/UI: Studio/Creators.

## Determinismo

La identidad del mundo base usa:

- `mapId`;
- `seed`;
- `generatorVersion`;
- `recipeId`;
- `recipeVersion`;
- `assetCatalogVersion`;
- `layoutHash`.

El core no utiliza `Math.random()` ni tiempos de pared dentro del `MapDefinition`. El mismo conjunto de inputs produce el mismo `layoutHash` y la misma serialización.

Streams actuales derivan del seed principal y nombres estables (`layout`, `roads`, `architecture`, `decoration`). Esto permite desacoplar futuras regeneraciones parciales sin introducir aleatoriedad global.

## Pipeline actual

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
→ coarse terrain field
→ Poisson-style decoration placement
→ scenic vistas
→ navigation graph
→ chunk index
→ pure validator
→ weighted quality scorer
→ best-of-N
→ MapDefinition
```

WFC local, prefab catalog-driven placement, lock/regenerate y Web Worker son capacidades pendientes; no se documentan como implementadas todavía.

## API pública

### `generateMapCandidate(recipe, options)`

Genera un candidato determinista y devuelve un `MapDefinition` congelado.

Opciones actuales:

- `seed`;
- `assetCatalogVersion`;
- `style` overrides;
- `constraints` reservadas para extensión data-driven.

### `generateBestOf(recipe, options)`

Genera entre 1 y 32 candidatos, rechaza inválidos, ordena por quality score y expone:

- `bestOverall`;
- `mostMonumental`;
- `mostOrganic`;
- `mostExplorable`;
- `mostCompact`.

### `validateMapDefinition(map, recipe)`

Validator puro/headless. Actualmente comprueba required districts, spawn, exits, bounds de landmarks, overlaps de landmarks, parcelas válidas, reachability de distritos/exits y conectividad del semantic graph.

### `scoreMapDefinition(map, recipe)`

Puntuación 0–100 ponderada por recipe con:

- playability;
- connectivity;
- navigation;
- visualComposition;
- landmarkQuality;
- districtVariety;
- roadQuality;
- densityBalance;
- negativeSpace;
- assetVariety;
- scenicVistas;
- technicalSafety.

## Recipes actuales

- `KELO_ROYAL_CAPITAL_V1`;
- `KELO_VILLAGE_V1`;
- `KELO_FOREST_V1`.

La lógica del generador no contiene una Plaza hardcodeada. Las diferencias de composición viven en recipes.

## Roads

El road graph usa Delaunay como conjunto de conexiones candidatas, MST para garantizar conectividad y reinserción de edges para loops. Las carreteras generadas son data (`polyline`, `class`, `width`, `material`, `priority`, `source`), no dibujo Canvas.

## Blocks y parcels

Blocks/parcels son descripción del terreno base. Esto prepara housing, shops y futuras parcelas sin transferir ownership de propiedades al generator.

`roadFrontage`, `buildableArea`, `orientation`, familias permitidas y density son metadata generativa; ownership, compra, construcción y estado persistente siguen fuera de Map Forge.

## Terrain y decoración

Terrain se produce como coarse field asociado a distritos/biome. No existe un segundo terrain renderer.

Decoración usa colocación Poisson-style con spacing, clearance de landmarks y separación de roads. En este pass solo produce familias semánticas; resolver assets reales será una capa de catálogo posterior.

## Chunks

Cada `MapDefinition` incluye lookup espacial determinista con chunk size 512 para terrain, roads, blocks, parcels, landmarks y decorations. El renderer futuro debe consumir esta indexación en vez de generar una megatextura.

## Online-first

Map Forge define solamente **BASE GENERATED WORLD**.

La arquitectura online futura debe mantener separado:

```text
Base Generated World
+ Server / Runtime Deltas
```

Deltas como player buildings, property ownership, market stalls, temporary events, resource state, NPC state y destroyed objects no deben incorporarse al layoutHash del mundo base.

La futura autoridad puede ser `LocalMapAuthority` hoy y `ServerMapAuthority` mañana sin cambiar IDs ni `MapDefinition`.

## Invariantes

1. No `Math.random()` dentro del procedural core.
2. No DOM ni Canvas dentro del core.
3. No writes a `obstacles`.
4. No writes a `KELO_COLLISION` desde el core.
5. No mutación de Property System.
6. No dependencia de cámara/input/UI.
7. Same inputs ⇒ same layoutHash y misma serialización.
8. Un mapa no pasa a best-of si validator lo marca inválido.
9. Performance wall-clock se mide fuera del MapDefinition para no romper determinismo.

## Tests y CI

`node scripts/map-forge-core-audit.mjs` cubre:

- same seed == same layoutHash;
- serialización determinista;
- different seed cambia hash;
- required districts;
- semantic nodes;
- MST;
- loops en Royal Capital;
- parcels;
- scenic vistas requeridas;
- chunk lookup determinista;
- serialization roundtrip;
- best-of-8;
- 100 seeds Royal Capital;
- 100 seeds Village;
- 100 seeds Forest;
- gate de valid rate >= 99%;
- gate que el scorer distinga candidatos reales.

`Map Forge Core CI` ejecuta este audit en PRs que toquen Map Forge.

## Deuda pendiente real

- WFC local con budget/retry/fallback.
- Prefab generation metadata conectado a `KELO_PREFAB_CONTRACT`.
- lock + regenerate parcial.
- Web Worker y parity sync/worker.
- runtime adapter hacia `KELO_WORLD_RENDERER` y `KELO_COLLISION`.
- Creator/Studio workspace y overlays.
- golden seeds con assetCatalogVersion real.
- LIVE/mobile validation después de la integración visible.

Estas capacidades están pendientes y no deben tratarse como LIVE.

## Cómo extender sin duplicar owner

- Nueva recipe: añadir data a `map-forge-recipes.mjs`.
- Nueva métrica: extender `map-forge-quality.mjs`.
- Nueva primitive geométrica reusable: `map-forge-geometry.mjs`.
- Nueva fase procedural: extender el builder manteniendo serialización determinista.
- Render/collision/property/UI: **no implementar aquí**; conectar por el owner existente correspondiente.
