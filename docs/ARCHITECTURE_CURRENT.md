# Kelo World — Architecture Current

**Actualizado:** 2026-09-16 · Runtime V6.69 · Evergreen migration active

## Capas

### 1. Boot / Account
`index.html` → estado persistido normalizado → legacy engine bootstrap → owners Foundation → primer frame → módulos internos after-paint → módulos first-use.

`src/core/state-store-bootstrap.js` corre **antes de `engine-a.js`**. Su función es compatibilidad: versiona/normaliza el save `kelo_world_state_v2_1`, preserva campos desconocidos y crea backup antes de una migración. No posee gameplay todavía.

El boot crítico solo conserva autoridades necesarias para dibujar, caminar y mantener los contratos Foundation. `controlPlane` y `observability` ya no bloquean el primer paint: `KeloModuleLoader` los carga con policy `after-paint` después de cruzar dos frames.

Contrato CI medido:

- **48/48** scripts externos críticos antes de `kelo:boot-ready`;
- **422,554 / 425,000 bytes** fuente críticos;
- **3/3** scripts externos estáticos después de boot-ready;
- **21,669 / 22,000 bytes** post-boot estáticos;
- **9** módulos internos diferidos `after-paint`.

Los límites son guardrails: crecer exige evidencia y cambio explícito del contrato. La migración del último consumidor directo de `KeloAbilityAim` añadió solo **14 bytes netos** al source crítico respecto a la fase anterior, sin añadir scripts ni trabajo de primer uso; el runtime moderno de abilities permanece fuera del primer frame.

### 2. Foundation Core
`src/core/` posee eventos, input locks, input, movement extension, player transition position, camera, avatar composition, render/simulation extension, feature lifecycle, update boundaries y fronteras de migración legacy.

Los comandos discontinuos de viaje legacy `teleportToPlot` / `teleportToFarm` están estrangulados temporalmente por `KeloLegacyTransitionBridge` y pasan por `KeloPlayerPosition` + `KeloCamera`. Movimiento continuo sigue legacy hasta completar paridad/QA. `KeloPlayerPosition` no es owner de dash/physics; esas transiciones de movimiento deben usar `KeloMovement`/ability authority.

`KeloAbilityAim` es el strangler temporal de aim/input legacy. Posee el lifecycle **global legacy** de puntero, matemática/range e indicador de render. El registry/dispatcher de cast middleware legacy se separó en `KeloLegacyAbilityCast`, expuesto desde el mismo `legacy-ability-aim-system.js`; por tanto no se añadió un segundo engine ni un nuevo `<script>` al boot. `KeloAbilityAim.registerCastMiddleware` sigue existiendo como adapter de compatibilidad, pero ahora tiene **cero consumidores runtime directos**.

`engine-l` y `engine-m` registran directamente sus middleware mediante `KeloLegacyAbilityCast.registerMiddleware`. `engine-l:plaza-cast-presentation` permanece crítico y su comportamiento está congelado por un test ejecutable contra el fragmento real: dash consume el cast, conserva cooldown, duración `.11+.08*(range/170)`, clamp de 24 px, trail/burst y no llama `next()`; los casts no-dash delegan exactamente una vez y después añaden presentación visual. `engine-m:skill-shots` sigue entrando solo cuando `world` se carga por first-use. Ambos todavía leen `skillAim` como estado legacy de rango/dirección.

`KeloAbilityDirection` y `KeloLegacyAbilityTrigger` mantienen compatibilidad de `engine-f`. Su comportamiento ya está caracterizado contra el archivo real mediante un sandbox VM: thresholds de dirección, prioridad input→velocidad→aim, dash directo 150, radio PvP `<60`, proyectiles 450/life 2 y fallback legacy.

`engine-g` conserva únicamente estado compatibility + dash tween legacy. Su matemática y efectos están caracterizados contra el archivo real: quadratic ease-out, collision push, PvP `<52`, daño/fallback y finalización del tween. Ya no posee hotbar, scheduler UI ni bindings de pointer/aim.

La hotbar moderna pertenece a `KeloAbilities`. No se construye durante el boot de Plaza: el feature interno `abilityRuntime` usa policy `first-use`, `userToggle:false` y carga en orden `abilityData.js → stone-system.js → kelo-ability-boot.js` mediante el `KeloModuleLoader` existente. `kelo-ability-boot.js` expone `KeloAbilitiesLoader`, crea `KeloAbilities` y mantiene el adapter compatibility `renderActionBar` cuando el runtime se despierta.

