# Kelo World — App Update System

## Propósito

`KeloUpdater` mantiene actualizada la web instalada de KELO WORLD sin pedir al jugador que elimine ni vuelva a añadir el icono de la pantalla de inicio. Detecta la revisión que ya fue publicada por GitHub Pages y, cuando hay una build distinta, ofrece una acción táctil para recargar el cliente con archivos frescos.

## OWNER y archivos

- OWNER: `KeloUpdater`.
- Core cliente: `src/core/update-system.js`.
- Superficie UI: `src/ui/update-ui.js` (`KeloUpdaterUI`, consumidor visual).
- Service Worker: `sw.js`.
- Revisión desplegada: `version.json`, renderizado por GitHub Pages/Jekyll mediante `site.github.build_revision`.
- Install metadata: `manifest.webmanifest`.
- Boot LIVE: `index.html`.

No existe un segundo owner de versiones. La UI no decide qué build es actual ni escribe estado del updater.

## Estado que posee

`KeloUpdater` posee únicamente metadata de cliente:

- `installedBuild`: última build que este cliente confirmó como cargada;
- `deployedBuild`: revisión actualmente publicada por Pages;
- `availableBuild`: revisión pendiente de aplicar;
- estado de ciclo: `booting`, `checking`, `current`, `available`, `applying`, `error`;
- disponibilidad del Service Worker.

La única persistencia local es `kelo.world.updater.installedBuild.v1`. No contiene inventario, auth, economía, posición, HP ni ningún dato de gameplay.

## Estado que NO posee

El updater no posee ni puede modificar:

- autoridad online o WebSocket;
- sesiones Supabase;
- personaje, inventario, mercado, KC/oro, propiedades o progreso;
- mapas o assets como contenido autoritativo;
- lógica de PvP.

Actualizar el cliente solo cambia los bytes estáticos que el navegador usa para ejecutar la build publicada.

## API pública

```js
KeloUpdater.check({ force?: boolean })
KeloUpdater.applyUpdate()
KeloUpdater.getState()
```

Eventos de ventana:

```text
kelo:update:checking
kelo:update:available
kelo:update:current
kelo:update:applying
kelo:update:error
kelo:update:service-worker-error
```

La UI escucha estos eventos y delega `applyUpdate()` al owner.

## Flujo

1. `index.html` carga `src/core/update-system.js` antes del runtime gameplay.
2. El owner registra `sw.js` con scope de la instalación actual y `updateViaCache: none`.
3. `KeloUpdater` solicita `version.json` con `cache: no-store`.
4. GitHub Pages publica en ese archivo el SHA real de la revisión ya desplegada.
5. En el primer arranque con updater, ese SHA se establece como baseline local.
6. En aperturas posteriores, si el SHA desplegado difiere del baseline, el estado pasa a `available` y la UI muestra `ACTUALIZAR`.
7. Al pulsar `ACTUALIZAR`, el owner asegura que el Service Worker está listo y navega a la misma URL con `kelo_update=<sha>`.
8. El Service Worker reconoce esa navegación y, durante una ventana corta, fuerza `cache: reload` para requests same-origin. Así JS/CSS/assets de la build nueva no quedan pegados a una respuesta HTTP vieja.
9. La nueva página confirma que `kelo_update` coincide con `version.json`, persiste el nuevo baseline y limpia los parámetros de la URL con `history.replaceState`.

## Política de caché

El Service Worker NO implementa un cache offline general y NO intercepta APIs externas. Fuera de la ventana explícita de actualización deja que el navegador siga su comportamiento normal. Esto evita convertir cada apertura en una descarga completa y evita almacenar respuestas gameplay/auth.

Durante una actualización explícita, solo requests `GET` del mismo origen entran en la ventana de refresh fuerte. La ventana es efímera y vive únicamente en memoria del worker.

## iPhone / instalación

La instalación usa `manifest.webmanifest` y metadatos `apple-mobile-web-app-*` en `index.html`. El icono instalado sigue apuntando al mismo scope `./`; una build nueva no requiere una nueva instalación.

En iOS/WebKit el soporte concreto del navegador puede variar, por eso el flujo no depende de Background Sync ni Push. La comprobación ocurre al abrir el juego, al volver a primer plano, al recuperar una página desde BFCache o al recuperar conexión.

No se usa `setInterval` ni un watchdog permanente.

## Online-first

Este sistema es deliberadamente cliente-only porque decide qué bytes estáticos ejecutar, no decisiones gameplay. El servidor autoritativo permanece en `server/*` y Supabase según sus owners actuales. Ninguna migración futura de autoridad gameplay requiere cambiar el contrato del updater.

Si en el futuro el servidor necesita imponer una versión mínima compatible, esa política debe añadirse como una frontera explícita de compatibilidad (por ejemplo `minimumClientBuild`) y nunca mezclarse con estado gameplay local.

## Invariantes

- Una revisión se considera disponible solo cuando `version.json` de Pages la expone como desplegada.
- Un commit todavía no desplegado no debe forzar al cliente a recargar.
- La primera ejecución del updater establece baseline y no debe producir un falso update.
- La UI nunca escribe `installedBuild` directamente.
- El updater no guarda respuestas API ni gameplay en Cache Storage.
- El update debe conservar la URL/ruta actual salvo parámetros efímeros del updater.
- El sistema debe funcionar desde un subpath como `/gemini/`; no asume scope `/`.

## Extension points

Capacidades compatibles sin crear un segundo updater:

- changelog asociado a un SHA;
- `required: true` / versión mínima cuando exista autoridad que lo publique;
- precache selectivo de assets inmutables con hash;
- progreso de descarga cuando exista un manifiesto real de assets;
- telemetría de `available/applied/error` sin incluir datos sensibles.

## Anti-patrones

No hacer:

- `setInterval` para consultar versiones cada pocos segundos;
- recargar automáticamente mientras el jugador está en una acción crítica;
- cache-first para `version.json`;
- cachear respuestas Supabase/WebSocket/API desde `sw.js`;
- usar el SHA de `main` como verdad si Pages todavía no terminó de desplegarlo;
- crear otro service worker para un subsistema del juego;
- borrar/reinstalar el icono como mecanismo normal de actualización.

## QA / auditoría

- `node scripts/updater-audit.mjs`
- `npm run audit:updater`
- Workflow: `.github/workflows/app-updater-ci.yml`

La auditoría estática exige boot LIVE, manifest, Service Worker, build marker, documentación y ausencia de `setInterval` en el owner.

Para validación LIVE se debe comprobar en Pages:

1. `version.json` devuelve JSON renderizado con SHA hexadecimal;
2. `sw.js` responde bajo el mismo scope;
3. `index.html` carga ambos módulos del updater;
4. una build posterior provoca `available` en un cliente con baseline anterior;
5. `ACTUALIZAR` recarga y el baseline pasa a la nueva build sin reinstalar el icono.

## Deuda conocida

- El primer rollout necesita que el dispositivo cargue una vez el nuevo `index.html`; un cliente que jamás haya recibido este código todavía no puede ser controlado retroactivamente por el Service Worker.
- No existe todavía changelog por build.
- No existe todavía modo offline completo; se evita introducirlo accidentalmente dentro del updater.
