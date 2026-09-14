/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater
 * keys: UPDATE PWA SERVICEWORKER BUILD VERSION IPHONE INSTALL STAGING PING NETWORK
 * purpose: detecta una build ya desplegada, la precarga en segundo plano solo con red razonable y la activa sin reinstalar el icono
 * public-api: KeloUpdater.check(), prepareUpdate(), applyUpdate(), evaluateNetwork(), setGameplayBusy(), getState()
 * consumes: version.json de Pages, Cache Storage same-origin, Service Worker, Network Information API opcional
 * state-owned: metadata del updater, staging de bytes estáticos y telemetría efímera de red; nunca estado gameplay
 * extension-points: eventos kelo:update:* y futura política de update obligatorio
 * reuse: owner único cliente del ciclo de actualización de la web instalada
 * legacy: N/A
 * do-not: no toca gameplay, auth, inventario, economía ni autoridad online
 */
(function initKeloUpdater(global) {
  'use strict';

  if (global.KeloUpdater) return;

  const STORAGE_KEY = 'kelo.world.updater.installedBuild.v1';
  const BUILD_RE = /^[0-9a-f]{7,40}$/i;
  const STAGE_CACHE_PREFIX = 'kelo-update-stage-v2-';
  const STAGE_META_PATH = '__kelo_update_stage_meta__.json';
  const PING_TIMEOUT_MS = 3500;
  const PROBE_FRESH_MS = 5000;
  const PAUSE_RETRY_MS = 6000;
  const FETCH_TIMEOUT_MS = 20000;
  const NETWORK_POLICY = Object.freeze({
    goodMaxMs: 100,
    fairMaxMs: 150,
    constrainedMaxMs: 200,
    goodDelayMs: 120,
    fairDelayMs: 650,
    constrainedDelayMs: 1500
  });

  const baseUrl = new URL('./', document.baseURI);
  const indexUrl = new URL('index.html', baseUrl);
  const versionUrl = new URL('version.json', baseUrl);
  const serviceWorkerUrl = new URL('sw.js', baseUrl);

  let stageGeneration = 0;
  let activeStagePromise = null;

  const state = {
    status: 'booting',
    installedBuild: readInstalledBuild(),
    deployedBuild: null,
    availableBuild: null,
    serviceWorkerReady: false,
    lastError: null,
    manualGameplayBusy: false,
    stage: {
      build: null,
      status: 'idle',
      total: 0,
      completed: 0,
      percent: 0,
      currentUrl: null
    },
    network: {
      status: 'unknown',
      pingMs: null,
      samples: [],
      failures: 0,
      saveData: false,
      effectiveType: null,
      downlinkMbps: null,
      lastDownloadMbps: null,
      lastProbeAt: 0,
      recovering: false,
      healthyStreak: 0,
      reason: null
    }
  };

  function safeStorageGet(key) {
    try { return global.localStorage ? global.localStorage.getItem(key) : null; }
    catch (_) { return null; }
  }

  function safeStorageSet(key, value) {
    try {
      if (global.localStorage) global.localStorage.setItem(key, value);
    } catch (_) {}
  }

  function normalizeBuild(value) {
    const build = String(value || '').trim();
    return BUILD_RE.test(build) ? build.toLowerCase() : null;
  }

  function readInstalledBuild() {
    return normalizeBuild(safeStorageGet(STORAGE_KEY));
  }

  function writeInstalledBuild(build) {
    const normalized = normalizeBuild(build);
    if (!normalized) return;
    state.installedBuild = normalized;
    safeStorageSet(STORAGE_KEY, normalized);
  }

  function copyNetworkState() {
    return {
      status: state.network.status,
      pingMs: state.network.pingMs,
      failures: state.network.failures,
      saveData: state.network.saveData,
      effectiveType: state.network.effectiveType,
      downlinkMbps: state.network.downlinkMbps,
      lastDownloadMbps: state.network.lastDownloadMbps,
      lastProbeAt: state.network.lastProbeAt,
      recovering: state.network.recovering,
      reason: state.network.reason
    };
  }

  function getState() {
    return Object.freeze({
      status: state.status,
      installedBuild: state.installedBuild,
      deployedBuild: state.deployedBuild,
      availableBuild: state.availableBuild,
      serviceWorkerReady: state.serviceWorkerReady,
      gameplayBusy: isGameplayBusy(),
      stage: Object.assign({}, state.stage),
      network: copyNetworkState(),
      lastError: state.lastError
    });
  }

  function emit(name, detail) {
    global.dispatchEvent(new CustomEvent('kelo:update:' + name, {
      detail: Object.assign({}, getState(), detail || {})
    }));
  }

  function median(values) {
    if (!values.length) return null;
    const sorted = values.slice().sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }

  function connectionHints() {
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
    return {
      saveData: !!(connection && connection.saveData),
      effectiveType: connection && connection.effectiveType ? String(connection.effectiveType) : null,
      downlinkMbps: connection && Number.isFinite(Number(connection.downlink)) ? Number(connection.downlink) : null,
      rtt: connection && Number.isFinite(Number(connection.rtt)) ? Number(connection.rtt) : null
    };
  }

  function isGameplayBusy() {
    if (state.manualGameplayBusy) return true;
    if (global.KELO_COMBAT_ENABLED === true) return true;
    try {
      if (global.KeloArena && typeof global.KeloArena.isActive === 'function' && global.KeloArena.isActive()) return true;
    } catch (_) {}
    return false;
  }

  function networkGateFromState() {
    if (!navigator.onLine) return { allow: false, delayMs: PAUSE_RETRY_MS, reason: 'offline' };
    if (document.visibilityState === 'hidden') return { allow: false, delayMs: PAUSE_RETRY_MS, reason: 'background' };
    if (isGameplayBusy()) return { allow: false, delayMs: 2500, reason: 'gameplay-priority' };
    if (state.network.saveData) return { allow: false, delayMs: 15000, reason: 'save-data' };
    if (state.network.effectiveType === 'slow-2g' || state.network.effectiveType === '2g') {
      return { allow: false, delayMs: 15000, reason: 'slow-network' };
    }
    if (state.network.status === 'good') return { allow: true, delayMs: NETWORK_POLICY.goodDelayMs, reason: 'good' };
    if (state.network.status === 'fair') return { allow: true, delayMs: NETWORK_POLICY.fairDelayMs, reason: 'fair' };
    if (state.network.status === 'constrained') return { allow: true, delayMs: NETWORK_POLICY.constrainedDelayMs, reason: 'constrained' };
    return { allow: false, delayMs: PAUSE_RETRY_MS, reason: state.network.reason || state.network.status || 'unknown' };
  }

  async function timedFetch(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = global.setTimeout(() => controller.abort(), Math.max(500, Number(timeoutMs) || FETCH_TIMEOUT_MS));
    try {
      return await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
    } finally {
      global.clearTimeout(timer);
    }
  }

  async function evaluateNetwork(options) {
    const opts = options || {};
    const hints = connectionHints();
    state.network.saveData = hints.saveData;
    state.network.effectiveType = hints.effectiveType;
    state.network.downlinkMbps = hints.downlinkMbps;

    if (!navigator.onLine) {
      state.network.status = 'offline';
      state.network.reason = 'offline';
      state.network.lastProbeAt = Date.now();
      return Object.assign({ allow: false, delayMs: PAUSE_RETRY_MS }, copyNetworkState());
    }

    if (document.visibilityState === 'hidden') {
      state.network.status = 'background';
      state.network.reason = 'background';
      state.network.lastProbeAt = Date.now();
      return Object.assign({ allow: false, delayMs: PAUSE_RETRY_MS }, copyNetworkState());
    }

    if (isGameplayBusy() && !opts.ignoreGameplayPriority) {
      state.network.status = 'gameplay-priority';
      state.network.reason = 'gameplay-priority';
      state.network.lastProbeAt = Date.now();
      return Object.assign({ allow: false, delayMs: 2500 }, copyNetworkState());
    }

    if (hints.saveData) {
      state.network.status = 'save-data';
      state.network.reason = 'save-data';
      state.network.lastProbeAt = Date.now();
      return Object.assign({ allow: false, delayMs: 15000 }, copyNetworkState());
    }

    if (hints.effectiveType === 'slow-2g' || hints.effectiveType === '2g') {
      state.network.status = 'slow-network';
      state.network.reason = 'slow-network';
      state.network.lastProbeAt = Date.now();
      return Object.assign({ allow: false, delayMs: 15000 }, copyNetworkState());
    }

    const probeUrl = new URL(versionUrl.href);
    probeUrl.searchParams.set('_kelo_ping', Date.now().toString(36));
    const startedAt = performance.now();

    try {
      const response = await timedFetch(probeUrl.href, {
        cache: 'no-store',
        credentials: 'same-origin'
      }, PING_TIMEOUT_MS);
      if (!response.ok) throw new Error('ping_http_' + response.status);
      await response.text();

      const measured = Math.max(1, Math.round(performance.now() - startedAt));
      state.network.samples.push(measured);
      if (state.network.samples.length > 5) state.network.samples.shift();

      const sampleMedian = median(state.network.samples);
      const effectivePing = hints.rtt != null ? Math.max(sampleMedian || measured, hints.rtt) : (sampleMedian || measured);
      state.network.pingMs = Math.round(effectivePing);
      state.network.failures = 0;
      state.network.lastProbeAt = Date.now();

      let nextStatus = 'poor';
      let nextReason = 'latency';
      if (effectivePing <= NETWORK_POLICY.goodMaxMs) {
        nextStatus = 'good';
        nextReason = null;
      } else if (effectivePing <= NETWORK_POLICY.fairMaxMs) {
        nextStatus = 'fair';
        nextReason = null;
      } else if (effectivePing <= NETWORK_POLICY.constrainedMaxMs) {
        nextStatus = 'constrained';
        nextReason = null;
      }

      if (hints.downlinkMbps != null && hints.downlinkMbps < 0.8) {
        nextStatus = 'poor';
        nextReason = 'low-throughput';
      }

      if (nextStatus === 'poor') {
        state.network.recovering = true;
        state.network.healthyStreak = 0;
        state.network.status = 'poor';
        state.network.reason = nextReason;
      } else if (state.network.recovering) {
        state.network.healthyStreak += 1;
        if (state.network.healthyStreak < 2) {
          state.network.status = 'recovering';
          state.network.reason = 'latency-recovery';
        } else {
          state.network.recovering = false;
          state.network.healthyStreak = 0;
          state.network.status = nextStatus;
          state.network.reason = null;
        }
      } else {
        state.network.status = nextStatus;
        state.network.reason = null;
      }
    } catch (error) {
      state.network.failures += 1;
      state.network.lastProbeAt = Date.now();
      state.network.recovering = true;
      state.network.healthyStreak = 0;
      state.network.status = 'unstable';
      state.network.reason = error && error.name === 'AbortError' ? 'timeout' : 'probe-failed';
    }

    const gate = networkGateFromState();
    const snapshot = Object.assign({ allow: gate.allow, delayMs: gate.delayMs }, copyNetworkState());
    emit('network', snapshot);
    return snapshot;
  }

  async function fetchDeployedBuild() {
    const url = new URL(versionUrl.href);
    url.searchParams.set('_kelo_check', Date.now().toString(36));
    const response = await fetch(url.href, {
      cache: 'no-store',
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error('version_http_' + response.status);

    let payload;
    try { payload = await response.json(); }
    catch (_) { throw new Error('version_not_json'); }

    const build = normalizeBuild(payload && payload.sha);
    if (!build) throw new Error('version_missing_sha');
    return build;
  }

  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || !global.isSecureContext) {
      state.serviceWorkerReady = false;
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register(serviceWorkerUrl.href, {
        scope: baseUrl.pathname,
        updateViaCache: 'none'
      });
      try { await registration.update(); } catch (_) {}
      await navigator.serviceWorker.ready;
      state.serviceWorkerReady = true;
      return registration;
    } catch (error) {
      state.serviceWorkerReady = false;
      state.lastError = String(error && error.message || error);
      emit('service-worker-error');
      return null;
    }
  }

  function requestedUpdateBuild() {
    try {
      return normalizeBuild(new URL(global.location.href).searchParams.get('kelo_update'));
    } catch (_) {
      return null;
    }
  }

  function clearUpdateQuery() {
    try {
      const url = new URL(global.location.href);
      if (!url.searchParams.has('kelo_update') && !url.searchParams.has('kelo_update_nonce')) return;
      url.searchParams.delete('kelo_update');
      url.searchParams.delete('kelo_update_nonce');
      global.history.replaceState(global.history.state, '', url.href);
    } catch (_) {}
  }

  function stageCacheName(build) {
    return STAGE_CACHE_PREFIX + normalizeBuild(build);
  }

  function stageMetaUrl(build) {
    const url = new URL(STAGE_META_PATH, baseUrl);
    url.searchParams.set('build', normalizeBuild(build) || 'invalid');
    return url.href;
  }

  async function isBuildStaged(build) {
    const normalized = normalizeBuild(build);
    if (!normalized || !('caches' in global)) return false;
    try {
      const cache = await caches.open(stageCacheName(normalized));
      const response = await cache.match(stageMetaUrl(normalized));
      if (!response) return false;
      const payload = await response.json();
      return !!(payload && payload.complete === true && normalizeBuild(payload.build) === normalized);
    } catch (_) {
      return false;
    }
  }

  async function cleanupStageCaches(keepBuild) {
    if (!('caches' in global)) return;
    const keepName = keepBuild ? stageCacheName(keepBuild) : null;
    try {
      const names = await caches.keys();
      await Promise.all(names
        .filter((name) => name.startsWith(STAGE_CACHE_PREFIX) && name !== keepName)
        .map((name) => caches.delete(name)));
    } catch (_) {}
  }

  function isStageableUrl(value) {
    try {
      const url = new URL(value, baseUrl);
      if (url.origin !== baseUrl.origin) return false;
      if (!url.pathname.startsWith(baseUrl.pathname)) return false;
      if (url.pathname === versionUrl.pathname || url.pathname === serviceWorkerUrl.pathname) return false;
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
      if (/\/(?:api|auth)\//i.test(url.pathname)) return false;
      return true;
    } catch (_) {
      return false;
    }
  }

  function assetPriority(url, source) {
    const pathname = new URL(url).pathname.toLowerCase();
    if (source === 'index') return 0;
    if (pathname.endsWith('.css') || pathname.endsWith('.webmanifest')) return 1;
    if (pathname.includes('/src/core/') || pathname.includes('engine-net')) return 2;
    if (pathname.endsWith('.js') || pathname.endsWith('.mjs')) return 3;
    if (/\.(woff2?|ttf|otf)$/.test(pathname)) return 4;
    if (/\.(png|jpe?g|webp|gif|svg|avif)$/.test(pathname)) return 5;
    return 4;
  }

  async function buildStagePlan(build) {
    const freshIndexUrl = new URL(indexUrl.href);
    freshIndexUrl.searchParams.set('_kelo_stage', build);
    freshIndexUrl.searchParams.set('_kelo_nonce', Date.now().toString(36));

    const indexResponse = await timedFetch(freshIndexUrl.href, {
      cache: 'reload',
      credentials: 'same-origin'
    }, FETCH_TIMEOUT_MS);
    if (!indexResponse.ok) throw new Error('stage_index_http_' + indexResponse.status);

    const indexForCache = indexResponse.clone();
    const html = await indexResponse.text();
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    const entries = new Map();

    function add(value, source, required) {
      if (!value || !isStageableUrl(value)) return;
      const url = new URL(value, baseUrl);
      url.hash = '';
      const key = url.href;
      if (key === baseUrl.href || key === indexUrl.href) return;
      const existing = entries.get(key);
      if (existing) {
        existing.required = existing.required || !!required;
        return;
      }
      entries.set(key, {
        url: key,
        source: source || 'index',
        required: !!required,
        priority: assetPriority(key, source || 'index')
      });
    }

    parsed.querySelectorAll('script[src]').forEach((node) => add(node.getAttribute('src'), 'index', true));
    parsed.querySelectorAll('link[href]').forEach((node) => {
      const rel = String(node.getAttribute('rel') || '').toLowerCase();
      if (/(stylesheet|preload|modulepreload|manifest|icon)/.test(rel)) add(node.getAttribute('href'), 'index', true);
    });

    try {
      performance.getEntriesByType('resource').forEach((entry) => {
        const name = entry && entry.name;
        if (!name || !isStageableUrl(name)) return;
        if (!/\.(?:js|mjs|css|png|jpe?g|webp|svg|woff2?|ttf|otf)(?:[?#].*)?$/i.test(name)) return;
        add(name, 'session', false);
      });
    } catch (_) {}

    const plan = Array.from(entries.values()).sort((a, b) => a.priority - b.priority);
    return { plan, indexForCache };
  }

  function updateStageProgress(build, completed, total, currentUrl) {
    state.stage.build = build;
    state.stage.completed = completed;
    state.stage.total = total;
    state.stage.percent = total ? Math.min(100, Math.round((completed / total) * 100)) : 0;
    state.stage.currentUrl = currentUrl || null;
    emit('staging-progress', {
      build,
      completed,
      total,
      percent: state.stage.percent,
      pingMs: state.network.pingMs,
      networkStatus: state.network.status
    });
  }

  function sleep(ms) {
    return new Promise((resolve) => global.setTimeout(resolve, Math.max(0, Number(ms) || 0)));
  }

  async function waitForNetworkGate(generation, build) {
    for (;;) {
      if (generation !== stageGeneration || state.availableBuild !== build) throw new Error('stage_cancelled');

      const immediate = networkGateFromState();
      const probeIsFresh = Date.now() - state.network.lastProbeAt < PROBE_FRESH_MS;
      const gate = probeIsFresh && immediate.reason !== 'unknown'
        ? immediate
        : await evaluateNetwork();

      if (gate.allow) {
        if (state.stage.status === 'paused') {
          state.stage.status = 'downloading';
          emit('staging-resumed', { build, pingMs: state.network.pingMs, networkStatus: state.network.status });
        }
        return gate;
      }

      state.stage.status = 'paused';
      state.network.reason = gate.reason || state.network.reason;
      emit('staging-paused', {
        build,
        reason: gate.reason || state.network.reason,
        pingMs: state.network.pingMs,
        networkStatus: state.network.status
      });
      await sleep(gate.delayMs || PAUSE_RETRY_MS);
      state.network.lastProbeAt = 0;
    }
  }

  async function fetchAndStage(cache, entry) {
    const startedAt = performance.now();
    const response = await timedFetch(entry.url, {
      cache: 'reload',
      credentials: 'same-origin'
    }, FETCH_TIMEOUT_MS);
    if (!response.ok) throw new Error('stage_asset_http_' + response.status);

    const elapsedMs = Math.max(1, performance.now() - startedAt);
    const bytes = Number(response.headers.get('content-length')) || 0;
    if (bytes > 0) {
      state.network.lastDownloadMbps = Math.round(((bytes * 8) / (elapsedMs / 1000) / 1000000) * 10) / 10;
    }

    await cache.put(entry.url, response.clone());
  }

  async function prepareUpdate(build) {
    const targetBuild = normalizeBuild(build || state.availableBuild || state.deployedBuild);
    if (!targetBuild) throw new Error('no_update_build');
    if (state.installedBuild === targetBuild) return getState();

    if (!('caches' in global)) {
      state.status = 'available';
      state.stage = { build: targetBuild, status: 'unsupported', total: 0, completed: 0, percent: 0, currentUrl: null };
      emit('staging-unsupported', { build: targetBuild });
      return getState();
    }

    if (await isBuildStaged(targetBuild)) {
      state.status = 'ready';
      state.stage.build = targetBuild;
      state.stage.status = 'ready';
      state.stage.percent = 100;
      emit('staged', { build: targetBuild, percent: 100, reused: true });
      return getState();
    }

    if (activeStagePromise && state.stage.build === targetBuild && ['planning', 'downloading', 'paused'].includes(state.stage.status)) {
      return activeStagePromise;
    }

    const generation = ++stageGeneration;
    state.status = 'preparing';
    state.stage = { build: targetBuild, status: 'planning', total: 0, completed: 0, percent: 0, currentUrl: null };
    state.lastError = null;
    emit('staging', { build: targetBuild });

    activeStagePromise = (async () => {
      await cleanupStageCaches(targetBuild);
      await waitForNetworkGate(generation, targetBuild);
      const { plan, indexForCache } = await buildStagePlan(targetBuild);
      if (generation !== stageGeneration || state.availableBuild !== targetBuild) throw new Error('stage_cancelled');

      const cache = await caches.open(stageCacheName(targetBuild));
      await cache.put(baseUrl.href, indexForCache.clone());
      await cache.put(indexUrl.href, indexForCache.clone());

      const total = plan.length + 1;
      let completed = 1;
      state.stage.status = 'downloading';
      updateStageProgress(targetBuild, completed, total, indexUrl.href);

      for (const entry of plan) {
        if (generation !== stageGeneration || state.availableBuild !== targetBuild) throw new Error('stage_cancelled');

        const existing = await cache.match(entry.url);
        if (!existing) {
          let attempts = 0;
          let staged = false;
          while (!staged && attempts < 3) {
            attempts += 1;
            const gate = await waitForNetworkGate(generation, targetBuild);
            try {
              await fetchAndStage(cache, entry);
              staged = true;
              if (gate.delayMs) await sleep(gate.delayMs);
            } catch (error) {
              state.network.failures += 1;
              state.network.recovering = true;
              state.network.status = 'unstable';
              state.network.reason = error && error.name === 'AbortError' ? 'timeout' : 'download-failed';
              state.network.lastProbeAt = 0;
              if (!entry.required && attempts >= 2) break;
              if (attempts >= 3) throw error;
              state.stage.status = 'paused';
              emit('staging-paused', {
                build: targetBuild,
                reason: state.network.reason,
                pingMs: state.network.pingMs,
                networkStatus: state.network.status
              });
              await sleep(PAUSE_RETRY_MS);
            }
          }
        }

        completed += 1;
        updateStageProgress(targetBuild, completed, total, entry.url);
      }

      await cache.put(stageMetaUrl(targetBuild), new Response(JSON.stringify({
        build: targetBuild,
        complete: true,
        total,
        completedAt: new Date().toISOString()
      }), {
        headers: { 'content-type': 'application/json' }
      }));

      if (generation !== stageGeneration || state.availableBuild !== targetBuild) throw new Error('stage_cancelled');
      state.status = 'ready';
      state.stage.status = 'ready';
      state.stage.percent = 100;
      state.stage.currentUrl = null;
      emit('staged', {
        build: targetBuild,
        completed: total,
        total,
        percent: 100,
        pingMs: state.network.pingMs
      });
      return getState();
    })().catch((error) => {
      if (String(error && error.message || error) === 'stage_cancelled') return getState();
      state.status = 'available';
      state.stage.status = 'error';
      state.lastError = String(error && error.message || error);
      emit('staging-error', { build: targetBuild, error: state.lastError });
      return getState();
    }).finally(() => {
      if (generation === stageGeneration) activeStagePromise = null;
    });

    return activeStagePromise;
  }

  async function check(options) {
    const opts = options || {};
    if (state.status === 'checking' && !opts.force) return getState();

    const previousStatus = state.status;
    state.status = 'checking';
    state.lastError = null;
    emit('checking');

    try {
      const deployedBuild = await fetchDeployedBuild();
      state.deployedBuild = deployedBuild;

      const requestedBuild = requestedUpdateBuild();
      if (requestedBuild && requestedBuild === deployedBuild) {
        writeInstalledBuild(deployedBuild);
        clearUpdateQuery();
        scheduleStageCleanup();
      }

      if (!state.installedBuild) {
        writeInstalledBuild(deployedBuild);
      }

      if (state.installedBuild !== deployedBuild) {
        state.availableBuild = deployedBuild;
        state.status = previousStatus === 'ready' && state.stage.build === deployedBuild ? 'ready' : 'available';
        emit('available', { build: deployedBuild });
        prepareUpdate(deployedBuild).catch(() => {});
      } else {
        stageGeneration += 1;
        state.availableBuild = null;
        state.status = 'current';
        state.stage = { build: null, status: 'idle', total: 0, completed: 0, percent: 0, currentUrl: null };
        emit('current', { build: deployedBuild });
        if (!requestedBuild) cleanupStageCaches(null).catch(() => {});
      }
    } catch (error) {
      state.status = previousStatus === 'ready' ? 'ready' : 'error';
      state.lastError = String(error && error.message || error);
      emit('error');
    }

    return getState();
  }

  function scheduleStageCleanup() {
    const cleanup = () => global.setTimeout(() => cleanupStageCaches(null).catch(() => {}), 3500);
    if (document.readyState === 'complete') cleanup();
    else global.addEventListener('load', cleanup, { once: true });
  }

  function waitForController(maxMs) {
    if (!navigator.serviceWorker || navigator.serviceWorker.controller) return Promise.resolve();

    return new Promise((resolve) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        navigator.serviceWorker.removeEventListener('controllerchange', finish);
        resolve();
      };
      navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
      global.setTimeout(finish, Math.max(250, Number(maxMs) || 1800));
    });
  }

  async function applyUpdate() {
    if (!state.availableBuild) await check({ force: true });
    const targetBuild = state.availableBuild || state.deployedBuild;
    if (!targetBuild) throw new Error('no_update_build');

    const staged = await isBuildStaged(targetBuild);
    if (!staged && state.stage.status !== 'unsupported') {
      await prepareUpdate(targetBuild);
      if (!await isBuildStaged(targetBuild)) throw new Error('update_not_staged');
    }

    state.status = 'applying';
    emit('applying', { build: targetBuild });

    const registration = await registerServiceWorker();
    if (registration && registration.waiting) {
      try { registration.waiting.postMessage({ type: 'KELO_SKIP_WAITING' }); } catch (_) {}
    }
    await waitForController(1800);

    const nextUrl = new URL(global.location.href);
    nextUrl.searchParams.set('kelo_update', targetBuild);
    nextUrl.searchParams.set('kelo_update_nonce', Date.now().toString(36));
    global.location.replace(nextUrl.href);
  }

  function setGameplayBusy(busy, source) {
    state.manualGameplayBusy = !!busy;
    state.network.lastProbeAt = 0;
    emit('network-priority', {
      busy: state.manualGameplayBusy,
      source: String(source || 'manual')
    });
    return getState();
  }

  function setNetworkPriority(priority, source) {
    const value = String(priority || '').toLowerCase();
    return setGameplayBusy(value === 'critical' || value === 'gameplay' || value === 'combat', source || 'priority-api');
  }

  async function boot() {
    await registerServiceWorker();
    await check({ force: true });
  }

  global.KeloUpdater = Object.freeze({
    check,
    prepareUpdate,
    applyUpdate,
    evaluateNetwork,
    setGameplayBusy,
    setNetworkPriority,
    getState
  });

  global.addEventListener('kelo:network-priority', (event) => {
    const detail = event && event.detail || {};
    if (typeof detail.busy === 'boolean') setGameplayBusy(detail.busy, detail.source || 'event');
    else if (detail.priority) setNetworkPriority(detail.priority, detail.source || 'event');
  });

  document.addEventListener('visibilitychange', () => {
    state.network.lastProbeAt = 0;
    if (document.visibilityState === 'visible') check().catch(() => {});
  });
  global.addEventListener('online', () => {
    state.network.lastProbeAt = 0;
    check().catch(() => {});
  });
  global.addEventListener('offline', () => {
    state.network.status = 'offline';
    state.network.reason = 'offline';
    state.network.lastProbeAt = Date.now();
  });
  global.addEventListener('pageshow', (event) => {
    if (event.persisted) check({ force: true }).catch(() => {});
  });

  boot().catch((error) => {
    state.status = 'error';
    state.lastError = String(error && error.message || error);
    emit('error');
  });
})(window);
