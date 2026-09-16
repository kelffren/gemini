# BibliotecaTecnologia — Documentación técnica

> Fuente de verdad operativa de Biblioteca Universal / Content Vault / Content Packs.
> Este documento cubre solo esta tecnología.
> Última revisión: 2026-09-16.

## 1. Propósito

BibliotecaTecnologia administra distribución e integración de contenido de Kelo World sin cargar binarios externos en el boot normal.

Tipos soportados:

- image;
- sprite;
- tileset;
- animation;
- vfx;
- sfx;
- music;
- ambience;
- ability declarativa;
- scene/prefab;
- content packs.

Principio canónico:

```text
DISCOVERED != OWNED != DOWNLOADED != INTEGRATED != LOADED
```

## 2. Archivos principales

### Catálogos

- `data/external-asset-providers.json`
- `data/opengameart-cc0-curated.json`
- `data/kelo-content-starter-catalog.json`
- `data/content-pack-catalog.json`

### Providers

- `src/creators/assets/external-asset-providers.mjs`
- `src/creators/assets/kenney-live-provider.mjs`
- `src/creators/assets/lpc-live-provider.mjs`
- `src/creators/assets/opengameart-live-provider.mjs`
- `src/creators/assets/kelo-content-live-provider.mjs`

### Vault / integración

- `src/creators/assets/personal-asset-vault.mjs`
- `src/creators/assets/content-integration-router.mjs`
- `src/creators/assets/personal-asset-runtime-bridge.mjs`
- `src/creators/assets/personal-content-runtime-bridge.mjs`

### Packs

- `src/creators/assets/content-pack-manager.mjs`
- `content-packs.html`

### UI

- `asset-vault.html`
- `src/ui/asset-library-launcher.js`

## 3. Personal Vault — schema actual

Base IndexedDB:

```text
kelo_personal_asset_vault_v1
DB_VERSION = 2
```

Stores:

```text
assets
blobs
manifests
casBlobs
```

### `assets`

Metadata normalizada por `asset.id`.

Campos relevantes:

```text
id
provider
externalId
name
category
contentKind
license
author/authors
licenses
creditUrls
creditNotes
ownership
downloaded
integrated
bytes
mime
sha256
expectedSha256
rollbackActive
pinnedCommit
definitionUrl
repositoryUrl
verified
```

### `blobs`

Para contenido CAS nuevo, ya no guarda necesariamente el Blob directamente. Actúa como puntero:

```json
{
  "id": "provider:asset",
  "digest": "sha256:...",
  "previousDigest": "sha256:... | null",
  "bytes": 123,
  "mime": "image/png",
  "storage": "cas-v2"
}
```

Filas legacy con `blob` inline siguen siendo válidas.

### `casBlobs`

Contenido físico deduplicado:

```json
{
  "digest": "sha256:...",
  "blob": "<Blob>",
  "bytes": 123,
  "mime": "image/png",
  "createdAt": "...",
  "updatedAt": "...",
  "orphanedAt": null
}
```

El key canónico es el SHA-256.

## 4. Descarga CAS

`downloadAsset(input)` ahora sigue:

```text
remember metadata
 -> fetch/inline Blob
 -> MIME validation
 -> SHA-256 real
 -> compare expectedSha256 si existe
 -> put/reuse casBlobs[digest]
 -> atomically update blobs[assetId] pointer
 -> update metadata
```

Si el digest ya existe:

```text
casReused = true
```

No se crea otra copia física del mismo contenido.

## 5. Compatibilidad legacy

`getBlob(id)` resuelve ambas formas:

```text
legacy row.blob
```

o:

```text
row.digest -> casBlobs[digest].blob
```

Esto permite migración incremental sin convertir todo IndexedDB durante `onupgradeneeded`.

APIs:

```js
await migrateAssetToCas(id)
await migrateVaultToCas({limit, onProgress})
```

No ejecutar migraciones masivas automáticamente en el boot.

## 6. Deduplicación

API:

```js
await getCasStats()
```

Devuelve, entre otros:

```text
casBlobs
casPointers
legacyPointers
rollbackPointers
orphanedBlobs
logicalBytes
physicalCasBytes
deduplicatedBytes
dedupeRatio
```

Conceptos:

```text
logicalBytes = suma lógica de contenido referenciado
physicalCasBytes = blobs únicos guardados
```

## 7. Rollback por asset

Cuando una nueva descarga cambia el digest de un asset:

```text
current digest -> previousDigest
new digest -> current digest
```

API:

```js
await rollbackAssetBlob(id)
```

Comportamiento:

1. exige `previousDigest`;
2. exige que el blob anterior siga en CAS;
3. intercambia current/previous;
4. invalida el manifest integrado;
5. marca asset como `integrated:false`;
6. marca `rollbackActive:true`;
7. emite `kelo:personal-content-rolled-back`.

Después hay que reintegrar el contenido si se quiere usar esa versión.

Para abandonar historial:

```js
await discardAssetRollbackHistory(id)
```

