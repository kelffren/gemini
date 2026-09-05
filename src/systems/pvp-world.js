(function () {
  'use strict';

  const VERSION = 'pvp-world-v1.0';
  const WORLD = Object.freeze({ x: 2660, y: 360, w: 720, h: 720, spawnX: 2790, spawnY: 720, dummyX: 3190, dummyY: 720 });
  const state = {
    mode: 'social',
    combatEnabled: false,
    selected: null,
    armedSlot: -1,
    basicCooldown: 0,
    saved: null,
    floats: [],
    commandSeq: 1,
    resultSeq: 1,
    dummy: null,
  };

  window.KELO_COMBAT_ENABLED = false;

  function toast(msg) { if (typeof showToast === 'function') showToast(msg); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function dist(a, b) { return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0)); }
  function screenWorld(sx, sy) {
    if (typeof screenToWorld === 'function') return screenToWorld(sx, sy);
    const z = (typeof CONFIG !== 'undefined' && CONFIG.zoom) || 1;
    return { x: camera.x + (sx - screenW / 2) / z, y: camera.y + (sy - screenH / 2) / z };
  }

  function dummyEntity() {
    if (state.dummy) return state.dummy;
    if (typeof simulatedPlayers === 'undefined' || !simulatedPlayers.length) return null;
    state.dummy = simulatedPlayers[0];
    return state.dummy;
  }

  function command(type, payload) {
    return Object.freeze({ id: state.commandSeq++, type, payload: payload || {}, issuedAt: performance.now() });
  }

  const localAuthority = Object.freeze({
    execute(cmd) {
      if (!state.combatEnabled) return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: false, reason: 'COMBAT_DISABLED' });
      if (cmd.type === 'SELECT_TARGET') {
        const target = cmd.payload.target;
        state.selected = target && target.hp > 0 ? target : null;
        return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: !!state.selected, type: 'TARGET_SELECTED', targetId: state.selected && state.selected.id });
      }
      if (cmd.type === 'BASIC_ATTACK') {
        const target = cmd.payload.target;
        if (!target || target.hp <= 0) return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: false, reason: 'INVALID_TARGET' });
        if (state.basicCooldown > 0) return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: false, reason: 'COOLDOWN' });
        if (dist(localPlayer, target) > 150) return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: false, reason: 'OUT_OF_RANGE' });
        const amount = 18;
        target.hp = Math.max(0, (target.hp == null ? 100 : target.hp) - amount);
        state.basicCooldown = 0.7;
        return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: true, type: 'DAMAGE', targetId: target.id, amount, hp: target.hp });
      }
      if (cmd.type === 'CAST_ABILITY') {
        if (!window.KeloAbilities || !window.KeloAbilities.engine) return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: false, reason: 'ABILITY_ENGINE_UNAVAILABLE' });
        const result = window.KeloAbilities.engine.cast(cmd.payload.request);
        return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: !!result.valid, type: 'ABILITY_RESULT', result });
      }
      return Object.freeze({ id: state.resultSeq++, commandId: cmd.id, ok: false, reason: 'UNKNOWN_COMMAND' });
    }
  });

  function present(result, target) {
    if (!result) return;
    if (result.ok && result.type === 'DAMAGE' && target) {
      state.floats.push({ x: target.x, y: target.y - 42, text: '-' + result.amount, life: 0.8 });
      if (target.hp <= 0) toast('Dummy derrotado');
      return;
    }
    if (!result.ok && result.reason === 'OUT_OF_RANGE') toast('Fuera de alcance');
    else if (!result.ok && result.reason === 'COOLDOWN') toast('Ataque recargando');
  }

  function armAbility(slot) {
    if (!state.combatEnabled || !window.KeloAbilities) return;
    const instance = window.KeloAbilities.hotbar && window.KeloAbilities.hotbar.slots[slot];
    if (!instance) return toast('Slot vacío');
    const targeting = instance.definition && instance.definition.targeting;
    if (targeting && targeting.type === 'self') {
      const result = localAuthority.execute(command('CAST_ABILITY', { request: { slotIndex: slot } }));
      if (!result.ok) toast('No se pudo usar la habilidad');
      state.armedSlot = -1;
      return;
    }
    state.armedSlot = slot;
    toast('Habilidad lista · toca objetivo o suelo');
  }

  function castArmedAt(w, target) {
    const slot = state.armedSlot;
    if (slot < 0 || !window.KeloAbilities) return false;
    const instance = window.KeloAbilities.hotbar && window.KeloAbilities.hotbar.slots[slot];
    if (!instance || !instance.definition) { state.armedSlot = -1; return false; }
    const def = instance.definition;
    const d = { x: w.x - localPlayer.x, y: w.y - localPlayer.y };
    const len = Math.hypot(d.x, d.y) || 1;
    const dir = { x: d.x / len, y: d.y / len };
    const req = { slotIndex: slot };
    if (def.targeting.type === 'position') req.position = w;
    else if (def.targeting.type === 'target') {
      if (!target) { toast('Toca un enemigo'); return true; }
      req.targetId = target.id;
    } else if (def.targeting.type === 'direction') req.direction = dir;
    const result = localAuthority.execute(command('CAST_ABILITY', { request: req }));
    state.armedSlot = -1;
    if (!result.ok) toast('No se pudo usar la habilidad');
    return true;
  }

  function targetAt(w) {
    const d = dummyEntity();
    return d && d.hp > 0 && dist(w, d) <= (d.radius || 20) * 2.1 ? d : null;
  }

  function handleCombatTap(clientX, clientY) {
    if (!state.combatEnabled) return false;
    const w = screenWorld(clientX, clientY);
    const target = targetAt(w);
    if (state.armedSlot >= 0) return castArmedAt(w, target);
    if (!target) { state.selected = null; return false; }
    localAuthority.execute(command('SELECT_TARGET', { target }));
    const result = localAuthority.execute(command('BASIC_ATTACK', { target }));
    present(result, target);
    return true;
  }

  function ensureUi() {
    let exit = document.getElementById('kelo-pvp-exit');
    if (!exit) {
      exit = document.createElement('button');
      exit.id = 'kelo-pvp-exit'; exit.type = 'button'; exit.textContent = 'Salir PvP';
      exit.style.cssText = 'display:none;position:absolute;top:max(62px,calc(env(safe-area-inset-top) + 54px));right:max(12px,env(safe-area-inset-right));z-index:140;pointer-events:auto;background:rgba(18,20,27,.95);color:#ffd6d6;border:1px solid rgba(255,90,90,.7);border-radius:12px;padding:9px 12px;font-size:11px;font-weight:850';
      exit.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); leave(); });
      document.body.appendChild(exit);
    }
    return exit;
  }

  function enter() {
    if (state.mode === 'pvp') return;
    const d = dummyEntity();
    if (!d) return toast('PvP todavía cargando');
    state.saved = {
      x: localPlayer.x, y: localPlayer.y,
      cameraX: camera.x, cameraY: camera.y,
      dummyX: d.x, dummyY: d.y, dummyHp: d.hp, dummyMaxHp: d.maxHp,
    };
    state.mode = 'pvp'; state.combatEnabled = true; state.selected = null; state.armedSlot = -1;
    window.KELO_COMBAT_ENABLED = true;
    if (typeof isPvPActive !== 'undefined') isPvPActive = true;
    d.x = WORLD.dummyX; d.y = WORLD.dummyY; d.hp = d.maxHp = 100;
    if (typeof arenaPvP !== 'undefined') arenaPvP.rival = d;
    localPlayer.x = WORLD.spawnX; localPlayer.y = WORLD.spawnY; localPlayer.vx = 0; localPlayer.vy = 0;
    camera.x = camera.targetX = localPlayer.x; camera.y = camera.targetY = localPlayer.y;
    document.body.classList.remove('social-mode');
    const exit = ensureUi(); exit.style.display = 'block';
    if (typeof closeMenu === 'function') closeMenu();
    toast('Mundo PvP · toca al dummy para atacar');
    audit('entered');
  }

  function leave() {
    if (state.mode !== 'pvp') return;
    const d = dummyEntity();
    state.mode = 'social'; state.combatEnabled = false; state.selected = null; state.armedSlot = -1;
    window.KELO_COMBAT_ENABLED = false;
    if (typeof isPvPActive !== 'undefined') isPvPActive = false;
    if (typeof arenaPvP !== 'undefined') arenaPvP.rival = null;
    if (state.saved) {
      localPlayer.x = state.saved.x; localPlayer.y = state.saved.y; localPlayer.vx = 0; localPlayer.vy = 0;
      camera.x = camera.targetX = state.saved.cameraX; camera.y = camera.targetY = state.saved.cameraY;
      if (d) { d.x = state.saved.dummyX; d.y = state.saved.dummyY; d.hp = state.saved.dummyHp; d.maxHp = state.saved.dummyMaxHp; }
    }
    document.body.classList.add('social-mode');
    const exit = ensureUi(); exit.style.display = 'none';
    toast('Volviste al mundo social');
    audit('left');
  }

  function drawArenaOverlay() {
    if (!state.combatEnabled || typeof ctx === 'undefined') return;
    ctx.save();
    const z = (typeof CONFIG !== 'undefined' && CONFIG.zoom) || 1;
    ctx.translate(screenW / 2, screenH / 2); ctx.scale(z, z); ctx.translate(-camera.x, -camera.y);
    ctx.fillStyle = '#101722'; ctx.fillRect(WORLD.x, WORLD.y, WORLD.w, WORLD.h);
    ctx.fillStyle = '#162231'; ctx.fillRect(WORLD.x + 24, WORLD.y + 24, WORLD.w - 48, WORLD.h - 48);
    ctx.strokeStyle = 'rgba(231,197,106,.72)'; ctx.lineWidth = 5; ctx.strokeRect(WORLD.x + 18, WORLD.y + 18, WORLD.w - 36, WORLD.h - 36);
    ctx.strokeStyle = 'rgba(231,197,106,.18)'; ctx.lineWidth = 2;
    for (let x = WORLD.x + 80; x < WORLD.x + WORLD.w; x += 80) { ctx.beginPath(); ctx.moveTo(x, WORLD.y + 24); ctx.lineTo(x, WORLD.y + WORLD.h - 24); ctx.stroke(); }
    for (let y = WORLD.y + 80; y < WORLD.y + WORLD.h; y += 80) { ctx.beginPath(); ctx.moveTo(WORLD.x + 24, y); ctx.lineTo(WORLD.x + WORLD.w - 24, y); ctx.stroke(); }
    const d = dummyEntity();
    if (d) {
      if (state.selected === d && d.hp > 0) { ctx.strokeStyle = '#ff5d5d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(d.x, d.y + 12, 30, 13, 0, 0, Math.PI * 2); ctx.stroke(); }
      if (typeof renderAvatar === 'function' && d.hp > 0) renderAvatar(d, false);
      if (d.hp > 0) {
        ctx.fillStyle = 'rgba(0,0,0,.72)'; ctx.fillRect(d.x - 34, d.y - 58, 68, 7);
        ctx.fillStyle = '#ef476f'; ctx.fillRect(d.x - 34, d.y - 58, 68 * clamp(d.hp / d.maxHp, 0, 1), 7);
      }
    }
    if (typeof renderAvatar === 'function') renderAvatar(localPlayer, true);
    state.floats.forEach((f) => { ctx.globalAlpha = clamp(f.life / 0.8, 0, 1); ctx.fillStyle = '#fff'; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(f.text, f.x, f.y); });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function audit(event) {
    const d = dummyEntity();
    window.KELO_PVP_AUDIT = {
      version: VERSION, event: event || null,
      mode: state.mode, combatEnabled: state.combatEnabled,
      abilityBarVisible: document.body.classList.contains('social-mode') === false,
      dummyAlive: !!(d && d.hp > 0), dummyHp: d ? d.hp : null,
      armedSlot: state.armedSlot,
      authority: 'local-command-simulation-v1',
      commandResultBoundary: true,
      socialAbilityPermission: state.mode === 'social' ? false : null,
    };
  }

  const previousUpdate = typeof updateSimulation === 'function' ? updateSimulation : null;
  if (previousUpdate) updateSimulation = function (dt) {
    previousUpdate(dt);
    state.basicCooldown = Math.max(0, state.basicCooldown - dt);
    for (let i = state.floats.length - 1; i >= 0; i--) { state.floats[i].life -= dt; state.floats[i].y -= 20 * dt; if (state.floats[i].life <= 0) state.floats.splice(i, 1); }
    if (state.combatEnabled) {
      localPlayer.x = clamp(localPlayer.x, WORLD.x + localPlayer.radius, WORLD.x + WORLD.w - localPlayer.radius);
      localPlayer.y = clamp(localPlayer.y, WORLD.y + localPlayer.radius, WORLD.y + WORLD.h - localPlayer.radius);
    }
    audit('tick');
  };

  const previousRender = typeof render === 'function' ? render : null;
  if (previousRender) render = function () { previousRender(); drawArenaOverlay(); };

  window.addEventListener('pointerdown', function (event) {
    if (!state.combatEnabled) return;
    const slotButton = event.target && event.target.closest && event.target.closest('.stone-slot');
    if (slotButton) {
      event.preventDefault(); event.stopImmediatePropagation();
      armAbility(Number(slotButton.dataset.slot));
      return;
    }
    if (event.target !== canvas) return;
    if (handleCombatTap(event.clientX, event.clientY)) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);

  window.enterPvPWorld = enter;
  window.leavePvPWorld = leave;
  window.KeloPvPWorld = Object.freeze({
    version: VERSION,
    enter, leave,
    get state() { return Object.freeze({ mode: state.mode, combatEnabled: state.combatEnabled, selectedId: state.selected && state.selected.id, armedSlot: state.armedSlot }); },
    command,
    authority: localAuthority,
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { ensureUi(); audit('boot'); }, { once: true });
  else { ensureUi(); audit('boot'); }
})();
