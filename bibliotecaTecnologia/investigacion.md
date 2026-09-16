# BibliotecaTecnologia — Investigación

> Documento exclusivo de Biblioteca Universal / Content Vault / Content Packs de Kelo World.
> Última revisión: 2026-09-16.

## Objetivo e invariantes

BibliotecaTecnologia distribuye contenido sin convertir el boot en descarga masiva. `CATÁLOGO != DESCARGA != INTEGRACIÓN != ACTIVACIÓN != CARGA EN RUNTIME`. No crear Vaults paralelos; mantener mobile-first, metadata-first y carga bajo demanda.

## Fundamentos investigados

### OCI / CAS
OCI Content Descriptor exige `digest`, `size` y `mediaType`; tamaño debe comprobarse antes del hash/procesamiento pesado y después debe verificarse digest. Aplicación Kelo: `assetId -> descriptor -> sha256 -> CAS blob`.
Fuente: https://github.com/opencontainers/image-spec/blob/main/descriptor.md

### TUF
Targets usa hashes/tamaños; Snapshot fija una vista consistente y Timestamp ayuda a detectar metadata congelada. Firma real debe originarse fuera del cliente/Pages.
Fuente: https://theupdateframework.io/docs/metadata/

### Delta, chunking y móvil
Delta actual sigue por miembro. FastCDC queda reservado para blobs grandes y build-time. IndexedDB sigue canónico; OPFS requiere benchmark real en Safari/iPhone. Preflight conserva margen porque `navigator.storage.estimate()` es aproximado.

## Estado implementado

1. CAS SHA-256 con deduplicación y compatibilidad legacy.
2. Rollback + GC con reference roots.
3. Catálogo monotónico y pack staging/commit transaccional.
4. Storage-pressure preflight.
5. `stagePackMember()` valida `expectedBytes` antes de SHA-256 y luego `expectedSha256`.
6. Publisher determinista `scripts/publish-kelo-content-descriptors.mjs` genera `mediaType + size + digest`, sourceVersion/sourceDigest, fail-closed y escritura temp+rename.
7. Main Stability Gate ejecuta `--check` contra drift.
8. `data/kelo-content-descriptors.json` ya está materializado en main.
9. `kelo-content-live-provider.mjs` consume primero el descriptor publicado y propaga `size -> expectedBytes` y `digest -> expectedSha256`, con fallback cliente compatible.
10. **Ronda actual:** Quaternius queda explícitamente `catalogOnly` hasta disponer de un resolver de archivo directo verificado. Los enlaces de Drive/folder ya no se presentan como `downloadUrl`; se conservan como `externalDownloadUrl/sourceUrl`. Esto evita enviar HTML, carpetas o archivos no identificados al Vault/CAS.

## Decisión de esta ronda

Una biblioteca externa puede participar en descubrimiento sin ser automáticamente una fuente de bytes confiable. Para entrar al Vault como descarga directa debe existir una identidad de archivo verificable y estable (`mediaType + size + digest`) o un resolver controlado que produzca esos datos antes de staging.

```text
external catalog
 -> metadata/preview
 -> catalogOnly=true
 -> open source

verified direct binary future
 -> descriptor {size,digest,mediaType}
 -> size check
 -> SHA-256 check
 -> CAS/staging
```

Esta frontera permite conectar más bibliotecas sin rebajar la seguridad del Content Vault.

## Riesgos abiertos

- descriptor set Kelo todavía no está firmado;
- Pack Manager aún debe persistir descriptor locks explícitos por generación;
- `stale` sigue observacional;
- providers externos pueden carecer de digest/size confiables;
- Quaternius todavía no debe integrarse como binario directo hasta resolver archivos concretos y verificables;
- delta sigue por archivo; chunking aún no existe;
- OPFS no benchmarkeado en iPhone real;
- solo una generación previa;
- Pack state y Vault están en IndexedDB distintas; journal mitiga pero no crea ACID cross-database.

## Próximos niveles

1. conectar Quaternius al router federado conservando `catalogOnly`;
2. persistir `digest+size` publicados en member locks/generaciones del Pack Manager;
3. versionar/inmutabilizar descriptor set junto al catálogo;
4. firma metadata estilo TUF y hardening stale;
5. auditoría/rebuild reference graph;
6. OPFS iPhone benchmark;
7. FastCDC build-time para archivos grandes + chunk CAS/Range/resume.

## Regla permanente

Modificar el sistema existente, no duplicarlo; preservar mobile-first/on-demand, compatibilidad y rollback; verificar metadata antes de contenido pesado; evitar TinyFish.
