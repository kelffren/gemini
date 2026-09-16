# BibliotecaTecnologia — Investigación

> Documento exclusivo de la tecnología de Biblioteca Universal / Content Vault / Content Packs de Kelo World.
> Última revisión: 2026-09-16.

## 1. Objetivo

Construir una plataforma de distribución de contenido para Kelo World capaz de manejar sprites, tilesets, animaciones, VFX, SFX, música, ambiente, habilidades declarativas, escenas y packs completos sin convertir el bundle principal del juego en un paquete gigante.

La meta técnica no es solamente una "biblioteca de assets". Es un sistema de distribución de contenido con estas propiedades:

- metadata liviana en el catálogo;
- descarga explícita y bajo demanda;
- almacenamiento personal local/cloud;
- verificación criptográfica;
- integración por tipo de contenido;
- actualización diferencial;
- reanudación tras cortes;
- deduplicación entre packs;
- rollback seguro en una fase posterior;
- soporte futuro para marketplace y creadores.

## 2. Investigación externa

### 2.1 OCI: blobs direccionados por contenido

La especificación OCI Distribution define `blob`, `manifest`, `descriptor` y `digest` como piezas separadas. El descriptor contiene el tipo del contenido, su digest criptográfico y su tamaño. El cliente puede pedir exactamente un blob por digest y verificar que los bytes recibidos correspondan al digest solicitado.

Aplicación a Kelo:

- un asset debe evolucionar de `assetId -> blob` a `assetId -> descriptor -> blob sha256`;
- dos packs que usan exactamente los mismos bytes pueden referenciar el mismo blob;
- el blob no necesita saber quién lo usa;
- un manifest de pack debe ser pequeño y apuntar a contenido inmutable.

Fuente: https://github.com/opencontainers/image-spec/blob/main/descriptor.md
Fuente: https://github.com/opencontainers/distribution-spec/blob/main/spec.md

### 2.2 Merkle DAG / manifests

OCI modela componentes como un grafo direccionado por contenido. Esto es especialmente útil para Kelo porque un pack puede apuntar a otros packs, manifests o blobs sin duplicarlos.

Aplicación a Kelo:

```text
Pack Manifest
  -> Ability Manifest
  -> Scene Manifest
  -> Audio Blob sha256:A
  -> Sprite Blob sha256:B
  -> Dependency Pack Manifest
```

Si `sha256:B` ya existe en el dispositivo, no se descarga de nuevo.

Fuente: https://github.com/opencontainers/image-spec/blob/main/descriptor.md

### 2.3 TUF: seguridad de actualizaciones

The Update Framework documenta ataques que un updater serio debe considerar: rollback a una versión vieja, fast-forward malicioso y freeze/metadata estancada.

Aplicación a Kelo Marketplace futuro:

- versión monotónica de metadata;
- timestamp/expiración del catálogo;
- snapshot de manifests;
- firma de manifests publicados;
- nunca aceptar silenciosamente un catálogo con versión inferior a la ya conocida;
- separar claves de publicación de las de administración.

No se implementará una copia completa de TUF dentro del cliente ahora; se adoptarán progresivamente sus invariantes.

Fuente: https://theupdateframework.io/docs/security/

### 2.4 rsync: transferir solo diferencias

El algoritmo rsync usa un checksum rodante para identificar bloques que ya existen y enviar solamente partes nuevas. Su principio principal sigue siendo válido: evitar retransmitir bytes que el cliente ya posee.

Aplicación a Kelo:

- Nivel actual: delta por archivo/miembro del pack;
- siguiente nivel: delta por chunk dentro de archivos grandes;
- nunca usar chunking para archivos diminutos donde la metadata costaría más que la descarga.

Fuente: https://rsync.samba.org/tech_report/

### 2.5 FastCDC: chunking definido por contenido

FastCDC mejora Content-Defined Chunking para encontrar límites de chunks a partir del contenido. A diferencia de cortar siempre cada N KB, una inserción de bytes no desplaza necesariamente todos los chunks siguientes. Esto mejora la deduplicación entre versiones parecidas.

El paper reporta mayor velocidad que enfoques Rabin tradicionales manteniendo una deduplicación similar.

Aplicación futura recomendada:

- archivos > 512 KB: evaluar CDC;
- objetivo inicial aproximado de chunk medio: 64 KB;
- cada chunk obtiene SHA-256;
- manifest del archivo = lista ordenada de digests de chunks;
- solo descargar chunks ausentes;
- reconstruir archivo y verificar SHA-256 final.

No implementar FastCDC en el hilo principal del iPhone. Debe ejecutarse al publicar/build-time o en Worker cuando sea estrictamente necesario.

Fuente: https://www.usenix.org/conference/atc16/technical-sessions/presentation/xia

### 2.6 Courgette / bsdiff: parches especializados

Chromium documentó que un diff consciente de la estructura del contenido puede ser mucho menor que un diff binario genérico. Esto demuestra que no existe un único algoritmo óptimo para todos los tipos de archivo.

Aplicación a Kelo:

- PNG/WebP/audio: preferir blobs/chunks inmutables antes que aplicar parches complejos en el teléfono;
- JSON/manifests: son pequeños, descargar completos;
- bundles binarios grandes futuros: evaluar bsdiff/CDC en servidor;
- jamás ejecutar parches no verificados: reconstruir y validar hash final.

Fuente: https://new.chromium.org/developers/design-documents/software-updates-courgette/

### 2.7 Almacenamiento web e iPhone

IndexedDB y Cache Storage dependen de cuotas/evicción del navegador. `navigator.storage.estimate()` permite medir uso/cuota y `navigator.storage.persist()` puede solicitar almacenamiento persistente, aunque el navegador decide si lo concede.

Aplicación a Kelo:

- mostrar uso real del Baúl;
- solicitar persistencia después de que el usuario instale contenido importante, no al primer arranque;
- capturar `QuotaExceededError`;
- mantener ownership cloud separado del cache local;
- asumir que el cache local puede desaparecer y debe ser reconstruible.

Fuentes:
- https://developer.mozilla.org/en-US/docs/Web/API/Storage_API/Storage_quotas_and_eviction_criteria
- https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist

## 3. Arquitectura recomendada por niveles

### Nivel 1 — Implementado: delta por miembro

Cada miembro tiene un `descriptorHash`. Antes de actualizar:

1. resolver manifest actual;
2. comparar descriptor deseado con lock local;
3. clasificar `reuse`, `integrate` o `download`;
4. descargar solo `download`;
5. conservar `reuse` sin red;
6. limpiar miembros retirados solo si ningún otro pack los usa.

Esto resuelve el caso "pack de 40 archivos, cambiaron 2 -> bajar 2" siempre que el descriptor de esos 2 cambie o exista un digest esperado nuevo.

### Nivel 2 — Siguiente prioridad: Content Addressable Store V2

Crear un store global:

```text
blobs/sha256/<digest>
descriptors/<assetId>
packLocks/<packId>
refs/<digest> -> refcount
```

Ventajas:

- dedupe real entre cualquier pack;
- rollback barato;
- no sobrescribir la versión anterior mientras se instala la nueva;
- garbage collection por referencias;
- instalación atómica: cambiar un puntero al manifest nuevo al final.

### Nivel 3 — Chunk Store

Para binarios grandes:

```text
file manifest
  finalDigest
  totalSize
  chunks[]
    offset
    size
    digest
```

El cliente consulta chunks existentes y descarga únicamente faltantes.

### Nivel 4 — Metadata firmada

Modelo inspirado en TUF:

```text
root.json
snapshot.json
timestamp.json
targets/*.json
```

Para Kelo puede simplificarse inicialmente a:

- `catalogVersion` monotónico;
- `publishedAt`;
- `expiresAt`;
- `manifestDigest`;
- firma Ed25519 realizada server-side;
- claves públicas empotradas en cliente.

### Nivel 5 — Asset Gateway / CDN

No depender directamente de CORS, velocidad o permanencia de terceros.

El gateway debe:

- importar una vez desde la fuente original;
- validar licencia;
- calcular hash;
- generar previews;
- opcionalmente transcodificar;
- servir Range requests;
- cachear CDN;
- producir manifests Kelo inmutables.

El archivo original y su procedencia/licencia siguen registrados.

## 4. Decisiones para Kelo

### Mantener SHA-256 ahora

Razones:

- Web Crypto lo soporta ampliamente;
- OCI lo recomienda ampliamente;
- suficiente para identidad/integridad del contenido;
- cambiar a BLAKE3 ahora añadiría dependencia/WASM sin resolver un problema prioritario.

### Descriptor hash != digest de bytes

Son conceptos distintos:

- `descriptorHash`: detecta cambios en la definición de un miembro antes de descargar;
- `sha256` del blob: confirma identidad de bytes después de descargarlos;
- `expectedSha256`: permite confirmar identidad antes/después contra un digest publicado.

Para máxima seguridad el catálogo de producción debe incluir `expectedSha256` en todos los miembros publicados.

### No usar patches binarios en todo

Orden de preferencia:

1. reusar blob completo si digest coincide;
2. descargar archivo completo si es pequeño;
3. usar chunks para archivo grande;
4. usar patch binario especializado solo cuando datos reales demuestren beneficio.

## 5. Riesgos técnicos detectados

- Proveedores externos pueden cambiar bytes manteniendo la misma URL. Sin digest publicado no se puede detectar el cambio sin volver a descargar.
- IndexedDB en móvil es cache, no debe ser la única prueba de propiedad.
- Un update verdaderamente atómico requiere CAS V2; el vault actual todavía guarda blobs principalmente por `asset.id`.
- Audio/PNG comprimidos pueden obtener poco beneficio de bsdiff; medir antes de añadir complejidad.
- Content-defined chunking en el teléfono puede gastar CPU/batería; preferir manifests precomputados.
- Marketplace necesita firma server-side; nunca guardar claves privadas de publicación en GitHub Pages.

## 6. Métricas que debemos empezar a guardar

Por instalación/update:

- bytes totales lógicos del pack;
- bytes realmente descargados;
- bytes evitados por reuse;
- miembros reutilizados;
- miembros cambiados;
- chunks reutilizados cuando exista CDC;
- duración de descarga;
- duración de hash;
- duración de integración;
- errores por proveedor;
- tasa de reanudación exitosa;
- almacenamiento utilizado/cuota;
- dedupe ratio.

Métrica principal futura:

```text
bandwidth_saved_ratio = 1 - downloaded_bytes / logical_pack_bytes
```

## 7. Roadmap de I+D

Prioridad alta:

1. Content Addressable Store V2.
2. Manifest con digest obligatorio para publicación Kelo/Marketplace.
3. actualización atómica + rollback.
4. GC por referencias.
5. storage health + persist UX.

Prioridad media:

6. FastCDC build-time para archivos grandes.
7. chunk store y Range delivery.
8. Asset Gateway/CDN.
9. firma de manifests y protección rollback/freeze.

Prioridad posterior:

10. mirrors múltiples;
11. peer-assisted delivery opcional;
12. telemetry agregada de ahorro de ancho de banda;
13. prefetch predictivo únicamente con consentimiento/política de red.

## 8. Regla de diseño permanente

**La Biblioteca nunca debe hacer más pesado el boot principal por el simple hecho de que exista más contenido en el catálogo.**

Agregar 1 millón de assets debe aumentar principalmente metadata/search del backend, no los MB descargados al jugador.