Esto solo quita la referencia anterior. El blob no se destruye inmediatamente; GC decide después.

## 8. Garbage Collection CAS

API:

```js
await garbageCollectCas({
  graceMs,
  dryRun,
  maxDeletes,
  onProgress
})
```

Gracia por defecto:

```text
7 días
```

Modelo:

```text
unreferenced
 -> si no orphanedAt: marcar orphanedAt
 -> esperar grace period
 -> borrar en GC posterior
```

Un digest cuenta como referenciado si está en:

- `pointer.digest`;
- `pointer.previousDigest`.

Esto evita romper rollback.

`dryRun:true` no debe destruir nada.

## 9. `removeLocal()` y CAS

Quitar un asset local:

- elimina el pointer `blobs[id]`;
- elimina manifest integrado;
- mantiene metadata de ownership/discovery;
- no elimina inmediatamente el blob CAS;
- GC lo recuperará posteriormente si queda huérfano.

Esto desacopla uninstall de destrucción física inmediata.

## 10. Content Pack Catalog v2

`data/content-pack-catalog.json` mantiene schema de payload:

```text
kelo-content-pack-catalog-v1
```

pero la metadata de catálogo está actualmente en:

```json
{
  "version": 2,
  "publishedAt": "2026-09-16T07:16:00Z",
  "expiresAt": "2026-10-16T07:16:00Z"
}
```

El `version` del catálogo es independiente del `version` SemVer de cada pack.

## 11. Protección del catálogo

ContentPackManager IndexedDB:

```text
kelo_content_pack_v1
DB_VERSION = 2
```

Stores:

```text
packs
settings
```

`settings['catalog-security']` guarda:

```text
version
digest
publishedAt
expiresAt
stale
versionJump
lastAcceptedAt
```

Reglas activas:

### Rollback

Si:

```text
incoming.version < accepted.version
```

se lanza:

```text
PACK_CATALOG_ROLLBACK
```

### Mutación sin versión

Si:

```text
incoming.version == accepted.version
AND incoming.digest != accepted.digest
```

se lanza:

```text
PACK_CATALOG_MUTATED_WITHOUT_VERSION
```

Por tanto una versión de catálogo aceptada es inmutable localmente.

### Expiración

Si `expiresAt` quedó atrás:

```text
security.stale = true
```

En esta fase no bloquea instalación automáticamente. El endurecimiento vendrá cuando exista refresh/firma confiable.

API:

```js
await getCatalogSecurityState()
```

## 12. Actualización diferencial de packs

API:

```js
await planContentPackUpdate(id, {integrate:true})
```

Acciones:

```text
reuse
integrate
download
removed
```

El planner compara:

- descriptorHash;
- digest esperado;
- lock anterior;
- existencia local;
- integración local.

Una reinstalación sin cambios debe producir principalmente `reuse` y no redescargar bytes.

## 13. Lock de pack

Cada miembro mantiene:

```json
{
  "id": "provider:item",
  "provider": "provider",
  "contentKind": "animation",
  "bytes": 123,
  "sha256": "sha256:...",
  "expectedSha256": "sha256:... | null",
  "descriptorHash": "...",
  "integrated": true,
  "preexistingDownloaded": false,
  "version": "1.0.0"
}
```

## 14. Delta metrics

El estado de pack guarda:

```text
changedMembers
reusedMembers
removedMembers
estimatedDownloadBytes
estimatedSavedBytes
downloadedBytes
```

Métrica recomendada:

```text
bandwidth_saved_ratio = 1 - downloadedBytes / logicalUpdateBytes
```

## 15. Auditoría de integridad

API:

```js
await auditContentPack(id, {rehash:true})
```

Recalcula SHA-256 y compara contra el lock.

Razones actuales:

```text
ok
missing-binary
digest-mismatch
```

## 16. Storage Health

API:

```js
await getPackStorageHealth()
```

Incluye:

```text
usage
quota
free
persisted
opfsSupported
```

Persistencia:

```js
await requestPersistentPackStorage()
```

Nunca asumir que el navegador la concede.

## 17. Integración por tipo

### Visual

```text
Blob
 -> content-integration-router
 -> compiler
 -> visual manifest
 -> personal asset runtime bridge
 -> canonical atlas/catalog
```

Tipos:

- image
- sprite
- tileset
- animation
- vfx

### Audio

```text
Blob
 -> audio manifest
 -> personal content runtime bridge
 -> Audio() bajo demanda
```

`preload = none`.

### Ability

Solo JSON declarativo:

```text
JSON
 -> validator
 -> ability manifest
 -> KeloAbilities.engine.castSource()
```

Nunca ejecutar JS externo.

### Scene / Prefab

```text
JSON
 -> prefab validator
 -> prefabDefinition
 -> personal scene registry
 -> Studio prefabStamp
```

## 18. API pública actual — Vault

