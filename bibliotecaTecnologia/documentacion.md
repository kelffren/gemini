# BibliotecaTecnologia — Documentación técnica

> Fuente de verdad operativa de Biblioteca Universal / Content Vault / Content Packs.
> Última revisión: 2026-09-16.

## Propósito

Distribuir e integrar contenido sin cargar binarios externos en el boot normal.

```text
DISCOVERED != OWNED != DOWNLOADED != INTEGRATED != ACTIVE != LOADED
```

Tipos: image, sprite, tileset, animation, VFX, SFX, music, ambience, ability declarativa, scene/prefab y content packs.

## Archivos principales

Catálogos: `data/external-asset-providers.json`, `data/opengameart-cc0-curated.json`, `data/kelo-content-starter-catalog.json`, `data/content-pack-catalog.json`.

Providers: `external-asset-providers.mjs`, `kenney-live-provider.mjs`, `lpc-live-provider.mjs`, `opengameart-live-provider.mjs`, `kelo-content-live-provider.mjs`.

Vault/integración: `personal-asset-vault.mjs`, `content-integration-router.mjs`, runtime bridges.

Packs: `content-pack-manager.mjs`, `content-pack-transaction.mjs`, `content-packs.html`.

## Vault / CAS

IndexedDB `kelo_personal_asset_vault_v1`, stores `assets`, `blobs`, `manifests`, `casBlobs`.

```text
asset metadata -> blobs[id] pointer -> casBlobs[sha256] immutable Blob
```

Pointers nuevos conservan `digest`, `previousDigest`, `bytes`, `mime`, `storage:'cas-v2'`. Filas legacy con Blob inline siguen legibles. Migración es progresiva y nunca masiva en boot.

APIs importantes: `downloadAsset`, `getBlob`, `getBlobByDigest`, `getBlobPointer`, `rollbackAssetBlob`, `garbageCollectCas`, `integrateContent`.

## Descriptor nativo Kelo

`kelo-content-live-provider.mjs` deriva descriptor para cada `inlineManifest` al cargar el pequeño índice nativo:

```text
JSON.stringify(inlineManifest)
 -> TextEncoder
 -> expectedBytes
 -> WebCrypto SHA-256
 -> expectedSha256
```

El objeto normalizado expone:

```text
bytes
expectedBytes
expectedSha256
```

La serialización coincide con `content-pack-transaction.mjs`, que crea el Blob mediante `JSON.stringify(asset.inlineManifest)`.

Si WebCrypto no está disponible, `expectedBytes` sigue presente y `expectedSha256` queda `null`; compatibilidad se conserva.

## Descarga/staging e integridad

Flujo:

```text
metadata/descriptor
 -> fetch o inline Blob
 -> MIME validation
 -> non-empty
 -> expectedBytes check
 -> SHA-256
 -> expectedSha256 check
 -> compiler/validators
 -> staging
```

Errores relevantes:

```text
ASSET_SIZE_MISMATCH
ASSET_INTEGRITY_MISMATCH
PACK_STAGE_CAS_DIGEST_MISMATCH
```

OCI recomienda comprobar tamaño antes de hashing/procesamiento pesado y después verificar digest. El descriptor derivado en cliente mejora integridad transaccional, pero no sustituye metadata firmada por publisher.

## Pack Catalog y seguridad

`data/content-pack-catalog.json` mantiene `version`, `publishedAt`, `expiresAt`, `packs[]`.

PackManager usa IndexedDB `kelo_content_pack_v1`, stores `packs`, `settings`, `transactions`.

Reglas:

```text
incoming.version < accepted.version -> PACK_CATALOG_ROLLBACK
same version + different digest -> PACK_CATALOG_MUTATED_WITHOUT_VERSION
```

`stale` sigue observacional hasta existir refresh firmado confiable.

## Planner diferencial

`planContentPackUpdate(packId,{integrate:true})` produce `reuse`, `integrate`, `download`, `removed` y métricas `totalBytes`, `deltaBytes`, `stagingBytes`, `savedBytes`, miembros cambiados/reutilizados/retirados y `catalogHash`.

## Transacción atómica

Staging vive en `kelo_content_pack_staging_v1/stages`.

```text
ACTIVE GEN N
 -> plan
 -> storage preflight
 -> stage
 -> size + SHA-256 verify
 -> compiler/validators
 -> PREPARED
 -> atomic Vault commit
 -> activate target state
```

El commit del Vault usa una sola transacción sobre `assets`, `blobs`, `manifests`, `casBlobs`. Pointer drift se comprueba antes del commit; si la base cambió se lanza `PACK_TRANSACTION_POINTER_DRIFT`.

