# BibliotecaTecnologia — Documentación técnica

> Fuente de verdad operativa de la Biblioteca Universal / Content Vault / Content Packs de Kelo World.
> Este documento solo cubre esta tecnología.
> Última revisión: 2026-09-16.

## 1. Qué es BibliotecaTecnologia

BibliotecaTecnologia es la capa de distribución, almacenamiento e integración de contenido de Kelo World.

Administra:

- imágenes;
- sprites;
- tilesets;
- animaciones;
- VFX;
- SFX;
- música;
- ambientes;
- habilidades declarativas;
- escenas/prefabs;
- packs compuestos por cualquiera de los anteriores.

Principio central:

```text
CATÁLOGO != DESCARGA != INTEGRACIÓN != CARGA EN RUNTIME
```

El catálogo puede crecer sin que ese crecimiento aumente automáticamente el peso del boot del juego.

## 2. Estados canónicos

### Contenido individual

```text
DISCOVERED
  -> OWNED/FREE
  -> DOWNLOADED
  -> INTEGRATED
  -> LOADED (runtime, cuando se necesita)
```

### Pack

```text
NOT_INSTALLED
  -> INSTALLING
  -> INSTALLED

si falla:
INSTALLING/UPDATING
  -> PARTIAL
  -> reintento
  -> INSTALLED

si se elimina:
INSTALLED
  -> REMOVED
```

## 3. Archivos principales

### Catálogos/proveedores

- `data/external-asset-providers.json`
- `data/opengameart-cc0-curated.json`
- `data/kelo-content-starter-catalog.json`
- `data/content-pack-catalog.json`
- `src/creators/assets/external-asset-providers.mjs`
- `src/creators/assets/kenney-live-provider.mjs`
- `src/creators/assets/lpc-live-provider.mjs`
- `src/creators/assets/opengameart-live-provider.mjs`
- `src/creators/assets/kelo-content-live-provider.mjs`

### Vault / integración

- `src/creators/assets/personal-asset-vault.mjs`
- `src/creators/assets/content-integration-router.mjs`
- `src/creators/assets/personal-asset-runtime-bridge.mjs`
- `src/creators/assets/personal-content-runtime-bridge.mjs`

### Packs

- `src/creators/assets/content-pack-manager.mjs`
- `content-packs.html`

### UI

- `asset-vault.html`
- `src/ui/asset-library-launcher.js`

## 4. Contrato de un asset externo

Forma conceptual:

```json
{
  "id": "provider:asset-id",
  "provider": "provider",
  "externalId": "asset-id",
  "name": "Nombre",
  "contentKind": "sprite",
  "category": "character",
  "downloadUrl": "https://...",
  "sourceUrl": "https://...",
  "license": "CC0",
  "author": "Autor",
  "bytesHint": 12345,
  "expectedSha256": "sha256:..."
}
```

`expectedSha256` puede estar ausente durante discovery, pero debe ser obligatorio para contenido publicado por Kelo/Marketplace en una fase de producción endurecida.

## 5. Contrato de un pack

Archivo fuente actual:

`data/content-pack-catalog.json`

Esquema:

```json
{
  "schema": "kelo-content-pack-catalog-v1",
  "version": 1,
  "packs": [
    {
      "id": "namespace:pack",
      "name": "Pack",
      "version": "1.0.0",
      "category": "audio",
      "dependencies": [],
      "members": [
        {
          "provider": "opengameart",
          "assetId": "opengameart:item",
          "sha256": "opcional-en-v1",
          "version": "opcional"
        }
      ]
    }
  ]
}
```

Reglas:

- ID estable.
- Versión semántica `major.minor.patch`.
- máximo actual: 64 miembros directos.
- sin miembros duplicados.
- dependencias no pueden formar ciclos.
- licencia se valida por miembro.
- el manifest no contiene binarios.

## 6. Locks locales

Cada pack instalado guarda estado en IndexedDB `kelo_content_pack_v1`.

Cada miembro termina con un lock parecido a:

```json
{
  "id": "opengameart:forest-ambience",
  "provider": "opengameart",
  "contentKind": "ambience",
  "bytes": 733900,
  "sha256": "sha256:<hash-real-de-los-bytes>",
  "expectedSha256": null,
  "descriptorHash": "<hash-de-la-definicion-del-miembro>",
  "integrated": true,
  "preexistingDownloaded": false,
  "version": "1.0.0"
}
```

### `sha256`

Identidad observada de los bytes descargados.

### `expectedSha256`

Identidad esperada publicada por catálogo. Si existe y no coincide con bytes reales, la instalación falla.

