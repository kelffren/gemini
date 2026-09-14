/* KELO-INDEX
 * area: CORE
 * owner: KeloUpdater
 * keys: UPDATE PWA SERVICEWORKER BUILD VERSION IPHONE INSTALL
 * purpose: detecta una nueva build ya desplegada en Pages y coordina una recarga fresca sin reinstalar el icono
 * public-api: KeloUpdater.check(), KeloUpdater.applyUpdate(), KeloUpdater.getState()
 * consumes: version.json de Pages, Service Worker same-origin, localStorage solo para metadata del updater
 * state-owned: build instalada conocida, build desplegada, build disponible y estado del updater
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
  const baseUrl = new URL('./', document.baseURI);
  const versionUrl = new URL('version.json', baseUrl);
  const serviceWorkerUrl = new URL('sw.js', baseUrl);

  const state = {
    status: 'booting',
    installedBuild: readInstalledBuild(),
    deployedBuild: null,
    availableBuild: null,
    serviceWorkerReady: false,
    lastError: null
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

  function getState() {
    return Object.freeze({
      status: state.status,
      installedBuild: state.installedBuild,
      deployedBuild: state.deployedBuild,
      availableBuild: state.availableBuild,
      serviceWorkerReady: state.serviceWorkerReady,
      lastError: state.lastError
    });
  }

  function emit(name, detail) {
    global.dispatchEvent(new CustomEvent('kelo:update:' + name, {
      detail: Object.assign({}, getState(), detail || {})
    }));
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

  async function check(options) {
    const opts = options || {};
    if (state.status === 'checking' && !opts.force) return getState();

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
      }

      if (!state.installedBuild) {
        writeInstalledBuild(deployedBuild);
      }

      if (state.installedBuild !== deployedBuild) {
        state.availableBuild = deployedBuild;
        state.status = 'available';
        emit('available', { build: deployedBuild });
      } else {
        state.availableBuild = null;
        state.status = 'current';
        emit('current', { build: deployedBuild });
      }
    } catch (error) {
      state.status = 'error';
      state.lastError = String(error && error.message || error);
      emit('error');
    }

    return getState();
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

  async function boot() {
    await registerServiceWorker();
    await check({ force: true });
  }

  global.KeloUpdater = Object.freeze({
    check,
    applyUpdate,
    getState
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') check().catch(() => {});
  });
  global.addEventListener('online', () => check().catch(() => {}));
  global.addEventListener('pageshow', (event) => {
    if (event.persisted) check({ force: true }).catch(() => {});
  });

  boot().catch((error) => {
    state.status = 'error';
    state.lastError = String(error && error.message || error);
    emit('error');
  });
})(window);