```js
PERSONAL_CONTENT_VAULT.openVault()
PERSONAL_CONTENT_VAULT.rememberAsset()
PERSONAL_CONTENT_VAULT.getAsset()
PERSONAL_CONTENT_VAULT.listAssets()
PERSONAL_CONTENT_VAULT.listOwnedAssets()
PERSONAL_CONTENT_VAULT.downloadAsset()
PERSONAL_CONTENT_VAULT.getBlob()
PERSONAL_CONTENT_VAULT.getBlobPointer()
PERSONAL_CONTENT_VAULT.getBlobByDigest()
PERSONAL_CONTENT_VAULT.getManifest()
PERSONAL_CONTENT_VAULT.getObjectURL()
PERSONAL_CONTENT_VAULT.migrateAssetToCas()
PERSONAL_CONTENT_VAULT.migrateVaultToCas()
PERSONAL_CONTENT_VAULT.rollbackAssetBlob()
PERSONAL_CONTENT_VAULT.discardAssetRollbackHistory()
PERSONAL_CONTENT_VAULT.garbageCollectCas()
PERSONAL_CONTENT_VAULT.getCasStats()
PERSONAL_CONTENT_VAULT.integrateContent()
PERSONAL_CONTENT_VAULT.removeLocal()
PERSONAL_CONTENT_VAULT.getVaultStats()
```

## 19. API pública actual — Pack Manager

```js
CONTENT_PACK_MANAGER.loadPackCatalog()
CONTENT_PACK_MANAGER.listContentPacks()
CONTENT_PACK_MANAGER.getContentPack()
CONTENT_PACK_MANAGER.getCatalogSecurityState()
CONTENT_PACK_MANAGER.getPackState()
CONTENT_PACK_MANAGER.listPackStates()
CONTENT_PACK_MANAGER.inspectContentPacks()
CONTENT_PACK_MANAGER.planContentPackUpdate()
CONTENT_PACK_MANAGER.installContentPack()
CONTENT_PACK_MANAGER.auditContentPack()
CONTENT_PACK_MANAGER.removeContentPack()
CONTENT_PACK_MANAGER.getPackStorageHealth()
CONTENT_PACK_MANAGER.requestPersistentPackStorage()
CONTENT_PACK_MANAGER.clearPackCatalogCache()
```

## 20. Limitaciones actuales

### Atomicidad por pack

CAS ya permite conservar bytes antiguos, pero la transacción lógica del pack completo todavía no tiene `activeLock + previousLock` formal.

### Chunking

Delta sigue siendo por archivo. Un archivo enorme parcialmente modificado se descarga completo.

### Firma

Anti-rollback actual protege contra regresión/mutación observada localmente, pero todavía confía en el origen del catálogo. Marketplace requiere metadata firmada.

### Expiración

Se detecta `stale`, pero no se bloquea aún.

### CAS legacy

Blobs antiguos continúan coexistiendo hasta migración progresiva.

## 21. Próximo contrato objetivo

### Pack transaction

```text
activeLock
previousLock
stagingLock
```

Update:

```text
plan
 -> stage blobs
 -> verify
 -> stage integration manifests
 -> commit activeLock
 -> previous activeLock becomes rollback lock
 -> GC later
```

### Chunk manifest futuro

```json
{
  "schema": "kelo-content-file-manifest-v1",
  "finalDigest": "sha256:...",
  "size": 123456,
  "chunks": [
    {"digest":"sha256:...","offset":0,"size":65536}
  ]
}
```

## 22. Reglas de seguridad permanentes

- no secretos ni claves privadas en Pages;
- no JS ejecutable desde contenido externo;
- licencias antes de integración;
- digest antes de activar bytes cuando exista expected digest;
- una versión de catálogo no puede mutar silenciosamente;
- no aceptar versión de catálogo inferior a la ya observada;
- provider failure debe quedar aislado;
- contenido externo nunca entra automáticamente al boot.

## 23. Regla para futuros agentes

Antes de tocar esta tecnología:

1. leer este documento;
2. leer `bibliotecaTecnologia/investigacion.md` si cambia arquitectura;
3. modificar el Vault/PackManager existente, no crear uno paralelo;
4. mantener mobile-first;
5. mantener metadata-only hasta acción explícita;
6. preservar compatibilidad legacy;
7. medir ahorro/dedupe;
8. actualizar ambos documentos si cambia contrato;
9. pasar CI/Pages cuando sea posible.

## 24. Definition of Done

Una mejora de BibliotecaTecnologia debe comprobar, según aplique:

- build/sintaxis;
- boot no descarga contenido externo;
- instalación nueva funciona;
- reinstalación sin cambios evita red;
- update diferencial descarga solo lo cambiado;
- blobs idénticos deduplican en CAS;
- rollback conserva versión anterior;
- GC no borra digest referenciado;
- fallo queda reanudable;
- auditoría detecta corrupción;
- catálogo rollback/mutación se rechaza;
- CI/Pages sin regresión relevante.

## 25. Regla permanente

**El tamaño del catálogo y el tamaño descargado por el jugador deben permanecer desacoplados.**
