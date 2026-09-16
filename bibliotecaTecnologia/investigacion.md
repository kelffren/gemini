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

Fuente: https://github.com/opencontainers/image-spec/blob/main/descriptor.md

### TUF

Targets metadata lista hashes y tamaños; Snapshot evita vistas inconsistentes y Timestamp permite detectar metadata congelada. Kelo ya tiene anti-rollback local y expiración observacional; la firma real debe llegar desde publisher/backend, nunca mediante una clave privada en Pages.

Fuente: https://theupdateframework.io/docs/metadata/

### OSTree / Nix

Mantener old-or-new: preparar y verificar antes de cambiar el puntero activo. Generaciones activas, generación previa y transacciones vivas son raíces CAS; GC solo puede retirar blobs no alcanzables y tras período de gracia.

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
12. Publisher fail-closed: IDs únicos, tamaño/digest/cardinalidad válidos y escritura temp + rename.
13. **Ronda actual — source binding:** el descriptor set incluye ahora `sourceDigest` SHA-256 de los bytes exactos de `data/kelo-content-starter-catalog.json` y `sourceVersion`. El `--check` reproduce ambos, por lo que un descriptor set ya no solo prueba sus miembros: queda ligado criptográficamente a la revisión exacta de la fuente que lo produjo.

## Decisión de esta ronda

Un conjunto de descriptors debe identificar también su entrada canónica. Esto reduce ambigüedad entre dos revisiones del catálogo que casualmente contengan los mismos assets y prepara una futura cadena de metadata firmada/snapshot sin introducir firmas privadas en cliente.

```text
source bytes
 -> SHA-256 sourceDigest
 -> validate assets
 -> deterministic member descriptors
 -> descriptor set {source, sourceVersion, sourceDigest, descriptors}
 -> atomic publish
 -> CI reproducibility check
```

OCI confirma que `digest + size + mediaType` son propiedades primarias del descriptor y recomienda verificar tamaño antes de digest y procesamiento pesado. TUF confirma que Targets usa hashes/tamaños y Snapshot fija una vista consistente de metadata. El nuevo `sourceDigest` aplica ese principio de consistencia al borde publisher de Kelo.

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
