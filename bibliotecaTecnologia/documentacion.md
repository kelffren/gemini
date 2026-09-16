# BibliotecaTecnologia — Documentación técnica

> Fuente de verdad operativa de Biblioteca Universal / Content Vault / Content Packs.
> Este documento cubre solo esta tecnología.
> Última revisión: 2026-09-16.

## 1. Propósito

BibliotecaTecnologia distribuye e integra contenido de Kelo World sin cargar binarios externos en el boot normal.

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
DISCOVERED != OWNED != DOWNLOADED != INTEGRATED != ACTIVE != LOADED
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
- `src/creators/assets/content-pack-transaction.mjs`
- `content-packs.html`

## 3. Personal Vault / CAS

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

Para contenido CAS nuevo funciona como tabla de punteros:

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

Filas legacy con `blob` inline siguen siendo legibles.

### `casBlobs`

Contenido físico deduplicado:

```json
{
  "digest": "sha256:...",
  "blob": "<Blob>",
  "bytes": 123,
  "mime": "image/png",
  "orphanedAt": null
}
```

Key canónico: SHA-256.

## 4. Descarga individual

`downloadAsset(input)`:

```text
metadata
 -> fetch/inline Blob
 -> MIME validation
 -> SHA-256
 -> expectedSha256 validation
 -> put/reuse CAS
 -> pointer assetId -> digest
 -> metadata downloaded
```

Si el digest ya existe, no se crea otra copia física.

## 5. Compatibilidad legacy

`getBlob(id)` entiende:

```text
legacy row.blob
```

o:

```text
row.digest -> casBlobs[digest].blob
```

Migración progresiva:

```js
await migrateAssetToCas(id)
await migrateVaultToCas({limit,onProgress})
```

Regla: no hacer migración masiva automáticamente en boot.

## 6. Rollback individual

APIs:

```js
await rollbackAssetBlob(id)
await discardAssetRollbackHistory(id)
```

Pointer:

```text
digest
previousDigest
```

`rollbackAssetBlob()` intercambia current/previous, invalida manifest y deja el asset sin integrar hasta recompilarlo.

## 7. Garbage Collection CAS

API base:

```js
await garbageCollectCas({
  graceMs,
  dryRun,
  maxDeletes,
  onProgress,
  extraReferencedDigests
})
```

Gracia por defecto:

```text
7 días
```

Modelo:

```text
not reachable
 -> orphanedAt
 -> grace period
 -> delete in later GC
```

`extraReferencedDigests` permite que capas superiores —especialmente generaciones de packs— protejan blobs sin necesidad de fabricar pointers activos falsos.

## 8. Pack Catalog

Archivo:

```text
data/content-pack-catalog.json
```

Metadata:

```text
version
publishedAt
expiresAt
packs[]
```

El `version` global del catálogo es independiente del SemVer de cada pack.

## 9. Seguridad del catálogo

PackManager DB:

```text
IndexedDB: kelo_content_pack_v1
DB_VERSION = 3
```

Stores:

```text
packs
settings
transactions
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

Reglas:

```text
incoming.version < accepted.version
 -> PACK_CATALOG_ROLLBACK
```

```text
same version + different digest
 -> PACK_CATALOG_MUTATED_WITHOUT_VERSION
```

`stale=true` sigue siendo observacional hasta tener refresh/firma confiable.

## 10. Planner diferencial

API:

```js
await planContentPackUpdate(packId,{integrate:true})
```

Acciones:

```text
reuse
integrate
download
removed
```

Devuelve además:

```text
totalBytes
deltaBytes
stagingBytes
savedBytes
changedMembers
reusedMembers
removedMembers
catalogHash
```

`stagingBytes` se usa para storage-pressure preflight.

## 11. Atomic Pack Transaction

Staging DB:

```text
IndexedDB: kelo_content_pack_staging_v1
store: stages
```

La generación activa no se toca durante staging.

Flujo:

```text
ACTIVE GEN N
 -> plan
 -> storage preflight
 -> stage
 -> SHA-256 verify
 -> compiler/validators
 -> PREPARED
 -> atomic Vault commit
 -> activate target pack state
