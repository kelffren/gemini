/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater audit
 * keys: UPDATE PWA SERVICEWORKER AUDIT CI
 * purpose: valida por contrato que el updater instalado conserva boot, scope, refresh fresco y documentación mínima
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
const ui = read('src/ui/update-ui.js');
const sw = read('sw.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const version = read('version.json');
const doc = read('docs/systems/APP_UPDATE_SYSTEM.md');

expect(index.includes('src/core/update-system.js?v=1'), 'index.html no carga update-system.js');
expect(index.includes('src/ui/update-ui.js?v=1'), 'index.html no carga update-ui.js');
expect(index.includes('rel="manifest" href="manifest.webmanifest"'), 'index.html no declara manifest.webmanifest');
expect(index.includes('apple-mobile-web-app-capable'), 'faltan metadatos de instalación iOS');

expect(core.includes('owner: KeloUpdater'), 'update-system.js no declara owner KeloUpdater');
expect(core.includes("navigator.serviceWorker.register"), 'KeloUpdater no registra Service Worker');
expect(core.includes("updateViaCache: 'none'"), 'registro del Service Worker puede quedar cacheado');
expect(core.includes("cache: 'no-store'"), 'version.json debe consultarse sin cache');
expect(core.includes('kelo_update'), 'falta handoff de build a la recarga fresca');
expect(!core.includes('setInterval('), 'KeloUpdater no puede usar setInterval/watchdog');

expect(ui.includes('ACTUALIZAR'), 'la UI no expone acción ACTUALIZAR');
expect(ui.includes('safe-area-inset-bottom'), 'la UI no respeta safe-area inferior');
expect(ui.includes('KeloUpdater.applyUpdate()'), 'la UI no delega la actualización al owner');

expect(sw.includes('self.skipWaiting()'), 'Service Worker no activa la nueva revisión');
expect(sw.includes('self.clients.claim()'), 'Service Worker no reclama clientes abiertos');
expect(sw.includes("url.searchParams.has('kelo_update')"), 'Service Worker no detecta navegación de actualización');
expect(sw.includes("cache: 'reload'"), 'Service Worker no fuerza red durante la actualización');
expect(!sw.includes('caches.open('), 'updater no debe introducir cache offline general');

expect(manifest.id === './', 'manifest.id debe conservar el scope del repo');
expect(manifest.start_url === './', 'manifest.start_url debe ser relativo al repo');
expect(manifest.scope === './', 'manifest.scope debe ser relativo al repo');
expect(manifest.display === 'standalone', 'manifest debe abrir como app standalone');
expect(version.includes('site.github.build_revision'), 'version.json no usa el SHA real desplegado por Pages');
expect(doc.includes('KeloUpdater'), 'falta documentación técnica del owner');

if (!process.exitCode) {
  console.log('UPDATER AUDIT PASS');
}
