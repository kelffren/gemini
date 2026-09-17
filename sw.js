/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater service worker
 * keys: UPDATE PWA SERVICEWORKER DELTA HASH CACHE INSTANT PVP CREATORS IOS
 * purpose: activate staged builds from a shared content-addressed cache while keeping API/gameplay state network-owned; volatile first-use PvP/Creators code is network-first so installed iPhone PWAs cannot pin stale runtime modules.
 * public-api: KELO_SKIP_WAITING, KELO_SET_ACTIVE_BUILD, ?kelo_update=<build>
 * consumes: kelo-assets-v3, kelo-update-meta-v3, kelo-update-stage-v3-<build>
 * do-not: never cache API/session/gameplay responses
 */
'use strict';
let forceFreshUntil = 0; // kelo-sw-v6552 pwa-live-runtime

let activeStagedBuild = null;
let activeInstalledBuild = null;
const FORCE_FRESH_MS = 180000;
const BUILD_RE = /^[0-9a-f]{7,64}$/i;
const GIT_BLOB_RE = /^[0-9a-f]{40,64}$/i;
const STAGE_CACHE_PREFIX = 'kelo-update-stage-v3-';
const ASSET_CACHE_NAME = 'kelo-assets-v3';
const META_CACHE_NAME = 'kelo-update-meta-v3';
const MANIFEST_META_PATH = '__kelo_update_manifest_v3__.json';
const ACTIVE_BUILD_META_PATH = '__kelo_update_active_build_v3__.json';
const VOLATILE_EXACT = new Set([
  'engine-net.js',
  'src/core/pwa-freshness-guard.js',
  'src/core/module-loader.js',
  'src/core/feature-registry.js',
  'src/core/kelo-runtime-bootstrap.js',
  'src/core/creators-lazy-gate.js',
  'src/ui/studio-launcher.js',
  'src/characters/creator-avatar-runtime.mjs',
  'src/online/kelo-supabase-browser-session.mjs',
  'src/online/kelo-supabase-public-config.mjs',
  'src/visuals/combat-presentation-bridge.js'
]);
const VOLATILE_PREFIXES = Object.freeze([
  'src/creators/',
  'src/studio/',
  'src/abilities/',
  'src/systems/pvp',
  'src/systems/guardian',
  'src/systems/combat/',
  'src/systems/effects/',
  'src/systems/melee/',
  'src/ui/guardian'
]);
function normalizeBuild(value) { const build = String(value || '').trim(); return BUILD_RE.test(build) ? build.toLowerCase() : null; }
function normalizeBlob(value) { const blob = String(value || '').trim(); return GIT_BLOB_RE.test(blob) ? blob.toLowerCase() : null; }
function scopeUrl(pathname) { return new URL(pathname, self.registration.scope); }
function scopePath(url) {
  try {
    const scope = new URL(self.registration.scope);
    if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return null;
    return decodeURIComponent(url.pathname.slice(scope.pathname.length).replace(/^\/+/, '')) || 'index.html';
  } catch (_) { return null; }
}
function isVolatileRuntime(url) {
  if (url.searchParams.has('kelo_live')) return true;
  const path = scopePath(url); if (!path) return false;
  return VOLATILE_EXACT.has(path) || VOLATILE_PREFIXES.some((prefix) => path.startsWith(prefix));
}
function stageCacheName(build) { const normalized = normalizeBuild(build); return normalized ? STAGE_CACHE_PREFIX + normalized : null; }
function manifestMetaUrl(build) { const url = scopeUrl(MANIFEST_META_PATH); url.searchParams.set('build', normalizeBuild(build) || 'invalid'); return url.href; }
function activeBuildMetaUrl() { return scopeUrl(ACTIVE_BUILD_META_PATH).href; }
function assetObjectUrl(blob) { const normalized = normalizeBlob(blob); return normalized ? scopeUrl('__kelo_asset_v3__/' + normalized).href : null; }
async function readJson(response) { if (!response) return null; try { return await response.json(); } catch (_) { return null; } }
async function getManifest(build) {
  const normalized = normalizeBuild(build); if (!normalized) return null;
  try { const cache = await caches.open(META_CACHE_NAME); const manifest = await readJson(await cache.match(manifestMetaUrl(normalized))); return manifest && normalizeBuild(manifest.build) === normalized ? manifest : null; } catch (_) { return null; }
}
async function persistActiveBuild(build) {
  const normalized = normalizeBuild(build); if (!normalized) return; activeInstalledBuild = normalized;
  try { const cache = await caches.open(META_CACHE_NAME); await cache.put(activeBuildMetaUrl(), new Response(JSON.stringify({ build: normalized, updatedAt: new Date().toISOString() }), { headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } })); } catch (_) {}
}
async function resolveActiveBuild() {
  if (activeInstalledBuild) return activeInstalledBuild;
  try { const cache = await caches.open(META_CACHE_NAME); const payload = await readJson(await cache.match(activeBuildMetaUrl())); activeInstalledBuild = normalizeBuild(payload && payload.build); } catch (_) {}
  return activeInstalledBuild;
}
function findManifestEntry(manifest, url) {
  if (!manifest || !Array.isArray(manifest.files)) return null;
  const exact = manifest.files.find((entry) => entry && entry.url === url.href); if (exact) return exact;
  return manifest.files.find((entry) => { if (!entry || !entry.url) return false; try { const candidate = new URL(entry.url); return candidate.pathname === url.pathname && candidate.search === url.search; } catch (_) { return false; } }) || null;
}
async function contentAddressedResponse(url, build) {
  const manifest = await getManifest(build); const entry = findManifestEntry(manifest, url); const blob = normalizeBlob(entry && entry.blob); if (!blob) return null;
  try { const cache = await caches.open(ASSET_CACHE_NAME); return await cache.match(assetObjectUrl(blob)); } catch (_) { return null; }
}
async function stagedNavigation(url, build) {
  const cacheName = stageCacheName(build); if (!cacheName) return null;
  try {
    const cache = await caches.open(cacheName); const cleanUrl = new URL(url.href); cleanUrl.searchParams.delete('kelo_update'); cleanUrl.searchParams.delete('kelo_update_nonce');
    let match = await cache.match(cleanUrl.href); if (match) return match;
    const scope = new URL(self.registration.scope); match = await cache.match(scope.href); if (match) return match;
    return await cache.match(new URL('index.html', scope).href);
  } catch (_) { return null; }
}
async function stagedResponse(request, url, build) {
  if (request.mode === 'navigate') return stagedNavigation(url, build);
  const content = await contentAddressedResponse(url, build); if (content) return content;
  try { const cache = await caches.open(stageCacheName(build)); return await cache.match(request, { ignoreSearch: false }) || await cache.match(url.href); } catch (_) { return null; }
}
async function networkFirstVolatile(request, url) {
  try { return await fetch(request, { cache: 'reload' }); }
  catch (_) {
    const build = await resolveActiveBuild();
    if (build) { const cached = await contentAddressedResponse(url, build); if (cached) return cached; }
    throw _;
  }
}
self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch (_) {}
    await self.clients.claim();
  })());
});
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'KELO_SKIP_WAITING') { self.skipWaiting(); return; }
  if (data.type === 'KELO_SET_ACTIVE_BUILD') { const build = normalizeBuild(data.build); if (build) event.waitUntil(persistActiveBuild(build)); }
});
self.addEventListener('fetch', (event) => {
  const request = event.request; if (request.method !== 'GET') return;
  const url = new URL(request.url); if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate' && url.searchParams.has('kelo_update')) { const targetBuild = normalizeBuild(url.searchParams.get('kelo_update')); if (targetBuild) activeStagedBuild = targetBuild; forceFreshUntil = Date.now() + FORCE_FRESH_MS; }
  event.respondWith((async () => {
    if (Date.now() < forceFreshUntil && activeStagedBuild) {
      const staged = await stagedResponse(request, url, activeStagedBuild); if (staged) return staged;
      try { return await fetch(request, { cache: 'reload' }); } catch (_) { return fetch(request, { cache: 'reload' }); }
    }
    if (request.mode !== 'navigate' && isVolatileRuntime(url)) return networkFirstVolatile(request, url);
    if (request.mode !== 'navigate') {
      const build = await resolveActiveBuild();
      if (build) { const cached = await contentAddressedResponse(url, build); if (cached) return cached; }
    }
    return fetch(request);
  })());
});
