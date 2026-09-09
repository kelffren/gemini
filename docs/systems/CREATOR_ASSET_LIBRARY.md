# Kelo Creator Asset Library — System Contract

## Propósito y problema que resuelve

`Kelo Creator Asset Library` es la capacidad de autoría que permite a creadores autorizados **subir manualmente imágenes**, describirlas una sola vez y reutilizarlas en los editores de Kelo World y en Kelo Map Forge sin crear un catálogo runtime paralelo.

El problema que resuelve es doble:

1. evita que cada asset nuevo dependa de rutas de archivo hardcodeadas o cambios manuales en cada editor;
2. permite que la producción visual deje de depender únicamente del equipo oficial, preparando una biblioteca comunitaria moderada con revisiones inmutables.

La primera versión NO genera imágenes con IA. El archivo visual lo aporta manualmente el creador.

## Estado actual

**CREATOR-ACTIVE / OFFLINE-PROTOTYPE / ONLINE-READY BOUNDARY.**

- La UI de importación manual está activa dentro de Kelo Creators.
- La persistencia local usa IndexedDB.
- Los assets privados del creador y las revisiones globales visibles en el repositorio local se registran en el catálogo runtime existente.
- La publicación Global usa el permiso existente `world.publish` como autoridad local de prototipo.
- Un servidor/repositorio remoto para compartir assets realmente entre cuentas/dispositivos está **pendiente**. La API está diseñada para reemplazar el adapter sin cambiar consumidores ni IDs.

## OWNER y archivos principales

- Owner de autoría: `Kelo Creator Asset Library`.
- Servicio: `src/creators/assets/creator-asset-library.mjs`.
- Persistencia local reemplazable: `src/creators/assets/indexeddb-creator-asset-repository.mjs`.
- Workspace manifest: `src/creators/workspaces/asset-library-workspace.mjs`.
- UI: `src/creators/ui/asset-library-workspace.mjs`.
- Composition root: `src/creators/creator-entry.mjs`.
- Runtime placeable catalog reutilizado: `window.KELO_PROPERTY_CATALOG` en `src/property/property-asset-catalog.js`.
- Runtime image/atlas contract reutilizado: `window.KELO_ATLAS_CONTRACT` en `src/environment/atlas-contract.js`.
- Map Forge binding: `src/world/map-forge/map-forge-asset-binding.mjs`.
- Audit: `scripts/creator-asset-library-audit.mjs`.

## Estado que posee

El servicio de Asset Library posee solamente metadata de autoría y revisiones de assets:

- `assetId` inmutable por revisión;
- `familyId` estable para agrupar revisiones;
- `revision`;
- `contentHash`;
- `ownerId`;
- nombre;
- categoría;
- familia semántica;
- tags;
- distritos compatibles;
- estado `private | review | global`;
- dimensiones naturales;
- dimensiones de mundo;
- metadata de transparencia cuando se puede inspeccionar;
- colisión declarativa de plantilla;
- fase `props_back | props_front`;
- timestamps de creación/revisión/publicación;
- `Blob` de imagen en el repository local.

También mantiene de forma transitoria un cache de Data URLs mientras la sesión Creator está viva para registrar el recurso en `KELO_ATLAS_CONTRACT`.

## Estado que NO posee

La biblioteca NO posee:

- placements del mapa;
- ownership de parcelas;
- renderer;
- lifecycle de colisiones;
- `PropertySystem`;
- generación procedural de Map Forge;
- permisos/Admin Keys;
- compras/economía;
- publicación server-side definitiva;
- moderation policy definitiva;
- assets oficiales ya existentes.

`KELO_PROPERTY_CATALOG` sigue siendo el catálogo runtime de plantillas colocables. `KELO_ATLAS_CONTRACT` sigue siendo el owner de carga de imágenes. La Asset Library solo los alimenta a través de sus APIs públicas.

## Identidad y revisiones inmutables

Cada importación pertenece a una familia:

```text
creator:<owner>:<family>
```

Cada contenido nuevo crea una revisión con ID estable:

```text
creator:<owner>:<family>@r<revision>-<contentHash>
```

Ejemplo:

```text
creator:kelo:tree-white@r3-8a91f2c0
```

Si se vuelve a subir exactamente el mismo contenido dentro de la misma familia, se reutiliza la revisión existente. Si cambia el archivo, se crea una revisión nueva.

Una revisión `global` no puede borrarse desde esta API. Esto evita que mapas publicados queden apuntando a un asset que desapareció o cambió silenciosamente.

## API pública

`createCreatorAssetLibrary({ root, repository, permission })` devuelve:

### `importFile(options)`

Importa manualmente una imagen y registra su revisión.

Entradas principales:

