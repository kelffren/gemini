# Kelo Map Forge — System Contract

## Propósito

`KeloMapForge` genera **Base Generated Worlds** para Kelo World y los convierte siempre al contrato normal `MapDefinition`. El sistema puede obtener la geometría base desde un proveedor externo, pero no posee renderer, cámara, colisión runtime, Property, gameplay ni autoridad de publicación.

El flujo visible sigue siendo único:

```text
Generation Provider
→ MapDefinition
→ mapDefinitionToWorldDraftSnapshot()
→ World Draft Snapshot normalizado
   ├─ KELO_WORLD_BUILDER.renderSnapshotPreview()  [read-only]
   └─ KELO_WORLD_EDIT world:draft:import
      → world:preview:enter
      → KELO_WORLD_BUILDER.ingestViewSnapshot()
      → KELO_PROPERTY_SYSTEM replaceLayout
      → KeloCamera.focus()
```

No existe un segundo map engine, Property System, camera manager ni renderer.

## Estado actual

**CREATOR ACTIVE / SETTLEMAKER CLOUD PRIMARY / LOCAL FALLBACK / DRAFT PREVIEW LIVE / ONLINE-FIRST.**

Map Forge usa por defecto un servicio separado de Settlemaker para obtener una ciudad estructurada. Si ese servicio no está disponible, `map-forge-worker-client.mjs` conserva el generador determinista local existente como fallback mediante Worker o ejecución síncrona.

La salida de ambos caminos termina en el mismo `MapDefinition`, por lo que preview, World Editor, autoridad, renderer, cámara y publicación no necesitan saber qué generador produjo la geometría.

## Proveedor Settlemaker

Owner de integración: `src/world/map-forge/map-forge-settlemaker-provider.mjs`.

Servicio actual:

```text
https://kelo-settlemaker-service.onrender.com
```

Contrato HTTP:

```text
POST /generate
Content-Type: application/json

seed + population + opciones de asentamiento
→ GeoJSON + metadata de Settlemaker
```

El proveedor transforma exclusivamente datos. No importa código de Settlemaker dentro de Kelo World y no llama al renderer ni a autoridades runtime.

El adapter convierte:

- `ward` → distritos Kelo;
- `street` → roads Kelo, conservando jerarquía artery/road;
- `building` → blocks + parcels estructurados;
- `poi` / `tower` → landmarks semánticos limitados y espaciados;
- `entrance` → exits;
- wards → terrain field determinista;
- centros de distrito → navigation/semantic graph conectado;
- metadata Settlemaker → provenance dentro de `MapDefinition.metadata/debug`.

Las coordenadas locales de Settlemaker se escalan de forma uniforme a `recipe.worldBounds`; el mapa final queda dentro del sistema de coordenadas normal de Kelo.

### Lo que deliberadamente NO importa todavía

- colisiones de edificios Settlemaker;
- interacciones;
- ownership/economía;
- runtime NPCs;
- arte/SVG de Settlemaker;
- un renderer externo.

Los edificios sí permanecen como geometría estructurada (`blocks`/`parcels`) para poder vestirlos posteriormente con prefabs Kelo sin perder el layout urbano.

## Separación de licencia

Settlemaker es GPL-3.0-only. Kelo World no incorpora su runtime ni copia su fuente en este repositorio. El servicio externo ejecuta Settlemaker como programa separado y Kelo consume únicamente su salida HTTP/JSON. La arquitectura técnica mantiene esa frontera explícita.

## Generador local de respaldo

El core local sigue en `src/world/map-forge/map-forge-core.mjs` y continúa siendo determinista. Su pipeline actual es:

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

Este camino no se elimina: sirve como fallback si la red o el servicio externo fallan y también puede forzarse programáticamente con `provider:'local'` en el generation client.

## Owners y archivos

