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
9. **Ronda actual:** `kelo-content-live-provider.mjs` consume primero el descriptor publicado y propaga `size -> expectedBytes` y `digest -> expectedSha256`. Solo acepta el set cuando schema/algoritmo/descriptors son válidos, no hay IDs duplicados, `sourceVersion` coincide y la cardinalidad coincide con el catálogo. Si no puede usarlo, conserva el cálculo cliente como fallback compatible.

## Decisión de esta ronda

La identidad publicada debe ser preferida sobre una identidad recalculada por el mismo consumidor. El cliente sigue verificando bytes, pero el valor esperado ya proviene normalmente del borde publisher. Esto acerca Kelo al patrón OCI descriptor->content y prepara metadata firmada tipo TUF sin meter claves privadas en Pages.

```text
publisher -> descriptor publicado {size,digest}
         -> provider (prefer published)
         -> expectedBytes/expectedSha256
         -> staging: size check -> SHA-256 check -> integrate
```

## Riesgos abiertos

- descriptor set todavía no está firmado;
- Pack Manager aún debe persistir descriptor locks explícitos por generación;
- `stale` sigue observacional;
- providers externos pueden carecer de digest/size confiables;
- delta sigue por archivo; chunking aún no existe;
- OPFS no benchmarkeado en iPhone real;
- solo una generación previa;
- Pack state y Vault están en IndexedDB distintas; journal mitiga pero no crea ACID cross-database.

## Próximos niveles

1. persistir `digest+size` publicados en member locks/generaciones del Pack Manager;
2. versionar/inmutabilizar descriptor set junto al catálogo;
3. firma metadata estilo TUF y hardening stale;
4. auditoría/rebuild reference graph;
5. OPFS iPhone benchmark;
6. FastCDC build-time para archivos grandes + chunk CAS/Range/resume.

## Regla permanente

Modificar el sistema existente, no duplicarlo; preservar mobile-first/on-demand, compatibilidad y rollback; verificar metadata antes de contenido pesado; evitar TinyFish.
