/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater audit
 * keys: UPDATE PWA SERVICEWORKER AUDIT CI STAGING PING NETWORK WATCH
 * purpose: valida boot, staging secuencial, gate de red, prioridad gameplay, detección en sesiones largas, activación y documentación
 * online: N/A; auditoría estática del cliente
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const fail = (message) => {
  console.error(`UPDATER AUDIT FAIL: ${message}`);
  process.exitCode = 1;
};
const expect = (condition, message) => {
  if (!condition) fail(message);
};

const index = read('index.html');
const core = read('src/core/update-system.js');
const watch = read('src/core/update-watch.js');
const ui = read('src/ui/update-ui.js');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const version = read('version.json');
const doc = read('docs/systems/APP_UPDATE_SYSTEM.md');

expect(index.includes('src/core/update-system.js?v=3-network-stage'), 'index.html no carga la revisión fresca network-stage de update-system.js');
expect(index.includes('src/core/update-watch.js?v=1'), 'index.html no carga el detector de deploys durante sesiones largas');
expect(index.includes('src/ui/update-ui.js?v=2-network-stage'), 'index.html no carga update-ui.js');
expect(index.includes('rel="manifest" href="manifest.webmanifest"'), 'index.html no declara manifest.webmanifest');
expect(index.includes('apple-mobile-web-app-capable'), 'faltan metadatos de instalación iOS');

expect(core.includes('owner: KeloUpdater'), 'update-system.js no declara owner KeloUpdater');
expect(core.includes('navigator.serviceWorker.register'), 'KeloUpdater no registra Service Worker');
expect(core.includes("updateViaCache: 'none'"), 'registro del Service Worker puede quedar cacheado');
expect(core.includes("cache: 'no-store'"), 'version.json/ping debe consultarse sin cache');
expect(core.includes('NETWORK_POLICY'), 'falta política explícita de ping/red');
expect(core.includes('goodMaxMs: 100'), 'falta umbral de ping bueno');
expect(core.includes('fairMaxMs: 150'), 'falta umbral de ping moderado');
expect(core.includes('constrainedMaxMs: 200'), 'falta corte superior razonable antes de pausar');
expect(core.includes('saveData'), 'falta respeto por Ahorro de Datos');
expect(core.includes('effectiveType'), 'falta pista opcional de tipo de red');
expect(core.includes('evaluateNetwork'), 'falta evaluador de red/ping');
expect(core.includes('setGameplayBusy'), 'falta API de prioridad gameplay');
expect(core.includes('KELO_COMBAT_ENABLED'), 'el updater no detecta combate crítico');
expect(core.includes('KeloArena.isActive'), 'el updater no detecta Arena/PVP activo');
expect(core.includes("state.stage.status = 'paused'"), 'falta pausa del staging');
expect(core.includes('STAGE_CACHE_PREFIX'), 'falta cache aislado de staging por build');
expect(core.includes('cache.put('), 'el updater no precarga bytes');
expect(core.includes('for (const entry of plan)'), 'el staging no garantiza cola secuencial');
expect(core.includes('stageMetaUrl'), 'falta marcador de build completamente descargada');
expect(core.includes('isBuildStaged'), 'applyUpdate no puede verificar staging completo');
expect(core.includes('kelo_update'), 'falta handoff de build a la recarga');
expect(core.includes("parsed.querySelectorAll('script[src]')"), 'el plan no incluye scripts declarados por el HTML nuevo');
expect(!core.includes('(?:api|auth)'), 'no excluir src/auth: los scripts estáticos de auth también son parte del boot shell');
expect(!core.includes('setInterval('), 'KeloUpdater no puede usar setInterval/watchdog');

expect(watch.includes('CHECK_EVERY_MS = 120000'), 'el watch debe comprobar deploys con cadencia ligera de 2 minutos');
expect(watch.includes('updater.check()'), 'el watch no delega la detección a KeloUpdater');
expect(watch.includes('snapshot.gameplayBusy'), 'el watch no cede el chequeo ante gameplay crítico');
expect(watch.includes("document.visibilityState === 'visible'"), 'el watch debe evitar comprobaciones periódicas con la app oculta');
expect(watch.includes('setTimeout('), 'el watch debe programarse sin loop de frame');
expect(!watch.includes('setInterval('), 'el watch no puede usar setInterval agresivo');

expect(ui.includes('Actualización en segundo plano'), 'la UI no presenta precarga silenciosa');
expect(ui.includes('Actualización pausada'), 'la UI no presenta pausa por red/gameplay');
expect(ui.includes('Nueva versión lista'), 'la UI no distingue build completamente preparada');
expect(ui.includes('ACTUALIZAR'), 'la UI no expone acción ACTUALIZAR');
expect(ui.includes('safe-area-inset-bottom'), 'la UI no respeta safe-area inferior');
expect(ui.includes('KeloUpdater.applyUpdate()'), 'la UI no delega la actualización al owner');
expect(ui.includes('kelo:update:staged'), 'el botón no está gobernado por staging completo');

expect(sw.includes('self.skipWaiting()'), 'Service Worker no activa la nueva revisión');
expect(sw.includes('self.clients.claim()'), 'Service Worker no reclama clientes abiertos');
expect(sw.includes("url.searchParams.has('kelo_update')"), 'Service Worker no detecta navegación de actualización');
expect(sw.includes("cache: 'reload'"), 'Service Worker no fuerza red como fallback');
expect(sw.includes('STAGE_CACHE_PREFIX'), 'Service Worker no conoce el staging por build');
expect(sw.includes('stagedResponse'), 'Service Worker no consume los bytes precargados');
expect(sw.includes('caches.open('), 'Service Worker no puede leer el staging');

expect(manifest.id === './', 'manifest.id debe conservar el scope del repo');
expect(manifest.start_url === './', 'manifest.start_url debe ser relativo al repo');
expect(manifest.scope === './', 'manifest.scope debe ser relativo al repo');
expect(manifest.display === 'standalone', 'manifest debe abrir como app standalone');
expect(version.includes('site.github.build_revision'), 'version.json no usa el SHA real desplegado por Pages');

expect(doc.includes('KeloUpdater'), 'falta documentación técnica del owner');
expect(doc.includes('precarga'), 'documentación no describe staging en segundo plano');
expect(doc.includes('200 ms'), 'documentación no declara el umbral superior de ping');
expect(doc.includes('setGameplayBusy'), 'documentación no explica prioridad gameplay');
expect(doc.includes('Ahorro de Datos'), 'documentación no explica Save Data');
expect(doc.includes('2 minutos'), 'documentación no explica detección durante sesiones largas');

if (!process.exitCode) console.log('UPDATER AUDIT PASS');
