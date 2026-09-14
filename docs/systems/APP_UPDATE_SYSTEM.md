# Kelo World — App Update System

## Propósito

`KeloUpdater` mantiene actualizada la web instalada de KELO WORLD sin pedir al jugador que elimine ni vuelva a añadir el icono de la pantalla de inicio. Detecta la revisión que ya fue publicada por GitHub Pages, descarga por adelantado los bytes estáticos de la nueva build mientras el jugador sigue usando la versión actual y solo habilita `ACTUALIZAR` cuando la build necesaria para arrancar está preparada.

La descarga es deliberadamente oportunista: gameplay, PVP y una conexión estable tienen prioridad sobre el updater. Además, `update-watch.js` hace una comprobación mínima cada **2 minutos** durante sesiones largas para descubrir deploys que aparezcan mientras el jugador sigue dentro del juego; si hay gameplay crítico o la app está oculta, cede y no consulta.

## OWNER y archivos

- OWNER: `KeloUpdater`.
- Core cliente: `src/core/update-system.js`.
- Detector ligero para sesiones largas: `src/core/update-watch.js` (solo delega en `KeloUpdater`).
- Superficie UI: `src/ui/update-ui.js` (`KeloUpdaterUI`, consumidor visual).
- Service Worker: `sw.js`.
- Revisión desplegada: `version.json`, renderizado por GitHub Pages/Jekyll mediante `site.github.build_revision`.
- Install metadata: `manifest.webmanifest`.
- Boot LIVE: `index.html`.
- Auditoría: `scripts/updater-audit.mjs`.

No existe un segundo owner de versiones. La UI y el watch no deciden qué build es actual, no escriben estado del updater y no descargan assets por su cuenta.

## Estado que posee

`KeloUpdater` posee únicamente metadata del cliente y del staging:

- `installedBuild`: última build que este cliente confirmó como cargada;
- `deployedBuild`: revisión actualmente publicada por Pages;
- `availableBuild`: revisión pendiente;
- `stage.build/status/total/completed/percent`: estado de la precarga;
- `network.status/pingMs/failures/saveData/effectiveType/downlinkMbps`: diagnóstico efímero de red;
- disponibilidad del Service Worker.

La única persistencia de versión sigue siendo `kelo.world.updater.installedBuild.v1`. Los bytes precargados viven en Cache Storage bajo un namespace exclusivo `kelo-update-stage-v2-<sha>`.

No contiene inventario, auth, economía, posición, HP ni ningún dato gameplay.

## API pública

```js
KeloUpdater.check({ force?: boolean })
KeloUpdater.prepareUpdate(build?)
KeloUpdater.applyUpdate()
KeloUpdater.evaluateNetwork()
KeloUpdater.setGameplayBusy(boolean, source?)
KeloUpdater.setNetworkPriority('critical' | 'normal', source?)
KeloUpdater.getState()
```

Para cualquier subsistema que necesite prioridad absoluta de red:

```js
KeloUpdater.setGameplayBusy(true, 'pvp')
// ...
KeloUpdater.setGameplayBusy(false, 'pvp')
```

También existe el puente desacoplado `kelo:network-priority`. Además, el updater detecta automáticamente `window.KELO_COMBAT_ENABLED === true` y Arena activa mediante `KeloArena.isActive()`.

## Eventos

```text
kelo:update:checking
kelo:update:available
kelo:update:current
kelo:update:network
kelo:update:network-priority
kelo:update:staging
kelo:update:staging-progress
kelo:update:staging-paused
kelo:update:staging-resumed
kelo:update:staged
kelo:update:staging-error
kelo:update:staging-unsupported
kelo:update:applying
kelo:update:error
kelo:update:service-worker-error
```

## Flujo completo

1. `index.html` carga `KeloUpdater` antes del runtime gameplay y luego `update-watch.js`.
2. El owner registra `sw.js` con `updateViaCache: none`.
3. Consulta `version.json` con `cache: no-store`.
4. Pages expone el SHA real que ya está desplegado.
5. Si ese SHA difiere de `installedBuild`, pasa a `available`.
6. Antes de descargar el nuevo `index.html`, el evaluador hace un probe pequeño same-origin.
7. Si la red es apta, `prepareUpdate()` obtiene el HTML nuevo y extrae scripts, CSS, manifest, preload e iconos same-origin.
8. Descarga **un solo recurso a la vez** y lo guarda en `kelo-update-stage-v2-<sha>`.
9. Si el ping sube, hay errores, Ahorro de Datos, PVP/combat o la app queda oculta, la cola se pausa sin perder lo ya descargado.
10. Cuando la red vuelve a ser sana, se recupera automáticamente.
11. Solo después de completar todos los recursos requeridos se escribe el marcador de staging completo y se emite `kelo:update:staged`.
12. La UI cambia a `Nueva versión lista` y habilita `ACTUALIZAR`.
13. Al pulsar el botón, el navegador navega con `kelo_update=<sha>`.
14. `sw.js` sirve primero los bytes ya precargados de esa build. Si falta un recurso, usa `cache: reload` como fallback.
15. La página nueva confirma el SHA, actualiza `installedBuild`, limpia parámetros efímeros y elimina staging viejo después de completar la carga.
16. Si el jugador permanece dentro durante mucho tiempo, `update-watch.js` vuelve a llamar a `KeloUpdater.check()` cada 2 minutos únicamente cuando la app está visible y no hay gameplay crítico, permitiendo descubrir el siguiente deploy sin reabrir la app.

