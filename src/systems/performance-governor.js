(function (root) {
  'use strict';

  const VERSION = '1.0.0';
  const TARGET_FPS = 60;
  const TARGET_FRAME_MS = 1000 / TARGET_FPS;
  const SAMPLE_ALPHA = 0.08;
  const REPORT_TTL_MS = 750;

  const WEIGHTS = Object.freeze({
    chunk: 2,
    staticProp: 1,
    animatedProp: 3,
    npc: 4,
    player: 5,
    mountRider: 7,
    projectile: 2,
    particle: 0.35,
    simpleFx: 2,
    complexFx: 5,
    dynamicLight: 10
  });

  const PROFILES = Object.freeze([
    Object.freeze({ id: 'ultra', label: 'ULTRA', weightedBudget: 500, particleCap: 240, fxCap: 48, actorCutoff: 2200, nearHz: 60, midHz: 30, farHz: 15, farCutoff: 1800 }),
    Object.freeze({ id: 'high', label: 'HIGH', weightedBudget: 420, particleCap: 180, fxCap: 36, actorCutoff: 1800, nearHz: 60, midHz: 30, farHz: 15, farCutoff: 1500 }),
    Object.freeze({ id: 'medium', label: 'MEDIUM', weightedBudget: 330, particleCap: 120, fxCap: 24, actorCutoff: 1500, nearHz: 60, midHz: 30, farHz: 12, farCutoff: 1250 }),
    Object.freeze({ id: 'performance', label: 'PERFORMANCE', weightedBudget: 240, particleCap: 72, fxCap: 16, actorCutoff: 1200, nearHz: 45, midHz: 24, farHz: 10, farCutoff: 1000 })
  ]);

  const reported = new Map();
  const textureMemory = new Map();
  const updateClock = new Map();
  let profileIndex = 1;
  let manualProfile = null;
  let lastFrameAt = performance.now();
  let emaFrameMs = TARGET_FRAME_MS;
  let badMs = 0;
  let goodMs = 0;
  let lastHudAt = 0;
  let hud = null;
  let hudEnabled = false;
  let lastSnapshot = null;

  function safeGlobal(name) {
    try {
      if (name === 'particles' && typeof particles !== 'undefined') return particles;
      if (name === 'simulatedPlayers' && typeof simulatedPlayers !== 'undefined') return simulatedPlayers;
      if (name === 'arenaPvP' && typeof arenaPvP !== 'undefined') return arenaPvP;
      if (name === 'localPlayer' && typeof localPlayer !== 'undefined') return localPlayer;
      if (name === 'camera' && typeof camera !== 'undefined') return camera;
      if (name === 'CONFIG' && typeof CONFIG !== 'undefined') return CONFIG;
      if (name === 'screenW' && typeof screenW !== 'undefined') return screenW;
      if (name === 'screenH' && typeof screenH !== 'undefined') return screenH;
    } catch (e) {}
    return root[name];
  }

  function profile() {
    if (manualProfile) return PROFILES.find(p => p.id === manualProfile) || PROFILES[profileIndex];
    return PROFILES[profileIndex];
  }

  function estimateActiveChunks() {
    const cfg = safeGlobal('CONFIG') || {};
    const cam = safeGlobal('camera') || { x: 1440, y: 1520 };
    const sw = Number(safeGlobal('screenW')) || root.innerWidth || 390;
    const sh = Number(safeGlobal('screenH')) || root.innerHeight || 844;
    const z = Number(cfg.zoom) || 1;
    const chunk = Number(root.KELO_WORLD_RENDERER && root.KELO_WORLD_RENDERER.chunkSize) || 512;
    const worldW = Number(cfg.worldWidth) || 3600;
    const worldH = Number(cfg.worldHeight) || 3200;
    const hw = sw / (2 * z) + chunk;
    const hh = sh / (2 * z) + chunk;
    const minX = Math.max(0, Math.floor((cam.x - hw) / chunk));
    const maxX = Math.min(Math.ceil(worldW / chunk) - 1, Math.floor((cam.x + hw) / chunk));
    const minY = Math.max(0, Math.floor((cam.y - hh) / chunk));
    const maxY = Math.min(Math.ceil(worldH / chunk) - 1, Math.floor((cam.y + hh) / chunk));
    return Math.max(0, maxX - minX + 1) * Math.max(0, maxY - minY + 1);
  }

  function getBuiltInCounts() {
    const ps = safeGlobal('particles');
    const bots = safeGlobal('simulatedPlayers');
    const arena = safeGlobal('arenaPvP');
    return {
      chunk: estimateActiveChunks(),
      player: 1 + (Array.isArray(bots) ? bots.length : 0),
      projectile: arena && Array.isArray(arena.projectiles) ? arena.projectiles.length : 0,
      particle: Array.isArray(ps) ? ps.length : 0
    };
  }

  function liveReportedCounts(now) {
    const out = {};
    for (const [kind, item] of reported) {
      if (now - item.at > REPORT_TTL_MS) {
        reported.delete(kind);
        continue;
      }
      out[kind] = Math.max(0, Number(item.count) || 0);
    }
    return out;
  }

  function weightedCost(counts) {
    let total = 0;
    for (const [kind, count] of Object.entries(counts)) total += (WEIGHTS[kind] || 1) * (Number(count) || 0);
    return total;
  }

  function textureMB() {
    let bytes = 0;
    for (const item of textureMemory.values()) bytes += item.bytes;
    return bytes / (1024 * 1024);
  }

  function buildSnapshot(now) {
    const counts = Object.assign({}, getBuiltInCounts());
    const external = liveReportedCounts(now);
    for (const [kind, count] of Object.entries(external)) counts[kind] = Math.max(counts[kind] || 0, count);
    const p = profile();
    const cost = weightedCost(counts);
    return Object.freeze({
      version: VERSION,
      targetFps: TARGET_FPS,
      targetFrameMs: TARGET_FRAME_MS,
      fps: 1000 / Math.max(1, emaFrameMs),
      frameMs: emaFrameMs,
      quality: p.id,
      manualQuality: manualProfile,
      weightedCost: cost,
      weightedBudget: p.weightedBudget,
      pressure: cost / p.weightedBudget,
      particleCap: p.particleCap,
      fxCap: p.fxCap,
      actorCutoff: p.actorCutoff,
      textureMB: textureMB(),
      counts: Object.freeze(counts)
    });
  }

  function dispatchQualityChange(previous, next) {
    if (document.body) document.body.dataset.keloQuality = next.id;
    try { root.dispatchEvent(new CustomEvent('kelo:qualitychange', { detail: { previous: previous.id, quality: next.id, profile: next } })); } catch (e) {}
  }

  function setProfileIndex(nextIndex) {
    const clamped = Math.max(0, Math.min(PROFILES.length - 1, nextIndex));
    if (clamped === profileIndex) return;
    const previous = PROFILES[profileIndex];
    profileIndex = clamped;
    dispatchQualityChange(previous, PROFILES[profileIndex]);
  }

  function autoTune(dt, snapshot) {
    if (manualProfile || document.hidden) return;
    const overloaded = snapshot.fps < 52 || snapshot.frameMs > 19.2 || snapshot.pressure > 1.05;
    const healthy = snapshot.fps > 58 && snapshot.frameMs < 17.0 && snapshot.pressure < 0.72;
    if (overloaded) {
      badMs += dt;
      goodMs = Math.max(0, goodMs - dt * 2);
    } else if (healthy) {
      goodMs += dt;
      badMs = Math.max(0, badMs - dt);
    } else {
      badMs = Math.max(0, badMs - dt * 0.35);
      goodMs = Math.max(0, goodMs - dt * 0.35);
    }
    if (badMs >= 1800 && profileIndex < PROFILES.length - 1) {
      setProfileIndex(profileIndex + 1); badMs = 0; goodMs = 0;
    } else if (goodMs >= 6000 && profileIndex > 0) {
      setProfileIndex(profileIndex - 1); badMs = 0; goodMs = 0;
    }
  }

  function ensureHud() {
    if (hud || !document.body) return;
    hud = document.createElement('div');
    hud.id = 'kelo-perf-hud';
    hud.style.cssText = 'position:fixed;left:8px;bottom:max(8px,env(safe-area-inset-bottom));z-index:99999;pointer-events:none;background:rgba(5,7,10,.88);border:1px solid rgba(231,197,106,.45);color:#f1d58b;border-radius:10px;padding:7px 9px;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;display:none;backdrop-filter:blur(6px)';
    document.body.appendChild(hud);
  }

  function updateHud(now, snapshot) {
    if (!hudEnabled || now - lastHudAt < 400) return;
    lastHudAt = now;
    ensureHud();
    if (!hud) return;
    hud.style.display = 'block';
    hud.textContent = 'KELO PERF ' + VERSION + '\n' + snapshot.quality.toUpperCase() + '  ' + snapshot.fps.toFixed(1) + ' FPS  ' + snapshot.frameMs.toFixed(2) + 'ms\n' + 'budget ' + snapshot.weightedCost.toFixed(1) + '/' + snapshot.weightedBudget + '  ' + Math.round(snapshot.pressure * 100) + '%\n' + 'chunks ' + (snapshot.counts.chunk || 0) + '  actors ' + (snapshot.counts.player || 0) + '  particles ' + (snapshot.counts.particle || 0) + '/' + snapshot.particleCap + '\n' + 'textures ' + snapshot.textureMB.toFixed(1) + ' MB';
  }

  function frame(now) {
    const rawDt = now - lastFrameAt;
    lastFrameAt = now;
    if (!document.hidden && rawDt > 0 && rawDt < 120) {
      emaFrameMs += (rawDt - emaFrameMs) * SAMPLE_ALPHA;
      const snapshot = buildSnapshot(now);
      lastSnapshot = snapshot;
      autoTune(rawDt, snapshot);
      updateHud(now, snapshot);
    }
    root.requestAnimationFrame(frame);
  }

  function reportVisible(kind, count) {
    if (!kind) return;
    reported.set(String(kind), { count: Math.max(0, Number(count) || 0), at: performance.now() });
  }

  function canSpawn(kind, count) {
    const p = profile();
    const n = Math.max(1, Number(count) || 1);
    const snapshot = lastSnapshot || buildSnapshot(performance.now());
    if (kind === 'particle' && (snapshot.counts.particle || 0) + n > p.particleCap) return false;
    if ((kind === 'simpleFx' || kind === 'complexFx') && ((snapshot.counts.simpleFx || 0) + (snapshot.counts.complexFx || 0) + n > p.fxCap)) return false;
    return snapshot.weightedCost + (WEIGHTS[kind] || 1) * n <= p.weightedBudget;
  }

  function getAnimationHz(distance) {
    const d = Math.max(0, Number(distance) || 0);
    const p = profile();
    if (d <= 500) return p.nearHz;
    if (d <= 1000) return p.midHz;
    if (d <= p.farCutoff) return p.farHz;
    return 0;
  }

  function shouldUpdate(key, distance, now) {
    const hz = getAnimationHz(distance);
    if (hz <= 0) return false;
    const t = Number(now) || performance.now();
    const minInterval = 1000 / hz;
    const last = updateClock.get(key) || 0;
    if (t - last < minInterval) return false;
    updateClock.set(key, t);
    return true;
  }

  function shouldRenderActor(distance) {
    return Math.max(0, Number(distance) || 0) <= profile().actorCutoff;
  }

  function registerTexture(id, width, height, copies) {
    const w = Math.max(0, Number(width) || 0);
    const h = Math.max(0, Number(height) || 0);
    const c = Math.max(1, Number(copies) || 1);
    textureMemory.set(String(id), { bytes: w * h * 4 * c, width: w, height: h, copies: c });
  }

  function unregisterTexture(id) { textureMemory.delete(String(id)); }

  function setManualQuality(id) {
    if (id == null || id === 'auto') { manualProfile = null; badMs = 0; goodMs = 0; return profile().id; }
    const found = PROFILES.find(p => p.id === id);
    if (!found) throw new Error('Unknown Kelo quality profile: ' + id);
    const previous = profile();
    manualProfile = found.id;
    dispatchQualityChange(previous, found);
    return found.id;
  }

  function toggleHUD(force) {
    hudEnabled = typeof force === 'boolean' ? force : !hudEnabled;
    ensureHud();
    if (hud) hud.style.display = hudEnabled ? 'block' : 'none';
    try { localStorage.setItem('kelo_perf_hud', hudEnabled ? '1' : '0'); } catch (e) {}
    return hudEnabled;
  }

  function getSnapshot() { return lastSnapshot || buildSnapshot(performance.now()); }

  const api = Object.freeze({
    version: VERSION,
    targetFps: TARGET_FPS,
    targetFrameMs: TARGET_FRAME_MS,
    weights: WEIGHTS,
    profiles: PROFILES,
    reportVisible,
    canSpawn,
    getAnimationHz,
    shouldUpdate,
    shouldRenderActor,
    registerTexture,
    unregisterTexture,
    setManualQuality,
    toggleHUD,
    getSnapshot,
    get profile() { return profile(); }
  });

  root.KELO_PERF = api;
  root.KELO_PERFORMANCE_GOVERNOR = api;

  try {
    const params = new URLSearchParams(root.location.search);
    hudEnabled = params.get('perf') === '1' || localStorage.getItem('kelo_perf_hud') === '1';
  } catch (e) {}

  if (document.body) document.body.dataset.keloQuality = profile().id;

  if (typeof root.spawnParticle === 'function' && !root.spawnParticle.__keloPerfWrapped) {
    const rawSpawnParticle = root.spawnParticle;
    const wrapped = function () {
      if (!canSpawn('particle', 1)) return;
      return rawSpawnParticle.apply(this, arguments);
    };
    wrapped.__keloPerfWrapped = true;
    root.spawnParticle = wrapped;
  }

  root.requestAnimationFrame(frame);
})(typeof globalThis !== 'undefined' ? globalThis : window);