```

El commit del Vault usa una única transacción sobre:

```text
assets
blobs
manifests
casBlobs
```

## 12. API del transaction layer

Módulo:

```text
src/creators/assets/content-pack-transaction.mjs
```

APIs:

```js
stagePackMember(input,options)
stagePackRemoval(assetId,{transactionId})
listStagedPackMembers(transactionId)
abortStagedPack(transactionId)
commitStagedPack(transactionId)
inspectStagingStorage()
cleanupStaleStaging(options)
```

### `stagePackMember()`

Opciones relevantes:

```text
transactionId
integrate
useExistingBlob
sourceDigest
```

`sourceDigest` significa:

```text
CAS[digest]
 -> Blob
 -> recompute SHA-256
 -> compare digest
 -> compile/validate
 -> staging
```

Se usa especialmente para rollback sin red.

### `stagePackRemoval()`

Crea un tombstone transaccional.

En commit:

```text
delete blobs[assetId]
delete manifests[assetId]
metadata downloaded=false
CAS bytes remain for GC
```

Por tanto un miembro retirado puede desaparecer de la generación activa en el mismo commit atómico que los miembros nuevos aparecen.

## 13. Pointer drift protection

Antes de commit:

```text
currentDigest == staged.baseDigest
```

Si cambió en paralelo:

```text
PACK_TRANSACTION_POINTER_DRIFT
```

Esto evita aplicar una transacción sobre una base distinta de la que se validó.

## 14. Journal y crash recovery

Cada pack mantiene un journal en `transactions`.

Campos importantes:

```text
id = packId
transactionId
sessionId
operation = install | rollback
phase
previousState
targetState
changedAssetIds
removedAssetIds
completedMembers
totalMembers
storagePressure
delta
timestamps
error
```

Fases:

```text
staging
prepared
committing
vault-committed
committed
```

Recovery/error:

```text
recovered
failed
interrupted
needs-recovery
```

API:

```js
await recoverPackTransactions()
```

### Crash pre-commit

Staging se aborta. La generación activa queda intacta.

### Crash dentro del Vault commit

IndexedDB deja todos los cambios del Vault o ninguno.

### Crash post-Vault / pre-pack-state

Recovery verifica:

- digests activos de `changedAssetIds`;
- que `removedAssetIds` realmente no tengan pointer;
- `targetState` guardado antes del commit.

Si coincide, finaliza el pack state mediante roll-forward.

## 15. Generaciones

Estado:

```text
generation
previousGeneration
transaction.id
transaction.atomic
transaction.operation
```

Instalación/update:

```text
Gen N active
 -> prepare N+1
 -> commit
 -> Gen N+1 active
 -> Gen N previousGeneration
```

Rollback:

```text
Gen N active
 -> stage previousGeneration N-1 from CAS
 -> commit
 -> Gen N-1 active
 -> Gen N previousGeneration