## Evaluador de red / ping

La política inicial es conservadora:

| Condición | Acción |
|---|---|
| `0–100 ms` | descarga secuencial normal |
| `101–150 ms` | descarga secuencial con mayor separación |
| `151–200 ms` | descarga muy limitada si no hay gameplay crítico |
| `>200 ms` | pausa |
| offline / timeout / errores | pausa |
| `slow-2g` / `2g` | pausa |
| Ahorro de Datos (`saveData`) | pausa automática |
| PVP, combate o Arena activa | pausa; gameplay tiene prioridad |
| app oculta | pausa |

El ping se mide contra `version.json` del mismo origen con una petición pequeña, `cache: no-store`, timeout y una mediana de las últimas muestras para no reaccionar de forma exagerada a un pico aislado.

Si `navigator.connection` existe, sus pistas (`rtt`, `downlink`, `effectiveType`, `saveData`) son señal adicional. iOS puede no exponer esa API; el sistema no depende de ella.

No se usa `setInterval`. La búsqueda de builds durante sesiones largas utiliza un único `setTimeout` recursivo de 2 minutos, y el staging solo reevalúa la red mientras necesita avanzar o recuperarse. Ninguno corre dentro del frame loop.

## Prioridad absoluta del juego

El updater tiene concurrencia de descarga **1**. Antes de cada recurso vuelve a comprobar si debe ceder la red. Si combate o Arena están activos, no inicia un recurso nuevo y entra en `gameplay-priority`.

Una descarga que ya estaba en vuelo puede terminar, pero nunca se lanza una batería paralela de descargas. Esto evita que el updater compita deliberadamente con movimiento, reconciliación, combate o chat. El watch de versiones también cede durante gameplay crítico.

## Qué se precarga

La precarga prepara el **boot shell de la nueva build**, no todo el universo de assets:

- `index.html`;
- scripts declarados por el HTML nuevo, incluidos `src/auth/*.js` same-origin;
- CSS;
- manifest;
- preload e iconos same-origin;
- recursos estáticos usados por la sesión como extensión opcional.

Los recursos dinámicos que no forman parte del arranque se descargan bajo demanda después de la activación. Esto mantiene ligero el juego.

## Política de Cache Storage

`kelo-update-stage-v2-<sha>` es exclusivamente staging temporal de bytes estáticos. No se almacenan respuestas API, Supabase, WebSocket, economía, inventario ni payloads gameplay. Los archivos JavaScript estáticos de `src/auth/` sí forman parte del boot shell y se precargan igual que cualquier otro script same-origin; eso no equivale a cachear respuestas o tokens de autenticación.

`sw.js` solo consulta ese cache durante la ventana explícita de aplicación de una build. Fuera de esa ventana no convierte KELO WORLD en una app cache-first ni en un modo offline general.

## UI

Durante la precarga:

```text
Actualización en segundo plano
Preparando 43% (38/88) · 74 ms
```

Si se pausa:

```text
Actualización pausada
priorizando PVP y gameplay
```

O por red:

```text
Actualización pausada
ping alto · 224 ms
```

Solo al finalizar:

```text
Nueva versión lista
Descargada sin interrumpir el juego · Build abc1234
[ ACTUALIZAR ]
```

No hay recarga automática a mitad de una partida.

## iPhone / PWA

El icono instalado sigue apuntando al mismo scope `./`. Una build nueva no requiere reinstalar la PWA.

Mientras KELO WORLD está abierto, WebKit puede descargar y llenar Cache Storage. iOS **no garantiza** que una PWA suspendida o cerrada continúe ejecutando JavaScript o descargas en segundo plano; el staging reanuda cuando el jugador vuelve.

No depende de Background Sync ni Push.

## Invariantes

- Una revisión se considera disponible solo cuando `version.json` de Pages la expone como desplegada.
- Un commit todavía no desplegado no debe activar el updater.
- Durante una sesión larga, un deploy nuevo se descubre como máximo aproximadamente 2 minutos después mientras la app siga visible y no haya gameplay crítico.
- Gameplay siempre gana frente a staging y frente al watch periódico.
- La cola de staging tiene concurrencia 1.
- `>200 ms`, red inestable o Save Data detienen nuevas descargas.
- El botón normal de actualización aparece cuando el staging requerido está completo.
- Si Cache Storage no está disponible, se conserva el fallback clásico de actualización directa.
- La UI nunca escribe `installedBuild`.
- El updater no almacena respuestas API ni gameplay.
- El update conserva ruta y scope del repo `/gemini/`.
- No se usa un segundo Service Worker.

## QA / auditoría

```bash
npm run audit:updater
```

Workflow: `.github/workflows/app-updater-ci.yml`.

La auditoría exige boot LIVE, manifest, build marker real, umbrales 100/150/200 ms, Ahorro de Datos, detector PVP/Combat/Arena, staging por build, cola secuencial, marcador de staging completo, detector cada 2 minutos para sesiones largas, consumo desde `sw.js`, UI preparando/pausado/listo y ausencia de `setInterval`.

## Deuda conocida

- El primer rollout necesita que el dispositivo reciba una vez el nuevo `index.html`.
- No existe todavía changelog por build.
- No existe modo offline completo y no debe mezclarse accidentalmente con este updater.
- iOS puede suspender JavaScript cuando la PWA deja de estar activa; el staging reanuda al volver.
