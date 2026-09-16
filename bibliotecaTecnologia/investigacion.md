# BibliotecaTecnologia — Investigación

> Documento exclusivo de Biblioteca Universal / Content Vault / Content Packs de Kelo World.
> Última revisión: 2026-09-16.

## Objetivo e invariantes

BibliotecaTecnologia distribuye sprites, tilesets, animaciones, VFX, audio, abilities declarativas, escenas/prefabs y packs sin convertir el boot en una descarga masiva.

```text
CATÁLOGO != DESCARGA != INTEGRACIÓN != ACTIVACIÓN != CARGA EN RUNTIME
```

La disponibilidad puede crecer a millones de contenidos; almacenamiento, red y runtime local deben depender principalmente del contenido elegido por el jugador. No crear Vaults paralelos. Mantener mobile-first, metadata-first y carga bajo demanda.

## Fundamentos investigados

### OCI / CAS

OCI Content Descriptor exige `digest`, `size` y `mediaType`. `size` permite rechazar longitud inesperada antes del hash/procesamiento pesado; después se verifica el digest. SHA-256 sigue siendo el algoritmo canónico. La verificación debe ocurrir antes de procesamiento pesado.

Aplicación Kelo: `assetId -> descriptor -> sha256 -> CAS blob` y `pack -> members -> descriptors -> immutable blobs`.

Fuentes: https://github.com/opencontainers/image-spec/blob/main/descriptor.md y https://github.com/opencontainers/distribution-spec/blob/main/spec.md

### TUF

Targets metadata lista hashes y tamaños; Snapshot evita vistas inconsistentes y Timestamp permite detectar metadata congelada. Kelo ya tiene anti-rollback local y expiración observacional; la firma real debe llegar desde publisher/backend, nunca mediante una clave privada en Pages.

Fuente: https://theupdateframework.io/docs/metadata/

### OSTree / Nix

Mantener old-or-new: preparar y verificar antes de cambiar el puntero activo. Generaciones activas, generación previa y transacciones vivas son raíces CAS; GC solo puede retirar blobs no alcanzables y tras período de gracia.

Fuentes: https://ostreedev.github.io/ostree/atomic-upgrades/ y documentación Nix de profiles/GC roots.

### Delta, chunking y storage móvil

Delta actual es por miembro (`reuse`, `integrate`, `download`, `removed`). FastCDC queda reservado para archivos grandes; no introducirlo en archivos pequeños ni calcularlo durante boot móvil. IndexedDB sigue siendo canónico; OPFS es un tier futuro para blobs/chunks grandes tras benchmark real en Safari/iPhone. `navigator.storage.estimate()` es aproximado, por lo que el preflight conserva margen.

## Estado implementado

1. CAS SHA-256 con deduplicación física y compatibilidad legacy.
2. Rollback individual y GC con gracia.
3. Catálogo monotónico: rollback y mutación de misma versión rechazados.
4. Pack transaction: staging separado + commit atómico del Vault.
5. Rollback transaccional de pack desde CAS sin red cuando están los blobs.
6. Reference graph/GC roots para active, previous y transacciones vivas.
7. Storage-pressure preflight antes de descargas grandes.
8. `stagePackMember()` valida `expectedBytes` antes de SHA-256 cuando existe descriptor de tamaño.
9. Provider Kelo deriva temporalmente `expectedBytes + expectedSha256` de manifests declarativos para compatibilidad.
10. Publisher determinista `scripts/publish-kelo-content-descriptors.mjs` genera `mediaType + size + digest` desde la fuente canónica.
11. Main Stability Gate ejecuta el publisher con `--check` y detecta descriptor ausente o drift.
12. **Ronda actual — hardening del publisher:** el publisher rechaza IDs duplicados, descriptors vacíos/digest inválido, comprueba cardinalidad source→descriptors y publica mediante archivo temporal + rename para evitar dejar un descriptor parcialmente escrito si el proceso se interrumpe.

## Decisión de esta ronda

La identidad publicada debe ser determinista y además el acto de publicación debe ser fail-closed. Dos assets con el mismo ID no pueden producir referencias ambiguas. Un descriptor incompleto no puede publicarse. La escritura del descriptor set no debe exponer un archivo truncado durante una interrupción local/build.

```text
source manifest
 -> validate unique identity
 -> deterministic descriptor
 -> validate size/digest/cardinality
 -> temp file
 -> rename
 -> CI drift check
```

Esto no toca Vault, boot ni runtime y conserva carga bajo demanda.

## Riesgos abiertos

- `data/kelo-content-descriptors.json` todavía debe materializarse en repo para que el gate quede verde.
- Pack Manager todavía no consume el descriptor publicado.
- Metadata todavía no está firmada.
- `stale` sigue observacional.
- Providers externos sin expected digest/size pueden cambiar bytes bajo la misma URL.
- Delta sigue por archivo; chunking aún no existe.
- Staging puede duplicar bytes temporalmente.
- OPFS no está benchmarkeado en iPhone real.
- Solo se conserva una generación previa.
- Pack state y Vault están en IndexedDB distintas; journal mitiga pero no crea ACID cross-database.

## Próximos niveles

Alta prioridad:
1. materializar `data/kelo-content-descriptors.json` con el publisher y dejar CI verde;
2. hacer que Pack Manager consuma el descriptor publicado y propague `size -> expectedBytes`, `digest -> expectedSha256`;
3. versionar/inmutabilizar el descriptor set junto al catálogo;
4. firma de metadata estilo TUF y hardening de stale;
5. auditoría/rebuild detallado del reference graph.

Escala posterior: benchmark OPFS en iPhone/Safari; FastCDC build-time para archivos grandes; chunk CAS + Range/resume; Asset Gateway/CDN + mirrors; prefetch adaptativo limitado por red, batería y storage.

## Regla para futuras rondas

Leer primero `investigacion.md` y `documentacion.md`, inspeccionar implementación real, investigar fuentes actuales, elegir una mejora pequeña de alto impacto, modificar el sistema existente sin duplicarlo, preservar mobile-first/on-demand, revisar QA/CI y documentar el nuevo contrato. Evitar TinyFish.

**BibliotecaTecnologia debe comportarse como distribución de contenido inmutable, direccionada por contenido, transaccional y recuperable; nunca como una carpeta gigante de archivos.**
