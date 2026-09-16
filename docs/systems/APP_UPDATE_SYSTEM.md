# KELO WORLD — App Update System · Gate V8 + Updater V5.1

## Objetivo

El sistema de actualización tiene **un solo owner pesado**, `KeloUpdater`, pero no paga su coste durante el boot normal. `KeloUpdateGate` es la puerta ligera que permanece activa durante la sesión: detecta la build realmente desplegada, clasifica el cambio y solo despierta `Updater V5.1` cuando hace falta preparar o aplicar una actualización que requiere restart.

La arquitectura actual es:

`index.html → KeloUpdateGate (ligero) → clasificación → [fast-forward / hot / hot-data / wakeHeavy] → KeloUpdater V5.1 → update-watch`

`update-system-v5.js` y `update-watch.js` son **lazy**. No deben volver al critical path de `index.html`.

## Detección

`version.json` continúa siendo la autoridad del SHA que GitHub Pages ha desplegado mediante `site.github.build_revision`.

Durante los primeros dos minutos de sesión, Gate V8 puede comprobar una versión nueva aproximadamente cada **5 segundos**. Después pasa a una cadencia estable de **15 segundos**. Utiliza un único `setTimeout` reprogramado; no usa `setInterval`.

La detección cede ante app oculta, offline, movimiento activo, módulos opcionales cargando, PvP o Arena. Gameplay tiene prioridad.

## Clasificación antes de descargar

Cuando el SHA desplegado cambia, `KeloUpdateGate` consulta la comparación entre el commit instalado y el desplegado. Antes de despertar el updater pesado clasifica los paths:

- `none`: solo documentación, workflows u otros archivos no-runtime; marca la nueva build sin descargar assets ni recargar;
- `hot`: cambio exclusivamente CSS que puede sustituirse de forma segura;
- `hot-data`: JSON registrado explícitamente en `KeloHotDataRegistry`;
- `full-restart`: owners críticos como `index.html`, Foundation, boot, updater o collision;
- `seamless-restart`: cambio runtime normal que necesita preparación de la siguiente build.

No existe hot-swap arbitrario de JavaScript. Los paths críticos tienen una lista explícita y fail-closed.

## Wake del updater pesado

`KeloUpdateGate.wakeHeavy()` carga secuencialmente:

1. `src/core/update-system-v5.js`;
2. `src/core/update-watch.js`.

El wake se deduplica con una promesa compartida. Si `KeloUpdater` ya existe, no se crea otro owner. Al quedar listo el owner pesado, el gate deja de mantener su ciclo ligero.

## Updater V5.1 — verified predictive

Updater V5.1 ya no hace un tree walk completo del repositorio ni requiere Service Worker para funcionar. Usa la comparación exacta entre commits para identificar archivos cambiados y combina tres fuentes para construir el plan:

- critical shell derivado del `index.html` de la build objetivo;
- recursos realmente usados en la sesión;
- hotset aprendido de sesiones anteriores.

El objetivo es preparar los bytes que la próxima build necesita, no descargar el repositorio entero.

## Verificación de bytes

Para cada archivo cambiado que GitHub identifica con un blob SHA, V5.1 transmite el buffer a `update-verifier-worker.js` cuando `Worker` está disponible. El worker verifica la identidad **Git blob** y, cuando corresponde, la sintaxis del JavaScript clásico sin ejecutar el código de la actualización.

La build no se considera preparada simplemente porque una petición HTTP respondió 200. Existen reintentos de consistencia para absorber ventanas donde Pages/CDN todavía sirve bytes de una versión anterior.

Las métricas incluyen, entre otras:

- `compareMs`;
- `indexMs`;
- `downloadMs`;
- `timeToReadyMs`;
- `downloadedBytes`;
- `verifiedFiles`;
- `syntaxChecked`;
- `hotsetHits`;
- `consistencyRetries`.

## Gameplay priority

Updater V5.1 evalúa visibilidad, conectividad, movimiento, módulos en vuelo, PvP y Arena. Cuando gameplay se vuelve crítico, incrementa la generación del staging y aborta downloads en vuelo. Un staging pausado nunca tiene prioridad sobre jugar.

El API `setGameplayBusy()` / `setNetworkPriority()` permite que otros owners comuniquen esa prioridad sin crear otro scheduler de actualización.

## Health Shield

Aplicar una actualización no confirma inmediatamente la build como buena.

Antes del reload, V5.1 guarda un pending build con la build anterior. Durante el siguiente boot, `index.html` captura errores tempranos y el updater espera `kelo:boot-ready`, dos frames estables y una pequeña ventana de asentamiento.

Solo entonces la nueva build se confirma como `lastGoodBuild`. Si el boot falla repetidamente, esa build queda registrada como bloqueada y no se vuelve a aplicar automáticamente. Este **Health Shield** reduce el riesgo de convertir una actualización rota en el estado persistente del jugador.

## Watch

`update-watch.js` existe únicamente después de que `KeloUpdater` está despierto. Comprueba cada **15 segundos** cuando la aplicación está visible y `KeloUpdater.getState().gameplayBusy` es falso. Usa `setTimeout` recursivo y responde también a `visibilitychange` y `online`.

Watch no descarga assets, no decide builds y no crea autoridad propia; solo llama a `KeloUpdater.check()`.

## Ajustes / actualización manual

`settings-lazy-gate.js` mantiene la experiencia móvil ligera. Ajustes y Update Intelligence se cargan en first-use. El botón **Actualizar** reutiliza primero `KeloUpdateGate`; si necesita el owner pesado llama `wakeHeavy()` y después delega `check`, `prepareUpdate` y `applyUpdate` a `KeloUpdater`.

Si no existe una nueva build preparada, el botón puede revalidar los recursos runtime activos con `cache: reload` antes de refrescar. Esto sigue siendo un fallback de transporte, no un segundo updater.

`KeloUpdateIntelligenceUI` expone la verdad del gate/updater, métricas, health, consistencia y diagnóstico sin polling paralelo.

## Service Worker

Service Worker ya no es una dependencia obligatoria de V5.1. El updater puede verificar y calentar bytes utilizando HTTP cache y Cache Storage donde conviene. En iPhone/iOS el sistema evita depender de un mecanismo que WebKit puede desalojar o comportar de forma distinta.

`sw.js` puede seguir existiendo por compatibilidad PWA, pero no puede convertirse en un segundo owner de actualización ni guardar API, auth o estado gameplay.

## Invariantes

- un commit no desplegado jamás se ofrece como actualización;
- solo existe un `KeloUpdater`;
- el boot normal monta Gate V8, no el updater pesado ni watch;
- no hay `setInterval` en gate, updater o watch;
- gameplay/PvP/Arena tienen prioridad sobre staging;
- JavaScript no se hot-swapea arbitrariamente;
- bytes con blob conocido se verifican antes de READY;
- una build nueva no se confirma hasta superar Health Shield;
- una build que falla salud repetidamente puede bloquearse;
- Settings reutiliza el mismo gate/updater;
- estado de usuario, auth, economía, posición, HP y combate nunca forman parte del caché de actualización.

## QA

`npm run audit:updater` valida estáticamente el contrato **Gate V8 + Updater V5.1**. El Main Stability Gate ejecuta este audit junto con Foundation, documentación, performance, online y los smoke tests del commit exacto del PR.

La evolución futura puede cambiar GitHub Pages por un CDN con chunks content-hashed y headers immutable sin cambiar esta frontera: detección ligera → clasificación → verificación/preparación → health commit.