- `file`;
- `name`;
- `category`;
- `family`;
- `tags`;
- `districts`;
- `worldWidth`;
- `worldHeight`;
- `collisionMode`;
- `phase`.

Requiere `creators.access`.

### `list({ scope })`

Scopes actuales:

- `mine` — revisiones del creador actual;
- `global` — revisiones publicadas globalmente en el repository disponible;
- `review` — cola de revisión; completa solo para quien tiene permiso de publicación;
- `visible` — assets propios + globales.

### `submit(assetId)`

Mueve una revisión propia a `review`.

### `publish(assetId)`

Mueve una revisión a `global`. Requiere `world.publish`.

En producción esta transición debe validarse por autoridad remota.

### `remove(assetId)`

Elimina solamente una revisión propia no global del repository. Si ya fue registrada en el catálogo runtime durante la sesión actual, la desaparición visual completa se difiere hasta un nuevo boot porque los owners runtime actuales no tienen API de unregister. No se mutan sus Maps internos desde fuera.

### `hydrateRuntimeCatalog()`

Registra en los owners runtime existentes las revisiones visibles para el usuario actual.

### `catalogSnapshot()` / `catalogVersion()`

Exponen una representación compacta y determinista del catálogo colocable para consumidores como Map Forge. No incluyen `Blob`, `Image` ni objetos DOM.

## Flujo paso a paso

```text
Creator autorizado
→ Asset Library
→ elegir imagen manualmente
→ validar formato / tamaño / dimensiones
→ asignar metadata
→ content hash
→ crear/reutilizar revisión inmutable
→ guardar en Asset Repository
→ registrar imagen en KELO_ATLAS_CONTRACT
→ registrar plantilla con el mismo assetId en KELO_PROPERTY_CATALOG
→ disponible en editores/runtime del creador
→ opcional: enviar a review
→ autoridad aprueba
→ global
→ otros creadores/Map Forge pueden consumir esa revisión aprobada
```

## Formatos y límites actuales

- MIME: PNG, WebP y JPEG.
- Límite de archivo local: 5 MB.
- Dimensión máxima: 2048 px por eje, alineada con `KELO_ATLAS_CONTRACT`.
- Tamaño lógico colocable configurable hasta 1024 unidades por eje.
- Snap runtime: 32.

PNG/WebP son preferibles para props con transparencia. JPEG está permitido para casos donde transparencia no sea necesaria.

## Permisos

Se reutilizan capacidades existentes; no se crea un segundo sistema de roles.

- `creators.access` — puede abrir Asset Library e importar assets privados.
- `world.publish` — puede aprobar/publicar una revisión como Global en el prototipo actual.

Producción debe resolver estas capacidades mediante autoridad remota, manteniendo la misma interfaz de Creator permissions.

## Dependencias permitidas

Permitidas:

- Creator permission adapter;
- repository adapter;
- `KELO_PROPERTY_CATALOG.registerTemplate()`;
- `KELO_ATLAS_CONTRACT.register()`;
- `KeloInputLocks` en la UI;
- Map Forge asset-binding adapter como consumidor de snapshots.

No permitidas:

- escritura directa a Maps internos de Property Catalog/Atlas;
- `KELO_PROPERTY_SYSTEM.request()` desde la biblioteca;
- escritura a renderer;
- escritura a `obstacles`;
- reemplazar owner de `KELO_COLLISION`;
- rutas de archivo dentro de MapDefinition como identidad del asset.

## Events / hooks

El servicio expone `onChange(fn)` para eventos de autoría:

- `hydrated`;
- `imported`;
- `submitted`;
- `published`;
- `removed`.

`KELO_PROPERTY_CATALOG.onRegister()` ya notifica a consumidores existentes cuando una nueva plantilla se vuelve colocable.

## Persistencia local y autoridad online futura

### Local actual

`createIndexedDbCreatorAssetRepository()` guarda registros en `kelo-creator-assets-v1/assets`. Si IndexedDB no existe, usa un Map en memoria para tests/fallback.

### Online futuro

Se debe sustituir el repository/authority por una implementación remota que mantenga como mínimo:

- los mismos `assetId`/`familyId`;
- revisiones inmutables;
- owner;
- status/review;
- blob/object storage;
- moderation audit trail;
- permisos server-authoritative;
- catálogo global paginado/versionado.

Los workspaces, World Editor y Map Forge no deben cambiar para esa migración.

## Integración con Map Forge

Map Forge sigue generando posiciones y `family` semánticas (`tree`, `lamp`, `bench`, etc.). `map-forge-asset-binding.mjs` resuelve esas familias contra un snapshot de `KELO_PROPERTY_CATALOG` después del layout y antes del handoff.

Resultado:

```text
semantic decoration
→ deterministic catalog resolution
→ prefabPlacement.assetId
→ existing Studio draft importer
→ existing Property placement/runtime path
```

