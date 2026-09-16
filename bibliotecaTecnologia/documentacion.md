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

### Vault

- `src/creators/assets/personal-asset-vault.mjs`
- `src/creators/assets/content-integration-router.mjs`
- `src/creators/assets/personal-asset-runtime-bridge.mjs`
- `src/creators/assets/personal-content-runtime-bridge.mjs`

### Packs

- `src/creators/assets/content-pack-manager.mjs`
- `src/creators/assets/content-pack-transaction.mjs`
- `content-packs.html`

### UI

- `asset-vault.html`
- `content-packs.html`
- `src/ui/asset-library-launcher.js`

## 3. Personal Vault / CAS

Base:

```text
IndexedDB: kelo_personal_asset_vault_v1
```

Stores actuales:

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
ownership
downloaded
integrated
bytes
mime
sha256
expectedSha256
rollbackActive
provenance/licensing fields
```

### `blobs`

Para contenido CAS nuevo funciona como puntero:

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

Filas legacy que contienen `blob` directamente siguen siendo legibles.

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
 -> fetch/inline
 -> MIME validation
 -> SHA-256
 -> expectedSha256 validation
 -> put/reuse CAS blob
 -> update asset pointer
 -> update metadata
```

Si el digest ya existe, se reutiliza el blob físico.

## 5. Migración legacy

APIs:

```js
await migrateAssetToCas(id)
await migrateVaultToCas({limit, onProgress})
```

Regla:

**Nunca hacer migración masiva automáticamente durante boot.**

## 6. Rollback individual y GC

APIs:

```js
await rollbackAssetBlob(id)
await discardAssetRollbackHistory(id)
await garbageCollectCas(options)
```

Un pointer puede mantener:

```text
digest
previousDigest
```

GC:

```text
unreferenced
 -> marcar orphanedAt
 -> esperar grace period
 -> borrar posteriormente
```

Gracia actual: 7 días.

## 7. Pack Catalog

Archivo:

```text
data/content-pack-catalog.json
```

Metadata relevante:

```text
version
publishedAt
expiresAt
packs[]
```

Cada pack mantiene SemVer independiente.

## 8. Seguridad del catálogo

Pack manager:

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

La expiración actualmente se observa mediante:

```text
stale = true
```

pero todavía no bloquea instalación.

## 9. Planner diferencial

API:

```js
await planContentPackUpdate(packId, {integrate:true})
```

Acciones:

```text
reuse
integrate
download
removed
```

Compara:

- descriptor hash;
- expected digest;
- lock anterior;
- existencia local;
- estado de integración.

## 10. Atomic Pack Transaction

### Objetivo

Una actualización de pack no debe modificar la generación activa mientras todavía se están descargando o compilando miembros.

### Staging DB

```text
IndexedDB: kelo_content_pack_staging_v1
store: stages
```

Cada fila staged contiene conceptualmente:

```text
transactionId
assetId
baseDigest
digest nuevo
Blob temporal
bytes
mime
normalized asset metadata
compiled manifest
contentKind
compiler
network flag
stagedAt
```

### Flujo

```text
ACTIVE GENERATION N
        |
        | NO CAMBIA
        v
plan delta
 -> stage downloads/existing blobs
 -> verify SHA-256
 -> compile/validate manifests
 -> build target lock
 -> phase PREPARED
 -> atomic Vault commit
 -> activate generation N+1
 -> cleanup removed content
```

## 11. API de transacciones

Módulo:

```text
src/creators/assets/content-pack-transaction.mjs
```

API:

```js
stagePackMember(input, options)
listStagedPackMembers(transactionId)
abortStagedPack(transactionId)
commitStagedPack(transactionId)
inspectStagingStorage()
cleanupStaleStaging(options)
```

### `stagePackMember()`

No cambia el Vault activo.

Puede:

- descargar un miembro nuevo;
- usar un Blob ya activo para una operación `integrate`;
- calcular SHA-256;
- validar expected hash;
- compilar/validar manifest;
- guardar todo en staging.

### `commitStagedPack()`

Antes de commit verifica que el pointer actual no haya cambiado desde staging:

```text
currentDigest == baseDigest
```

Si no coincide:

```text
PACK_TRANSACTION_POINTER_DRIFT
```

Después usa **una sola transacción IndexedDB** sobre:

```text
assets
blobs
manifests
casBlobs
```

Todos los assets modificados cambian juntos.

Resultado:

```text
todos nuevos
OR
todos antiguos
```

para el conjunto de pointers/manifests dentro de esa transacción.

## 12. Journal del Pack Manager

Store:

```text
transactions
```

Un journal contiene:

