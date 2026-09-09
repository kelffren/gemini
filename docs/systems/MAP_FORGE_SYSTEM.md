# Kelo Map Forge — System Contract

## Propósito

`KeloMapForge` es la capacidad data-driven que genera **Base Generated Worlds** deterministas para Kelo World. No es un renderer, no posee cámara, no posee colisión runtime, no posee propiedades de jugadores y no modifica gameplay LIVE por sí mismo.

Transforma una recipe + seed estable en un `MapDefinition` puro, serializable, validado y puntuado. Desde Creators existe además una superficie visual para generar y comparar ciudades automáticamente sin escribir código.

## Estado actual

**CREATOR ACTIVE / RUNTIME HEADLESS.**

- Core determinista: activo y protegido por CI.
- Map Forge Creator workspace: activo y lazy desde Kelo Creators.
- Web Worker: activo en navegador con fallback síncrono determinista.
- Preview visual de candidatos: activo.
- Best-of 4/8/16/32: activo.
- Export JSON: activo.
- Aplicación directa al mundo LIVE: **todavía no**. La futura integración debe reutilizar `KELO_WORLD_RENDERER`, `KELO_COLLISION` y World/Studio authority; Map Forge no puede sustituirlos.

## Owner y archivos

- Owner lógico de generación: `KeloMapForge`.
- Recipes: `src/world/map-forge/map-forge-recipes.mjs`.
- PRNG/hash: `src/world/map-forge/map-forge-prng.mjs`.
- Geometría: `src/world/map-forge/map-forge-geometry.mjs`.
- Builder: `src/world/map-forge/map-forge-builder.mjs`.
- Validator/scorer: `src/world/map-forge/map-forge-quality.mjs`.
- Orchestrator/API: `src/world/map-forge/map-forge-core.mjs`.
- Worker: `src/world/map-forge/map-forge-worker.mjs`.
- Worker client: `src/world/map-forge/map-forge-worker-client.mjs`.
- Creator manifest: `src/creators/workspaces/map-forge-workspace.mjs`.
- Creator UI: `src/creators/ui/map-forge-workspace.mjs`.
- Core audit: `scripts/map-forge-core-audit.mjs`.
- Creator browser audit: `scripts/map-forge-creator-browser-audit.mjs`.
- CI: `.github/workflows/map-forge-core-ci.yml` y `.github/workflows/map-forge-creator-ci.yml`.

## Ownership

Map Forge posee solamente generación y datos de base world. No posee:

- Render final: `KELO_WORLD_RENDERER`.
- Collision lifecycle runtime: `KELO_COLLISION`.
- Camera/viewport: `KeloCamera`.
- Property ownership/build state: Property System.
- Player buildings, stalls, NPC runtime, resource state o eventos: authority/runtime deltas.
- Studio history/authority: Kelo Studio + `KELO_WORLD_EDIT`.

La UI Creator posee exclusivamente controles, preview, selección y exportación.

## Determinismo

La identidad del mundo base usa:

- `mapId`;
- `seed`;
- `generatorVersion`;
- `recipeId`;
- `recipeVersion`;
- `assetCatalogVersion`;
- `layoutHash`.

El core no usa `Math.random()` ni wall-clock dentro del `MapDefinition`. Mismos inputs producen mismo `layoutHash` y serialización.

Streams actuales se derivan de seed + nombres estables (`layout`, `roads`, `architecture`, `decoration`).

## Pipeline

```text
Map Intent
→ Semantic Graph
→ region anchors + deterministic relaxation
→ weighted power-Voronoi field
→ hero landmark placement
→ Delaunay graph
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
→ validator
→ quality scorer
→ best-of-N
→ MapDefinition
```

## API pública del core

### `generateMapCandidate(recipe, options)`
Genera un candidato determinista.

### `generateBestOf(recipe, options)`
Genera 1–32 candidatos, rechaza inválidos, ordena por score y expone `bestOverall`, `mostMonumental`, `mostOrganic`, `mostExplorable` y `mostCompact`.