El lifecycle moderno de la hotbar es **local por slot**, no global. Cada drag activo conserva su `pointerId`, usa `setPointerCapture` para continuidad del gesto, ignora `pointermove`/`pointerup` de otros pointers y limpia el estado al completar o cancelar. `pointercancel` nunca dispara cast. El self-target mantiene su cast inmediato. Este owner moderno convive temporalmente con `KeloAbilityAim`: el primero sirve a los cinco slots modernos first-use; el segundo sigue atendiendo compatibilidad aim/pointer global legacy, aunque ya no posee consumidores externos directos para registrar cast middleware.

PvP ya no depende de que `KeloAbilitiesLoader` exista por casualidad. `pvp-combat-runtime-loader.js` ejecuta explícitamente `KeloRuntimeBootstrap.ensure() → KELO_MODULE_LOADER.ensure('abilityRuntime') → KeloAbilitiesLoader.ensure()` antes de validar foundations, despertar abilities y enlazar prediction.

`KELO_FEATURE_REGISTRY` es la fuente única de metadata/policy de features. `KELO_ASSET_REGISTRY` solo expone paquetes que el usuario puede activar/desactivar. Features internas como `controlPlane`, `observability` y `abilityRuntime` usan `userToggle:false` y siguen siendo responsabilidad del lifecycle, no de la biblioteca de assets.

### 3. Legacy Core
El índice de producción conserva actualmente **9 engines legacy críticos**: `engine-a.js`, `engine-b.js`, `engine-c.js`, `engine-d.js`, `engine-e.js`, `engine-f.js`, `engine-g.js`, `engine-h.js` y `engine-l.js`.

`engine-i.js`, `engine-j.js` y `engine-k.js` están **RETIRED**. El boot audit escanea runtime/tests para impedir que reaparezcan referencias válidas a esos archivos.

El debt audit actual cuenta **28 writes directos de posición** y **12 writes directos de cámara** en el índice estático de producción. `engine-f/g` contienen 10 de los writes de posición. Ambos ya tienen characterization tests; el próximo paso correcto es migrar consumidores hacia autoridades modernas equivalentes, no mover deuda de carpeta ni borrar archivos sin paridad.

`legacy-ability-consumer-audit.mjs` mantiene un inventario del runtime basado en referencias ejecutables, ignorando comentarios. El baseline validado es: **0 consumidores directos de `KeloAbilityAim`**, **2 consumidores directos de `KeloLegacyAbilityCast`** (`engine-l/m`), **3 consumidores de `skillAim`** (`engine-g/l/m`) y **6 consumidores de `triggerStone`**. El audit falla si reaparece un consumidor directo de `KeloAbilityAim` o cambia accidentalmente el set esperado del owner de cast.

La retirada de la action bar de `engine-g`, la migración de `engine-m` y ahora la migración de `engine-l` muestran el proceso correcto: identificar owner, congelar comportamiento, migrar un consumidor, ejecutar CI/WebKit y solo después documentar. El dash quedó intacto porque todavía no hay equivalencia demostrada con el dash moderno.

Objetivo de retirada por responsabilidad:

`IDENTIFICAR → SHADOW/ADAPTER → MIGRAR CONSUMIDORES → TEST → LIVE → 0 USO LEGACY → DEAD → RETIRAR`

Nunca `BORRAR → arreglar lo que rompa`.

### 4. World / Environment
`src/environment/` posee terrain contract, atlases, world map, layer stack, surface ground, prop contract, prefab contract, district visuals y World Builder support.

`world` es first-use. El smoke del branch comprueba explícitamente que `engine-m.js` y su middleware no están presentes en el boot inicial y que aparecen después de `KELO_MODULE_LOADER.ensure('world')`. `engine-m` registra su middleware a través de `KeloLegacyAbilityCast`, no mediante `KeloAbilityAim`. Esto protege simultáneamente first paint y funcionalidad.

### 5. Asset Infrastructure
`KELO_ATLAS_CONTRACT` resuelve atlas; `KELO_PROPERTY_CATALOG` expone templates placeables. Compilers producen metadata, no renderers.

### 6. Studio / Creators
`src/studio/` contiene document/kernel/tools/UI. `src/creators/` contiene workspaces, Map Forge, asset compiler y evolución. Todos delegan mutations a owners existentes.

### 7. Gameplay Domains
Abilities modernas, equipment, mounts, backpack, PvP/Arena, identity/titles, nobility, economy, commerce, property, instances y guardian son owners separados. La compatibilidad de aim/pointer legacy vive temporalmente detrás de `KeloAbilityAim`; la compatibilidad de dispatch/middleware vive detrás de `KeloLegacyAbilityCast`. Ninguno es un segundo ability engine.

`KeloAbilities` es el runtime moderno data-driven y ahora también es el owner de la hotbar moderna/adapter `renderActionBar` tras el first-use de `abilityRuntime`. El smoke WebKit comprueba que no existe al boot y que, al cargar el feature, aparecen **5 slots modernos** sin restaurar los IDs `action-slot-*` retirados de `engine-g`.

