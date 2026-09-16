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
Publisher: `scripts/publish-kelo-content-descriptors.mjs`.

## Vault / CAS

IndexedDB `kelo_personal_asset_vault_v1`, stores `assets`, `blobs`, `manifests`, `casBlobs`.

```text
asset metadata -> blobs[id] pointer -> casBlobs[sha256] immutable Blob
```

Pointers nuevos conservan `digest`, `previousDigest`, `bytes`, `mime`, `storage:'cas-v2'`. Filas legacy con Blob inline siguen legibles. Migración es progresiva y nunca masiva en boot.

## Descriptor nativo Kelo

Durante la transición, `kelo-content-live-provider.mjs` deriva `expectedBytes` y `expectedSha256` de cada pequeño `inlineManifest`. Esto conserva compatibilidad pero no constituye una frontera de confianza independiente.

### Publisher determinista y fail-closed

`scripts/publish-kelo-content-descriptors.mjs` crea descriptors desde `data/kelo-content-starter-catalog.json` usando exactamente `JSON.stringify(inlineManifest)` y bytes UTF-8.

Salida por asset: `{id, mediaType:'application/json', size, digest:'sha256:...'}`.

Invariantes actuales del publisher:

- `id` obligatorio y único;
- `inlineManifest` obligatorio;
- tamaño positivo;
- digest SHA-256 con 64 hex lowercase;
- cardinalidad de descriptors igual a assets fuente;
- orden determinista por id;
- `--check` exige igualdad byte-a-byte con el descriptor publicado;
- publicación normal escribe primero un archivo temporal exclusivo y después hace `rename`, limpiando el temporal si falla.

Esto evita IDs ambiguos y reduce el riesgo de dejar un descriptor set truncado por una interrupción durante build/publicación.

Schema:

```json
{"schema":"kelo-content-descriptors-v1","algorithm":"sha256","source":"data/kelo-content-starter-catalog.json","descriptors":[]}
```

## Descarga/staging e integridad

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

Errores: `ASSET_SIZE_MISMATCH`, `ASSET_INTEGRITY_MISMATCH`, `PACK_STAGE_CAS_DIGEST_MISMATCH`.

## Pack Catalog y seguridad

`data/content-pack-catalog.json` mantiene `version`, `publishedAt`, `expiresAt`, `packs[]`. PackManager usa IndexedDB `kelo_content_pack_v1`, stores `packs`, `settings`, `transactions`.

`incoming.version < accepted.version -> PACK_CATALOG_ROLLBACK`; misma versión con digest distinto -> `PACK_CATALOG_MUTATED_WITHOUT_VERSION`. `stale` sigue observacional hasta existir refresh firmado confiable.

## Planner y transacción

`planContentPackUpdate()` produce `reuse`, `integrate`, `download`, `removed` y métricas de bytes/delta. Staging vive en `kelo_content_pack_staging_v1/stages`.

```text
ACTIVE GEN N -> plan -> storage preflight -> stage -> size + SHA-256 verify -> compiler/validators -> PREPARED -> atomic Vault commit -> activate target state
```

El commit del Vault usa una sola transacción sobre `assets`, `blobs`, `manifests`, `casBlobs`. Pointer drift lanza `PACK_TRANSACTION_POINTER_DRIFT`.

## Journal, rollback y GC

Journal cubre staging/prepared/committing/vault-committed/committed y recovery. `rollbackContentPack()` reconstruye la generación previa desde CAS sin red cuando los blobs siguen disponibles. `buildContentReferenceGraph({verify:true})` protege active generation, previousGeneration, transacciones vivas y pointers current/previous. Mantenimiento normal usa `garbageCollectContentStorage()`.

## Storage pressure

`assessPackStoragePressure()` usa `navigator.storage.estimate()` y reserva `max(8% quota, 24 MiB)`. OPFS solo se detecta; IndexedDB sigue canónico hasta benchmark real en iPhone/Safari.

## Integración por tipo

Visual: Blob -> integration router -> compiler -> manifest -> runtime bridge.
Audio: Blob -> audio manifest -> runtime bridge -> `Audio()` bajo demanda, `preload=none`.
Ability: JSON -> whitelist validator -> engine; nunca JS externo.
Scene/prefab: JSON -> prefab validator -> Studio prefabStamp.

## Estado del contrato de publicación

Implementado:

```text
publisher determinista + validación de unicidad/cardinalidad
 -> escritura temp + rename
 -> Main Stability Gate --check
 -> client descriptor fallback
 -> transaction size+digest verification
```

Bloqueo actual: `data/kelo-content-descriptors.json` aún debe materializarse. Después Pack Manager debe leer ese descriptor publicado y conservar `digest+size` en member locks.

## Limitaciones actuales

- descriptor file aún no materializado en `main`;
- Pack Manager todavía no consume descriptors publicados;
- descriptors derivados en cliente siguen siendo fallback temporal;
- catálogo no está firmado y `stale` no bloquea;
- providers externos pueden carecer de digest/size confiables;
- delta sigue por archivo, sin chunk CAS;
- staging puede duplicar temporalmente bytes;
- OPFS no benchmarkeado en iPhone;
- solo una generación previa;
- no existe ACID entre DB PackManager y Vault; journal + roll-forward mitigan.

## Próximos pasos

1. generar y commitear `data/kelo-content-descriptors.json` mediante el publisher;
2. consumir descriptor publicado desde Pack Manager y propagar `size/digest`;
3. versionar descriptor set con catálogo inmutable;
4. firma metadata estilo TUF;
5. auditoría/rebuild reference graph;
6. OPFS iPhone benchmark;
7. FastCDC build-time para archivos grandes y luego chunk CAS + Range/resume.

## Reglas permanentes

No secretos en Pages; no JS externo ejecutable; licencia antes de integración; descriptor antes de activar cuando exista; catálogo versionado e inmutable; no mutar generación activa durante staging; rollback primero desde CAS; previousGeneration protege blobs; GC respeta reference graph; preflight antes de operaciones grandes; providers aislados; contenido externo nunca entra automáticamente al boot; mobile-first; compatibilidad legacy; evitar TinyFish.

## Definition of Done

Según aplique: boot sin binarios externos; reinstalación sin cambios evita red; update diferencial descarga solo cambios; CAS deduplica; staging no altera active; removals son atómicos; rollback funciona sin red con CAS; GC preserva roots; storage pressure se comprueba; auditoría detecta corrupción; anti-rollback funciona; recovery no deja mezcla de generaciones; descriptors publicados son reproducibles; CI/Pages sin regresión relevante.

**El catálogo puede crecer casi sin límite; el dispositivo solo paga almacenamiento, red y runtime por contenido seleccionado, con integridad, rollback y deduplicación.**