### `descriptorHash`

Fingerprint de metadata que afecta distribución/integración. Incluye actualmente:

- id/provider/externalId;
- contentKind;
- downloadUrl;
- sourceUrl;
- licencia/autor;
- digest esperado;
- bytesHint;
- loop;
- inlineManifest.

Sirve para saber antes de descargar si una definición cambió.

## 7. Actualización diferencial V1.5

API principal:

```js
await planContentPackUpdate(packId)
```

Produce un plan por miembro:

```text
reuse      -> ya existe y descriptor coincide
integrate  -> bytes existen, falta integración
download   -> falta archivo o descriptor/digest cambió
removed    -> existía en versión anterior y ya no está
```

### Algoritmo

1. Resolver manifest actual del pack.
2. Resolver metadata actual de proveedores.
3. Calcular `descriptorHash` de cada miembro.
4. Cargar locks de versión instalada.
5. Consultar estado local del asset/blob.
6. Comparar digest esperado y descriptor.
7. Construir plan.
8. Descargar únicamente acciones `download`.
9. Reutilizar acciones `reuse` sin red.
10. Integrar únicamente lo que lo necesite.
11. Tras completar la nueva versión, limpiar miembros retirados si no tienen otras referencias.
12. Guardar lock nuevo.

Ejemplo:

```text
Pack v1: A B C D E
Pack v2: A B C' D E

reuse: A B D E
download: C'

Red = solo C'
```

## 8. API pública de ContentPackManager

```js
CONTENT_PACK_MANAGER.loadPackCatalog()
CONTENT_PACK_MANAGER.listContentPacks()
CONTENT_PACK_MANAGER.getContentPack(id)
CONTENT_PACK_MANAGER.getPackState(id)
CONTENT_PACK_MANAGER.listPackStates()
CONTENT_PACK_MANAGER.inspectContentPacks()
CONTENT_PACK_MANAGER.planContentPackUpdate(id)
CONTENT_PACK_MANAGER.installContentPack(id, options)
CONTENT_PACK_MANAGER.auditContentPack(id, options)
CONTENT_PACK_MANAGER.removeContentPack(id, options)
CONTENT_PACK_MANAGER.getPackStorageHealth()
CONTENT_PACK_MANAGER.requestPersistentPackStorage()
CONTENT_PACK_MANAGER.clearPackCatalogCache()
```

## 9. Métricas delta guardadas

Después de una instalación/update:

```json
{
  "delta": {
    "changedMembers": 2,
    "reusedMembers": 38,
    "removedMembers": 0,
    "estimatedDownloadBytes": 210000,
    "estimatedSavedBytes": 8400000,
    "downloadedBytes": 205442
  }
}
```

Esto permitirá medir ahorro real de ancho de banda.

## 10. Integración por tipo

### Visual

Tipos:

- image
- sprite
- tileset
- animation
- vfx

Ruta:

```text
Blob
 -> content-integration-router
 -> asset-sheet-compiler
 -> manifest visual
 -> personal asset runtime bridge
 -> canonical atlas/property catalog
```

### Audio

Tipos:

- sfx
- music
- ambience

Ruta:

```text
Blob
 -> audio manifest
 -> personal content runtime bridge
 -> Audio() bajo demanda
```

`preload = none`.

### Ability

Solo JSON declarativo.

```text
JSON
 -> validator
 -> personal ability manifest
 -> KeloAbilities.engine.castSource()
```

Nunca ejecutar JS externo.

### Scene / Prefab

```text
JSON
 -> studio-prefab-validator
 -> prefabDefinition
 -> personal scene registry
 -> Studio prefabStamp
```

## 11. Instalación reanudable

Si la instalación falla:

```text
status = partial
completedMembers = N
members = locks ya completados
error = motivo
```

En el siguiente intento, el planner vuelve a inspeccionar qué bytes siguen válidos y puede reutilizarlos.

No asumir que `completedMembers` por sí solo hace resume; la fuente de verdad son los assets/blobs/locks existentes.

## 12. Desinstalación segura

Un miembro solo puede borrarse físicamente si:

1. no lo necesita otro pack instalado;
2. no existía localmente antes de que el pack lo incorporara.

Esta regla evita destruir contenido adquirido/descargado individualmente.

## 13. Auditoría de integridad

API:

```js
await auditContentPack(packId, {rehash:true})
```

Para cada miembro:

- comprueba que existe blob;
- recalcula SHA-256;
- compara contra lock guardado;
- devuelve `digest-mismatch` si cambió.

