# BibliotecaTecnologia — Investigación

> Documento exclusivo de Biblioteca Universal / Content Vault / Content Packs de Kelo World.
> Última revisión: 2026-09-16.

## 1. Objetivo

BibliotecaTecnologia debe permitir descubrir, adquirir, descargar, integrar, activar, actualizar, retirar y eventualmente comprar/vender contenido sin convertir el boot del juego en una descarga masiva.

Tipos cubiertos:

- sprites;
- tilesets;
- animaciones;
- VFX;
- SFX;
- música;
- ambience;
- habilidades declarativas;
- escenas/prefabs;
- packs compuestos.

Principio permanente:

```text
CATÁLOGO != DESCARGA != INTEGRACIÓN != ACTIVACIÓN != CARGA EN RUNTIME
```

La disponibilidad puede crecer a millones de contenidos. Los bytes locales deben depender principalmente de lo que cada jugador decide usar, no del tamaño total del catálogo.

## 2. Fundamentos investigados

### 2.1 OCI / Content Addressable Storage

OCI separa blobs, descriptors y manifests. Un descriptor identifica bytes por digest criptográfico y tamaño.

Aplicación Kelo:

```text
assetId -> descriptor -> sha256 -> blob
pack -> members -> descriptors -> immutable blobs
```

Ventajas:

- deduplicación física;
- integridad;
- múltiples versiones coexistentes;
- rollback sin duplicar archivos lógicos;
- manifests pequeños;
- identidad lógica desacoplada de almacenamiento físico.

Fuentes:
- https://github.com/opencontainers/image-spec/blob/main/descriptor.md
- https://github.com/opencontainers/distribution-spec/blob/main/spec.md

### 2.2 TUF / seguridad del updater

The Update Framework documenta rollback, freeze, fast-forward y vistas inconsistentes de metadata.

Invariantes adoptadas/proyectadas:

- no aceptar una versión de catálogo menor a la ya observada;
- una versión publicada debe ser inmutable;
- metadata con publicación y expiración;
- targets futuros con hash + tamaño;
- snapshot consistente;
- firmas server-side futuras;
- ninguna clave privada en GitHub Pages.

Fuentes:
- https://theupdateframework.io/docs/security/
- https://theupdateframework.io/docs/metadata/

### 2.3 OSTree / despliegues atómicos

OSTree construye la nueva deployment antes de activarla y cambia de estado de forma atómica. La idea útil para Kelo es old-or-new: nunca una mezcla intermedia visible.

Aplicación Kelo:

```text
resolve
 -> stage
 -> verify
 -> prepare
 -> atomic pointer commit
 -> activate generation
```

Fuente:
- https://ostreedev.github.io/ostree/atomic-upgrades/

### 2.4 Nix / store inmutable, generations y GC roots

Nix conserva contenido inmutable y usa perfiles/generaciones para cambiar el estado activo y permitir rollback. Sus GC roots protegen objetos que todavía deben considerarse alcanzables; generaciones antiguas pueden mantenerse precisamente para rollback.

Aplicación Kelo:

- blobs por digest;
- generación activa por pack;
- generación previa preservada;
- activación por lock/puntero;
- generaciones activas y rollback como raíces CAS;
- GC separado de uninstall;
- eliminar una generación implica dejar de proteger sus digests, no borrar inmediatamente bytes.

Fuentes:
- https://nix.dev/manual/nix/latest/package-management/profiles.html
- https://nix.dev/manual/nix/latest/package-management/garbage-collector-roots.html
- https://wiki.nixos.org/wiki/Nix_store

### 2.5 Delta por miembro

Estado implementado:

```text
reuse
integrate
download
removed
```

Ejemplo:

```text
Pack v1: A B C D E
Pack v2: A B C' D E

Red: C'
```

Esto elimina red innecesaria antes de entrar en chunking.

### 2.6 FastCDC / Content Defined Chunking

Para archivos grandes, el delta por archivo completo no basta. FastCDC permite límites de chunks dependientes del contenido para que una pequeña inserción no desplace necesariamente todos los bloques siguientes.

Arquitectura futura:

```text
file manifest
  finalDigest
  totalSize
  chunks[]
    digest
    size
    offset
```

Recomendaciones:

- no usar CDC para archivos pequeños;
- evaluar a partir de ~512 KB;
- chunks medios iniciales cercanos a 64 KB;
- calcular chunks en publisher/gateway, no durante cada boot móvil;
- reconstruir y comprobar SHA-256 final.

Fuentes:
- https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia
- https://github.com/google/cdc-file-transfer

### 2.7 OPFS

IndexedDB es adecuado para metadata/punteros/manifests. OPFS puede convertirse en tier opcional para media y chunks grandes.

Reglas:

- feature detection;
- fallback completo a IndexedDB;
- procesamiento pesado en Worker cuando sea posible;
- benchmark real en Safari/iPhone antes de hacerlo default.

Fuentes:
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API

### 2.8 Cuota y presión de almacenamiento móvil

`navigator.storage.estimate()` expone una estimación de uso/cuota, no una garantía exacta. El almacenamiento web puede ser best-effort y las escrituras pueden fallar bajo presión; `persist()` solo solicita persistencia y el navegador decide.

Aplicación Kelo:

- medir antes de abrir una transacción grande;
- estimar el pico temporal, no solo los bytes finales;
- reservar margen de seguridad;
- abortar antes de red/staging cuando el margen es insuficiente;
- ownership cloud y cache local deben seguir separados.

Fuentes:
- https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/estimate
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

## 3. Evolución implementada

### Ronda 1 — CAS SHA-256

Se creó `casBlobs`.

Modelo:

```text
assets[id] -> metadata
blobs[id] -> digest
casBlobs[digest] -> Blob
```

Nuevas descargas:

1. fetch/inline Blob;
2. MIME validation;
3. SHA-256;
4. expected digest si existe;
5. reuse de CAS si digest ya existe;
6. pointer lógico por asset.

Legacy sigue legible y la migración es progresiva.

### Ronda 2 — rollback por asset + GC con gracia

Cada pointer puede conservar:

```text
digest
previousDigest
```

Se añadieron:

- `rollbackAssetBlob(id)`;
- `discardAssetRollbackHistory(id)`;
- `garbageCollectCas()`.

GC usa `orphanedAt` y 7 días de gracia por defecto.

### Ronda 3 — anti-rollback de catálogo

El catálogo mantiene:

```text
version
publishedAt
expiresAt
```

Reglas:

- versión menor => `PACK_CATALOG_ROLLBACK`;
- misma versión con digest diferente => `PACK_CATALOG_MUTATED_WITHOUT_VERSION`;
- expiración => `stale=true` observacional.

### Ronda 4 — Pack Transaction / Atomic Generation

Problema anterior:

`installContentPack()` podía alterar assets activos uno por uno durante la descarga.

Solución:

```text
ACTIVE GEN N
    |
    | no cambia
    v
plan
 -> staging
 -> digest verify
 -> compile/validate
 -> prepared
 -> atomic Vault commit
 -> Gen N+1 active
```

Nuevo módulo:

```text
src/creators/assets/content-pack-transaction.mjs
```

Staging:

```text
IndexedDB: kelo_content_pack_staging_v1
store: stages
```

El commit final usa una sola transacción sobre:

```text
assets
blobs
manifests
casBlobs
```

### Ronda 5 — rollback transaccional de pack completo

Problema:

`previousGeneration` existía como snapshot lógico, pero no había una operación segura que restaurara todos sus miembros coordinadamente.

Implementación:

```js
await rollbackContentPack(packId)
```

Flujo:

```text
Gen N activa
 -> leer previousGeneration N-1
 -> localizar cada sha256 en CAS
 -> stage bytes de CAS, sin red
 -> recompilar/validar manifests
 -> stage tombstones para miembros que solo existen en Gen N
 -> PREPARED
 -> commit atómico
 -> Gen N-1 activa
 -> Gen N pasa a previousGeneration
```

Propiedades:

- no usa red si los digests de la generación anterior siguen en CAS;
- los manifests se vuelven a validar a partir de los bytes reales;
- miembros retirados se eliminan dentro del mismo commit mediante tombstones;
- si falla pre-commit, la generación activa no cambia;
- journal/crash recovery funciona también para `operation:'rollback'`;
- permite alternar entre la generación actual y la anterior mientras ambas sigan representables.

Cambio en transaction layer:

```text
stagePackMember(..., sourceDigest)
stagePackRemoval(assetId)
```

`sourceDigest` permite adquirir bytes directamente de CAS y verificar que el contenido calculado coincide con ese digest.

### Ronda 6 — grafo de referencias / GC roots

Problema:

Un blob de una generación anterior podía dejar de tener pointer activo. Un GC que solo mirara `blobs[id]` podía considerarlo huérfano aunque todavía fuera necesario para rollback del pack.

Implementación:

```js
await buildContentReferenceGraph({verify:true})
await garbageCollectContentStorage(options)
```

Raíces actuales:

```text
active pack generations
previousGeneration
live transaction previousState
targetState
targetMembers
asset current pointer
asset previousDigest
```

`garbageCollectCas()` ahora acepta:

```js
extraReferencedDigests
```

Por tanto:

```text
reachable by pack generation => protected
not reachable => orphan candidate
orphan + grace elapsed => deletable
```

Esto aproxima el modelo Nix de store inmutable + GC roots, pero manteniendo el grafo reconstruible desde el estado Kelo.

Al desinstalar un pack se limpia `previousGeneration`, de modo que una generación eliminada deja de pinnear CAS para siempre.

### Ronda 7 — storage-pressure preflight

Problema:

Una actualización atómica puede necesitar temporalmente más espacio que su tamaño final:

```text
active bytes
+ staging bytes
+ downloaded bytes / nueva CAS data
```

Sin preflight, el navegador puede quedarse sin cuota a mitad del proceso.

Implementación:

```js
await assessPackStoragePressure(packId)
```

Política actual:

```text
reserve ratio: 8% de la cuota estimada
minimum reserve: 24 MiB
```

El planner calcula:

```text
estimatedStagingBytes
estimatedDownloadBytes
estimatedPeakExtraBytes
freeAfter
reserveBytes
safe / risk
```

`installContentPack()` ejecuta este guard automáticamente antes de abrir staging. Si el espacio estimado no deja la reserva mínima:

```text
PACK_STORAGE_PRESSURE
```

La operación se detiene antes de descargar contenido.

La UI también hace preflight para mostrar un error comprensible al jugador.

## 4. Journal y crash recovery

PackManager:

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

Fases normales:

```text
staging
prepared
committing
vault-committed
committed
```

Fases de recuperación/error:

```text
recovered
failed
interrupted
needs-recovery
```

Cada journal incluye ahora también:

```text
operation = install | rollback
changedAssetIds
removedAssetIds
previousState
targetState
storagePressure
delta metrics
```

Recovery comprueba:

- digests target activos para assets cambiados;
- ausencia de pointer para tombstones/removals;
- targetState persistido antes del commit.

## 5. Generaciones

Estado de un pack:

```text
generation
previousGeneration
transaction.id
transaction.atomic
transaction.operation
```

Solo se mantiene una generación previa embebida para evitar crecimiento recursivo. Eso permite rollback inmediato y mantiene el estado pequeño.

Modelo actual:

```text
Gen N-1 <-> Gen N
```

Un historial de más generaciones debe diseñarse explícitamente más adelante; no acumular snapshots anidados sin límite.

## 6. Reference graph actual

Objetivo:

```text
identity graph + immutable blob store
```

La pregunta para GC ya no debe ser:

> ¿este digest tiene pointer activo?

sino:

> ¿este digest es alcanzable desde cualquier raíz válida?

Raíces válidas actuales:

- generación activa;
- generación previa;
- transacción viva;
- rollback individual (`previousDigest`).

Esto protege rollback sin impedir GC indefinidamente.

## 7. Storage model actual

```text
Remote catalog metadata
        |
        v
Delta planner
        |
        +--> storage pressure preflight
        |
        v
Staging DB
        |
        v
SHA-256 verify + compiler validators
        |
        v
Atomic Vault transaction
        |
        v
Active generation
        |
        +--> Previous generation root
        |
        v
CAS reference graph
        |
        v
Grace-period GC
```