El contrato de pointer de esos cinco slots se caracteriza ejecutando el `bindSlot()` real en VM: un segundo dedo no puede robar el gesto activo, eventos de pointer ajenos no modifican ni finalizan el aim, el pointer dueño castea una sola vez, `pointercancel` no castea y los targets `self` conservan la activación inmediata. No se añade un listener global moderno.

No sustituir el dash de `engine-g` solo por similitud nominal: distancia, duración, easing, colisión, daño y lifecycle deben demostrarse equivalentes primero.

### 8. Online
`engine-net.js`, auth lifecycle y módulos server/Supabase implementan o preparan autoridad online. La regla es server-authoritative para valor persistente/competitivo.

### 9. Build / QA
El toolchain de cliente usa Node 22 y `package-lock.json`; dependencias de producción/build deben instalarse con `npm ci`. El servidor conserva su runtime Node 24 y su propio lockfile.

La migración evergreen está protegida por `.github/workflows/evergreen-foundation.yml`, que ejecuta como mínimo:

- characterization tests del state migrator;
- ownership de caches del Service Worker;
- contrato del legacy transition bridge;
- paridad de ability aim;
- paridad de ability direction/trigger legacy contra `engine-f.js` real;
- paridad del dash tween contra `engine-g.js` real y guardia de que no recupere hotbar/UI;
- contrato `abilityRuntime` first-use y su orden físico;
- characterization ejecutable del pointer lifecycle moderno de los cinco slots;
- ownership del pointer lifecycle legacy global en `KeloAbilityAim`;
- contrato y orden LIFO de `KeloLegacyAbilityCast`;
- **paridad ejecutable de la presentación de cast de Plaza contra `engine-l.js` real**;
- inventario automático de consumidores legacy de ability/aim/cast/trigger;
- reproducible build audit;
- CI supply-chain audit;
- lightweight boot surface audit con presupuestos de count + bytes;
- legacy debt report;
- Foundation architecture audit;
- orden estático de boot;
- build de producción del cliente + Turbo audit;
- smoke del servidor real;
- WebKit móvil sobre el commit del PR, incluyendo el handoff de hotbar first-use y la carga diferida de `engine-m`.

`boot-surface-audit.mjs` impide que control plane, updater, shadows, `engine-m` o engines retirados vuelvan accidentalmente al parser-blocking boot. El runtime moderno de abilities permanece fuera del boot crítico por contrato de lifecycle. Una subida del presupuesto crítico debe ser deliberada y respaldada por evidencia.

Los workflows activos fijan acciones externas por SHA exacto. `ci-supply-chain-audit.mjs` falla ante acciones externas sin pin SHA y ante `permissions: write-all`. Dependabot propone actualizaciones de npm y GitHub Actions por PR; una actualización nunca se considera segura solo porque sea nueva.

El head runtime `09ad6fedf18a57cf56741e59237b65f7c911106d` pasó los cuatro gates del Evergreen Foundation Guard: `foundation`, `client-build`, `server-smoke` y `webkit-mobile-smoke`. El mismo run confirmó `directAimConsumers=[]` y `directCastConsumers=["engine-l.js","engine-m.js"]`. Eso es evidencia branch-local, no QA físico.

## Flujo de asset moderno

`PNG/JPEG/WebP → foreground analysis → asset sheet compiler → sourceRects irregulares → manifest → atlas → semantic catalog → Studio palette → placement`

Forest Plaza es el caso de referencia actual: 146 piezas, IDs legacy preservados, nombres semánticos y 7 carpetas visuales.

## Fronteras obligatorias

- persistencia legacy pasa por `KeloStateStore` antes del boot;
- teleports/restores nuevos solo vía `KeloPlayerPosition`;
- dash/physics NO se migran a `KeloPlayerPosition`; deben usar `KeloMovement`/ability authority;
- cámara solo vía `KeloCamera`;
- colisiones solo vía `KELO_COLLISION`;
- render feature vía `KeloRender`/contratos de environment;
- aim/range/pointer legacy pasa temporalmente por `KeloAbilityAim`;
- middleware/dispatch de cast legacy pasa por `KeloLegacyAbilityCast`; el adapter `KeloAbilityAim.registerCastMiddleware` tiene cero consumidores runtime y no debe recibir consumidores nuevos;
- lifecycle lazy/after-paint solo vía `KeloModuleLoader` + `KELO_FEATURE_REGISTRY`;
- `abilityRuntime` es first-use interno y no user-toggleable;
- hotbar moderna pertenece a `KeloAbilities`; `engine-g` no puede recuperarla;
- pointer de hotbar moderna permanece local a cada slot y aislado por `pointerId`; no crear un segundo lifecycle global;
- UI oculta no debe ejecutar construcción innecesaria antes del primer paint;
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