### `validateMapDefinition(map, recipe)`
Comprueba required districts, spawn/exits, bounds, overlaps, parcelas y reachability.

### `scoreMapDefinition(map, recipe)`
Puntúa 0–100: playability, connectivity, navigation, visualComposition, landmarkQuality, districtVariety, roadQuality, densityBalance, negativeSpace, assetVariety, scenicVistas y technicalSafety.

## Creator workspace — uso

Ruta:

```text
Menú Luxe → Creators → BUILD → Map Forge
```

Controles actuales:

- Recipe: Royal Capital / Village / Forest.
- Seed reproducible.
- Best of 4 / 8 / 16 / 32.
- Monumentalidad.
- Caminos orgánicos.
- Densidad urbana.
- Vegetación.
- Exploración.
- Decoración.

La UI genera automáticamente al abrirse, muestra el plano con distritos, roads, parcelas, landmarks, spawn y exits, permite seleccionar cualquier candidato y exportar el `MapDefinition` ganador como JSON.

La generación se ejecuta en Web Worker cuando el navegador lo soporta. El Worker y el path síncrono deben producir el mismo layout hash para los mismos inputs.

## Recipes actuales

- `KELO_ROYAL_CAPITAL_V1`.
- `KELO_VILLAGE_V1`.
- `KELO_FOREST_V1`.

Las diferencias entre mapa viven en recipes; no se hardcodea una Plaza especial dentro del engine.

## Roads, parcelas, terreno y chunks

Roads usan Delaunay → MST → reinserción de loops. El resultado es data (`polyline`, `class`, `width`, `material`, `priority`).

Blocks/parcels describen terreno base para housing, shops y futuras parcelas sin transferir ownership a Map Forge.

Terrain se produce como field asociado a distritos/biome. Decoración usa spacing/clearance tipo Poisson.

Cada `MapDefinition` incluye lookup espacial determinista con chunk size 512 para terrain, roads, blocks, parcels, landmarks y decorations.

## Online-first

Map Forge define **BASE GENERATED WORLD**.

```text
Base Generated World
+ Server / Runtime Deltas
```

Player buildings, property ownership, market stalls, temporary events, resource state, NPC state y destructibles no forman parte del `layoutHash` del mundo base.

## Invariantes

1. No `Math.random()` dentro del procedural core.
2. No DOM/Canvas dentro del core.
3. No writes a `obstacles`.
4. No writes a `KELO_COLLISION` desde el core.
5. No mutación de Property System.
6. Same inputs ⇒ same layoutHash.
7. Un candidato inválido no entra al best-of.
8. Worker y sync deben mantener paridad.
9. Creator UI debe adquirir y liberar `KeloInputLocks` sin leaks.
10. Exportar/generar no publica ni cambia el mundo LIVE.

## Tests y CI

`map-forge-core-audit.mjs` cubre determinismo, serialización, MST/loops, parcelas, vistas, chunks, best-of y 300 seeds.

`map-forge-creator-browser-audit.mjs` cubre:

- Worker real en Chromium;
- Worker == sync layoutHash;
- primera generación automática;
- 8 candidatos por defecto;
- selección y score;
- preview canvas móvil 390×844;
- cambio de recipe a Village;
- cambio de count a 4;
- generación posterior;
- input lock acquire/release.

## Deuda pendiente real

- WFC local con budget/retry/fallback.
- Metadata generativa conectada a `KELO_PREFAB_CONTRACT`.
- lock + regenerate parcial.
- importar MapDefinition al World Studio como draft editable.
- runtime adapter final hacia `KELO_WORLD_RENDERER` y `KELO_COLLISION`.
- resolver prefabs/assets reales para buildings/landmarks por tags.
- golden seeds con `assetCatalogVersion` real.
- validación LIVE/mobile después de publicar mapas generados al runtime.

No tratar estas capacidades como implementadas hasta superar sus propios gates.
