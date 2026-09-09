# Kelo Map Forge — System Contract

## Propósito

`KeloMapForge` genera **Base Generated Worlds** deterministas para Kelo World. No es renderer, no posee cámara, colisión runtime, propiedades ni gameplay LIVE. Transforma recipe + seed + revisión de catálogo en un `MapDefinition` puro, validado y puntuado; el Creator adapter puede resolver después las decoraciones semánticas hacia IDs reales del catálogo compartido.

## Estado actual

**CREATOR-ACTIVE / DRAFT-SAFE.** El core es headless y determinista, tiene Worker-first con fallback síncrono, UI de Creator con preview/Best-of-N y handoff seguro hacia World Studio mediante la autoridad de drafts. Desde Asset Library V1 el worker client también toma un snapshot real de `KELO_PROPERTY_CATALOG` y aplica un binding determinista antes del handoff.

Map Forge no sustituye el mundo LIVE directamente.

## Owner y archivos

- Owner lógico: `KeloMapForge`.
- Recipes: `src/world/map-forge/map-forge-recipes.mjs`.
- PRNG/hash: `src/world/map-forge/map-forge-prng.mjs`.
- Geometría: `src/world/map-forge/map-forge-geometry.mjs`.
- Builder puro: `src/world/map-forge/map-forge-builder.mjs`.
- Validator/scorer: `src/world/map-forge/map-forge-quality.mjs`.
- Core/API: `src/world/map-forge/map-forge-core.mjs`.
- Worker: `src/world/map-forge/map-forge-worker.mjs`.
- Worker client + catalog boundary: `src/world/map-forge/map-forge-worker-client.mjs`.
- Asset binding puro: `src/world/map-forge/map-forge-asset-binding.mjs`.
- Creator UI: `src/creators/ui/map-forge-workspace.mjs`.
- Studio importer: `src/studio/adapters/map-forge-draft-importer.mjs`.
- Audits: `scripts/map-forge-core-audit.mjs`, `scripts/map-forge-studio-handoff-audit.mjs`, `scripts/creator-asset-library-audit.mjs`.

## Estado que posee

El core no posee estado mutable runtime. Produce datos serializables:

- metadata;
- worldBounds;
- semanticGraph;
- districts;
- terrain;
- roads;
- blocks/parcels;
- landmarks;
- decorations semánticas;
- prefabPlacements después del asset binding;
- spawn/exits;
- navigation/scenic vistas;
- chunkIndex;
- generationStats;
- validation/quality;
- `assetBinding` cuando se ejecuta el adapter de catálogo.

## Estado que NO posee

- Render: `KELO_WORLD_RENDERER`.
- Collision lifecycle: `KELO_COLLISION`.
- Camera: `KeloCamera`.
- Property ownership/build state: Property System.
- Catálogo colocable: `KELO_PROPERTY_CATALOG`.
- Assets/Blobs/revisiones de Creator: Creator Asset Library.
- Studio history/UI: Studio/Creators.
- Server/runtime deltas del mundo.

## Determinismo e identidad

La identidad base usa:

- `mapId`;
- `seed`;
- `generatorVersion`;
- `recipeId`;
- `recipeVersion`;
- `assetCatalogVersion`;
- `layoutHash`.

El core no usa `Math.random()` ni wall-clock. El worker client sustituye placeholders de catálogo por una versión determinista construida desde los IDs visibles de `KELO_PROPERTY_CATALOG` antes de generar.

El asset binding añade `assetBindingHash`, calculado a partir de layout + catálogo + placements resueltos. Mismo layout y mismo catálogo ⇒ mismo binding.

## Pipeline actual

```text
Map Intent
→ Semantic Graph
→ spatial layout / weighted power-Voronoi
→ landmarks
→ Delaunay → MST → strategic loops
→ roads
→ blocks/parcels
→ terrain
→ semantic Poisson decorations
→ scenic vistas / navigation / chunks
→ validator / scorer
→ Best-of-N
→ catalog snapshot
→ deterministic semantic-family asset binding
→ prefabPlacements con assetId estable
→ World draft importer
→ editable draft / exterior preview
```

## API principal

### `generateMapCandidate(recipe, options)`

Genera un candidato determinista. Opciones: `seed`, `assetCatalogVersion`, `style`, `constraints`.

### `generateBestOf(recipe, options)`

Genera 1–32 candidatos válidos y expone `bestOverall`, `mostMonumental`, `mostOrganic`, `mostExplorable`, `mostCompact`.

### `createMapForgeWorkerClient({ root })`

Usa Worker cuando existe y fallback sync cuando no. Obtiene el catálogo colocable desde `root.KELO_PROPERTY_CATALOG`, calcula una versión real, pasa esa versión al core y enlaza el resultado con `bindMapForgeAssets()` antes de resolver la Promise.

### `bindMapForgeAssets(map, catalog, { catalogVersion })`

Adapter puro. Convierte decoraciones semánticas (`tree`, `lamp`, `bench`, etc.) en `prefabPlacements` con IDs inmutables del catálogo. No carga imágenes ni muta runtime.

### `validateMapDefinition()` / `scoreMapDefinition()`

Mantienen validación y quality scoring puros.

## Recipes actuales

- `KELO_ROYAL_CAPITAL_V1`;
- `KELO_VILLAGE_V1`;
- `KELO_FOREST_V1`.

Las diferencias viven en recipes, no en una Plaza hardcodeada.

## Terrain, decoración y assets

Terrain sigue siendo coarse data; no existe un segundo terrain renderer.

El builder coloca `decorations` por familia semántica. El asset-binding adapter intenta resolverlas contra el catálogo compartido usando:

