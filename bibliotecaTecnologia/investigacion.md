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

OCI separa blobs, descriptors y manifests. El descriptor usa `digest`, `size` y `mediaType`; el tamaño permite rechazar contenido inesperado antes de hashing/procesamiento pesado y el digest identifica los bytes inmutables. SHA-256 sigue siendo el algoritmo canónico recomendado.

Aplicación Kelo:

```text
assetId -> descriptor -> sha256 -> CAS blob
pack -> members -> descriptors -> immutable blobs
```

Fuentes:
- https://github.com/opencontainers/image-spec/blob/main/descriptor.md
- https://github.com/opencontainers/distribution-spec/blob/main/spec.md

### TUF

Targets metadata lista hashes y tamaños; Snapshot evita vistas inconsistentes y Timestamp permite detectar metadata congelada. Kelo ya tiene anti-rollback local y expiración observacional; la firma real debe llegar desde publisher/backend, nunca mediante una clave privada en Pages.

Fuentes:
- https://theupdateframework.io/docs/security/
- https://theupdateframework.io/docs/metadata/

### OSTree / Nix

Mantener old-or-new: preparar y verificar antes de cambiar el puntero activo. Generaciones activas, generación previa y transacciones vivas son raíces CAS; GC solo puede retirar blobs no alcanzables y tras período de gracia.

Fuentes:
- https://ostreedev.github.io/ostree/atomic-upgrades/
- https://nix.dev/manual/nix/latest/package-management/profiles.html
- https://nix.dev/manual/nix/latest/package-management/garbage-collector-roots.html

### Delta, chunking y storage móvil

Delta actual es por miembro (`reuse`, `integrate`, `download`, `removed`). FastCDC queda reservado para archivos grandes; no introducirlo en archivos pequeños ni calcularlo durante boot móvil. IndexedDB sigue siendo canónico; OPFS es un tier futuro para blobs/chunks grandes tras benchmark real en Safari/iPhone. `navigator.storage.estimate()` es aproximado, por lo que el preflight conserva margen.

Fuentes:
- https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia
- https://github.com/google/cdc-file-transfer
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate

## Estado implementado

1. CAS SHA-256 con deduplicación física y compatibilidad legacy.
2. Rollback individual y GC con gracia.
3. Catálogo monotónico: rollback y mutación de misma versión rechazados.
4. Pack transaction: staging separado + commit atómico del Vault.
5. Rollback transaccional de pack desde CAS sin red cuando están los blobs.
6. Reference graph/GC roots para active, previous y transacciones vivas.
7. Storage-pressure preflight antes de descargas grandes.
8. `stagePackMember()` valida `expectedBytes` antes de SHA-256 cuando existe descriptor de tamaño.
9. **Ronda actual — descriptors nativos derivados antes de staging:** `kelo-content-live-provider.mjs` serializa cada `inlineManifest` exactamente como lo hará staging, calcula `expectedBytes` y SHA-256 con WebCrypto una sola vez al cargar el pequeño índice nativo, y expone `bytes`, `expectedBytes` y `expectedSha256`. El transaction layer ya existente verifica tamaño y digest antes de integrar. No se añadió otro Vault ni descarga de boot.

### Por qué esta ronda es segura

Los manifests Kelo son pequeños y declarativos. El cálculo ocurre al consultar el provider, no en el boot general ni para bibliotecas externas. Si WebCrypto no existe, se conserva la comprobación de tamaño y `expectedSha256` queda nulo, manteniendo compatibilidad. Los providers externos no cambian.

### Limitación importante

El descriptor nativo se deriva actualmente del mismo catálogo descargado. Esto detecta corrupción/mutación entre resolución y staging y fija identidad dentro de la transacción, pero **no sustituye un publisher firmado**: un origen comprometido podría servir catálogo y bytes maliciosos coherentes entre sí. La siguiente frontera de confianza es generar/persistir `sha256 + bytes` en publicación y después firmar metadata.

## Modelo actual

```text
Remote metadata
 -> provider descriptor
 -> delta planner
 -> storage preflight
 -> staging
 -> size check
 -> SHA-256 check
 -> compiler/validators
 -> atomic Vault commit
 -> active generation
 -> previous generation root
 -> CAS reference graph
 -> grace-period GC
```

## Invariantes

1. generación activa no cambia durante staging;
2. bytes staged se verifican antes del commit cuando existe descriptor;
3. no ejecutar JS externo;
4. abilities/scenes pasan validators declarativos;
5. removals propios son atómicos con la nueva generación;
6. fallo pre-commit preserva generación anterior;
7. recovery usa journal y roll-forward verificable;
8. rollback prefiere CAS a red;
9. previousGeneration es GC root;
10. storage pressure se evalúa antes de descargar;
11. uninstall y destrucción física son operaciones separadas;
12. contenido externo nunca entra automáticamente al boot.

## Riesgos abiertos

- Pack state y Vault están en IndexedDB distintas: journal mitiga, no existe ACID cross-database.
- Metadata todavía no está firmada.
- `stale` sigue observacional hasta existir refresh firmado confiable.
- Providers externos sin expected digest/size pueden cambiar bytes bajo la misma URL.
- Descriptors Kelo actuales son derivados en cliente, no emitidos por publisher independiente.
- Delta sigue por archivo; chunking aún no existe.
- Staging puede duplicar bytes temporalmente.
- OPFS no está benchmarkeado en iPhone real.
- Solo se conserva una generación previa.
- Reference graph se reconstruye bajo demanda.

## Próximos niveles

Alta prioridad:
1. publisher Kelo que materialice `sha256 + bytes` y falle si falta alguno;
2. propagar descriptors publicados desde `content-pack-catalog.json` al resolver miembros;
3. auditoría/rebuild detallado del reference graph;
4. telemetría local de transaction/rollback/recovery/GC;
5. firma de metadata estilo TUF y hardening de stale.

Escala posterior:
6. benchmark OPFS en iPhone/Safari;
7. FastCDC build-time para archivos grandes;
8. chunk CAS + Range/resume;
9. Asset Gateway/CDN + mirrors;
10. prefetch adaptativo limitado por red, batería y presión de storage.

## Regla para futuras rondas

Leer primero `investigacion.md` y `documentacion.md`, inspeccionar implementación real, investigar fuentes actuales, elegir una mejora pequeña de alto impacto, modificar el sistema existente sin duplicarlo, preservar mobile-first/on-demand, revisar QA/CI y documentar el nuevo contrato. Evitar TinyFish.

**BibliotecaTecnologia debe comportarse como distribución de contenido inmutable, direccionada por contenido, transaccional y recuperable; nunca como una carpeta gigante de archivos.**