No hay un segundo renderer ni un segundo sistema de colocación.

La selección es determinista por `layoutHash + decoration id + candidate IDs`. Un mismo layout y una misma revisión de catálogo producen el mismo `assetBindingHash`.

## Ejemplo de uso correcto

Un creador importa un árbol y le asigna:

```text
name: White Royal Tree
category: nature
family: tree
tags: white, royal, tree
districts: *
```

El registro obtiene un ID inmutable. El editor puede mostrarlo inmediatamente al creador. Cuando la revisión se publica como Global, el catálogo aprobado puede ser usado por otros creadores. Map Forge puede resolver una decoración semántica `family: tree` hacia esa revisión sin conocer su ruta física.

## Anti-patrones / qué NO hacer

- No guardar `assets/foo.png` directamente dentro de mapas como source of truth.
- No reemplazar una revisión Global con bytes nuevos bajo el mismo `assetId`.
- No crear `CommunityAssetRenderer`, `CommunityPropertyCatalog` ni otro runtime paralelo.
- No hacer que Map Forge lea Blobs o Data URLs.
- No publicar desde la UI saltándose la capability/authority boundary.
- No borrar revisiones globales referenciables.
- No registrar 20.000 thumbnails simultáneamente en DOM; la UI pagina resultados.

## Legacy / adapters / hotfixes relacionados

- `KELO_PROPERTY_CATALOG` ya agregaba props, prefabs, tilesets y assets imperiales. Se conserva como owner de plantillas colocables.
- `KELO_ATLAS_CONTRACT` ya controla registro/carga de imágenes. Se reutiliza.
- `KeloAssetRegistry` visual no se convierte en repositorio de autoría; su responsabilidad sigue siendo manifests visuales runtime.
- No se añade ningún hotfix a `engine-*.js`.

## Tests y CI

`scripts/creator-asset-library-audit.mjs` protege:

- snapshot inmutable de catálogo;
- resolución determinista de familias;
- creación de `prefabPlacements` reales;
- paridad de generación Map Forge con catálogo real;
- repository fallback;
- wiring de Kelo Creators/Hub;
- permisos de workspace;
- flujo `private → review → global`;
- prohibición de mutaciones directas a runtime owners.

El workflow `Creator Asset Library CI` ejecuta sintaxis + audit + documentación en PR/main.

## Observabilidad

Actualmente:

- errores de registro runtime se reportan con `console.warn('[Kelo Creator Assets] ...')`;
- el servicio emite cambios a `onChange`;
- Map Forge expone `assetBinding.resolved`, `assetBinding.unresolved`, `assetBindingHash` y `generationStats.assetPlacementCount`.

Telemetría server-side de publicación/rechazo/uso está pendiente.

## Fallos conocidos / deuda pendiente

- `global` todavía no significa sincronización real entre dispositivos; requiere repository remoto.
- Falta moderación server-side, reportes y razones de rechazo.
- Falta storage/CDN remoto y optimización/atlas packing server-side.
- Falta antivirus/content scanning y reglas de derechos/licencias antes de abrir publicación comunitaria real.
- El runtime catalog actual no tiene `unregister`; borrar un borrador ya registrado no lo quita de la sesión hasta reiniciar.
- El binding v1 usa aliases/familias semánticas; packs, pesos curatoriales y estilos/biomas más ricos quedan para siguientes versiones.
- No hay monetización/marketplace de assets en esta versión.

## Extension points y reutilización

Para añadir una capacidad sin duplicar owner:

- nuevo storage → implementar otro repository con `put/get/list/remove`;
- nueva revisión/moderación → mantener `assetId` inmutable y cambiar authority adapter;
- nueva metadata → extender record + template mapping, no crear otro catálogo;
- nuevo consumidor → usar `KELO_PROPERTY_CATALOG`/snapshot por ID;
- nuevo tipo de imagen/asset → validar primero compatibilidad del runtime owner correspondiente;
- nuevo criterio Map Forge → extender `map-forge-asset-binding.mjs`, no meter rutas en el generator.

## Checklist para una nueva capacidad

1. ¿La metadata pertenece a Asset Library o al owner runtime del tipo?
2. ¿Reutiliza `KELO_PROPERTY_CATALOG` si es colocable?
3. ¿Reutiliza `KELO_ATLAS_CONTRACT` para cargar imagen?
4. ¿Mantiene IDs/revisiones inmutables?
5. ¿La mutación pasa por permission/authority boundary?
6. ¿Es serializable y online-ready?
7. ¿No introduce rutas hardcodeadas en mapas?
8. ¿Map Forge recibe solo snapshot/IDs, no Blobs?
9. ¿La UI sigue paginada/mobile-first?
10. ¿Audit/docs se actualizan en el mismo PR?