```

Actualmente se conserva una sola generación anterior.

## 16. Rollback transaccional de pack

API:

```js
await rollbackContentPack(packId,{onProgress})
```

Precondiciones:

```text
pack installed
previousGeneration exists
no live transaction on same pack
all required old digests available in CAS
```

Comportamiento:

1. lee locks de `previousGeneration`;
2. compara con generación activa;
3. `reuse` si digest/estado ya coincide;
4. stagea bytes viejos por `sourceDigest` cuando necesita cambio;
5. recompila/valida manifest;
6. stagea tombstones para miembros current-only que no deben conservar cache;
7. guarda `targetState`;
8. commit atómico;
9. activa la generación anterior;
10. conserva la generación reemplazada como `previousGeneration`.

No usa red mientras los blobs estén en CAS.

## 17. Reference Graph / GC Roots

API:

```js
await buildContentReferenceGraph({verify:true})
```

Raíces protegidas:

```text
active generation members
previousGeneration members
live transaction previousState
targetState
targetMembers
asset pointer digest
asset pointer previousDigest
```

Resultado conceptual:

```text
root -> sha256 digest -> immutable CAS blob
```

`verify:true` comprueba que cada raíz tenga un blob CAS disponible y reporta `missing`.

GC seguro de toda la tecnología:

```js
await garbageCollectContentStorage(options)
```

Esta API construye primero el grafo y pasa sus digests como `extraReferencedDigests` al GC del Vault.

**Para mantenimiento normal de BibliotecaTecnologia, preferir `garbageCollectContentStorage()` sobre llamar al GC base directamente.**

## 18. Storage-pressure guard

API:

```js
await assessPackStoragePressure(packId,{integrate:true})
```

Política actual:

```text
STORAGE_RESERVE_RATIO = 0.08
STORAGE_MIN_RESERVE_BYTES = 24 MiB
```

Cálculo aproximado:

```text
free = quota - usage
estimatedPeakExtraBytes = estimatedStagingBytes + estimatedDownloadBytes
reserveBytes = max(8% quota, 24 MiB)
freeAfter = free - estimatedPeakExtraBytes
safe = freeAfter >= reserveBytes
```

Si `navigator.storage.estimate()` no entrega cuota confiable, el riesgo queda `unknown` y la operación puede continuar; no inventar una cuota.

`installContentPack()` hace este guard automáticamente antes de staging.

Error cuando no es seguro:

```text
PACK_STORAGE_PRESSURE:<peak>:<free>:<reserve>
```

## 19. Storage Health

API:

```js
await getPackStorageHealth()
```

Devuelve:

```text
usage
quota
free
persisted
opfsSupported
staging.members
staging.bytes
staging.transactions
pressurePolicy.reserveRatio
pressurePolicy.minReserveBytes
```

Persistencia:

```js
await requestPersistentPackStorage()
```

Nunca asumir que el navegador la concede.

## 20. Install removals ahora son atómicos

Antes, miembros retirados podían limpiarse después de activar el pack.

Ahora, cuando el miembro:

```text
not shared by another installed pack
AND not preexisting local content
```

se crea un tombstone mediante `stagePackRemoval()` y desaparece dentro del mismo Vault commit.

Esto mejora la propiedad old-or-new de la generación.

## 21. Auditoría

Pack activo:

```js
await auditContentPack(id,{rehash:true})
```

Comprueba SHA-256 y devuelve `generation`.

Raíces CAS:

```js
await buildContentReferenceGraph({verify:true})
```

La UI `content-packs.html` expone:

- Auditar pack;
- Auditar raíces CAS;
- rollback a generación anterior;
- preflight de espacio antes de instalar.

## 22. Integración por tipo

### Visual

```text
Blob -> content-integration-router -> asset-sheet compiler -> manifest -> runtime bridge
```

### Audio

```text
Blob -> audio manifest -> runtime bridge -> Audio() bajo demanda
```

`preload = none`.

### Ability

```text
JSON -> whitelist validator -> personal ability manifest -> KeloAbilities.engine.castSource()
```

Nunca ejecutar JS externo.

### Scene / Prefab

```text
JSON -> prefab validator -> prefabDefinition -> Studio prefabStamp
```

## 23. API pública — Vault

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

## 24. API pública — Pack Manager

```js
CONTENT_PACK_MANAGER.loadPackCatalog()
CONTENT_PACK_MANAGER.listContentPacks()
CONTENT_PACK_MANAGER.getContentPack()
CONTENT_PACK_MANAGER.getCatalogSecurityState()
CONTENT_PACK_MANAGER.getPackState()
CONTENT_PACK_MANAGER.listPackStates()
CONTENT_PACK_MANAGER.getPackTransaction()
CONTENT_PACK_MANAGER.recoverPackTransactions()
CONTENT_PACK_MANAGER.inspectContentPacks()
CONTENT_PACK_MANAGER.planContentPackUpdate()
CONTENT_PACK_MANAGER.assessPackStoragePressure()
CONTENT_PACK_MANAGER.installContentPack()
CONTENT_PACK_MANAGER.rollbackContentPack()
CONTENT_PACK_MANAGER.buildContentReferenceGraph()
CONTENT_PACK_MANAGER.garbageCollectContentStorage()
CONTENT_PACK_MANAGER.auditContentPack()
CONTENT_PACK_MANAGER.removeContentPack()
CONTENT_PACK_MANAGER.getPackStorageHealth()
CONTENT_PACK_MANAGER.requestPersistentPackStorage()
CONTENT_PACK_MANAGER.clearPackCatalogCache()
```

## 25. Métricas recomendadas

Pack/update:

```text
changedMembers
reusedMembers
removedMembers
estimatedDownloadBytes
estimatedStagingBytes
estimatedSavedBytes
downloadedBytes
```

CAS:

```text
logicalBytes
physicalCasBytes
deduplicatedBytes
dedupeRatio
rollbackPointers
orphanedBlobs
referenceRootCount
missingReferenceRoots
```

Storage pressure:

```text
quota
usage
free
estimatedPeakExtraBytes
reserveBytes
freeAfter
risk
```

Transacción:

```text
operation
phase
completedMembers
totalMembers
rollback count
recovery count
failure count
```

## 26. Limitaciones actuales

### Cross-database atomicity

Vault pointers/manifests sí cambian en una transacción única.

Pack state vive en otra IndexedDB. Mitigación:

```text
persistent journal + targetState + digest/tombstone inspection + roll-forward recovery
```

### Historial

Solo una generación previa. No añadir historial infinito dentro de `previousGeneration`.

### Chunking

Delta sigue siendo por archivo/miembro.

### Firma

Anti-rollback local todavía confía en el origen HTTPS. Marketplace final requiere publisher firmado.

### Storage estimate

Es estimado, no una garantía. La reserva es preventiva, no prueba matemática de que una escritura vaya a ser aceptada.

### OPFS

Disponible solo como capability detectada; aún no es almacenamiento canónico.

## 27. Próximos pasos recomendados

1. digest + size obligatorios para contenido Kelo publicado;
2. auditoría/rebuild más detallado del reference graph;
3. historial opcional de generaciones con política de retención;
4. telemetría local de update/rollback/recovery/GC;
5. OPFS benchmark real en iPhone;
6. FastCDC publisher;
7. chunk CAS;
8. Range delivery/reanudación;
9. Asset Gateway/CDN;
10. metadata firmada estilo TUF;
11. mirrors/failover.

## 28. Reglas permanentes

- no secretos en Pages;
- no JS externo ejecutable;
- licencia antes de integración;
- digest antes de activar cuando exista expected digest;
- catálogo versionado e inmutable;
- no mutar generación activa durante staging;
- rollback primero desde CAS;
- previousGeneration debe proteger sus blobs frente a GC;
- GC de BibliotecaTecnologia debe respetar el reference graph;
- no iniciar operaciones grandes si storage pressure es claramente insuficiente;
- no borrar CAS inmediatamente al desinstalar;
- fallos de providers deben quedar aislados;
- contenido externo nunca entra automáticamente al boot;
- mobile-first;
- compatibilidad legacy.

## 29. Regla para futuros agentes

Antes de modificar esta tecnología:

1. leer `documentacion.md`;
2. leer `investigacion.md`;
3. inspeccionar código actual;
4. investigar buenas prácticas relevantes;
5. modificar el sistema existente, no crear otro Vault/PackManager;
6. preservar CAS + generaciones + journal;
7. mantener metadata-only hasta acción explícita;
8. mantener carga bajo demanda;
9. medir impacto en bytes/red/storage;
10. actualizar estos dos documentos cuando cambie el contrato;
11. revisar CI/Pages.

## 30. Definition of Done

Según aplique, una mejora debe comprobar:

- boot no descarga binarios externos;
- instalación nueva funciona;
- reinstalación sin cambios evita red;
- update diferencial descarga solo lo cambiado;
- blobs idénticos deduplican;
- staging no altera generación activa;
- removals coordinados son atómicos;
- rollback restaura pack completo sin red cuando CAS está disponible;
- GC no elimina active/previous/live-transaction roots;
- storage pressure se comprueba antes de operación grande;
- auditoría detecta digest faltante/corrupto;
- catálogo rollback/mutación se rechaza;
- crash recovery puede completar o abortar sin dejar mezcla de generaciones;
- CI/Pages sin regresión relevante.

## 31. Regla permanente

**El catálogo puede crecer casi sin límite; el dispositivo solo debe pagar almacenamiento, red y carga runtime por el contenido realmente seleccionado, conservando rollback e integridad sin duplicación innecesaria.**
