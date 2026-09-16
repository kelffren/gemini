# Community Asset Streaming — Kelo World

**Estado:** CLIENT/RUNTIME LIVE PREPARED · REMOTE STORAGE PENDING
**Owner:** Kelo Community Asset Pipeline
**Fecha:** 2026-09-16

## Objetivo

Permitir que cualquier jugador pueda crear/equipar assets comunitarios sin incluir toda la biblioteca dentro del build del juego y sin requerir aprobación humana para cada PNG/WebP/JPEG seguro.

## Regla principal

Los assets comunitarios no forman parte del bundle base de Kelo World.

El mundo transmite referencias/manifiestos pequeños. El teléfono descarga el archivo visual únicamente cuando necesita mostrarlo, lo verifica, lo cachea localmente y lo libera de memoria cuando deja de ser relevante.

```text
Creator
  -> Automatic Safety/Format Gate
  -> Remote Asset Storage + Manifest Catalog
  -> Player equips manifest/id
  -> Existing server AOI exposes relevant player state only
  -> Client proximity/visibility request
  -> Dynamic Asset Stream Manager
  -> SHA/size/MIME verification
  -> Cache Storage + memory object URL
  -> Avatar/renderer owner consumes asset
  -> Garbage collector
```

## Implementación actual

### Publicación

- `creator-publish.html`
- `src/creators/assets/community-asset-policy.mjs`
- `src/creators/assets/community-asset-publisher.mjs`

Auto-publicación cliente permitida inicialmente:

- `image/png`
- `image/webp`
- `image/jpeg`

Revisión manual:

- `image/gif`

Bloqueados para auto-publicación:

- SVG
- HTML
- JavaScript
- cualquier MIME desconocido/no permitido

Gates iniciales:

- máximo 8 MiB;
- máximo 4096x4096;
- máximo 16,777,216 píxeles;
- decodificación de imagen obligatoria;
- SHA-256 cuando Web Crypto está disponible;
- metadata acotada y normalizada.

**Importante:** estos checks del navegador son UX, no autoridad. El backend debe repetir MIME sniffing, límites, hash, ownership/auth, rate limiting, malware/content gates y reglas de publicación.

### Streaming

- `src/creators/assets/dynamic-asset-streaming.mjs`
- `src/creators/assets/community-asset-runtime.mjs`
- lazy gate: `src/ui/asset-library-launcher.js`

Prioridad actual:

| Contexto | Prioridad |
|---|---:|
| perfil abierto | 100 |
| visible y <=8 unidades | 90 |
| visible | 75 |
| <=24 unidades | 35 |
| fuera de relevancia | 0 / no descarga |

Características:

- deduplicación de descargas en vuelo;
- concurrencia acotada (3 por defecto);
- Cache Storage persistente;
- working set de caché objetivo 128 MiB;
- verificación bytes/MIME/SHA antes de usar;
- object URLs solo para assets activos;
- garbage collection de memoria;
- trimming LRU aproximado de caché persistente;
- `credentials: omit` para descargas públicas;
- CORS requerido en el storage/CDN.

## Integración con el boot

No se añade el motor de streaming al boot pesado de plaza.

`asset-library-launcher.js` ya forma parte del post-boot. Mantiene un listener pequeño. Al recibir por primera vez `kelo:community-player-assets`, importa `community-asset-runtime.mjs` dinámicamente y reenvía el evento. Así el runtime comunitario cuesta 0 descargas adicionales mientras ningún asset comunitario sea necesario.

El menú principal también expone `Crear / Publicar`, que abre `creator-publish.html`.

## Eventos cliente

### Entrada

```js
window.dispatchEvent(new CustomEvent('kelo:community-player-assets', {
  detail: {
    playerId: 'p123',
    visible: true,
    distance: 6,
    profileOpen: false,
    assets: [manifestA, manifestB]
  }
}));
```

### Salida lista para render

```text
kelo:community-player-assets-ready
```

Detalle:

```js
{ playerId, assets }
```

Cada asset incluye el `manifest`, `blob`, `objectUrl`, `source` (`network` o `cache`) y key versionada.

### Jugador fuera

```text
kelo:community-player-left
```

Esto quita el pin de memoria; el GC puede liberar después el object URL.

## Backend/Storage — pendiente real

GitHub Pages no puede ser el storage de uploads comunitarios dinámicos.

`community-asset-publisher.mjs` usa un contrato de transporte explícito:

```js
window.KELO_COMMUNITY_ASSET_TRANSPORT = {
  async uploadAsset({ file, validation, creatorId }) {
    // -> { url, assetId, version }
  },
  async publishManifest(manifest) {
    // persistir catálogo
  },
  async queueForReview({ file, validation, creatorId }) {
    // opcional para GIF/futuros formatos
  }
};
```

Hasta que exista un storage/API configurado, `creator-publish.html` valida y previsualiza, pero informa claramente que el backend comunitario no está conectado. No debe fingir publicación multi-dispositivo.

## Integración server AOI

El servidor Kelo actual ya posee AOI espacial y solo serializa jugadores relevantes al viewer. La integración final debe reutilizar ese AOI y añadir referencias de assets/manifiestos al estado del jugador; **no crear otro proximity server ni otro broadcast global**.

Preferencia de red:

1. server guarda/valida IDs de assets equipados;
2. `serializePlayer` envía IDs/versiones, no bytes;
3. cliente resuelve manifest desde catálogo;
4. Dynamic Asset Stream Manager descarga el archivo desde CDN;
5. renderer recibe object URL después de validación.

## Invariantes

- Nunca meter la biblioteca comunitaria completa en `assets/` ni precargarla.
- Nunca ejecutar código de un asset comunitario.
- Nunca usar SVG/HTML/JS como auto-publicación abierta.
- Nunca confiar en validación cliente como seguridad.
- Nunca descargar assets de jugadores fuera del AOI/visibilidad útil.
- Nunca crear un segundo renderer o game loop para esta feature.
- Nunca bloquear la plaza esperando community assets; usar placeholders/base avatar hasta que estén listos.
- Cache miss o asset inválido debe degradar visualmente, no romper gameplay.
- Gameplay/PvP/colisión no puede depender de un cosmético remoto.

## Próximo gate para LIVE multiusuario

Conectar almacenamiento remoto + catálogo persistente + autenticación/ownership. Después conectar IDs equipados al estado AOI del servidor y al owner de avatar/render existente.
