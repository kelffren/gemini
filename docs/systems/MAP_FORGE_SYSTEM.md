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

El core no posee estado mutable runtime. Produce metadata, bounds, semantic graph, districts, terrain, roads, blocks/parcels, landmarks, decoraciones semánticas, spawn/exits, navigation, scenic vistas, chunks, stats, validation/quality. Tras el adapter de catálogo puede incluir `prefabPlacements` y `assetBinding`.

## Estado que NO posee

- Render: `KELO_WORLD_RENDERER`.
- Collision lifecycle: `KELO_COLLISION`.
- Camera: `KeloCamera`.
- Property ownership/build state: Property System.
- Catálogo colocable: `KELO_PROPERTY_CATALOG`.
- Assets/Blobs/revisiones: Creator Asset Library.
- Studio history/UI.
- Server/runtime deltas.

## Determinismo e identidad

La identidad base usa `mapId`, `seed`, `generatorVersion`, `recipeId`, `recipeVersion`, `assetCatalogVersion` y `layoutHash`. El core no usa `Math.random()` ni wall-clock. El worker client sustituye placeholders de catálogo por una versión determinista construida desde IDs visibles de `KELO_PROPERTY_CATALOG` antes de generar.

El asset binding añade `assetBindingHash`; mismo layout + mismo catálogo ⇒ mismo binding.

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

Genera 1–32 candidatos válidos y expone selecciones de calidad.

### `createMapForgeWorkerClient({ root })`

Usa Worker o fallback sync. Obtiene catálogo colocable desde `root.KELO_PROPERTY_CATALOG`, calcula versión real, pasa esa versión al core y enlaza el resultado con `bindMapForgeAssets()` antes de resolver.

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

Terrain sigue siendo coarse data. El builder coloca `decorations` por familia semántica. El binding intenta resolverlas contra el catálogo compartido usando familia/nombre/ID/source, aliases español/inglés, categoría y distrito compatibles y elección determinista.

Si una familia no tiene candidato, queda en `assetBinding.unresolved`; no se inventa ruta ni placeholder físico.

Los assets Creator usan el mismo `KELO_PROPERTY_CATALOG` que los oficiales.

## Studio / exterior handoff

`map-forge-draft-importer.mjs` transforma `prefabPlacements` en placements de draft usando `assetId`. La importación pasa por la autoridad de World Edit. Preview exterior no publica ni destruye LIVE.

## Online-first

Map Forge define **BASE GENERATED WORLD**:

```text
Base Generated World
+ Server / Runtime Deltas
```

El catálogo global online futuro debe entregar revisión/version determinista y assets aprobados; el worker client/binding consume el mismo shape sin cambiar el generator. Player buildings, ownership, stalls, eventos, recursos, NPC runtime y destrucción quedan fuera del layout base.

## Dependencias permitidas

Recipes/data, primitives puras, snapshot serializable de `KELO_PROPERTY_CATALOG`, Asset Library solo para hidratar el owner runtime antes de abrir Map Forge y World workspace/authority para handoff.

El core no depende de DOM, Canvas, Property System, Atlas, Image, Blob o Creator UI.

## Events / hooks

No hay eventos en core. Creator Asset Library hidrata `KELO_PROPERTY_CATALOG` antes de abrir Map Forge. El worker client toma snapshot por generación.

## Persistencia

Map Forge no persiste estado propio. JSON exportado contiene IDs/versiones. Drafts y assets pertenecen a sus owners respectivos.

## Invariantes

1. No `Math.random()` en procedural core ni asset binding.
2. No DOM/Canvas en core/binding.
3. No writes a `obstacles`.
4. No reemplazo de `KELO_COLLISION`.
5. No mutación de Property System.
6. No rutas físicas como identidad de placements.
7. Same inputs + same catalog ⇒ same layout/binding.
8. Solo candidatos válidos pueden ser best-of.
9. Resolution failures quedan explícitos en `unresolved`.
10. Handoff cruza la autoridad de draft existente.

## Ejemplo correcto

Map Forge genera una decoración `family: tree`. El catálogo contiene `creator:kelo:white-tree@r2-91af82c1`. El binding crea `prefabPlacement.assetId` con esa revisión y Studio la importa por su path existente.

## Anti-patrones

- No meter `src: "assets/tree.png"` en MapDefinition como identity.
- No leer Blob/Data URL desde core.
- No crear `MapForgeAssetCatalog` paralelo.
- No escribir placements directamente al LIVE world.
- No elegir assets con `Math.random()`.
- No incluir runtime deltas en layoutHash.

## Legacy/adapters relacionados

Studio importer y worker client son adapters deliberados. `KELO_PROPERTY_CATALOG` continúa como catálogo runtime. `KeloAssetRegistry` visual no reemplaza este contrato.

## Tests y CI

- `map-forge-core-audit.mjs`: determinismo/conectividad/seeds/quality.
- `map-forge-studio-handoff-audit.mjs`: draft authority/handoff.
- `creator-asset-library-audit.mjs`: catálogo compartido, binding determinista, prefabPlacements y owner boundaries.

## Observabilidad

Cada mapa enlazado expone `metadata.assetCatalogVersion`, `metadata.assetBindingHash`, `assetBinding.resolved`, `assetBinding.unresolved`, `generationStats.assetPlacementCount` y `generationStats.unresolvedDecorationCount`.

## Deuda pendiente real

- WFC local con budget/retry/fallback.
- lock + regenerate parcial.
- richer prefab generation para blocks/parcels/landmarks.
- catalog packs/styles/biomes y weighting curatorial.
- server-approved global catalog revision/CDN.
- golden seeds con catálogos de producción.
- LIVE/mobile validation continua.

## Cómo extender sin duplicar owner

- Nueva recipe → `map-forge-recipes.mjs`.
- Nueva métrica → `map-forge-quality.mjs`.
- Nueva primitive → `map-forge-geometry.mjs`.
- Nueva fase procedural → builder puro.
- Nueva regla de matching → `map-forge-asset-binding.mjs`.
- Nuevos assets → Asset Library / `KELO_PROPERTY_CATALOG`.
- Render/collision/property/UI → sus owners existentes.

## Checklist

1. ¿Cambia layout o solo binding?
2. ¿Es determinista/serializable?
3. ¿Usa IDs de catálogo, no rutas?
4. ¿Respeta `KELO_PROPERTY_CATALOG`?
5. ¿No toca renderer/collision/property directo?
6. ¿Mantiene base world separado de deltas?
7. ¿Actualiza audit/docs?