- familia/nombre/ID/source;
- aliases español/inglés;
- categoría compatible;
- distrito compatible;
- elección determinista entre candidatos equivalentes.

Si una familia no tiene candidato, la decoración queda en `assetBinding.unresolved` y no se inventa una ruta ni se crea un placeholder físico dentro del mapa.

Los assets importados por Creator usan el mismo `KELO_PROPERTY_CATALOG` que assets oficiales; Map Forge no distingue un renderer comunitario.

## Studio / exterior handoff

`map-forge-draft-importer.mjs` transforma `prefabPlacements` en placements del draft usando el `assetId` ya resuelto. La importación pasa por `KELO_WORLD_EDIT` y crea un draft nuevo. Preview exterior no publica ni destruye LIVE.

## Online-first

Map Forge define **BASE GENERATED WORLD**. El modelo sigue:

```text
Base Generated World
+ Server / Runtime Deltas
```

El catálogo global online futuro debe entregar una revisión/version determinista y assets aprobados; el worker client/binding puede consumir ese mismo snapshot sin cambiar el generator.

Player buildings, ownership, stalls, eventos, recursos, NPC runtime y destrucción siguen fuera del layout base.

## Dependencias permitidas

- recipes/data;
- primitives puras de Map Forge;
- snapshot serializable de `KELO_PROPERTY_CATALOG` en el worker client;
- Asset Library solo para hidratar el owner runtime antes de abrir Map Forge;
- World workspace/authority para handoff.

No se permite que el core dependa de DOM, Canvas, Property System, Atlas, Image, Blob o Creator UI.

## Eventos/hooks

No hay eventos en el core. Creator Asset Library hidrata `KELO_PROPERTY_CATALOG` antes de abrir Map Forge. El worker client toma un snapshot por cada generación, por lo que assets nuevos registrados antes del botón GENERAR pueden entrar en esa ronda.

## Persistencia

Map Forge no persiste estado propio. El JSON exportado contiene IDs/versiones. Los drafts se persisten por el owner de World Studio/World Edit. Los assets se persisten por Asset Library/repository.

## Invariantes

1. No `Math.random()` en procedural core ni asset binding.
2. No DOM/Canvas en core/binding.
3. No writes a `obstacles`.
4. No reemplazo de `KELO_COLLISION`.
5. No mutación de Property System desde Map Forge.
6. No rutas físicas como identidad de placements.
7. Same inputs + same catalog ⇒ same layout/binding.
8. Solo candidatos válidos pueden ser best-of.
9. Asset resolution falla visible en metadata (`unresolved`), no silenciosamente mediante un asset inventado.
10. World handoff siempre cruza la autoridad de draft existente.

## Ejemplo correcto

Map Forge genera:

```json
{"id":"dec:31","family":"tree","x":900,"y":640}
```

El catálogo contiene una revisión aprobada `creator:kelo:white-tree@r2-91af82c1`. El binding crea un `prefabPlacement` con ese `assetId`. Studio importa el placement; renderer/Property System siguen usando sus owners existentes.

## Anti-patrones

- No meter `src: "assets/tree.png"` en MapDefinition como identity.
- No leer Blob/Data URL desde el core.
- No crear `MapForgeAssetCatalog` runtime paralelo.
- No escribir placements directamente al LIVE world.
- No recalcular asset selection con `Math.random()`.
- No incluir server/runtime deltas dentro de layoutHash.

## Legacy/adapters relacionados

El Studio importer y el worker client son adapters deliberados. `KELO_PROPERTY_CATALOG` continúa como catálogo runtime. `KeloAssetRegistry` visual no reemplaza este contrato ni es authoring storage.

## Tests y CI

- `map-forge-core-audit.mjs`: determinismo, conectividad, seeds, quality.
- `map-forge-studio-handoff-audit.mjs`: draft authority/handoff.
- `creator-asset-library-audit.mjs`: catálogo compartido, binding determinista, prefabPlacements y owner boundaries.

## Observabilidad

Cada mapa enlazado expone:

- `metadata.assetCatalogVersion`;
- `metadata.assetBindingHash`;
- `assetBinding.resolved`;
- `assetBinding.unresolved`;
- `generationStats.assetPlacementCount`;
- `generationStats.unresolvedDecorationCount`.

## Deuda pendiente real

- WFC local con budget/retry/fallback.
- lock + regenerate parcial.
- richer prefab generation para blocks/parcels/landmarks.
- catalog packs, styles, biomes y weighting curatorial más ricos.
- server-approved global catalog revision/CDN.
- golden seeds que incluyan catálogos de producción.
- LIVE/mobile validation continua conforme crece la biblioteca.

## Cómo extender sin duplicar owner

- Nueva recipe → `map-forge-recipes.mjs`.
- Nueva métrica → `map-forge-quality.mjs`.
- Nueva primitive → `map-forge-geometry.mjs`.
- Nueva fase procedural → builder puro.
- Nueva regla de matching de assets → `map-forge-asset-binding.mjs`.
- Nuevos assets → Asset Library / `KELO_PROPERTY_CATALOG`, nunca el generator.
- Render/collision/property/UI → conectar por sus owners existentes.

## Checklist

1. ¿La nueva lógica cambia layout o solo binding?
2. ¿Es determinista y serializable?
3. ¿Usa IDs de catálogo, no rutas?
4. ¿Respeta `KELO_PROPERTY_CATALOG` como owner runtime?
5. ¿No toca renderer/collision/property directamente?
6. ¿Mantiene base world separado de runtime deltas?
7. ¿Actualiza audit/docs en el mismo PR?
