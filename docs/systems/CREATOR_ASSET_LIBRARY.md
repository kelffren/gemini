# Kelo Creator Asset Library — System Contract

## Propósito y problema que resuelve

`Kelo Creator Asset Library` es la capacidad de autoría que permite a creadores autorizados **subir manualmente imágenes**, describirlas una sola vez y reutilizarlas en los editores de Kelo World y en Kelo Map Forge sin crear un catálogo runtime paralelo.

Resuelve dos problemas: evita rutas de archivo hardcodeadas por mapa/editor y prepara producción comunitaria moderada con revisiones inmutables. La V1 **no genera imágenes con IA**; el archivo visual lo aporta manualmente el creador.

## Estado actual

**CREATOR-ACTIVE / OFFLINE-PROTOTYPE / ONLINE-READY BOUNDARY.**

- La UI de importación manual está activa dentro de Kelo Creators.
- Persistencia local: IndexedDB.
- Assets privados del creador y revisiones globales visibles en el repository disponible se registran en los owners runtime existentes.
- Publicación Global usa `world.publish` como autoridad local de prototipo.
- Repository/storage remoto cross-account está pendiente; puede sustituir el adapter sin cambiar consumidores ni IDs.

## OWNER y archivos principales

- Owner de autoría: `Kelo Creator Asset Library`.
- Servicio: `src/creators/assets/creator-asset-library.mjs`.
- Persistencia reemplazable: `src/creators/assets/indexeddb-creator-asset-repository.mjs`.
- Workspace: `src/creators/workspaces/asset-library-workspace.mjs`.
- UI: `src/creators/ui/asset-library-workspace.mjs`.
- Composition root: `src/creators/creator-entry.mjs`.
- Catálogo colocable reutilizado: `window.KELO_PROPERTY_CATALOG` en `src/property/property-asset-catalog.js`.
- Atlas reutilizado: `window.KELO_ATLAS_CONTRACT` en `src/environment/atlas-contract.js`.
- Map Forge binding: `src/world/map-forge/map-forge-asset-binding.mjs`.
- Audit: `scripts/creator-asset-library-audit.mjs`.

## Estado que posee

Solo metadata/revisiones de autoría: `assetId`, `familyId`, `revision`, `contentHash`, `ownerId`, nombre, categoría, familia semántica, tags, distritos, estado `private | review | global`, dimensiones, metadata de transparencia, tamaño lógico, colisión declarativa, fase visual, timestamps y `Blob` en el repository local. Mantiene además un cache transitorio de Data URLs para registrar imágenes en `KELO_ATLAS_CONTRACT` durante la sesión Creator.

## Estado que NO posee

No posee placements, parcels, renderer, collision lifecycle, PropertySystem, algoritmo procedural, Admin Keys, economía, assets oficiales ni autoridad server-side definitiva. `KELO_PROPERTY_CATALOG` sigue siendo el catálogo runtime colocable y `KELO_ATLAS_CONTRACT` sigue siendo el owner de carga de imágenes.

## Identidad y revisiones inmutables

Familia:

```text
creator:<owner>:<family>
```

Revisión:

```text
creator:<owner>:<family>@r<revision>-<contentHash>
```

Mismo contenido dentro de la misma familia reutiliza la revisión; contenido diferente crea otra. Una revisión `global` no puede borrarse desde esta API.

## API pública

`createCreatorAssetLibrary({ root, repository, permission })` expone:

- `importFile(options)`: valida/importa manualmente; requiere `creators.access`.
- `list({ scope })`: `mine`, `global`, `review`, `visible`.
- `submit(assetId)`: revisión propia → `review`.
- `publish(assetId)`: → `global`; requiere `world.publish`.
- `remove(assetId)`: solo revisión propia no global. Si ya estaba registrada runtime, su retirada visual completa se difiere a un nuevo boot porque los owners runtime no tienen `unregister` público.
- `hydrateRuntimeCatalog()`: registra revisiones visibles en Atlas + Property Catalog.
- `catalogSnapshot()` / `catalogVersion()`: snapshot compacto determinista para Map Forge.
- `onChange(fn)`: hooks de autoría.

## Flujo paso a paso

```text
Creator autorizado
→ elegir imagen manualmente
→ validar formato/tamaño/dimensiones
→ metadata
→ content hash
→ revisión inmutable
→ Asset Repository
→ KELO_ATLAS_CONTRACT.register
→ KELO_PROPERTY_CATALOG.registerTemplate
→ disponible para el creador y los editores
→ submit opcional
→ review
→ autoridad aprueba
→ global
→ consumidores usan el mismo assetId
```

## Formatos y límites actuales

- PNG, WebP, JPEG.
- Máximo 5 MB en el fallback local.
- Máximo 2048 px por eje.
- Tamaño lógico colocable hasta 1024 por eje.
- Snap runtime: 32.

PNG/WebP son preferibles para props transparentes.

## Permisos

Se reutilizan capacidades existentes:

- `creators.access`: importar/usar biblioteca privada.
- `world.publish`: aprobar/publicar Global en el fallback local.

No se introduce otro sistema de roles.

## Dependencias permitidas