## 8. Invariantes actuales

Toda instalación/rollback correcta debe cumplir:

1. la generación activa no cambia durante staging;
2. todos los bytes staged se verifican antes del commit;
3. no se ejecuta JS externo;
4. abilities/scenes pasan validators declarativos;
5. removals del update se incluyen en el commit atómico cuando Kelo es dueño de ese cache;
6. un fallo pre-commit preserva la generación anterior;
7. crash post-commit se recupera por journal;
8. rollback usa CAS antes que red;
9. previousGeneration es una GC root real;
10. storage pressure se evalúa antes de descargar;
11. uninstall y destrucción física siguen separados;
12. contenido externo no entra al boot automáticamente.

## 9. Métricas

Medir/expandir:

```text
logicalBytes
physicalCasBytes
deduplicatedBytes
dedupeRatio
referenceRootCount
missingReferenceRoots
estimatedDownloadBytes
estimatedStagingBytes
estimatedPeakExtraBytes
reserveBytes
freeAfter
downloadedBytes
estimatedSavedBytes
reusedMembers
changedMembers
removedMembers
stagingBytes
transactionDuration
commitDuration
rollbackCount
rollbackFailures
recoveryCount
recoveryFailures
orphanedBlobs
gcReclaimedBytes
```

Ratios centrales:

```text
bandwidth_saved_ratio = 1 - downloaded_bytes / logical_update_bytes
storage_dedupe_ratio = 1 - physical_cas_bytes / logical_referenced_bytes
transaction_success_rate = committed / started
rollback_success_rate = successful_rollbacks / rollback_attempts
```

## 10. Riesgos abiertos

- pack state y Vault viven en IndexedDB distintas; journal hace roll-forward recovery, pero no existe ACID cross-database;
- metadata todavía no está firmada;
- `stale` del catálogo no bloquea aún;
- proveedores sin expected digest pueden cambiar bytes bajo la misma URL;
- archivos grandes siguen usando delta por archivo;
- staging todavía puede duplicar bytes temporalmente;
- `estimate()` es aproximado, por eso el guard debe conservar margen;
- OPFS todavía no fue benchmarkeado en iPhone real;
- historial de generaciones >1 todavía no existe;
- CAS reference graph todavía se reconstruye bajo demanda en vez de mantener un índice incremental;
- no existe publisher Kelo que obligue `digest + size` para todo contenido nativo.

## 11. Próximos niveles

Alta prioridad:

1. digest + size obligatorios para todo contenido publicado por Kelo.
2. auditoría/rebuild del reference graph con diagnóstico de referencias rotas.
3. historial opcional de 3–5 generaciones con política explícita de retención.
4. telemetría local de transaction/rollback/recovery/GC.
5. hardening de catálogo stale cuando exista canal firmado de refresh.

Siguiente capa de escala:

6. benchmark OPFS en iPhone/Safari y tier de blobs grandes.
7. FastCDC build-time.
8. chunk CAS.
9. Range delivery / resume por chunks.
10. Asset Gateway/CDN.
11. metadata firmada estilo TUF.
12. mirrors y failover.

Posterior:

13. prefetch adaptativo respetando red/batería;
14. caché predictiva limitada por presión de storage;
15. peer-assisted delivery opcional, siempre verificado por digest.

## 12. Regla para futuras rondas autónomas

Cada ronda debe:

1. leer `investigacion.md`;
2. leer `documentacion.md`;
3. inspeccionar implementación real;
4. investigar tecnología externa relevante;
5. elegir una mejora de alto impacto y riesgo acotado;
6. modificar el sistema existente, nunca crear un Vault paralelo;
7. preservar iPhone/mobile-first;
8. mantener metadata-only hasta acción explícita;
9. mantener carga bajo demanda;
10. documentar el contrato nuevo;
11. revisar CI/Pages.

## 13. Regla permanente

**BibliotecaTecnologia debe comportarse como un sistema de distribución de contenido inmutable, direccionado por contenido, transaccional y recuperable; nunca como una carpeta gigante de archivos.**
