/* KELO-INDEX
 * area: VISUAL
 * keys: VFX FX PROJECTILE TRAIL PARTICLE SFX AUDIO SCREEN SHAKE FLASH POOL CULL QUALITY SPRITESHEET
 * hace: runtimes independientes para VFX, proyectiles visuales, sonido y efectos de pantalla
 * online: solo representa eventos/contexto; jamás calcula hit, daño, estado real ni trayectoria autoritativa
 */
(function (root) {
  'use strict';

  const manifests = root.KELO_VISUAL_MANIFESTS;
  const contextApi = root.KeloVisualContext;
  if (!manifests || !contextApi) {
    console.error('[Kelo FX] visual manifests/context unavailable');
    return;
  }

  const fxDefs = new Map();
  const projectileDefs = new Map();
  const sfxDefs = new Map();
  const screenDefs = new Map();
  const activeFx = [];
  const fxPool = [];
  const activeProjectiles = [];
  const projectilePool = [];
  let fxSeq = 1;
  let projectileSeq = 1;
  let drawn = 0;
  let culled = 0;

  function registerInto(map, def, label) {
    if (!def || !def.id) throw new Error('INVALID_' + label);
    const id = String(def.id);
    if (map.has(id)) throw new Error('DUPLICATE_' + label + '_' + id);
    map.set(id, Object.freeze(Object.assign({}, def, { id: id })));
    return id;
  }

  Object.keys(manifests.fx || {}).forEach(function (id) { registerInto(fxDefs, manifests.fx[id], 'FX'); });
  Object.keys(manifests.projectileVisuals || {}).forEach(function (id) { registerInto(projectileDefs, manifests.projectileVisuals[id], 'PROJECTILE_VISUAL'); });
  Object.keys(manifests.sfx || {}).forEach(function (id) { registerInto(sfxDefs, manifests.sfx[id], 'SFX'); });
  Object.keys(manifests.screenFx || {}).forEach(function (id) { registerInto(screenDefs, manifests.screenFx[id], 'SCREEN_FX'); });

  function randomUnit(seed) {
    let s = (Number(seed) || 1) >>> 0;
    return function () {
      s += 0x6D2B79F5;
      let t = s;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function canSpawn(kind, count) {
    return !root.KELO_PERF || typeof root.KELO_PERF.canSpawn !== 'function' || root.KELO_PERF.canSpawn(kind, count || 1);
  }

  function worldVisible(x, y, radius) {
    try {
      if (typeof camera === 'undefined' || typeof screenW === 'undefined' || typeof screenH === 'undefined') return true;
      const zoom = (typeof CONFIG !== 'undefined' && Number(CONFIG.zoom)) || 1;
      const hw = screenW / (2 * zoom) + (radius || 0) + 64;
      const hh = screenH / (2 * zoom) + (radius || 0) + 64;
      return x >= camera.x - hw && x <= camera.x + hw && y >= camera.y - hh && y <= camera.y + hh;
    } catch (e) { return true; }
  }

  function actorPosition(instance) {
    const c = instance.context;
    const actor = c.actor || contextApi.resolveActor(c.actorId);
    if (!actor) return c.origin || { x: instance.x || 0, y: instance.y || 0 };
    const socket = instance.socket || instance.def.socket || 'center';
    return root.KeloAnchors && typeof root.KeloAnchors.get === 'function' ? root.KeloAnchors.get(actor, socket) : { x: actor.x, y: actor.y };
  }

  function resetFxObject(item, def, context, options) {
    const opts = options || {};
    const c = contextApi.normalize(context || opts.context || {});
    item.id = 'vfx_' + (fxSeq++).toString(36);
    item.definitionId = def.id;
    item.def = def;
    item.context = c;
    item.space = String(opts.space || def.space || 'WORLD').toUpperCase();
    item.layer = String(opts.layer || def.layer || 'worldFX');
    item.socket = opts.socket || def.socket || null;
    const p = c.origin || c.target || { x: Number(opts.x) || 0, y: Number(opts.y) || 0 };
    item.x = Number(opts.x != null ? opts.x : p && p.x) || 0;
    item.y = Number(opts.y != null ? opts.y : p && p.y) || 0;
    item.scale = Math.max(0.05, Number(opts.scale != null ? opts.scale : c.visual.scale) || 1);
    item.elapsed = 0;
    item.duration = Math.max(0.001, Number(opts.duration != null ? opts.duration : def.duration) || 0.25);
    item.loop = opts.loop != null ? opts.loop === true : def.loop === true;
    item.seed = Number(opts.seed != null ? opts.seed : c.visual.seed) || 1;
    item.rng = randomUnit(item.seed);
    item.dead = false;
    item.samples = [];
    item.particles = null;
    if (def.type === 'particle_emitter') {
      const count = Math.min(32, Math.max(1, Number(def.particleCount) || 8));
      item.particles = [];
      for (let i = 0; i < count; i++) item.particles.push({ a: item.rng() * Math.PI * 2, r: 0.15 + item.rng() * 0.85, phase: item.rng() });
    }
    return item;
  }

  // KELO-INDEX VISUAL/VFX instancia una definición sin requerir ability, stone ni combate.
  function spawnFx(id, context, options) {
    const def = fxDefs.get(String(id || ''));
    if (!def) return null;
    if (!canSpawn(def.type === 'particle_emitter' ? 'complexFx' : 'simpleFx', 1)) return null;
    const item = resetFxObject(fxPool.pop() || {}, def, context, options);
    activeFx.push(item);
    return item.id;
  }

  function stopFx(id) {
    const index = activeFx.findIndex(function (item) { return item.id === id; });
    if (index < 0) return false;
    const item = activeFx.splice(index, 1)[0];
    item.dead = true;
    fxPool.push(item);
    return true;
  }

  function updateFx(dt) {
    for (let i = activeFx.length - 1; i >= 0; i--) {
      const item = activeFx[i];
      item.elapsed += dt;
      if (item.loop && item.elapsed >= item.duration) item.elapsed %= item.duration;
      if (!item.loop && item.elapsed >= item.duration) {
        activeFx.splice(i, 1);
        item.dead = true;
        fxPool.push(item);
      }
    }
  }

  function effectPosition(item) {
    if (item.space === 'ACTOR') return actorPosition(item);
    return { x: item.x, y: item.y };
  }

  function alphaOf(item) {
    const p = Math.max(0, Math.min(1, item.elapsed / item.duration));
    return Math.max(0, Number(item.def.alpha == null ? 1 : item.def.alpha)) * (item.loop ? 1 : (1 - p));
  }

  function drawRing(g, item, p) {
    const progress = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const radius = (Number(item.def.radius) || 24) * item.scale * (0.7 + progress * 0.5);
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#fff';
    g.lineWidth = Math.max(1, 2 * item.scale);
    g.beginPath(); g.ellipse(p.x, p.y, radius, radius * 0.38, 0, 0, Math.PI * 2); g.stroke();
  }

  function drawGlow(g, item, p) {
    const progress = item.elapsed / item.duration;
    const radius = (Number(item.def.radius) || 20) * item.scale * (0.8 + Math.sin(progress * Math.PI) * 0.35);
    g.globalAlpha = alphaOf(item) * 0.7;
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.arc(p.x, p.y, radius, 0, Math.PI * 2); g.fill();
  }

  function drawBurst(g, item, p) {
    const progress = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const radius = (Number(item.def.radius) || 34) * item.scale * (0.25 + progress * 0.95);
    const rays = Math.max(4, Number(item.def.rays) || 8);
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#fff';
    g.lineWidth = Math.max(1, 2.2 * item.scale);
    for (let i = 0; i < rays; i++) {
      const a = (i / rays) * Math.PI * 2 + item.seed * 0.013;
      const r0 = radius * 0.28, r1 = radius * (0.62 + (i % 3) * 0.12);
      g.beginPath(); g.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0); g.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1); g.stroke();
    }
    g.globalAlpha *= 0.55;
    g.fillStyle = item.def.accent || item.def.color || '#fff';
    g.beginPath(); g.arc(p.x, p.y, radius * 0.34, 0, Math.PI * 2); g.fill();
  }

  function drawParticles(g, item, p) {
    const progress = item.loop ? (item.elapsed / item.duration) % 1 : Math.max(0, Math.min(1, item.elapsed / item.duration));
    const radius = (Number(item.def.radius) || 24) * item.scale;
    g.fillStyle = item.def.color || '#fff';
    (item.particles || []).forEach(function (pt, index) {
      const phase = (progress + pt.phase) % 1;
      const rr = radius * pt.r * (0.4 + phase * 0.7);
      const x = p.x + Math.cos(pt.a + phase * 0.8) * rr;
      const y = p.y + Math.sin(pt.a) * rr * 0.35 - phase * radius * 1.35;
      g.globalAlpha = (Number(item.def.alpha) || 0.7) * (1 - phase) * 0.9;
      const size = 1.5 + (index % 3) * 0.7;
      g.fillRect(Math.round(x), Math.round(y), size, size);
    });
  }

  function drawTrailFx(g, item, p) {
    const progress = Math.max(0, Math.min(1, item.elapsed / item.duration));
    const r = Math.max(2, (Number(item.def.radius) || 8) * item.scale * (1 - progress * 0.5));
    g.globalAlpha = alphaOf(item);
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.arc(p.x, p.y, r, 0, Math.PI * 2); g.fill();
  }

  // KELO-INDEX VISUAL/SPRITESHEET recorta frames de una hoja sin mover gameplay ni mezclar ownership.
  function drawAssetFx(g, item, p) {
    const assetId = item.def.assetId;
    if (!assetId || !root.KeloAssetRegistry) return false;
    const image = root.KeloAssetRegistry.resource(assetId);
    if (!image) { root.KeloAssetRegistry.load(assetId); return false; }

    let sx = 0, sy = 0;
    let sw = image.width || 32, sh = image.height || 32;
    if (item.def.type === 'sprite_animation') {
      const frameWidth = Math.max(1, Number(item.def.frameWidth) || sw);
      const frameHeight = Math.max(1, Number(item.def.frameHeight) || sh);
      const columns = Math.max(1, Number(item.def.columns) || Math.floor(sw / frameWidth) || 1);
      const rows = Math.max(1, Number(item.def.rows) || Math.floor(sh / frameHeight) || 1);
      const available = Math.max(1, columns * rows);
      const frameCount = Math.max(1, Math.min(Number(item.def.frames) || available, available));
      const fps = Math.max(0.001, Number(item.def.fps) || 12);
      const rawFrame = Math.floor(item.elapsed * fps);
      const frame = item.loop ? rawFrame % frameCount : Math.min(frameCount - 1, rawFrame);
      sx = (frame % columns) * frameWidth;
      sy = Math.floor(frame / columns) * frameHeight;
      sw = frameWidth;
      sh = frameHeight;
    }

    const width = (Number(item.def.width) || sw || 32) * item.scale;
    const height = (Number(item.def.height) || sh || 32) * item.scale;
    const offset = item.def.offset || {};
    const ox = (Number(item.def.offsetX) || Number(offset.x) || 0) * item.scale;
    const oy = (Number(item.def.offsetY) || Number(offset.y) || 0) * item.scale;
    const alpha = Math.max(0, Number(item.def.alpha == null ? 1 : item.def.alpha));
    g.globalAlpha = item.def.fadeOut === false ? alpha : alphaOf(item);
    g.imageSmoothingEnabled = false;
    g.drawImage(
      image,
      sx, sy, sw, sh,
      Math.round(p.x + ox - width * 0.5),
      Math.round(p.y + oy - height * 0.5),
      width, height
    );
    return true;
  }

  function drawBeam(g, item, p) {
    const target = item.context.target;
    if (!target) return;
    g.globalAlpha = alphaOf(item);
    g.strokeStyle = item.def.color || '#fff';
    g.lineWidth = Math.max(1, Number(item.def.width) || 2);
    g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(target.x, target.y); g.stroke();
  }

  function drawOneFx(g, item) {
    const p = effectPosition(item);
    if (item.space !== 'SCREEN' && !worldVisible(p.x, p.y, (Number(item.def.radius) || 32) * item.scale)) { culled += 1; return; }
    g.save();
    const type = item.def.type;
    if (type === 'ring' || type === 'decal') drawRing(g, item, p);
    else if (type === 'glow' || type === 'flash') drawGlow(g, item, p);
    else if (type === 'burst' || type === 'lightning') drawBurst(g, item, p);
    else if (type === 'particle_emitter') drawParticles(g, item, p);
    else if (type === 'trail') drawTrailFx(g, item, p);
    else if (type === 'beam') drawBeam(g, item, p);
    else if (type === 'static_sprite' || type === 'sprite_animation') drawAssetFx(g, item, p);
    g.restore();
    drawn += 1;
  }

  function drawLayer(layer, g) {
    activeFx.forEach(function (item) {
      if (item.space === 'ACTOR') return;
      if (item.layer === layer) drawOneFx(g, item);
    });
  }

  function drawActorLayer(layer, actor, g) {
    const id = contextApi.actorIdOf(actor);
    activeFx.forEach(function (item) {
      if (item.space !== 'ACTOR' || item.layer !== layer) return;
      if (item.context.actorId && item.context.actorId !== id) return;
      if (!item.context.actor) item.context.actor = actor;
      drawOneFx(g, item);
    });
  }

  function fxMetrics() {
    return { definitions: fxDefs.size, active: activeFx.length, pooled: fxPool.length, drawn: drawn, culled: culled };
  }

  function resetProjectile(item, def, gameplayObject, context, options) {
    const c = contextApi.normalize(context || {});
    const opts = options || {};
    const start = c.origin || { x: Number(opts.x) || 0, y: Number(opts.y) || 0 };
    const dir = c.direction || { x: 1, y: 0 };
    const len = Math.hypot(dir.x, dir.y) || 1;
    item.id = 'pvis_' + (projectileSeq++).toString(36);
    item.definitionId = def.id;
    item.def = def;
    item.gameplayObject = gameplayObject || null;
    item.context = c;
    item.x = start.x; item.y = start.y;
    item.vx = dir.x / len * (Number(opts.speed) || Number(c.gameplay.speed) || Number(def.defaultSpeed) || 0);
    item.vy = dir.y / len * (Number(opts.speed) || Number(c.gameplay.speed) || Number(def.defaultSpeed) || 0);
    item.maxDistance = Number(opts.maxDistance) || Number(c.gameplay.range) || Number(def.defaultMaxDistance) || 500;
    item.traveled = 0;
    item.preview = !gameplayObject;
    item.dead = false;
    item.trail = [];
    item.trailClock = 0;
    return item;
  }

  // KELO-INDEX VISUAL/PROJECTILE engancha apariencia a proyectil gameplay sin cambiar su posición/colisión.
  function attachProjectile(gameplayObject, visualId, context, options) {
    const def = projectileDefs.get(String(visualId || ''));
    if (!def || !canSpawn('simpleFx', 1)) return null;
    const item = resetProjectile(projectilePool.pop() || {}, def, gameplayObject, context, options);
    activeProjectiles.push(item);
    return item.id;
  }

  function previewProjectile(visualId, context, options) { return attachProjectile(null, visualId, context, options); }

  function stopProjectile(id) {
    const index = activeProjectiles.findIndex(function (item) { return item.id === id || item.context.projectileId === id; });
    if (index < 0) return false;
    const item = activeProjectiles.splice(index, 1)[0];
    item.dead = true; projectilePool.push(item); return true;
  }

  function updateProjectiles(dt) {
    for (let i = activeProjectiles.length - 1; i >= 0; i--) {
      const item = activeProjectiles[i];
      const beforeX = item.x, beforeY = item.y;
      if (item.gameplayObject) {
        if (item.gameplayObject._keloVisualDead === true) {
          activeProjectiles.splice(i, 1); projectilePool.push(item); continue;
        }
        item.x = Number(item.gameplayObject.x) || item.x;
        item.y = Number(item.gameplayObject.y) || item.y;
      } else {
        item.x += item.vx * dt; item.y += item.vy * dt;
        item.traveled += Math.hypot(item.x - beforeX, item.y - beforeY);
        if (item.traveled >= item.maxDistance) {
          activeProjectiles.splice(i, 1); projectilePool.push(item); continue;
        }
      }
      item.trailClock += dt;
      if (item.trailClock >= 0.045) {
        item.trailClock = 0;
        item.trail.push({ x: item.x, y: item.y, life: 0.24 });
        if (item.trail.length > 10) item.trail.shift();
      }
      item.trail.forEach(function (pt) { pt.life -= dt; });
      item.trail = item.trail.filter(function (pt) { return pt.life > 0; });
    }
  }

  function drawProjectile(item, g) {
    if (!worldVisible(item.x, item.y, Number(item.def.glowRadius) || 24)) { culled += 1; return; }
    const trailDef = fxDefs.get(item.def.trailRef);
    g.save();
    item.trail.forEach(function (pt) {
      const a = Math.max(0, pt.life / 0.24) * Number(trailDef && trailDef.alpha || 0.4);
      g.globalAlpha = a;
      g.fillStyle = trailDef && trailDef.color || item.def.color || '#fff';
      g.beginPath(); g.arc(pt.x, pt.y, Math.max(2, (Number(trailDef && trailDef.radius) || 7) * a), 0, Math.PI * 2); g.fill();
    });
    g.globalAlpha = 0.18;
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.arc(item.x, item.y, Number(item.def.glowRadius) || 20, 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1;
    g.fillStyle = item.def.color || '#fff';
    g.beginPath(); g.arc(item.x, item.y, Number(item.def.radius) || 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = item.def.coreColor || '#fff';
    g.beginPath(); g.arc(item.x, item.y, Math.max(2, (Number(item.def.radius) || 10) * 0.42), 0, Math.PI * 2); g.fill();
    g.restore();
    drawn += 1;
  }

  function drawProjectileLayer(layer, g) {
    activeProjectiles.forEach(function (item) { if ((item.def.layer || 'worldFX') === layer) drawProjectile(item, g); });
  }

  function projectileMetrics() { return { definitions: projectileDefs.size, active: activeProjectiles.length, pooled: projectilePool.length, drawn: 0, culled: 0 }; }

  let audioContext = null;
  function getAudioContext() {
    if (audioContext) return audioContext;
    const Ctor = root.AudioContext || root.webkitAudioContext;
    if (!Ctor) return null;
    try { audioContext = new Ctor(); return audioContext; } catch (e) { return null; }
  }

  // KELO-INDEX VISUAL/SFX sonido reutilizable; no está unido 1:1 a un FX ni a una ability.
  function playSfx(id, context, options) {
    const def = sfxDefs.get(String(id || ''));
    if (!def) return false;
    if (def.type === 'audio' && def.assetId && root.KeloAssetRegistry) {
      const audio = root.KeloAssetRegistry.resource(def.assetId);
      if (!audio) { root.KeloAssetRegistry.load(def.assetId); return false; }
      try { const clone = audio.cloneNode(true); clone.volume = Math.max(0, Math.min(1, Number(options && options.volume) || Number(def.volume) || 0.5)); clone.play().catch(function () {}); return true; } catch (e) { return false; }
    }
    if (def.type !== 'synth') return false;
    const ac = getAudioContext();
    if (!ac) return false;
    try {
      if (ac.state === 'suspended') ac.resume().catch(function () {});
      const now = ac.currentTime;
      const duration = Math.max(0.02, Number(def.duration) || 0.12);
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = def.waveform || 'sine';
      osc.frequency.setValueAtTime(Math.max(20, Number(def.frequency) || 220), now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, Number(def.frequencyEnd) || Number(def.frequency) || 220), now + duration);
      gain.gain.setValueAtTime(Math.max(0.001, Number(def.gain) || 0.04), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
      osc.connect(gain); gain.connect(ac.destination); osc.start(now); osc.stop(now + duration);
      return true;
    } catch (e) { return false; }
  }

  const screenActive = [];
  let screenSeq = 1;
  function spawnScreen(id, options) {
    const def = screenDefs.get(String(id || ''));
    if (!def) return null;
    const item = { id: 'sfxscreen_' + (screenSeq++).toString(36), def: def, elapsed: 0, duration: Math.max(0.001, Number(def.duration) || 0.1), seed: Number(options && options.seed) || screenSeq };
    screenActive.push(item); return item.id;
  }
  function shake(id, options) { return spawnScreen(id || 'impact_medium', options); }
  function flash(id, options) { return spawnScreen(id || 'flash_warm_small', options); }
  function updateScreen(dt) {
    for (let i = screenActive.length - 1; i >= 0; i--) { screenActive[i].elapsed += dt; if (screenActive[i].elapsed >= screenActive[i].duration) screenActive.splice(i, 1); }
  }
  function worldOffset() {
    let x = 0, y = 0;
    screenActive.forEach(function (item) {
      if (item.def.type !== 'shake') return;
      const p = Math.max(0, Math.min(1, item.elapsed / item.duration));
      const a = (Number(item.def.amplitude) || 3) * (1 - p);
      x += Math.sin((item.elapsed * 83 + item.seed) * 7.1) * a;
      y += Math.cos((item.elapsed * 71 + item.seed) * 5.7) * a;
    });
    return { x: x, y: y };
  }
  function applyWorldTransform(g) { const o = worldOffset(); if (o.x || o.y) g.translate(o.x, o.y); }
  function drawScreen(g) {
    const w = root.innerWidth || 390, h = root.innerHeight || 844;
    screenActive.forEach(function (item) {
      if (item.def.type !== 'flash') return;
      const p = Math.max(0, Math.min(1, item.elapsed / item.duration));
      g.save(); g.globalAlpha = (Number(item.def.alpha) || 0.08) * (1 - p); g.fillStyle = item.def.color || '#fff'; g.fillRect(0, 0, w, h); g.restore();
    });
  }

  root.KeloFXRegistry = Object.freeze({ version: 'fx-registry-v1.1.0', get: function (id) { return fxDefs.get(String(id || '')) || null; }, list: function () { return Array.from(fxDefs.values()); }, register: function (def) { return registerInto(fxDefs, def, 'FX'); } });
  root.KeloFX = Object.freeze({ version: 'fx-runtime-v1.1.0', spawn: spawnFx, stop: stopFx, update: updateFx, drawLayer: drawLayer, drawActorLayer: drawActorLayer, metrics: fxMetrics });
  root.KeloProjectileVisualRegistry = Object.freeze({ version: 'projectile-visual-registry-v1.0.0', get: function (id) { return projectileDefs.get(String(id || '')) || null; }, list: function () { return Array.from(projectileDefs.values()); }, register: function (def) { return registerInto(projectileDefs, def, 'PROJECTILE_VISUAL'); } });
  root.KeloProjectileVisuals = Object.freeze({ version: 'projectile-visual-runtime-v1.0.0', attach: attachProjectile, preview: previewProjectile, stop: stopProjectile, update: updateProjectiles, drawLayer: drawProjectileLayer, metrics: projectileMetrics });
  root.KeloSFXRegistry = Object.freeze({ version: 'sfx-registry-v1.0.0', get: function (id) { return sfxDefs.get(String(id || '')) || null; }, list: function () { return Array.from(sfxDefs.values()); }, register: function (def) { return registerInto(sfxDefs, def, 'SFX'); } });
  root.KeloSFX = Object.freeze({ version: 'sfx-runtime-v1.0.0', play: playSfx });
  root.KeloScreenFX = Object.freeze({ version: 'screen-fx-v1.0.0', get: function (id) { return screenDefs.get(String(id || '')) || null; }, shake: shake, flash: flash, play: spawnScreen, update: updateScreen, draw: drawScreen, worldOffset: worldOffset, applyWorldTransform: applyWorldTransform });
})(typeof globalThis !== 'undefined' ? globalThis : window);