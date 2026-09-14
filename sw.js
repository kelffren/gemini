/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater service worker
 * keys: UPDATE PWA SERVICEWORKER FRESH CACHE IPHONE
 * purpose: toma control de la web instalada y fuerza una carga fresca solo durante la aplicación explícita de una nueva build
 * public-api: mensaje KELO_SKIP_WAITING; navegación con ?kelo_update=<build>
 * consumes: requests same-origin de KELO WORLD
 * state-owned: ventana efímera de refresh forzado; no persiste gameplay ni sesión
 * extension-points: futura estrategia de precache por manifiesto de assets
 * reuse: worker único para actualización de la web instalada
 * legacy: N/A
 * do-not: no cachear estado/API gameplay ni inventar autoridad offline
 */
'use strict';

let forceFreshUntil = 0;
const FORCE_FRESH_MS = 120000;

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'KELO_SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && url.searchParams.has('kelo_update')) {
    forceFreshUntil = Date.now() + FORCE_FRESH_MS;
  }

  if (Date.now() >= forceFreshUntil) return;

  event.respondWith(
    fetch(request, { cache: 'reload' }).catch(() => fetch(request))
  );
});
