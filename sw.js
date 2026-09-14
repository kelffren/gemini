/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater service worker
 * keys: UPDATE PWA SERVICEWORKER FRESH CACHE IPHONE STAGING
 * purpose: activa bytes ya precargados por KeloUpdater y fuerza red como fallback durante la aplicación explícita de una build
 * public-api: mensaje KELO_SKIP_WAITING; navegación con ?kelo_update=<build>; cache stage kelo-update-stage-v2-<build>
 * consumes: requests same-origin de KELO WORLD y Cache Storage de staging
 * state-owned: build de staging activa y ventana efímera de refresh; no persiste gameplay ni sesión
 * extension-points: futura estrategia de manifiesto de assets
 * reuse: worker único para actualización de la web instalada
 * legacy: N/A
 * do-not: no cachear estado/API gameplay ni inventar autoridad offline
 */
'use strict';

let forceFreshUntil = 0;
let activeStagedBuild = null;
const FORCE_FRESH_MS = 180000;
const BUILD_RE = /^[0-9a-f]{7,40}$/i;
const STAGE_CACHE_PREFIX = 'kelo-update-stage-v2-';

function normalizeBuild(value) {
  const build = String(value || '').trim();
  return BUILD_RE.test(build) ? build.toLowerCase() : null;
}

function stageCacheName(build) {
  const normalized = normalizeBuild(build);
  return normalized ? STAGE_CACHE_PREFIX + normalized : null;
}

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

async function stagedResponse(request, url, build) {
  const cacheName = stageCacheName(build);
  if (!cacheName) return null;

  try {
    const cache = await caches.open(cacheName);

    if (request.mode === 'navigate') {
      const cleanUrl = new URL(url.href);
      cleanUrl.searchParams.delete('kelo_update');
      cleanUrl.searchParams.delete('kelo_update_nonce');

      let match = await cache.match(cleanUrl.href);
      if (match) return match;

      const scopeUrl = new URL(self.registration.scope);
      match = await cache.match(scopeUrl.href);
      if (match) return match;

      match = await cache.match(new URL('index.html', scopeUrl).href);
      if (match) return match;
      return null;
    }

    return await cache.match(request, { ignoreSearch: false }) || await cache.match(url.href);
  } catch (_) {
    return null;
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' && url.searchParams.has('kelo_update')) {
    const targetBuild = normalizeBuild(url.searchParams.get('kelo_update'));
    if (targetBuild) activeStagedBuild = targetBuild;
    forceFreshUntil = Date.now() + FORCE_FRESH_MS;
  }

  if (Date.now() >= forceFreshUntil) return;

  event.respondWith((async () => {
    const staged = activeStagedBuild
      ? await stagedResponse(request, url, activeStagedBuild)
      : null;
    if (staged) return staged;

    try {
      return await fetch(request, { cache: 'reload' });
    } catch (_) {
      return fetch(request);
    }
  })());
});
