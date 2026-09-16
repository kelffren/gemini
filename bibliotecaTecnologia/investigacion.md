# BibliotecaTecnologia — Investigación

> Documento exclusivo de la tecnología Biblioteca Universal / Content Vault / Content Packs de Kelo World.
> Última revisión: 2026-09-16.

## 1. Objetivo

BibliotecaTecnologia debe permitir que Kelo World descubra, adquiera, descargue, integre, actualice y retire sprites, tilesets, animaciones, VFX, SFX, música, ambiente, habilidades declarativas, escenas y packs completos sin que el catálogo haga pesado el boot principal.

Principio permanente:

```text
CATÁLOGO != DESCARGA != INTEGRACIÓN != CARGA EN RUNTIME
```

El sistema debe poder crecer de miles a millones de contenidos manteniendo el peso del jugador ligado únicamente a lo que ese jugador realmente usa.

## 2. Fundamentos investigados

### 2.1 OCI / Content Addressable Storage

OCI separa blobs, manifests y descriptors. Un descriptor identifica contenido usando digest criptográfico y tamaño.

Aplicación Kelo:

```text
assetId -> descriptor -> sha256 -> blob
pack -> descriptors -> blobs
```

Consecuencias:

- bytes idénticos se almacenan una sola vez;
- un pack no necesita poseer físicamente su contenido;
- varias versiones pueden coexistir;
- el estado activo puede cambiar mediante punteros;
- integridad y deduplicación usan el mismo digest.

Fuentes:
- https://github.com/opencontainers/image-spec/blob/main/descriptor.md
- https://github.com/opencontainers/distribution-spec/blob/main/spec.md

### 2.2 TUF / seguridad del updater

The Update Framework documenta ataques específicos contra sistemas de actualización: rollback, fast-forward, freeze y mezcla inconsistente de metadata.

Invariantes que adoptaremos progresivamente:

- nunca aceptar metadata con versión menor a la ya aceptada;
- una versión concreta debe ser inmutable;
- metadata debe tener fecha de publicación y expiración;
- targets futuros deben incluir hash y tamaño;
- manifests de marketplace deberán firmarse server-side;
- nunca guardar claves privadas en GitHub Pages.

Fuentes:
- https://theupdateframework.io/docs/security/
- https://theupdateframework.io/docs/metadata/

### 2.3 Delta por archivo

Antes de chunking, la optimización más rentable es no volver a descargar miembros del pack cuyo descriptor y digest siguen válidos.

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

