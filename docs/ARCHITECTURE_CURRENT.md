# Kelo World — Architecture Current

**Actualizado:** 2026-09-15 · Runtime V6.69 · Evergreen migration active

## Capas

### 1. Boot / Account
`index.html` → estado persistido normalizado → legacy engine bootstrap → owners Foundation → primer frame → módulos internos after-paint → módulos first-use.

`src/core/state-store-bootstrap.js` corre **antes de `engine-a.js`**. Su función es compatibilidad: versiona/normaliza el save `kelo_world_state_v2_1`, preserva campos desconocidos y crea backup antes de una migración. No posee gameplay todavía.

El boot crítico solo conserva autoridades necesarias para dibujar, caminar y mantener los contratos Foundation. `controlPlane` y `observability` ya no bloquean el primer paint: `KeloModuleLoader` los carga con policy `after-paint` después de cruzar dos frames. El presupuesto CI actual es ≤49 scripts externos críticos y ≤3 scripts externos estáticos después de `kelo:boot-ready`.

### 2. Foundation Core
`src/core/` posee eventos, input locks, input, movement extension, player transition position, camera, avatar composition, render/simulation extension, feature lifecycle, update boundaries y fronteras de migración legacy.

Los comandos discontinuos de viaje legacy `teleportToPlot` / `teleportToFarm` están estrangulados temporalmente por `KeloLegacyTransitionBridge` y pasan por `KeloPlayerPosition` + `KeloCamera`. Movimiento continuo sigue legacy hasta completar paridad/QA.

`KELO_FEATURE_REGISTRY` es la fuente única de metadata/policy de features. `KELO_ASSET_REGISTRY` solo expone paquetes que el usuario puede activar/desactivar. Features internas como `controlPlane` y `observability` usan `userToggle:false` y siguen siendo responsabilidad del lifecycle, no de la biblioteca de assets.

### 3. Legacy Core
`engine-a.js`, `engine-b.js` y `engine-c.js` todavía contienen estado/física/UI/render/gameplay histórico. No reciben capacidades nuevas cuando existe owner moderno. `engine-i.js` fue retirado porque estaba vacío y ya no tenía razón para existir en el runtime.

Objetivo de retirada por responsabilidad:

`IDENTIFICAR → SHADOW/ADAPTER → MIGRAR CONSUMIDORES → TEST → LIVE → 0 USO LEGACY → DEAD → RETIRAR`

Nunca `BORRAR → arreglar lo que rompa`.

### 4. World / Environment
`src/environment/` posee terrain contract, atlases, world map, layer stack, surface ground, prop contract, prefab contract, district visuals y World Builder support.

### 5. Asset Infrastructure
`KELO_ATLAS_CONTRACT` resuelve atlas; `KELO_PROPERTY_CATALOG` expone templates placeables. Compilers producen metadata, no renderers.

### 6. Studio / Creators
`src/studio/` contiene document/kernel/tools/UI. `src/creators/` contiene workspaces, Map Forge, asset compiler y evolución. Todos delegan mutations a owners existentes.

### 7. Gameplay Domains
Abilities, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo.

### 9. Build / QA
El toolchain de cliente usa Node 22 y `package-lock.json`; dependencias de producción/build deben instalarse con `npm ci`. El servidor conserva su runtime Node 24 y su propio lockfile.

La migración evergreen está protegida por `.github/workflows/evergreen-foundation.yml`, que ejecuta como mínimo:

- characterization tests del state migrator;
- ownership de caches del Service Worker;
- contrato del legacy transition bridge;
- reproducible build audit;
- lightweight boot surface audit;
- Foundation architecture audit;
- orden estático de boot;
- build de producción del cliente + Turbo audit;
- smoke del servidor real;
- WebKit móvil sobre el commit del PR.

`boot-surface-audit.mjs` impide que control plane, updater, shadows o engines retirados vuelvan accidentalmente al parser-blocking boot. Una subida del presupuesto crítico debe ser deliberada y respaldada por evidencia.

Dependabot propone actualizaciones de npm y GitHub Actions por PR; una actualización de dependencia nunca se considera segura solo porque sea nueva.

## Flujo de asset moderno

`PNG/JPEG/WebP → foreground analysis → asset sheet compiler → sourceRects irregulares → manifest → atlas → semantic catalog → Studio palette → placement`

Forest Plaza es el caso de referencia actual: 146 piezas, IDs legacy preservados, nombres semánticos y 7 carpetas visuales.

## Fronteras obligatorias

- persistencia legacy pasa por `KeloStateStore` antes del boot;
- teleports/restores nuevos solo vía `KeloPlayerPosition`;
- cámara solo vía `KeloCamera`;
- colisiones solo vía `KELO_COLLISION`;
- render feature vía `KeloRender`/contratos de environment;
- lifecycle lazy/after-paint solo vía `KeloModuleLoader` + `KELO_FEATURE_REGISTRY`;
- templates vía `KELO_PROPERTY_CATALOG`;
- World changes vía Studio/`KELO_WORLD_EDIT`;
- assets importados no inventan un renderer;
- UI no se convierte en autoridad gameplay;
- cliente no se convierte en autoridad final online.

## PWA / actualización

El Service Worker ya no puede borrar Cache Storage indiscriminadamente. Solo limpia caches del namespace Kelo que no estén en el keep-list de assets, metadata y stages activos. `skipWaiting`/`clients.claim` siguen siendo transición sensible y no se retiran hasta tener un test completo de actualización staged→health→activate.

El código pesado del updater ya no pertenece al camino del primer paint; su gate se carga dentro del `controlPlane` interno después del primer frame.

## Móvil

El editor se abre con chrome-first y prewarm/boot por etapas. Evitar canvas/blur/import masivo simultáneo en iPhone. La verificación final de World móvil es dispositivo real + LIVE; WebKit branch-local es un gate previo, no sustituto del dispositivo físico.
