const DEFAULT_CACHE_NAME = 'kelo-community-assets-v1';
const DEFAULT_MAX_CACHE_BYTES = 128 * 1024 * 1024;

function keyFor(manifest) {
  return `${manifest.id}@${manifest.version || 1}`;
}

function assetPriority({ visible = false, distance = Infinity, profileOpen = false } = {}) {
  if (profileOpen) return 100;
  if (visible && distance <= 8) return 90;
  if (visible) return 75;
  if (distance <= 24) return 35;
  return 0;
}

function assertManifest(manifest) {
  if (!manifest?.id || !manifest?.url) throw new Error('invalid_asset_manifest');
  const parsed = new URL(manifest.url, globalThis.location?.href || 'https://local.invalid/');
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('invalid_asset_protocol');
  if (parsed.protocol === 'http:' && globalThis.location?.protocol === 'https:') throw new Error('mixed_content_asset_url');
  return parsed.href;
}

async function sha256Hex(blob) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function verifyBlob(blob, manifest) {
  if (manifest.bytes && blob.size !== Number(manifest.bytes)) throw new Error('asset_size_mismatch');
  if (manifest.mime && blob.type && blob.type !== manifest.mime) throw new Error('asset_mime_mismatch');
  if (manifest.sha256) {
    const hash = await sha256Hex(blob);
    if (hash && hash.toLowerCase() !== String(manifest.sha256).toLowerCase()) throw new Error('asset_hash_mismatch');
  }
}

export class DynamicAssetStreamManager extends EventTarget {
  constructor({ cacheName = DEFAULT_CACHE_NAME, concurrency = 3, maxCacheBytes = DEFAULT_MAX_CACHE_BYTES } = {}) {
    super();
    this.cacheName = cacheName;
    this.concurrency = Math.max(1, Math.min(6, Number(concurrency) || 3));
    this.maxCacheBytes = Math.max(16 * 1024 * 1024, Number(maxCacheBytes) || DEFAULT_MAX_CACHE_BYTES);
    this.memory = new Map();
    this.inFlight = new Map();
    this.queue = [];
    this.active = 0;
    this.playerKeys = new Map();
    this.lastUsed = new Map();
  }

  async requestAsset(manifest, { priority = 50 } = {}) {
    const key = keyFor(manifest);
    const existing = this.memory.get(key);
    if (existing) {
      this.lastUsed.set(key, Date.now());
      return existing;
    }
    if (this.inFlight.has(key)) return this.inFlight.get(key);

    const promise = new Promise((resolve, reject) => {
      this.queue.push({ manifest, key, priority, resolve, reject });
      this.queue.sort((a, b) => b.priority - a.priority);
      this.#pump();
    });
    this.inFlight.set(key, promise);
    promise.finally(() => this.inFlight.delete(key));
    return promise;
  }

  async syncPlayerAssets(playerId, manifests = [], context = {}) {
    const priority = assetPriority(context);
    const previous = this.playerKeys.get(String(playerId)) || new Set();
    const next = new Set();

    if (priority === 0) {
      this.playerKeys.set(String(playerId), next);
      return [];
    }

    const unique = [];
    for (const manifest of manifests) {
      if (!manifest?.id || !manifest?.url) continue;
      const key = keyFor(manifest);
      if (next.has(key)) continue;
      next.add(key);
      unique.push(manifest);
    }
    this.playerKeys.set(String(playerId), next);

    for (const key of previous) if (!next.has(key)) this.lastUsed.set(key, Date.now());

    const assets = await Promise.all(unique.map(manifest => this.requestAsset(manifest, { priority })));
    this.dispatchEvent(new CustomEvent('player-assets-ready', { detail: { playerId, assets } }));
    return assets;
  }

  releasePlayer(playerId) {
    this.playerKeys.delete(String(playerId));
  }

  async collectGarbage({ maxIdleMs = 15 * 60 * 1000 } = {}) {
    const pinned = new Set([...this.playerKeys.values()].flatMap(set => [...set]));
    const cutoff = Date.now() - maxIdleMs;
    for (const [key, entry] of this.memory) {
      if (pinned.has(key) || (this.lastUsed.get(key) || 0) > cutoff) continue;
      if (entry.objectUrl && globalThis.URL?.revokeObjectURL) URL.revokeObjectURL(entry.objectUrl);
      this.memory.delete(key);
      this.lastUsed.delete(key);
    }
    await this.#trimPersistentCache();
  }

  #pump() {
    while (this.active < this.concurrency && this.queue.length) {
      const task = this.queue.shift();
      this.active += 1;
      this.#load(task.manifest, task.key)
        .then(task.resolve, task.reject)
        .finally(() => {
          this.active -= 1;
          this.#pump();
        });
    }
  }

  async #load(manifest, key) {
    const url = assertManifest(manifest);
    let blob = await this.#readCache(url, manifest);
    let source = 'cache';

    if (!blob) {
      source = 'network';
      const response = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store' });
      if (!response.ok) throw new Error(`asset_fetch_failed_${response.status}`);
      blob = await response.blob();
      await verifyBlob(blob, manifest);
      await this.#writeCache(url, blob, manifest);
    }

    const objectUrl = globalThis.URL?.createObjectURL ? URL.createObjectURL(blob) : null;
    const entry = Object.freeze({ key, manifest, blob, objectUrl, source });
    this.memory.set(key, entry);
    this.lastUsed.set(key, Date.now());
    this.dispatchEvent(new CustomEvent('asset-ready', { detail: entry }));
    return entry;
  }

  async #readCache(url, manifest) {
    if (!globalThis.caches) return null;
    const cache = await caches.open(this.cacheName);
    const response = await cache.match(url);
    if (!response) return null;
    const blob = await response.blob();
    try {
      await verifyBlob(blob, manifest);
      return blob;
    } catch {
      await cache.delete(url);
      return null;
    }
  }

  async #writeCache(url, blob, manifest) {
    if (!globalThis.caches) return;
    const headers = new Headers({
      'content-type': manifest.mime || blob.type || 'application/octet-stream',
      'x-kelo-bytes': String(blob.size),
      'x-kelo-cached-at': String(Date.now()),
    });
    const cache = await caches.open(this.cacheName);
    await cache.put(url, new Response(blob, { status: 200, headers }));
  }

  async #trimPersistentCache() {
    if (!globalThis.caches) return;
    const cache = await caches.open(this.cacheName);
    const requests = await cache.keys();
    const entries = [];
    let total = 0;

    for (const request of requests) {
      const response = await cache.match(request);
      if (!response) continue;
      const bytes = Number(response.headers.get('x-kelo-bytes')) || Number(response.headers.get('content-length')) || 0;
      const cachedAt = Number(response.headers.get('x-kelo-cached-at')) || 0;
      total += bytes;
      entries.push({ request, bytes, cachedAt });
    }

    if (total <= this.maxCacheBytes) return;
    entries.sort((a, b) => a.cachedAt - b.cachedAt);
    for (const entry of entries) {
      if (total <= this.maxCacheBytes) break;
      if (await cache.delete(entry.request)) total -= entry.bytes;
    }
  }
}

export { assetPriority };