Red: solo C'
```

### 2.4 FastCDC / Content-Defined Chunking

Para archivos grandes, una actualización por archivo completo deja de ser suficiente. FastCDC encuentra límites de chunks a partir del contenido, por lo que pequeñas inserciones no desplazan todos los bloques posteriores.

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

Recomendación inicial:

- no usar CDC para archivos pequeños;
- evaluar desde ~512 KB en adelante;
- chunk medio inicial cercano a 64 KB;
- precomputar chunks al publicar/build-time;
- reconstruir y verificar SHA-256 final.

Fuentes:
- https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia
- https://github.com/google/cdc-file-transfer

### 2.5 OPFS para blobs grandes

MDN documenta OPFS como almacenamiento privado al origen optimizado para archivos y escrituras de alto rendimiento. Está pensado, entre otros casos, para apps con grandes cantidades de media y descargas parciales/reanudables.

Aplicación futura Kelo:

- IndexedDB continúa excelente para metadata, punteros y manifests;
- OPFS puede convertirse en tier opcional para blobs/chunks grandes;
- usar Web Worker cuando haya procesamiento intensivo;
- mantener fallback IndexedDB para compatibilidad.

Fuentes:
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
- https://developer.mozilla.org/en-US/docs/Web/API/File_System_API

### 2.6 Persistencia y cuotas

El almacenamiento web es best-effort por defecto. `navigator.storage.persist()` puede solicitar persistencia y `estimate()` permite medir uso/cuota, pero el navegador mantiene la decisión final.

Reglas Kelo:

- ownership cloud y cache local son conceptos distintos;
- el dispositivo debe poder reconstruir el cache;
- solicitar persistencia después de que exista valor local real;
- nunca considerar IndexedDB/OPFS como única prueba de compra.

Fuente:
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria

## 3. Rondas manuales ejecutadas — 2026-09-16

### Ronda 1 — CAS SHA-256 real

Problema detectado:

`personal-asset-vault.mjs` almacenaba blobs directamente por `asset.id`. Si dos assets/packs referenciaban exactamente los mismos bytes, podían existir copias duplicadas y no había base limpia para rollback.

Implementación:

- IndexedDB subió a schema interno v2;
- nuevo store `casBlobs`;
- nuevas descargas calculan SHA-256 antes de activar el puntero;
- `blobs` pasa a actuar como tabla de punteros para contenido nuevo;
- `getBlob()` sigue entendiendo filas legacy;
- migración progresiva disponible, sin migración destructiva en `onupgradeneeded`;
- metadata ahora conserva `sha256`, `expectedSha256` y más provenance/licensing.

Modelo actual:

```text
assets[id]
blobs[id] -> digest
casBlobs[digest] -> Blob
```

Esto introduce deduplicación física real para nuevas descargas.

### Ronda 2 — rollback + garbage collection con gracia

Problema detectado:

Un CAS sin política de historial/GC acumula blobs para siempre; borrarlos inmediatamente destruye rollback y causa thrashing.

Implementación:

- el puntero conserva `previousDigest` al cambiar de versión;
- `rollbackAssetBlob(id)` intercambia digest actual/anterior sin red;
- el manifest integrado se invalida después de rollback para impedir mezclar manifest nuevo con bytes viejos;
- `discardAssetRollbackHistory(id)` permite liberar explícitamente el historial;
- `garbageCollectCas()` usa mark + grace period;
- primera pasada marca `orphanedAt`;
- solo una pasada posterior, después de la gracia, puede borrar;
- blobs actuales y de rollback cuentan como referenciados.

Gracia por defecto actual: 7 días.

Objetivo: rollback barato + GC conservador.

### Ronda 3 — protección anti-rollback de catálogo

Problema detectado:

Aunque los blobs tenían hash, un cliente todavía podía recibir metadata de catálogo antigua o metadata modificada silenciosamente manteniendo el mismo número de versión.

Implementación:

- catálogo subió de versión 1 a 2;
- añade `publishedAt` y `expiresAt`;
- ContentPackManager guarda localmente la versión/digest aceptados;
- versión entrante menor => `PACK_CATALOG_ROLLBACK`;
- mismo número de versión con digest diferente => `PACK_CATALOG_MUTATED_WITHOUT_VERSION`;
- expiración se registra como `stale` de forma observacional por ahora;
- `getCatalogSecurityState()` expone el estado;
- `inspectContentPacks()` incluye seguridad del catálogo.

Esto es una adopción incremental de invariantes TUF, no una implementación completa de TUF.

## 4. Estado arquitectónico después de las rondas

```text
Remote metadata
      |
      v
Pack Catalog v2
  version/publishedAt/expiresAt
      |
      v
Delta Planner
 reuse / integrate / download / removed
      |
      v
Personal Vault
 asset metadata
      |
      v
Asset pointer
 current digest + previous digest
      |
      v
SHA-256 CAS
 unique immutable blobs
      |
      +--> runtime integration
      +--> rollback
      +--> grace-period GC
