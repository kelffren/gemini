# Kelo World — Architecture Current

**Actualizado:** 2026-09-16 · Runtime V6.69 · Evergreen migration active

## Capas

### 1. Boot / Account
`index.html` → estado persistido normalizado → legacy engine bootstrap → owners Foundation → primer frame → módulos internos after-paint → módulos first-use.

`src/core/state-store-bootstrap.js` corre **antes de `engine-a.js`**. Su función es compatibilidad: versiona/normaliza el save `kelo_world_state_v2_1`, preserva campos desconocidos y crea backup antes de una migración. No posee gameplay todavía.

El boot crítico solo conserva autoridades necesarias para dibujar, caminar y mantener los contratos Foundation. `controlPlane` y `observability` ya no bloquean el primer paint: `KeloModuleLoader` los carga con policy `after-paint` después de cruzar dos frames.

Contrato CI medido:

- **48/48** scripts externos críticos antes de `kelo:boot-ready`;
- **422,634 / 425,000 bytes** fuente críticos;
- **3/3** scripts externos estáticos después de boot-ready;
- **21,342 / 22,000 bytes** post-boot estáticos;
- **9** módulos internos diferidos `after-paint`.

Los límites son guardrails: crecer exige evidencia y cambio explícito del contrato.

### 2. Foundation Core
`src/core/` posee eventos, input locks, input, movement extension, player transition position, camera, avatar composition, render/simulation extension, feature lifecycle, update boundaries y fronteras de migración legacy.

Los comandos discontinuos de viaje legacy `teleportToPlot` / `teleportToFarm` están estrangulados temporalmente por `KeloLegacyTransitionBridge` y pasan por `KeloPlayerPosition` + `KeloCamera`. Movimiento continuo sigue legacy hasta completar paridad/QA.

`KeloAbilityAim` es el strangler temporal de aim/input legacy. Posee una sola lifecycle de puntero, matemática/range, indicador de render y un registry explícito de cast middleware. `engine-l` registra la presentación de cast de Plaza en boot; `engine-m` no se carga en el primer frame y registra `engine-m:skill-shots` únicamente cuando el pack `world` entra por first-use.

`KELO_FEATURE_REGISTRY` es la fuente única de metadata/policy de features. `KELO_ASSET_REGISTRY` solo expone paquetes que el usuario puede activar/desactivar. Features internas como `controlPlane` y `observability` usan `userToggle:false` y siguen siendo responsabilidad del lifecycle, no de la biblioteca de assets.

### 3. Legacy Core
El índice de producción conserva actualmente **9 engines legacy críticos**: `engine-a.js`, `engine-b.js`, `engine-c.js`, `engine-d.js`, `engine-e.js`, `engine-f.js`, `engine-g.js`, `engine-h.js` y `engine-l.js`.

`engine-i.js`, `engine-j.js` y `engine-k.js` están **RETIRED**. El boot audit escanea runtime/tests para impedir que reaparezcan referencias válidas a esos archivos.

El debt audit actual cuenta **28 writes directos de posición** y **12 writes directos de cámara** en el índice estático de producción. `engine-f/g` contienen 10 de los writes de posición y son un siguiente objetivo de caracterización/migración; no se borran ni reescriben a ciegas.

Objetivo de retirada por responsabilidad:

`IDENTIFICAR → SHADOW/ADAPTER → MIGRAR CONSUMIDORES → TEST → LIVE → 0 USO LEGACY → DEAD → RETIRAR`

Nunca `BORRAR → arreglar lo que rompa`.

### 4. World / Environment
`src/environment/` posee terrain contract, atlases, world map, layer stack, surface ground, prop contract, prefab contract, district visuals y World Builder support.

`world` es first-use. El smoke del branch comprueba explícitamente que `engine-m.js` y su middleware no están presentes en el boot inicial y que aparecen después de `KELO_MODULE_LOADER.ensure('world')`. Esto protege simultáneamente first paint y funcionalidad.

### 5. Asset Infrastructure
`KELO_ATLAS_CONTRACT` resuelve atlas; `KELO_PROPERTY_CATALOG` expone templates placeables. Compilers producen metadata, no renderers.

### 6. Studio / Creators
`src/studio/` contiene document/kernel/tools/UI. `src/creators/` contiene workspaces, Map Forge, asset compiler y evolución. Todos delegan mutations a owners existentes.

### 7. Gameplay Domains
Abilities modernas, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados. La compatibilidad de aim/cast legacy vive temporalmente detrás de `KeloAbilityAim`; no se crea un segundo ability engine.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo.

### 9. Build / QA
El toolchain de cliente usa Node 22 y `package-lock.json`; dependencias de producción/build deben instalarse con `npm ci`. El servidor conserva su runtime Node 24 y su propio lockfile.

La migración evergreen está protegida por `.github/workflows/evergreen-foundation.yml`, que ejecuta como mínimo:

- characterization tests del state migrator;
- ownership de caches del Service Worker;
- contrato del legacy transition bridge;
- paridad de ability aim;
- ownership del pointer lifecycle;
- contrato del cast middleware;
- reproducible build audit;
- CI supply-chain audit;
- lightweight boot surface audit con presupuestos de count + bytes;
- legacy debt report;
- Foundation architecture audit;
- orden estático de boot;
- build de producción del cliente + Turbo audit;
- smoke del servidor real;
- WebKit móvil sobre el commit del PR.

`boot-surface-audit.mjs` impide que control plane, updater, shadows, `engine-m` o engines retirados vuelvan accidentalmente al parser-blocking boot. Una subida del presupuesto crítico debe ser deliberada y respaldada por evidencia.

Los workflows activos fijan acciones externas por SHA exacto. `ci-supply-chain-audit.mjs` falla ante acciones externas sin pin SHA y ante `permissions: write-all`. Dependabot propone actualizaciones de npm y GitHub Actions por PR; una actualización nunca se considera segura solo porque sea nueva.

El head `eb4c3e56f0e1d8a0b56fa4d13c691b9fc44918a5` pasó los cuatro gates del Evergreen Foundation Guard: `foundation`, `client-build`, `server-smoke` y `webkit-mobile-smoke`. Eso es evidencia branch-local, no QA físico.

## Flujo de asset moderno

`PNG/JPEG/WebP → foreground analysis → asset sheet compiler → sourceRects irregulares → manifest → atlas → semantic catalog → Studio palette → placement`

Forest Plaza es el caso de referencia actual: 146 piezas, IDs legacy preservados, nombres semánticos y 7 carpetas visuales.

## Fronteras obligatorias

- persistencia legacy pasa por `KeloStateStore` antes del boot;
- teleports/restores nuevos solo vía `KeloPlayerPosition`;
- cámara solo vía `KeloCamera`;
- colisiones solo vía `KELO_COLLISION`;
- render feature vía `KeloRender`/contratos de environment;
- aim/pointer/cast middleware legacy pasa temporalmente por `KeloAbilityAim`;
- lifecycle lazy/after-paint solo vía `KeloModuleLoader` + `KELO_FEATURE_REGISTRY`;
- `engine-m` permanece first-use dentro de `world`, no crítico;
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

## Estado de merge

El PR evergreen permanece **draft**. No se promueve a `main` hasta ejecutar QA físico/LIVE sobre el head exacto para boot, movimiento, World/Studio y viajes farm/plot. Los gates automatizados verdes son condición necesaria, no suficiente.