- Core procedural local: `src/world/map-forge/map-forge-core.mjs`.
- Settlemaker adapter/provider: `src/world/map-forge/map-forge-settlemaker-provider.mjs`.
- Generation client / selección cloud→fallback: `src/world/map-forge/map-forge-worker-client.mjs`.
- Recipes: `src/world/map-forge/map-forge-recipes.mjs`.
- Builder local: `src/world/map-forge/map-forge-builder.mjs`.
- Validator/scorer compartido: `src/world/map-forge/map-forge-quality.mjs`.
- Worker local: `src/world/map-forge/map-forge-worker.mjs`.
- Creator UI/lifecycle: `src/creators/ui/map-forge-workspace.mjs`.
- Creator routing: `src/creators/workspaces/map-forge-workspace.mjs`.
- World handoff: `src/creators/workspaces/world-workspace.mjs`.
- Normalización/import: `src/studio/adapters/map-forge-draft-importer.mjs`.
- Draft/preview authority: `KELO_WORLD_EDIT`.
- Runtime projection + snapshot preview: `src/environment/world-builder-system.js`.
- Real placement rendering: `src/property/property-system.js`.
- Real placement catalog: `KELO_PROPERTY_CATALOG` / `src/property/property-asset-catalog.js`.
- Camera: `KeloCamera` / `src/core/camera-system.js`.
- Settlemaker contract audit: `scripts/map-forge-settlemaker-provider-audit.mjs`.
- Studio handoff audit: `scripts/map-forge-studio-handoff-audit.mjs`.
- Mobile visual smoke: `tests/map-forge-mobile-preview.spec.js`.
- CI: `.github/workflows/map-forge-studio-handoff-ci.yml`.

## Estado que posee

El provider externo no posee estado mutable. El generation client solo conserva requests pendientes del Worker y el último modo de proveedor para observabilidad de UI.

El `MapDefinition` conserva metadata de identidad, world bounds, semantic graph, districts, terrain, roads, blocks, parcels, landmarks, prefab placements, decorations, interactions, spawns, exits, collision descriptors, navigation, scenic vistas, chunk index, generation stats, validation y quality.

El estado temporal de la interfaz —recipe, seed, candidates, selected candidate y sliders— pertenece al workspace Creator.

## Estado que NO posee

- Render final: `KELO_WORLD_RENDERER` / World Builder overlay.
- Collision lifecycle: `KELO_COLLISION`.
- Camera/viewport: `KeloCamera`.
- Property ownership/build state: `KELO_PROPERTY_SYSTEM`.
- World draft/publish state: `KELO_WORLD_EDIT`.
- Economía, NPC runtime, PvP o player deltas.

## API pública

### `createMapForgeWorkerClient()`

`generate(recipeId, options)` intenta Settlemaker cloud primero. Si la petición, adaptación o validación falla, usa el generador local existente. `mode` informa `settlemaker-cloud`, `worker-fallback` o `sync-fallback`.

### `generateSettlemakerBestOf(recipe, options)`

Genera hasta 4 candidatos remotos por llamada para no saturar un servicio gratuito. Cada candidato usa una seed derivada determinísticamente y vuelve a pasar por el scorer/validator de Map Forge.

### `settlemakerGeoJsonToMapDefinition(response, recipe, options)`

Adapter puro y determinista. No hace red ni mutaciones runtime.

## Determinismo e identidad

Para una misma respuesta GeoJSON, recipe, seed, style y asset catalog version, la adaptación produce el mismo `layoutHash` y la misma estructura Kelo. El hash se calcula sobre la geometría normalizada antes de añadir validation/quality.

Settlemaker también genera de forma determinista por seed. La respuesta del servicio elimina timestamps no deterministas antes de devolverse a Kelo.

El generador local mantiene la regla histórica de no usar `Math.random()` ni wall-clock dentro de `MapDefinition`.

## Scoring y validación

Un mapa externo **no entra automáticamente por ser de Settlemaker**. Después de adaptarlo se reutilizan:

```text
validateMapDefinition()
scoreMapDefinition()
```

El adapter construye un recipe de scoring con los distritos realmente recibidos para que las reglas de conectividad, navegación, bounds, landmarks, road quality y composición sigan aplicando. Un candidato inválido no puede entrar al handoff.

## Proyección a World Draft Snapshot

`mapDefinitionToWorldDraftSnapshot()` sigue siendo la única traducción visual/editable compartida. Rasteriza terrain y roads, conserva placements explícitos, resuelve semántica contra `KELO_PROPERTY_CATALOG` y proyecta colisiones declaradas sin mutar LIVE.

Settlemaker no salta esta frontera. Una vez adaptado, su mapa es un MapDefinition normal.

## Preview dentro de Map Forge

La preview delega en:

```text
KELO_WORLD_BUILDER.renderSnapshotPreview(canvas, snapshot, bounds)
```

World Builder reutiliza `KELO_TILE_REGISTRY`, `KELO_ATLAS_CONTRACT` y `KELO_PROPERTY_SYSTEM.drawPlacements()`. La carga de assets es asíncrona y se redibuja por eventos asset-ready.

