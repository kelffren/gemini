# BibliotecaTecnologia — Investigación

> Documento exclusivo de Biblioteca Universal / Content Vault / Content Packs de Kelo World.
> Última revisión: 2026-09-16.

## 1. Objetivo

BibliotecaTecnologia debe permitir descubrir, descargar, integrar, actualizar, retirar y eventualmente comprar/vender contenido sin convertir el boot del juego en una descarga masiva.

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

La cantidad de contenido disponible puede crecer a millones. Los bytes descargados por un jugador deben depender solo de lo que ese jugador decide usar.

## 2. Fundamentos externos investigados

### 2.1 OCI / Content Addressable Storage

OCI separa blobs, descriptors y manifests. Un descriptor puede identificar bytes mediante digest criptográfico y tamaño.

Aplicación Kelo:

```text
assetId -> descriptor -> sha256 -> blob
pack -> members -> descriptors -> immutable blobs
```

Ventajas:

- deduplicación física;
- verificación de integridad;
- múltiples versiones coexistentes;
- manifests pequeños;
- distribución independiente de identidad lógica.

Fuentes:
- https://github.com/opencontainers/image-spec/blob/main/descriptor.md
- https://github.com/opencontainers/distribution-spec/blob/main/spec.md

### 2.2 TUF / seguridad de updates

The Update Framework documenta rollback, freeze, fast-forward y vistas inconsistentes de metadata.

Invariantes adoptadas/proyectadas:

- no aceptar versión de catálogo inferior a la ya observada;
- una versión publicada no debe mutar silenciosamente;
- metadata con publicación/expiración;
- hashes/tamaños para targets;
- snapshot consistente;
- firma server-side futura;
- ninguna clave privada dentro de GitHub Pages.

Fuentes:
- https://theupdateframework.io/docs/security/
- https://theupdateframework.io/docs/metadata/

### 2.3 OSTree / transición atómica

OSTree construye una nueva deployment antes de activarla y después realiza una transición atómica. Ante una interrupción se conserva un estado completo anterior o completo nuevo, no un estado intermedio.

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

### 2.4 Nix / store inmutable + generations

Nix conserva contenido inmutable en el store y usa perfiles/generaciones para cambiar el estado activo y permitir rollback.

Aplicación Kelo:

- blobs por digest;
- generación activa por pack;
- generación previa preservada;
- activación por puntero/lock;
- GC separado de uninstall.

Fuente:
- https://wiki.nixos.org/wiki/Nix_store

### 2.5 Delta por miembro

Estado actual:

```text
reuse
integrate
download
removed
```

Si un pack tiene 40 miembros y cambian 2, solo esos 2 deben necesitar red.

### 2.6 FastCDC / Content Defined Chunking

Para archivos grandes, delta por archivo completo deja de ser suficiente.

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

Recomendación:

- aplicar solo a archivos grandes;
- precomputar chunks en publisher/gateway;
- cliente descarga chunks ausentes;
- verificar SHA-256 final reconstruido.

Fuentes:
- https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia
- https://github.com/google/cdc-file-transfer

### 2.7 OPFS

IndexedDB es útil para metadata y objetos, pero OPFS puede ser mejor tier para media/chunks grandes.

Reglas:

- feature detection;
- fallback IndexedDB;
- worker para trabajo intensivo;
- benchmark real en Safari/iPhone antes de hacerlo default.

Fuentes:
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

## 3. Evolución implementada

### Ronda 1 — CAS SHA-256

Se añadió `casBlobs`.

Modelo:

```text
assets[id] -> metadata
blobs[id] -> digest
casBlobs[digest] -> Blob
```

Nuevas descargas:

1. descargan/crean Blob;
2. validan MIME;
3. calculan SHA-256;
4. comparan `expectedSha256` cuando existe;
5. reutilizan blob si digest ya existe;
6. actualizan puntero lógico.

Legacy sigue legible y la migración es progresiva.

### Ronda 2 — rollback + GC conservador

Cada pointer puede conservar:

```text
digest
previousDigest
```

Se añadieron:

- `rollbackAssetBlob(id)`;
- `discardAssetRollbackHistory(id)`;
- `garbageCollectCas()`.

GC usa `orphanedAt` + período de gracia de 7 días.

### Ronda 3 — anti-rollback del catálogo

El catálogo tiene:

```text
version
publishedAt
expiresAt
```

Reglas:

- versión menor => `PACK_CATALOG_ROLLBACK`;
- misma versión con bytes distintos => `PACK_CATALOG_MUTATED_WITHOUT_VERSION`;
- expiración => `stale=true` observacional.

### Ronda 4 — Pack Transaction / Atomic Generation

Problema anterior:

Aunque cada asset tenía rollback, `installContentPack()` podía ir cambiando assets activos uno a uno mientras el resto seguía descargándose. Un fallo a mitad podía dejar una mezcla temporal de versiones.

Solución implementada:

Nuevo módulo:

```text
src/creators/assets/content-pack-transaction.mjs
```

Nuevo flujo:

```text
ACTIVE GENERATION N
       |
       | permanece sin cambios
       v
resolve delta
 -> stage changed members
 -> SHA-256 verify
 -> compile/validate manifests in staging
 -> prepare target generation N+1
 -> atomic IndexedDB commit of ALL changed asset pointers/manifests
 -> activate pack state N+1
 -> clean removed members later
```

