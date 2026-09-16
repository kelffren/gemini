# BibliotecaTecnologia — Documentación técnica

> Fuente de verdad operativa de Biblioteca Universal / Content Vault / Content Packs.
> Última revisión: 2026-09-16.

## Contrato

`DISCOVERED != OWNED != DOWNLOADED != INTEGRATED != ACTIVE != LOADED`. Contenido externo no entra al boot normal; metadata primero, binarios bajo demanda.

## Vault / CAS
IndexedDB `kelo_personal_asset_vault_v1`; stores `assets`, `blobs`, `manifests`, `casBlobs`. Nuevos pointers conservan digest/previousDigest/bytes/mime/storage. Legacy sigue legible y migra progresivamente.

## Descriptors Kelo publicados

Fuente: `data/kelo-content-starter-catalog.json`.
Publisher: `scripts/publish-kelo-content-descriptors.mjs`.
Salida: `data/kelo-content-descriptors.json`.

Cada descriptor contiene `{id, mediaType:'application/json', size, digest:'sha256:...'}`. El set conserva `sourceVersion` y `sourceDigest`. Publisher valida unicidad, cardinalidad, tamaños/digests y usa temp+rename. `--check` detecta drift.

### Ruta runtime actual

`kelo-content-live-provider.mjs` solicita catálogo y descriptor set como metadata pequeña, sin binarios externos. El descriptor publicado se usa solamente si:

- `schema === kelo-content-descriptors-v1`;
- `algorithm === sha256`;
- `descriptors` es array válido;
- cada id es único;
- size es entero >= 0;
- digest cumple `sha256:` + 64 hex;
- `sourceVersion` coincide con catálogo;
- cardinalidad coincide con assets fuente.

Cuando pasa, `size -> expectedBytes` y `digest -> expectedSha256`, con `descriptorSource:'published'`. Si falla/está ausente, se conserva `describeInlineManifest()` como fallback compatible (`descriptorSource:'client-fallback'`). No se rompe contenido existente ni se introduce otro Vault.

## Verificación staging

```text
published descriptor
 -> expectedBytes check
 -> SHA-256
 -> expectedSha256 check
 -> compiler/validators
 -> staging
 -> atomic Vault commit
```

Errores relevantes: `ASSET_SIZE_MISMATCH`, `ASSET_INTEGRITY_MISMATCH`, `PACK_STAGE_CAS_DIGEST_MISMATCH`.

## Packs / rollback / GC

PackManager mantiene catálogo monotónico, planner diferencial, storage preflight, journal, staging separado y activación old-or-new. Rollback reconstruye desde CAS cuando existen blobs. Reference graph protege active, previous y transacciones vivas; GC solo retira contenido no alcanzable tras gracia.

## Seguridad y móvil

No secretos en Pages; no JS externo ejecutable; licencia antes de integración; audio `preload=none`; previews y assets bajo demanda; IndexedDB canónico; OPFS solo futuro tras benchmark iPhone/Safari; no FastCDC en boot ni para blobs pequeños.

## Estado actual

Implementado: CAS/dedup, integridad SHA-256, size precheck, transacciones, rollback, GC roots, storage pressure, publisher reproducible/source-bound, descriptor materializado, CI drift check y consumo preferente del descriptor publicado en provider Kelo.

Pendiente prioritario: persistir `digest+size` publicados en member locks/generaciones del Pack Manager para que update/rollback comparen identidad publicada sin recalcularla; después descriptor set inmutable/versionado y firmas estilo TUF.

## Definition of Done

Boot sin binarios externos; reinstalación sin cambios evita red; delta descarga solo cambios; CAS deduplica; staging no altera active; rollback funciona desde CAS; GC preserva roots; storage pressure se comprueba; anti-rollback/recovery evitan mezcla de generaciones; descriptors publicados son reproducibles, source-bound y consumidos como expectativa de integridad; mobile-first y compatibilidad legacy permanecen.