## Preview exterior y World Editor

`VER EN MAPA EXTERIOR` crea/importa un draft, entra por `world:preview:enter`, enfoca por `KeloCamera` y ofrece `VOLVER A MAP FORGE`. El shell fullscreen se separa antes del await para no bloquear input.

`ABRIR EN WORLD EDITOR` sigue siendo un flujo separado y usa el mismo draft importer. Ninguno publica LIVE automáticamente.

## Online-first

Map Forge define solo el **BASE GENERATED WORLD**:

```text
Base Generated World
+ Server / Runtime Deltas
```

La dependencia HTTP de generación ocurre antes de la autoridad gameplay. Las mutaciones del mundo continúan pasando por `KELO_WORLD_EDIT.request()` y pueden migrar a autoridad remota sin cambiar el provider.

La URL del servicio puede sustituirse mediante `globalThis.KELO_MAP_FORGE_SETTLEMAKER_URL` sin introducir secretos en el cliente.

## Fallos y fallback

Si Settlemaker responde con error, timeout, JSON inválido, GeoJSON inválido o ningún candidato válido, el generation client registra un warning y ejecuta el generador local determinista existente.

Esto mantiene Map Forge utilizable durante cold starts o caídas del servicio sin crear una segunda UI ni un segundo flujo de handoff.

## Invariantes

1. Todo proveedor termina en un `MapDefinition` válido.
2. Settlemaker nunca renderiza dentro de Kelo.
3. No se incorpora el runtime GPL de Settlemaker en `kelffren/gemini`.
4. No hay writes directos a `KELO_COLLISION` desde generator/provider/importer.
5. No hay mutación directa de Property desde generator/provider/importer.
6. Camera solo mediante `KeloCamera`.
7. Preview Map Forge y exterior usan la misma proyección normalizada.
8. Un candidato inválido no puede entrar al handoff.
9. Same normalized inputs ⇒ same `layoutHash`.
10. Falla cloud ⇒ fallback local, no un renderer paralelo.
11. El provider externo no controla economía, gameplay, persistencia ni publicación.

## Tests y CI

`node scripts/map-forge-settlemaker-provider-audit.mjs` usa GeoJSON sintético con wards, streets, buildings, POIs y entrances para comprobar:

- adaptación determinista;
- wards → districts;
- streets → roads;
- buildings → blocks/parcels;
- POIs/towers → landmarks;
- entrances → exits;
- navegación válida;
- scoring compartido;
- best-of HTTP con fetch mockeado;
- identidad distinta para seeds distintas.

`node scripts/map-forge-studio-handoff-audit.mjs` protege la proyección y el lifecycle existente.

`tests/map-forge-mobile-preview.spec.js` protege el flujo visible 390×844 de preview/handoff/retorno. CI ejecuta los tres contratos relevantes.

## Observabilidad

- `workerClient.mode` expone el provider realmente usado.
- errores cloud se registran con prefijo `[Kelo Map Forge]` antes de fallback.
- `MapDefinition.metadata.sourceGenerator` y `sourceSchemaVersion` guardan provenance.
- `debug.provider`, `degradedFlags` y `originShift` conservan diagnostics no autoritativos.

## Deuda pendiente real

- vestir `building` polygons con una biblioteca más amplia de prefabs Kelo sin repetir props;
- importar murallas como componentes Kelo cuando exista un owner visual/collision apropiado;
- mejorar navegación para proyectar directamente el grafo de calles en lugar del backbone semántico de distritos;
- golden seeds de Settlemaker con screenshots aprobadas;
- atlas authored activo para todos los caminos;
- endpoint de generación con plan/infra estable si el free service deja de ser suficiente.

## Cómo extender sin duplicar owner

- Nuevo proveedor: adapter bajo `src/world/map-forge/` que devuelva MapDefinition y se enchufe al generation client.
- Nueva recipe: `map-forge-recipes.mjs`.
- Nueva métrica: `map-forge-quality.mjs`.
- Nueva primitive geométrica local: `map-forge-geometry.mjs`.
- Nueva traducción visual/editable: extender el importer o el owner runtime correspondiente.
- Nuevos assets: registrar en Property/Tile/Atlas owners existentes; Map Forge solo referencia semántica/data.

Nunca conectar un proveedor externo directamente a Canvas, Property, colisión, cámara o mundo LIVE.