```

## 5. Métricas que deben evolucionar

Ya debemos medir o preparar:

- logical bytes;
- physical CAS bytes;
- deduplicated bytes;
- dedupe ratio;
- bytes estimados a descargar;
- bytes realmente descargados;
- bytes evitados;
- miembros reuse/download/integrate;
- cantidad de CAS blobs;
- pointers CAS vs legacy;
- rollback pointers;
- blobs huérfanos;
- bytes recuperados por GC;
- duración de hash/integración;
- storage usage/quota/persisted;
- catálogo aceptado/stale/version jump.

Métricas centrales:

```text
bandwidth_saved_ratio = 1 - downloaded_bytes / logical_update_bytes
storage_dedupe_ratio = 1 - physical_cas_bytes / logical_referenced_bytes
```

## 6. Próximos niveles investigados

### Nivel siguiente A — CAS transaccional por pack

Hoy cada asset puede conservar versión previa. El siguiente paso es elevar la atomicidad al pack completo:

```text
resolve
 -> stage all new blobs
 -> verify all
 -> integrate/stage manifests
 -> one logical commit of pack lock
 -> keep previous pack lock for rollback
```

Si el update falla antes del commit, la versión activa del pack no cambia.

### Nivel siguiente B — ref graph explícito

Actualmente las referencias se pueden reconstruir inspeccionando punteros/packs.

Futuro:

```text
refs[digest]
  activeAssets[]
  rollbackAssets[]
  packs[]
  chunks[]
```

No usar un simple refcount ciego si perdemos trazabilidad. Preferir grafo/referencias reconstruibles.

### Nivel siguiente C — OPFS tiering

Mover blobs suficientemente grandes a OPFS y dejar metadata/punteros en IndexedDB.

Condiciones:

- feature detection;
- fallback completo;
- migración progresiva;
- nunca bloquear el main thread;
- benchmark real en iPhone antes de activarlo por defecto.

### Nivel siguiente D — FastCDC build-time

El cliente no debería descubrir chunks costosos cada vez. Publisher/Gateway genera manifests de chunks; cliente solo consulta qué digests ya posee.

### Nivel siguiente E — metadata firmada

Marketplace real debe evolucionar de:

```text
version + digest local
```

a:

```text
root trust
snapshot
fresh timestamp
signed targets
expected digest + size
```

## 7. Riesgos abiertos

- Catalog anti-rollback sin firma aún confía en el origen HTTPS/GitHub Pages.
- Expiración se observa pero todavía no bloquea instalación; debe endurecerse cuando exista canal de refresh confiable.
- Fast-forward malicioso requiere firmas/roles para resolverse correctamente.
- CAS nuevo coexiste con blobs legacy hasta migración progresiva.
- GC todavía es local al Vault; pack rollback transaccional requiere historial del lock completo.
- archivos enormes siguen siendo delta por archivo hasta implementar chunks.
- OPFS es prometedor, pero debe probarse en Safari/iPhone real antes de mover almacenamiento crítico.

## 8. Orden de I+D actualizado

Alta prioridad:

1. Pack transaction + previous pack lock.
2. CAS audit/rebuild de referencias.
3. UI de rollback/auditoría/GC controlado.
4. manifest con digest + tamaño obligatorio para publicación Kelo.
5. OPFS benchmark/tiering para blobs grandes.

Media:

6. FastCDC publisher/build-time.
7. chunk CAS + Range delivery.
8. Asset Gateway/CDN.
9. metadata firmada estilo TUF.
10. mirrors y recuperación de proveedor.

Posterior:

11. telemetry agregada de dedupe/bandwidth;
12. prefetch adaptativo respetando red/batería;
13. peer-assisted delivery opcional y verificable.

## 9. Regla para futuras rondas autónomas

Cada ronda debe:

1. leer `investigacion.md` y `documentacion.md`;
2. inspeccionar implementación real antes de proponer;
3. investigar buenas prácticas actuales;
4. elegir una sola mejora de alto impacto y bajo riesgo;
5. integrar sobre el Vault/PackManager existente, nunca crear uno paralelo;
6. preservar mobile-first y carga bajo demanda;
7. actualizar estos dos documentos si cambia el contrato;
8. comprobar CI/Pages cuando sea posible.

## 10. Regla permanente

**La disponibilidad de contenido debe crecer mucho más rápido que los bytes descargados por jugador.**

Toda nueva función de BibliotecaTecnologia debe proteger esa propiedad.