Esto es auditoría local. Para autenticidad de publisher necesitamos firma de metadata en la fase CAS/Marketplace.

## 14. Storage Health

```js
await getPackStorageHealth()
```

Devuelve:

```json
{
  "supported": true,
  "usage": 1000000,
  "quota": 500000000,
  "free": 499000000,
  "persisted": false
}
```

Para solicitar persistencia:

```js
await requestPersistentPackStorage()
```

Nunca asumir que `persist()` será concedido.

## 15. Seguridad

Invariantes actuales:

- licencia se valida antes de download/integration;
- JSON de habilidad/escena no puede introducir JS ejecutable;
- tipos/delivery/effects pasan whitelist;
- binarios descargados obtienen SHA-256;
- `expectedSha256` se verifica cuando existe;
- providers están aislados: fallo de uno no debe tumbar toda la biblioteca;
- contenido externo no entra al boot automáticamente.

No poner secretos, tokens privados o claves de firma en GitHub Pages.

## 16. Limitaciones conocidas

### 16.1 Todavía no es CAS puro

`personal-asset-vault.mjs` almacena blobs principalmente usando `asset.id` como key. Por eso todavía no tenemos rollback barato ni varias versiones del mismo asset coexistiendo por digest.

### 16.2 Delta actual es por miembro

Si un único archivo de 200 MB cambia 1 MB, V1.5 todavía descargaría ese archivo entero.

Solución futura: FastCDC/chunk manifests.

### 16.3 Proveedor sin digest

Si un tercero cambia bytes manteniendo exactamente la misma URL/metadata, el planner no puede saberlo sin hacer red. Producción debe pinnear digests.

### 16.4 Atomicidad

El estado del pack se conmuta al final, pero el Vault V1 puede reemplazar un blob por assetId durante update. Rollback fuerte requiere CAS V2.

## 17. Arquitectura objetivo CAS V2

```text
Catalog
  |
  v
Pack Manifest (signed)
  |
  +--> descriptor asset A --> sha256:A
  +--> descriptor asset B --> sha256:B
  +--> file manifest C
          +--> chunk sha256:C1
          +--> chunk sha256:C2
          +--> chunk sha256:C3

Local CAS
  blobs/sha256/*
  manifests/*
  refs/*
  packLocks/*
```

Update:

```text
resolve -> diff graph -> download missing blobs/chunks -> verify -> stage -> atomic pointer swap -> GC later
```

## 18. Política de garbage collection futura

No borrar inmediatamente un blob cuando baja su refcount.

Propuesta:

```text
refcount == 0
 -> orphanedAt = now
 -> grace period
 -> GC cuando storage pressure / mantenimiento
```

Esto permite rollback rápido y evita thrashing instalar/quitar/reinstalar.

## 19. Política de versiones

### Pack

SemVer.

- PATCH: fixes/metadata compatible.
- MINOR: miembros/features nuevos compatibles.
- MAJOR: cambio incompatible del pack/contrato.

### Schema

El schema debe versionarse independientemente:

```text
kelo-content-pack-catalog-v1
kelo-content-pack-lock-v1 (futuro formal)
kelo-content-file-manifest-v1 (futuro)
```

No romper lectores viejos sin migración explícita.

## 20. Regla para futuros agentes/IA

Antes de modificar BibliotecaTecnologia:

1. leer `bibliotecaTecnologia/documentacion.md`;
2. leer `bibliotecaTecnologia/investigacion.md` si la tarea cambia arquitectura/distribución;
3. integrar, no crear un segundo Vault/catalog/pack manager paralelo;
4. mantener mobile-first;
5. mantener `metadata-only until explicit action`;
6. medir bytes evitados además de bytes descargados;
7. no introducir código ejecutable externo;
8. actualizar estos dos documentos si cambia el contrato de esta tecnología.

## 21. Definition of Done para cambios de BibliotecaTecnologia

Un cambio no está terminado hasta comprobar:

- sintaxis/build;
- boot normal no descarga contenido externo;
- una instalación nueva funciona;
- una reinstalación sin cambios no vuelve a descargar bytes;
- un update con un miembro cambiado solo descarga ese miembro;
- un fallo queda reanudable;
- un pack compartido no destruye blobs usados por otro pack;
- auditoría SHA-256 funciona;
- Pages/CI no muestran regresión relevante.

## 22. Regla permanente

**El número de contenidos disponibles y el peso descargado por un jugador deben estar desacoplados.**

El sistema debe poder pasar de miles a millones de contenidos sin convertir el arranque de Kelo World en una descarga masiva.