Permitidas: permission adapter, repository adapter, `KELO_PROPERTY_CATALOG.registerTemplate()`, `KELO_ATLAS_CONTRACT.register()`, `KeloInputLocks`, snapshots serializables y el adapter de Map Forge.

Prohibidas: escribir Maps internos de owners, `KELO_PROPERTY_SYSTEM.request()` desde la biblioteca, escribir renderer/`obstacles`, reemplazar `KELO_COLLISION`, o guardar rutas físicas como identidad del asset en mapas.

## Events / hooks

`onChange` emite `hydrated`, `imported`, `submitted`, `published`, `removed`. `KELO_PROPERTY_CATALOG.onRegister()` sigue siendo el hook runtime para plantillas nuevas.

## Persistencia local y autoridad online futura

`createIndexedDbCreatorAssetRepository()` usa `kelo-creator-assets-v1/assets`; sin IndexedDB usa Map en memoria para tests/fallback.

El repository remoto futuro debe conservar IDs/revisiones inmutables, owner, status/review, blob/object storage, audit trail, permisos server-authoritative y catálogo global paginado/versionado. Workspaces, World Editor y Map Forge no deberían cambiar.

## Integración con Map Forge

Map Forge genera familias semánticas (`tree`, `lamp`, `bench`, etc.). `map-forge-asset-binding.mjs` las resuelve contra un snapshot de `KELO_PROPERTY_CATALOG` **después del layout y antes del handoff**:

```text
semantic decoration
→ deterministic catalog resolution
→ prefabPlacement.assetId
→ existing Studio draft importer
→ existing Property placement/runtime path
```

La selección usa `layoutHash + decoration id + candidate IDs`; mismo layout + mismo catálogo produce mismo `assetBindingHash`.

## Ejemplo correcto

Un creador importa:

```text
name: White Royal Tree
category: nature
family: tree
tags: white, royal, tree
districts: *
```

Obtiene un ID inmutable. El editor lo usa inmediatamente. Tras publicación Global, otros creadores y Map Forge pueden usar esa revisión sin conocer la ruta física.

## Anti-patrones / qué NO hacer

- No guardar `assets/foo.png` como source of truth de mapas.
- No reemplazar bytes de una revisión Global bajo el mismo ID.
- No crear `CommunityAssetRenderer` ni otro Property Catalog.
- No hacer que Map Forge lea Blob/Data URL.
- No publicar saltándose capability/authority.
- No renderizar decenas de miles de thumbnails simultáneamente; la UI pagina.

## Legacy / adapters / hotfixes relacionados

`KELO_PROPERTY_CATALOG` ya agregaba props/prefabs/tilesets y se conserva como owner. `KELO_ATLAS_CONTRACT` ya controla carga. `KeloAssetRegistry` visual no se convierte en repository de autoría. No se añade hotfix a `engine-*.js`.

## Tests y CI

`scripts/creator-asset-library-audit.mjs` protege snapshot inmutable, binding determinista, `prefabPlacements`, paridad Map Forge, repository fallback, wiring Creator/Hub, permisos, flujo de publicación y ausencia de mutaciones directas. `Creator Asset Library CI` ejecuta sintaxis + audit + documentación.

## Observabilidad / telemetría

- errores runtime: `console.warn('[Kelo Creator Assets] ...')`;
- cambios: `onChange`;
- Map Forge: `assetBinding.resolved`, `assetBinding.unresolved`, `assetBindingHash`, `generationStats.assetPlacementCount`.

Telemetría server-side de moderación/uso queda pendiente.

## Fallos conocidos / deuda pendiente

- `global` local todavía no sincroniza dispositivos/cuentas;
- falta storage/CDN y moderation server-side;
- falta scanning de seguridad y reglas de derechos/licencias antes de abrir publicación comunitaria pública;
- el catálogo runtime no tiene `unregister`;
- matching V1 usa familias/aliases; packs, pesos curatoriales, styles/biomes más ricos quedan pendientes;
- no hay marketplace/monetización de assets en V1.

## Extension points y cómo reutilizarlo

- nuevo storage → otro repository `put/get/list/remove`;
- nueva moderación → conservar `assetId` y cambiar authority adapter;
- nueva metadata → extender record/template mapping, no crear catálogo nuevo;
- nuevo consumidor → usar `KELO_PROPERTY_CATALOG`/snapshot por ID;
- nuevo criterio Map Forge → extender `map-forge-asset-binding.mjs`.

## Checklist para añadir capacidad sin duplicar owner

1. ¿La metadata pertenece a Asset Library o a un owner runtime existente?
2. ¿Reutiliza `KELO_PROPERTY_CATALOG` si es colocable?
3. ¿Reutiliza `KELO_ATLAS_CONTRACT` para imagen?
4. ¿Mantiene revisiones inmutables?
5. ¿La mutación pasa por permission/authority boundary?
6. ¿Es serializable/online-ready?
7. ¿Evita rutas hardcodeadas en mapas?
8. ¿Map Forge recibe IDs/snapshot y no Blobs?
9. ¿La UI sigue paginada/mobile-first?
10. ¿Audit/docs cambian en el mismo PR?