Durante staging:

- no cambia `assets`;
- no cambia `blobs` activo;
- no cambia `manifests` activo;
- no entra contenido staged al runtime.

Los blobs staged viven temporalmente en:

```text
IndexedDB: kelo_content_pack_staging_v1
store: stages
```

El commit final sobre el Vault usa una sola transacción IndexedDB para:

```text
assets
blobs
manifests
casBlobs
```

Por tanto los miembros cambiados del pack saltan juntos, no uno por uno.

## 4. Journal y crash recovery

PackManager subió a:

```text
kelo_content_pack_v1
DB_VERSION = 3
```

Stores:

```text
packs
settings
transactions
```

Cada pack tiene como máximo una transacción activa registrada.

Fases:

```text
staging
prepared
committing
vault-committed
committed
```

Estados de recuperación:

```text
recovered
failed
interrupted
needs-recovery
```

El `SESSION_ID` distingue una operación viva de una operación abandonada por recarga/crash.

### Crash antes del commit

Resultado:

```text
active generation N intacta
staging eliminado posteriormente
```

### Crash durante el commit del Vault

La transacción IndexedDB del Vault es atómica:

```text
todos los pointers nuevos
OR
ninguno
```

### Crash después del Vault commit pero antes de guardar el pack lock

Existe una frontera entre dos bases IndexedDB distintas. No existe transacción ACID cross-database en IndexedDB.

Mitigación implementada:

- journal persistente;
- `targetState` guardado antes del commit;
- `changedAssetIds`;
- recovery comprueba digests activos;
- si el Vault ya contiene la generación nueva, finaliza el pack state;
- si no, aborta staging y conserva la generación anterior.

API:

```js
await recoverPackTransactions()
```

Esto convierte esa frontera en un proceso recuperable/roll-forward.

## 5. Generaciones

Cada pack activo ahora puede tener:

```text
generation = 1, 2, 3...
previousGeneration
transaction.id
transaction.atomic = true
```

La generación anterior se conserva como snapshot lógico de un nivel.

Razón para limitar historial inmediato:

- evitar crecimiento recursivo del estado;
- CAS mantiene bytes previos;
- más adelante se puede implementar historial configurable.

## 6. Staging y storage

`getPackStorageHealth()` ahora también expone staging temporal:

```text
staging.members
staging.bytes
staging.transactions
```

Limpieza de staging abandonado:

```js
cleanupStaleStaging()
```

No se considera ownership. Es cache temporal de transacción.

## 7. Invariantes actuales

Una instalación/update correcta debe cumplir:

1. el pack activo no cambia durante descarga;
2. todos los miembros staged se verifican antes de commit;
3. código externo no se ejecuta;
4. habilidad/scene pasan validators existentes;
5. el swap de assets cambiados es una única transacción del Vault;
6. un fallo pre-commit preserva la generación anterior;
7. un crash post-commit se puede completar mediante journal;
8. uninstall y GC siguen separados;
9. contenido externo no entra al boot automáticamente.

## 8. Métricas

Mantener/expandir:

```text
logicalBytes
physicalCasBytes
deduplicatedBytes
dedupeRatio
estimatedDownloadBytes
downloadedBytes
estimatedSavedBytes
reusedMembers
changedMembers
stagingBytes
transactionDuration
commitDuration
recoveryCount
recoveryFailures
orphanedBlobs
gcReclaimedBytes
```

Métricas centrales:

```text
bandwidth_saved_ratio = 1 - downloaded_bytes / logical_update_bytes
storage_dedupe_ratio = 1 - physical_cas_bytes / logical_referenced_bytes
transaction_success_rate = committed / started
```

## 9. Riesgos abiertos

- el pack lock y el Vault viven en bases IndexedDB diferentes; journal resuelve crash recovery pero no crea una transacción ACID cross-database;
- metadata aún no está firmada;
- catálogo `stale` todavía no bloquea instalación;
- provider externo sin digest puede cambiar bytes bajo la misma URL;
- archivos grandes todavía usan delta por archivo;
- staged blobs duplican temporalmente espacio hasta commit;
- OPFS aún no fue benchmarkeado en iPhone real;
- rollback de pack completo todavía necesita API/UI coordinada sobre `previousGeneration`.

## 10. Próximos niveles

Alta prioridad:

1. `rollbackContentPack()` transaccional usando `previousGeneration`.
2. CAS reference graph audit/rebuild.
3. digest + size obligatorios para contenido publicado por Kelo.
4. UI de historial de generaciones.
5. límites de staging según storage pressure.

Después:

6. OPFS tier para blobs grandes.
7. FastCDC build-time.
8. chunk CAS.
9. Asset Gateway/CDN.
10. metadata firmada estilo TUF.
11. mirrors y failover.

## 11. Regla para futuras rondas autónomas

Cada ronda:

1. leer `investigacion.md`;
2. leer `documentacion.md`;
3. inspeccionar implementación real;
4. investigar tecnología externa relevante;
5. elegir una mejora concreta;
6. modificar el sistema existente, no duplicarlo;
7. preservar iPhone/mobile-first;
8. mantener carga bajo demanda;
9. actualizar estos dos documentos;
10. revisar CI/Pages.

## 12. Regla permanente

**BibliotecaTecnologia debe comportarse como un sistema de distribución de contenido inmutable y recuperable, no como una carpeta gigante de archivos.**