```text
id = packId
transactionId
sessionId
phase
packVersion
catalogHash
previousState
targetState
changedAssetIds
completedMembers
totalMembers
delta metrics
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

Fases de error/recovery:

```text
failed
interrupted
needs-recovery
recovered
```

## 13. Crash recovery

API:

```js
await recoverPackTransactions()
```

### Crash pre-commit

Se aborta staging.

La generación activa anterior no se modifica.

### Crash dentro del Vault commit

IndexedDB garantiza atomicidad de esa transacción.

El Vault termina completamente viejo o completamente nuevo.

### Crash entre Vault commit y pack-state activation

El pack journal guarda `targetState`.

Recovery:

1. inspecciona los digests activos de `changedAssetIds`;
2. si coinciden con `targetState`, finaliza la activación;
3. si no coinciden, elimina staging y conserva generación anterior.

Esta estrategia es roll-forward recovery.

## 14. Generaciones

Estado activo del pack:

```text
generation
previousGeneration
transaction.id
transaction.atomic
```

Ejemplo:

```text
Gen 1 -> activa
update preparado
Gen 1 -> sigue activa
commit
Gen 2 -> activa
Gen 1 -> previousGeneration
```

El snapshot anterior se limita a una generación lógica para evitar recursión ilimitada.

## 15. `installContentPack()`

Comportamiento actual:

1. recupera journal interrumpido cuando corresponda;
2. instala dependencias;
3. genera delta plan;
4. crea transaction journal;
5. stages solo `download` e `integrate`;
6. `reuse` conserva lock existente;
7. construye `targetState`;
8. marca `prepared`;
9. ejecuta commit atómico del Vault;
10. guarda pack activo;
11. marca journal `committed`;
12. limpia miembros retirados fuera del camino crítico.

### Fallo pre-commit

```text
activeGenerationPreserved = true
```

No se escribe un estado `partial` encima del pack activo.

## 16. `inspectContentPacks()`

Expone:

```text
state
installed
integrated
generation
updateAvailable
catalogChanged
delta
catalogSecurity
transaction
```

`transaction` solo aparece cuando existe una transacción activa.

## 17. Storage Health

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
```

Persistencia:

```js
await requestPersistentPackStorage()
```

## 18. Auditoría

API:

```js
await auditContentPack(id, {rehash:true})
```

Comprueba SHA-256 de la generación activa.

Devuelve también:

```text
generation
```

## 19. Integración por tipo

### Visual

```text
Blob
 -> content-integration-router
 -> asset-sheet compiler
 -> visual manifest
 -> runtime bridge
```

### Audio

```text
Blob
 -> audio manifest
 -> runtime bridge
 -> Audio() under demand
```

`preload = none`.

### Ability

```text
JSON
 -> whitelist validator
 -> personal ability manifest
 -> KeloAbilities.engine.castSource()
```

Nunca ejecutar JS externo.

### Scene / Prefab

```text
JSON
 -> prefab validator
 -> prefabDefinition
 -> Studio prefabStamp
```

## 20. API pública — Vault

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

## 21. API pública — Pack Manager

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
CONTENT_PACK_MANAGER.installContentPack()
CONTENT_PACK_MANAGER.auditContentPack()
CONTENT_PACK_MANAGER.removeContentPack()
CONTENT_PACK_MANAGER.getPackStorageHealth()
CONTENT_PACK_MANAGER.requestPersistentPackStorage()
CONTENT_PACK_MANAGER.clearPackCatalogCache()
```

## 22. Métricas

Pack state:

```text
changedMembers
reusedMembers
removedMembers
estimatedDownloadBytes
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
```

Transaction:

```text
phase
completedMembers
totalMembers
staging bytes
recovery count (futuro agregado)
```

## 23. Limitaciones actuales

### Cross-database atomicity

El commit de pointers/manifests del Vault sí es una única transacción.

El `pack state` vive en otra IndexedDB, por lo que no existe ACID real entre ambas bases.

Solución actual:

```text
persistent journal + targetState + digest inspection + recovery
```

### Pack rollback completo

Se conserva `previousGeneration`, pero todavía no existe API final:

```text
rollbackContentPack(packId)
```

### Chunking

Delta sigue siendo por miembro/archivo.

### Firma

Anti-rollback local no sustituye firma del publisher.

### Staging space

Durante un update puede coexistir temporalmente:

```text
active bytes + staged bytes
```

Hay que controlar storage pressure en versiones futuras.

## 24. Próximo paso recomendado

### Pack rollback transaccional

Usar `previousGeneration` para preparar una transacción inversa:

```text
Gen N activa
 -> stage pointers/manifests de Gen N-1
 -> verify CAS availability
 -> atomic commit
 -> Gen N-1 activa
```

Sin red cuando los blobs previos sigan en CAS.

Después:

- ref graph explícito;
- digest+size obligatorio;
- OPFS tier;
- FastCDC/chunks;
- Asset Gateway/CDN;
- metadata firmada.

## 25. Reglas permanentes

- no secretos en Pages;
- no JS externo ejecutable;
- licencia antes de integración;
- digest antes de activar;
- catálogo versionado e inmutable;
- no mutar generación activa durante staging;
- no borrar CAS inmediatamente al desinstalar;
- provider failure aislado;
- contenido externo nunca entra automáticamente al boot;
- mobile-first;
- mantener compatibilidad legacy.

## 26. Regla para futuros agentes

Antes de modificar BibliotecaTecnologia:

1. leer `documentacion.md`;
2. leer `investigacion.md` si cambia arquitectura;
3. integrar sobre el sistema existente;
4. no crear un segundo Vault/PackManager;
5. mantener metadata-only hasta acción explícita;
6. preservar atomicidad pre-commit;
7. medir bytes evitados y dedupe;
8. actualizar ambos documentos;
9. revisar CI/Pages.

## 27. Definition of Done

Según aplique:

- sintaxis/build correctos;
- boot sin descarga externa;
- instalación nueva funcional;
- reinstalación sin cambios sin red innecesaria;
- update diferencial;
- staging no modifica generación activa;
- commit cambia conjunto completo de assets;
- fallo pre-commit conserva generación anterior;
- recovery puede cerrar crash post-commit;
- SHA-256 audit;
- CAS dedupe;
- rollback individual preservado;
- GC no borra referencias;
- catálogo rollback/mutación rechazado;
- CI/Pages sin regresión relevante.

## 28. Regla permanente

**Un pack nuevo debe poder prepararse completamente sin tocar el pack activo.**