## Journal / crash recovery

Fases: `staging`, `prepared`, `committing`, `vault-committed`, `committed`; recovery/error: `recovered`, `failed`, `interrupted`, `needs-recovery`.

Journal guarda operación install/rollback, previousState, targetState, miembros cambiados/retirados, progreso, storagePressure y delta. Crash pre-commit aborta staging; crash post-Vault puede hacer roll-forward verificando pointers/tombstones.

## Generaciones y rollback

```text
Gen N active -> prepare N+1 -> commit -> N+1 active, N previous
```

`rollbackContentPack()` stagea la generación previa desde CAS, recompila/valida, añade tombstones necesarios y hace commit atómico. No usa red si los digests siguen en CAS. Solo se conserva una generación anterior.

## Reference graph / GC

`buildContentReferenceGraph({verify:true})` protege:

```text
active generation
previousGeneration
live transaction previousState
targetState
targetMembers
asset current/previous pointers
```

`garbageCollectContentStorage()` debe ser la entrada normal de mantenimiento: construye el grafo y pasa sus digests como raíces extra al GC del Vault. GC usa período de gracia; uninstall no equivale a borrar bytes inmediatamente.

## Storage pressure

`assessPackStoragePressure()` usa `navigator.storage.estimate()` y política actual de reserva `max(8% quota, 24 MiB)`.

```text
estimatedPeakExtraBytes = stagingBytes + downloadBytes
freeAfter = free - estimatedPeakExtraBytes
safe = freeAfter >= reserveBytes
```

Si la cuota es desconocida, el riesgo queda unknown; no inventar valores. `requestPersistentPackStorage()` solo solicita persistencia, nunca asumir que fue concedida. OPFS se detecta como capability pero aún no es almacenamiento canónico.

## Integración por tipo

Visual: Blob -> integration router -> asset-sheet compiler -> manifest -> runtime bridge.

Audio: Blob -> audio manifest -> runtime bridge -> `Audio()` bajo demanda, `preload=none`.

Ability: JSON -> whitelist validator -> personal ability manifest -> engine. Nunca ejecutar JS externo.

Scene/prefab: JSON -> prefab validator -> prefabDefinition -> Studio prefabStamp.

## Auditoría

`auditContentPack(id,{rehash:true})` comprueba binaries/digests de generación activa. `buildContentReferenceGraph({verify:true})` detecta raíces CAS faltantes. UI expone auditoría, rollback y preflight de espacio.

## Limitaciones actuales

- no existe ACID entre DB de PackManager y DB del Vault; journal + roll-forward mitigan;
- descriptors Kelo nativos se derivan en cliente y aún no están materializados/firmados por publisher;
- providers externos pueden carecer de digest/size confiables;
- catálogo no está firmado;
- `stale` no bloquea;
- delta sigue por archivo, sin chunk CAS;
- staging puede duplicar temporalmente bytes;
- OPFS no está benchmarkeado en iPhone real;
- solo una generación previa;
- reference graph se reconstruye bajo demanda.

## Próximos pasos

1. publisher Kelo que materialice y exija `sha256 + bytes`;
2. propagar esos descriptors publicados desde el pack catalog al resolver miembros;
3. auditoría/rebuild detallado del reference graph;
4. telemetría local de update/rollback/recovery/GC;
5. firma de metadata estilo TUF;
6. benchmark OPFS en iPhone;
7. FastCDC build-time para archivos grandes;
8. chunk CAS + Range/resume;
9. Asset Gateway/CDN y mirrors.

## Reglas permanentes

No secretos en Pages; no JS externo ejecutable; licencia antes de integración; descriptor antes de activar cuando exista; catálogo versionado e inmutable; no mutar generación activa durante staging; rollback primero desde CAS; previousGeneration protege blobs; GC respeta reference graph; preflight antes de operaciones grandes; providers aislados; contenido externo nunca entra automáticamente al boot; mobile-first; compatibilidad legacy; evitar TinyFish.

## Definition of Done

Según aplique: boot sin binarios externos; reinstalación sin cambios evita red; update diferencial descarga solo cambios; CAS deduplica; staging no altera active; removals son atómicos; rollback funciona sin red con CAS; GC preserva roots; storage pressure se comprueba; auditoría detecta corrupción; anti-rollback funciona; recovery no deja mezcla de generaciones; CI/Pages sin regresión relevante.

**El catálogo puede crecer casi sin límite; el dispositivo solo paga almacenamiento, red y runtime por contenido seleccionado, con integridad, rollback y deduplicación.**
