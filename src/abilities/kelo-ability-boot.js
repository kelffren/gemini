(function () {
  'use strict';

  const stones = window.KeloStones;
  if (!stones) {
    console.error('KeloAbilities: KeloStones not loaded');
    return;
  }

  const defs = window.ABILITIES || [];
  const byId = new Map(defs.map((d) => [d.id, d]));
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const tierColor = {
    Common: '#8b949e', Rare: '#58a6ff', Epic: '#bc8cff',
    Legendary: '#f2cc60', Mythic: '#ff7b72', Divine: '#f0f6fc',
  };
  const fx = { projectiles: [], areas: [], walls: [], traps: [], statuses: [] };
  const hotbar = { slots: Array(stones.LOADOUT_SIZE).fill(null) };
  const listeners = new Map();
  let fingerprint = '';
  let sequence = 1;

  function emit(name, payload) {
    const set = listeners.get(name);
    if (!set) return;
    set.forEach((fn) => { try { fn(payload); } catch (error) { console.error(error); } });
  }

  const bus = Object.freeze({
    on(name, fn) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(fn);
      return () => listeners.get(name).delete(fn);
    },
    emit,
  });

  function uid(prefix) {
    return (prefix || 'fx') + '_' + Math.random().toString(36).slice(2, 10);
  }

  function distance(a, b) {
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
  }

  function direction(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  function toast(message) {
    if (typeof showToast === 'function') showToast(message);
  }

  function entities() {
    const out = [];
    if (typeof localPlayer !== 'undefined') out.push(localPlayer);
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach((p) => out.push(p));
    return out;
  }

  function enemies(owner) {
    return entities().filter((p) => p && p !== owner && (p.hp == null || p.hp > 0));
  }

  function damage(target, amount, meta) {
    if (!target) return;
    let remaining = Math.max(0, Number(amount) || 0);
    const requested = remaining;
    let absorbed = 0;
    if (target.keloShield > 0) {
      absorbed = Math.min(target.keloShield, remaining);
      target.keloShield -= absorbed;
      remaining -= absorbed;
      if (target.keloShield <= 0) emit('SHIELD_BROKEN', { target });
    }
    target.hp = Math.max(0, (target.hp == null ? 100 : target.hp) - remaining);
    emit('DAMAGE', Object.assign({ target, requested, absorbed, amount: remaining, hp: target.hp }, meta || {}));
    if (target.hp <= 0) emit('DEATH', Object.assign({ target }, meta || {}));
  }

  function heal(target, amount, meta) {
    if (!target) return;
    const max = target.maxHp || 100;
    const before = target.hp == null ? max : target.hp;
    target.hp = Math.min(max, before + Math.max(0, Number(amount) || 0));
    emit('HEAL', Object.assign({ target, amount: target.hp - before, hp: target.hp }, meta || {}));
  }

  function status(target, source, effect, abilityId) {
    fx.statuses.push({
      id: uid('status'), target, source, abilityId,
      type: effect.status, remaining: effect.duration || 1,
      magnitude: effect.magnitude || 0, interval: effect.tickInterval || 1,
      tick: effect.tickInterval || 1,
    });
    emit('STATUS_APPLIED', { target, source, abilityId, effect });
  }

  function applyEffects(def, source, target, perTick) {
    (def.effects || []).forEach((effect) => {
      if ((effect.perTick === true) !== (perTick === true)) return;
      if (effect.type === 'damage') damage(target, effect.amount, { source, abilityId: def.id, damageType: effect.damageType });
      else if (effect.type === 'heal') heal(target, effect.amount, { source, abilityId: def.id });
      else if (effect.type === 'shield') {
        target.keloShield = (target.keloShield || 0) + effect.amount;
        target.keloShieldT = effect.duration || 4;
        emit('SHIELD_APPLIED', { target, source, abilityId: def.id, amount: effect.amount });
      } else if (effect.type === 'status') status(target, source, effect, def.id);
    });
  }

  function validateCast(request, instance, def) {
    if (!instance || !def) return { valid: false, reason: 'EMPTY_SLOT' };
    if (!localPlayer || localPlayer.hp <= 0) return { valid: false, reason: 'DEAD' };
    if (instance.cooldown > 0) return { valid: false, reason: 'COOLDOWN' };
    if ((localPlayer.mana || 0) < (def.resource.cost || 0)) return { valid: false, reason: 'NO_MANA' };
    const target = def.targeting || {};
    if (target.type === 'direction') {
      if (!request.direction || !Number.isFinite(request.direction.x) || !Number.isFinite(request.direction.y)) return { valid: false, reason: 'INVALID_TARGET' };
    }
    if (target.type === 'position') {
      const p = request.position;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return { valid: false, reason: 'INVALID_POSITION' };
      if (target.range && distance(localPlayer, p) > target.range + 8) return { valid: false, reason: 'OUT_OF_RANGE' };
    }
    return { valid: true };
  }

  function castProjectile(request, owner, def) {
    const d = direction(request.direction.x, request.direction.y);
    fx.projectiles.push({
      id: uid('projectile'), owner, def, x: owner.x, y: owner.y,
      vx: d.x * def.delivery.speed, vy: d.y * def.delivery.speed,
      radius: def.delivery.radius, traveled: 0, maxDistance: def.delivery.maxDistance,
    });
  }

  function castSelfAoe(owner, def) {
    enemies(owner).forEach((enemy) => {
      if (distance(owner, enemy) <= def.delivery.radius) applyEffects(def, owner, enemy, false);
    });
    fx.areas.push({ kind: 'flash', x: owner.x, y: owner.y, radius: def.delivery.radius, time: 0.35, color: def.visuals.color });
  }

  function castChain(owner, def) {
    const used = [];
    let origin = owner;
    let amount = ((def.effects || []).find((e) => e.type === 'damage') || {}).amount || 20;
    let current = enemies(owner)
      .filter((enemy) => distance(owner, enemy) <= (def.targeting.range || 400))
      .sort((a, b) => distance(owner, a) - distance(owner, b))[0];
    for (let i = 0; i < (def.delivery.maxTargets || 3) && current; i++) {
      damage(current, amount, { source: owner, abilityId: def.id, damageType: 'lightning' });
      used.push(current);
      fx.areas.push({ kind: 'bolt', x1: origin.x, y1: origin.y, x2: current.x, y2: current.y, time: 0.2, color: def.visuals.color });
      origin = current;
      amount *= def.delivery.damageFalloff || 0.8;
      current = enemies(owner)
        .filter((enemy) => used.indexOf(enemy) < 0 && distance(origin, enemy) <= def.delivery.jumpRange)
        .sort((a, b) => distance(origin, a) - distance(origin, b))[0];
    }
  }

  function castDash(request, owner, def) {
    const d = direction(request.direction.x, request.direction.y);
    const duration = def.delivery.duration || 0.18;
    owner._dash = {
      sx: owner.x, sy: owner.y,
      tx: owner.x + d.x * (def.delivery.distance || 160),
      ty: owner.y + d.y * (def.delivery.distance || 160),
      time: duration, max: duration,
    };
  }

  function castBlink(request, owner, def) {
    const d = direction(request.direction.x, request.direction.y);
    const amount = def.delivery.distance || 130;
    const worldW = (typeof CONFIG !== 'undefined' && CONFIG.worldWidth) || 3600;
    const worldH = (typeof CONFIG !== 'undefined' && CONFIG.worldHeight) || 3200;
    owner.x = Math.max(24, Math.min(worldW - 24, owner.x + d.x * amount));
    owner.y = Math.max(24, Math.min(worldH - 24, owner.y + d.y * amount));
  }

  function castArea(request, owner, def) {
    const p = request.position || owner;
    fx.areas.push({
      kind: 'persist', owner, def, x: p.x, y: p.y,
      radius: def.delivery.radius, time: def.delivery.duration,
      interval: def.delivery.tickInterval, tick: 0, color: def.visuals.color,
    });
  }

  function castWall(request, owner, def) {
    const p = request.position || owner;
    const width = def.delivery.width || 150;
    const wall = { x: p.x - width / 2, y: p.y - 12, w: width, h: 24, hp: def.delivery.hp || 250, time: def.delivery.duration || 4 };
    fx.walls.push(wall);
    if (typeof obstacles !== 'undefined') obstacles.push(wall);
  }

  function castTrap(request, owner, def) {
    const p = request.position || owner;
    fx.traps.push({
      owner, def, x: p.x, y: p.y,
      radius: def.delivery.activationRadius,
      arm: def.delivery.armTime, time: def.delivery.duration, state: 'ARMING',
    });
  }

  function castAura(owner, def) {
    fx.areas.push({
      kind: 'aura', owner, def, x: owner.x, y: owner.y,
      radius: def.delivery.radius, time: def.delivery.duration,
      interval: def.delivery.tickInterval, tick: 0, color: def.visuals.color,
    });
  }

  function cast(request) {
    const slot = Number(request && request.slotIndex);
    if (!Number.isInteger(slot) || slot < 0 || slot >= hotbar.slots.length) return { valid: false, reason: 'INVALID_SLOT' };
    const instance = hotbar.slots[slot];
    const def = instance && instance.definition;
    const validation = validateCast(request || {}, instance, def);
    if (!validation.valid) {
      emit('ABILITY_FAILED', { request, reason: validation.reason });
      return validation;
    }

    localPlayer.mana -= def.resource.cost || 0;
    instance.cooldown = def.cooldown;
    emit('ABILITY_CAST', {
      playerId: localPlayer.id || 'local', stoneUid: instance.stoneUid,
      abilityId: def.id, abilityKey: def.key, slotIndex: slot,
      clientSequence: sequence++, loadoutFingerprint: fingerprint,
    });

    const type = def.delivery.type;
    if (type === 'projectile') castProjectile(request, localPlayer, def);
    else if (type === 'self_aoe') castSelfAoe(localPlayer, def);
    else if (type === 'chain') castChain(localPlayer, def);
    else if (type === 'dash') castDash(request, localPlayer, def);
    else if (type === 'blink') castBlink(request, localPlayer, def);
    else if (type === 'instant') applyEffects(def, localPlayer, localPlayer, false);
    else if (type === 'persistent_area') castArea(request, localPlayer, def);
    else if (type === 'wall') castWall(request, localPlayer, def);
    else if (type === 'trap') castTrap(request, localPlayer, def);
    else if (type === 'aura') castAura(localPlayer, def);
    else return { valid: false, reason: 'UNSUPPORTED_DELIVERY' };
    return { valid: true, abilityId: def.id, stoneUid: instance.stoneUid };
  }

  const engine = Object.freeze({ cast });

  function syncFromState(force) {
    if (typeof STATE === 'undefined') return;
    const snapshot = stones.exportLoadout(STATE);
    if (!force && snapshot.fingerprint === fingerprint) return;

    const previous = new Map();
    hotbar.slots.forEach((slot) => { if (slot) previous.set(slot.stoneUid, slot); });
    snapshot.slots.forEach((entry, slotIndex) => {
      if (!entry) {
        hotbar.slots[slotIndex] = null;
        return;
      }
      const stone = STATE.equipped.find((candidate) => candidate && candidate.uid === entry.stoneUid);
      const normalized = stone && stones.normalizeStone(stone);
      const definition = normalized && stones.resolveAbility(normalized);
      if (!normalized || !definition) {
        hotbar.slots[slotIndex] = null;
        return;
      }
      const old = previous.get(normalized.uid);
      hotbar.slots[slotIndex] = {
        stoneUid: normalized.uid, abilityId: normalized.abilityId,
        abilityKey: normalized.abilityKey, tier: normalized.tier,
        definition, cooldown: old ? old.cooldown : 0,
      };
    });
    fingerprint = snapshot.fingerprint;
    paintHotbar();
    emit('LOADOUT_CHANGED', snapshot);
  }

  function update(dt) {
    syncFromState(false);
    hotbar.slots.forEach((slot) => { if (slot) slot.cooldown = Math.max(0, slot.cooldown - dt); });

    if (typeof localPlayer !== 'undefined') {
      if (localPlayer.mana == null) { localPlayer.mana = 100; localPlayer.maxMana = 100; }
      localPlayer.mana = Math.min(localPlayer.maxMana || 100, localPlayer.mana + 8 * dt);
      if (localPlayer.keloShieldT > 0) {
        localPlayer.keloShieldT -= dt;
        if (localPlayer.keloShieldT <= 0) localPlayer.keloShield = 0;
      }
      if (localPlayer._dash) {
        const dash = localPlayer._dash;
        dash.time -= dt;
        const k = 1 - Math.max(0, dash.time) / dash.max;
        localPlayer.x = dash.sx + (dash.tx - dash.sx) * Math.min(1, k);
        localPlayer.y = dash.sy + (dash.ty - dash.sy) * Math.min(1, k);
        if (dash.time <= 0) localPlayer._dash = null;
      }
    }

    for (let i = fx.projectiles.length - 1; i >= 0; i--) {
      const p = fx.projectiles[i];
      const step = Math.hypot(p.vx, p.vy) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.traveled += step;
      let hit = enemies(p.owner).find((enemy) => distance(p, enemy) < p.radius + (enemy.radius || 16));
      if (typeof obstacles !== 'undefined' && obstacles.some((wall) => p.x > wall.x && p.x < wall.x + wall.w && p.y > wall.y && p.y < wall.y + wall.h)) hit = hit || false;
      if (hit) applyEffects(p.def, p.owner, hit, false);
      if (hit !== undefined || p.traveled >= p.maxDistance) fx.projectiles.splice(i, 1);
    }

    for (let i = fx.areas.length - 1; i >= 0; i--) {
      const area = fx.areas[i];
      area.time -= dt;
      if (area.kind === 'aura' && area.owner) { area.x = area.owner.x; area.y = area.owner.y; }
      if (area.interval) {
        area.tick += dt;
        while (area.tick >= area.interval) {
          area.tick -= area.interval;
          if (area.kind === 'aura') applyEffects(area.def, area.owner, area.owner, true);
          else if (area.kind === 'persist') enemies(area.owner).forEach((enemy) => { if (distance(area, enemy) <= area.radius) applyEffects(area.def, area.owner, enemy, true); });
        }
      }
      if (area.time <= 0) fx.areas.splice(i, 1);
    }

    for (let i = fx.walls.length - 1; i >= 0; i--) {
      const wall = fx.walls[i];
      wall.time -= dt;
      if (wall.time <= 0 || wall.hp <= 0) {
        if (typeof obstacles !== 'undefined') {
          const index = obstacles.indexOf(wall);
          if (index >= 0) obstacles.splice(index, 1);
        }
        fx.walls.splice(i, 1);
      }
    }

    for (let i = fx.traps.length - 1; i >= 0; i--) {
      const trap = fx.traps[i];
      trap.time -= dt;
      if (trap.state === 'ARMING') { trap.arm -= dt; if (trap.arm <= 0) trap.state = 'ARMED'; }
      if (trap.state === 'ARMED') {
        const victim = enemies(trap.owner).find((enemy) => distance(trap, enemy) <= trap.radius);
        if (victim) { applyEffects(trap.def, trap.owner, victim, false); fx.traps.splice(i, 1); continue; }
      }
      if (trap.time <= 0) fx.traps.splice(i, 1);
    }

    for (let i = fx.statuses.length - 1; i >= 0; i--) {
      const st = fx.statuses[i];
      st.remaining -= dt; st.tick -= dt;
      if (st.type === 'slow' && st.target) st.target._slowMul = 1 - (st.magnitude || 0.3);
      if (st.tick <= 0 && (st.type === 'burn' || st.type === 'poison')) {
        st.tick += st.interval;
        damage(st.target, st.magnitude || 5, { source: st.source, abilityId: st.abilityId });
      }
      if (st.remaining <= 0) {
        if (st.type === 'slow' && st.target) st.target._slowMul = 1;
        fx.statuses.splice(i, 1);
      }
    }
    paintHotbar();
  }

  function draw() {
    if (typeof ctx === 'undefined' || typeof camera === 'undefined') return;
    const zoom = (typeof CONFIG !== 'undefined' && CONFIG.zoom) || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2); ctx.scale(zoom, zoom); ctx.translate(-camera.x, -camera.y);
    fx.projectiles.forEach((p) => {
      ctx.fillStyle = (p.def.visuals && p.def.visuals.color) || '#ff6b35';
      ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
    });
    fx.areas.forEach((area) => {
      ctx.strokeStyle = area.color || '#fff'; ctx.globalAlpha = area.kind === 'bolt' ? 0.9 : 0.35;
      ctx.beginPath();
      if (area.kind === 'bolt') { ctx.moveTo(area.x1, area.y1); ctx.lineTo(area.x2, area.y2); }
      else ctx.arc(area.x || 0, area.y || 0, area.radius || 20, 0, Math.PI * 2);
      ctx.stroke(); ctx.globalAlpha = 1;
    });
    fx.walls.forEach((wall) => { ctx.fillStyle = 'rgba(168,216,255,.7)'; ctx.fillRect(wall.x, wall.y, wall.w, wall.h); });
    fx.traps.forEach((trap) => { ctx.strokeStyle = trap.state === 'ARMED' ? '#8ac926' : '#666'; ctx.beginPath(); ctx.arc(trap.x, trap.y, trap.radius, 0, Math.PI * 2); ctx.stroke(); });
    ctx.restore();
  }

  const aim = { slot: -1, active: false, x0: 0, y0: 0, x1: 0, y1: 0 };

  function bindSlot(button, slot) {
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault(); event.stopPropagation();
      const instance = hotbar.slots[slot];
      if (!instance) return toast('Slot vacío');
      const def = instance.definition;
      if (def.targeting.type === 'self') return cast({ slotIndex: slot });
      aim.slot = slot; aim.active = true; aim.x0 = aim.x1 = event.clientX; aim.y0 = aim.y1 = event.clientY;
      try { button.setPointerCapture(event.pointerId); } catch (error) {}
    });
    button.addEventListener('pointermove', (event) => { if (aim.active && aim.slot === slot) { aim.x1 = event.clientX; aim.y1 = event.clientY; } });
    button.addEventListener('pointerup', () => {
      if (!aim.active || aim.slot !== slot) return;
      aim.active = false;
      const instance = hotbar.slots[slot];
      if (!instance) return;
      const def = instance.definition;
      const dx = aim.x1 - aim.x0, dy = aim.y1 - aim.y0;
      const d = direction(dx || 1, dy || 0);
      if (def.targeting.type === 'position') {
        const zoom = (typeof CONFIG !== 'undefined' && CONFIG.zoom) || 1;
        const amount = Math.min(def.targeting.range || 300, Math.hypot(dx, dy) / zoom * 1.2 || 80);
        cast({ slotIndex: slot, direction: d, position: { x: localPlayer.x + d.x * amount, y: localPlayer.y + d.y * amount } });
      } else cast({ slotIndex: slot, direction: d });
    });
    button.addEventListener('pointercancel', () => { if (aim.slot === slot) aim.active = false; });
  }

  function paintHotbar() {
    const bar = document.getElementById('action-bar-container');
    if (!bar) return;
    if (!bar.dataset.keloStoneV4) {
      bar.innerHTML = '';
      bar.dataset.keloStoneV4 = '1';
      for (let slot = 0; slot < stones.LOADOUT_SIZE; slot++) {
        const button = document.createElement('button');
        button.type = 'button'; button.className = 'stone-slot' + (slot === 4 ? ' ultimate' : '');
        button.dataset.slot = String(slot); bar.appendChild(button); bindSlot(button, slot);
      }
    }
    bar.querySelectorAll('.stone-slot').forEach((button, slot) => {
      const instance = hotbar.slots[slot];
      if (!instance) {
        button.style.borderColor = '';
        button.innerHTML = '<span style="font-size:16px;opacity:.3">◇</span><span style="opacity:.4">' + (slot === 4 ? 'ULT' : 'Vacío') + '</span>';
        return;
      }
      const def = instance.definition;
      const cooldown = instance.cooldown || 0;
      button.style.borderColor = tierColor[instance.tier] || '#c9a24a';
      button.innerHTML = '<span style="font-size:' + (slot === 4 ? 20 : 17) + 'px">' + (def.icon || '◆') + '</span><span>' + def.name.split(' ')[0] + '</span>' +
        (slot === 4 ? '<span style="font-size:6px">ULT</span>' : '') +
        (cooldown > 0 ? '<span style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,.62);display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">' + cooldown.toFixed(1) + '</span>' : '');
    });
  }

  function saveAndRefresh() {
    if (typeof saveState === 'function') saveState();
    syncFromState(true);
    const panel = document.getElementById('kelo-builder');
    if (panel && panel.style.display === 'block') renderPanel(panel);
  }

  function equipInventory(index) {
    if (typeof STATE === 'undefined') return false;
    index = Number(index);
    if (!Number.isInteger(index) || index < 0 || index >= STATE.inventory.length) return false;
    const stone = stones.normalizeStone(STATE.inventory[index]);
    if (!stone) return false;
    const def = stones.abilityByKey(stone.abilityKey);
    const snapshot = stones.exportLoadout(STATE);
    if (def.slotType === 'ultimate') {
      if (snapshot.slots[4]) return toast('Solo puedes equipar 1 Ultimate'), false;
    } else if (snapshot.slots.slice(0, 4).every(Boolean)) {
      return toast('Tus 4 ranuras normales ya están ocupadas'), false;
    }
    STATE.inventory.splice(index, 1); STATE.equipped.push(stone); saveAndRefresh();
    toast(stone.name + (def.slotType === 'ultimate' ? ' equipada como Ultimate' : ' equipada'));
    return true;
  }

  function unequipSlot(slot) {
    if (typeof STATE === 'undefined') return false;
    slot = Number(slot);
    const entry = stones.exportLoadout(STATE).slots[slot];
    if (!entry) return false;
    const index = STATE.equipped.findIndex((stone) => stone && stone.uid === entry.stoneUid);
    if (index < 0) return false;
    const stone = STATE.equipped.splice(index, 1)[0]; STATE.inventory.push(stones.normalizeStone(stone)); saveAndRefresh(); toast(stone.name + ' guardada');
    return true;
  }

  function moveNormal(slot, delta) {
    const target = slot + delta;
    if (slot < 0 || target < 0 || slot >= 4 || target >= 4) return;
    const snapshot = stones.exportLoadout(STATE);
    const a = snapshot.slots[slot], b = snapshot.slots[target];
    if (!a || !b) return;
    const ai = STATE.equipped.findIndex((stone) => stone.uid === a.stoneUid);
    const bi = STATE.equipped.findIndex((stone) => stone.uid === b.stoneUid);
    if (ai < 0 || bi < 0) return;
    [STATE.equipped[ai], STATE.equipped[bi]] = [STATE.equipped[bi], STATE.equipped[ai]];
    saveAndRefresh();
  }

  function card(stone, controls) {
    const info = stones.stoneSummary(stone);
    if (!info) return '';
    const color = tierColor[info.tier] || '#8b949e';
    const affixes = info.affixes.length ? info.affixes.join(' · ') : 'Sin afijos';
    return '<div style="border:1px solid ' + color + ';border-radius:12px;padding:9px;background:rgba(255,255,255,.025)"><div style="display:flex;gap:8px"><div style="font-size:24px">' + info.icon + '</div><div style="min-width:0;flex:1"><b>' + info.name + '</b><div style="font-size:9px;color:' + color + ';font-weight:800">' + info.tier.toUpperCase() + '</div><div style="font-size:9px;color:#8b949e">' + info.recipe + '</div><div style="font-size:9px;margin-top:3px">' + affixes + '</div></div></div>' + (controls || '') + '</div>';
  }

  function renderPanel(panel) {
    const snapshot = stones.exportLoadout(STATE);
    const projected = stones.projectLoadout(STATE);
    panel.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center"><div><b style="color:#e7c56a">ARSENAL DE PIEDRAS</b><div style="font-size:9px;color:#8b949e">4 habilidades + 1 Ultimate · el PvP hereda este loadout</div></div><button id="kelo-close-stones">×</button></div><div id="kelo-loadout" style="display:grid;gap:7px;margin-top:10px"></div><div style="margin-top:12px"><b>Inventario</b><div id="kelo-inventory" style="display:grid;gap:7px;margin-top:7px"></div></div><div style="font-size:8px;color:#484f58;margin-top:8px">Loadout ' + snapshot.fingerprint + '</div>';
    panel.querySelector('#kelo-close-stones').onclick = () => { panel.style.display = 'none'; };
    const loadout = panel.querySelector('#kelo-loadout');
    for (let slot = 0; slot < 5; slot++) {
      const stone = projected[slot];
      if (!stone) {
        const empty = document.createElement('div'); empty.style.cssText = 'border:1px dashed #30363d;border-radius:10px;padding:9px;color:#484f58;text-align:center';
        empty.textContent = slot === 4 ? 'Slot 5 · Ultimate vacío' : 'Slot ' + (slot + 1) + ' · normal vacío'; loadout.appendChild(empty); continue;
      }
      const row = document.createElement('div');
      const arrows = slot < 4 ? '<button data-left>←</button>' : '';
      const arrowsR = slot < 4 ? '<button data-right>→</button>' : '';
      row.innerHTML = card(stone, '<div style="display:flex;gap:5px;margin-top:7px">' + arrows + '<button data-remove style="flex:1">Quitar</button>' + arrowsR + '</div>');
      const left = row.querySelector('[data-left]'), right = row.querySelector('[data-right]');
      if (left) left.onclick = () => moveNormal(slot, -1);
      row.querySelector('[data-remove]').onclick = () => unequipSlot(slot);
      if (right) right.onclick = () => moveNormal(slot, 1);
      loadout.appendChild(row);
    }
    const inventory = panel.querySelector('#kelo-inventory');
    if (!STATE.inventory.length) inventory.innerHTML = '<div style="padding:10px;color:#8b949e;border:1px dashed #30363d;border-radius:10px">No tienes piedras guardadas.</div>';
    STATE.inventory.forEach((stone, index) => {
      const row = document.createElement('div'); row.innerHTML = card(stone, '<button data-equip style="width:100%;margin-top:7px;padding:7px">Equipar</button>');
      row.querySelector('[data-equip]').onclick = () => equipInventory(index); inventory.appendChild(row);
    });
  }

  function openPanel() {
    let panel = document.getElementById('kelo-builder');
    if (!panel) {
      panel = document.createElement('div'); panel.id = 'kelo-builder';
      panel.style.cssText = 'display:none;position:absolute;top:82px;left:8px;width:min(360px,calc(100vw - 16px));z-index:120;background:rgba(10,13,18,.985);border:1px solid rgba(231,197,106,.55);border-radius:14px;padding:12px;color:#c9d1d9;font-size:11px;pointer-events:auto;max-height:72vh;overflow:auto'; document.body.appendChild(panel);
    }
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block'; if (panel.style.display === 'block') renderPanel(panel);
  }

  function installUi() {
    let button = document.getElementById('kelo-stones-btn');
    if (!button) {
      button = document.createElement('button'); button.id = 'kelo-stones-btn'; button.type = 'button'; button.textContent = '◆ Piedras';
      button.style.cssText = 'position:absolute;bottom:160px;right:10px;z-index:90;pointer-events:auto;background:rgba(16,20,28,.94);color:#e7c56a;border:1px solid #c9a24a;border-radius:10px;padding:8px 11px;font-size:11px;font-weight:800'; document.body.appendChild(button);
    }
    button.onclick = openPanel;
  }

  function installLegacyAdapters() {
    window.createStoneInstance = (typeId, tier) => {
      try { return stones.createFromLegacy(typeId, tier || 'Common', { source: 'world' }); }
      catch (error) { console.error(error); return stones.createAbilityStone('fireball', tier || 'Common', { source: 'fallback' }); }
    };
    window.equipStone = equipInventory;
    window.unequipStone = unequipSlot;
    window.renderActionBar = () => { syncFromState(true); paintHotbar(); };
    window.triggerStone = (slot) => {
      const d = direction((localPlayer && localPlayer.vx) || 1, (localPlayer && localPlayer.vy) || 0);
      return cast({ slotIndex: Number(slot), direction: d });
    };
    window.addTestStones = () => {
      if (!window.KELO_ABILITY_DEBUG) return toast('Las piedras de prueba están desactivadas');
      STATE.inventory.push(stones.createAbilityStone('chain_lightning', 'Rare', { source: 'debug' })); saveAndRefresh();
    };

    window.selectForFusion = (inventoryIndex) => {
      if (typeof fusionSelection === 'undefined' || fusionSelection.length >= 3) return;
      const stone = stones.normalizeStone(STATE.inventory[inventoryIndex]); if (!stone) return;
      if (fusionSelection.length) {
        const first = stones.normalizeStone(fusionSelection[0]);
        if (first.abilityKey !== stone.abilityKey) return toast('La fusión requiere la misma habilidad');
        if (first.tier !== stone.tier) return toast('Las 3 piedras deben tener el mismo tier');
      }
      fusionSelection.push(stone); if (typeof renderFusionPanel === 'function') renderFusionPanel();
    };

    window.executeFusion = () => {
      if (typeof fusionSelection === 'undefined') return;
      const check = stones.canFuse(fusionSelection);
      if (!check.valid) return toast({ NEED_THREE: 'Necesitas 3 piedras', ABILITY_MISMATCH: 'Solo la misma habilidad', TIER_MISMATCH: 'Mismo tier requerido', MAX_TIER: 'Ya es Divine' }[check.reason] || 'Fusión inválida');
      if (STATE.gold < 100) return toast('Oro insuficiente');
      STATE.gold -= 100;
      const ids = new Set(check.stones.map((s) => s.uid)); STATE.inventory = STATE.inventory.filter((s) => !ids.has(s.uid));
      const rank = stones.tierRank(check.tier) + 1;
      const success = Math.max(20, 75 - rank * 12 + STATE.fusionMastery * 2), critical = Math.min(40, rank * 8), roll = Math.random() * 100;
      const log = document.getElementById('fusion-log');
      if (roll < success) {
        const upgraded = stones.createAbilityStone(check.abilityKey, check.nextTier, { source: 'fusion' }); STATE.inventory.push(upgraded); STATE.fusionXp += 25;
        if (STATE.fusionXp >= 100) { STATE.fusionMastery++; STATE.fusionXp = 0; }
        if (log) { log.style.color = '#39d353'; log.textContent = 'ÉXITO: [' + check.nextTier + '] ' + upgraded.name; }
      } else if (roll < success + critical) {
        if (log) { log.style.color = '#ff7b72'; log.textContent = 'FALLO CRÍTICO'; }
      } else {
        STATE.inventory.push(check.stones[0]); if (log) { log.style.color = '#ffd166'; log.textContent = 'Fallo: 1 piedra recuperada'; }
      }
      fusionSelection = []; saveAndRefresh(); if (typeof renderFusionPanel === 'function') renderFusionPanel();
    };
  }

  function boot() {
    if (typeof STATE === 'undefined') return console.error('KeloAbilities: STATE unavailable');
    const migration = stones.migrateState(STATE);
    if (!STATE.equipped.length && !STATE.inventory.length) STATE.equipped = stones.createStarterSet();
    if (typeof localPlayer !== 'undefined') { localPlayer.mana = 100; localPlayer.maxMana = 100; }
    installLegacyAdapters(); installUi(); syncFromState(true); paintHotbar();
    if (migration.migrated || migration.quarantined || migration.rekeyed || migration.overflow) { console.info('KeloStones migration', migration); if (typeof saveState === 'function') saveState(); }

    const previousUpdate = updateSimulation;
    updateSimulation = (dt) => { previousUpdate(dt); update(dt); };
    const previousRender = render;
    render = () => { previousRender(); draw(); };

    window.KeloAbilities = Object.freeze({
      registry: Object.freeze({ getById: (id) => byId.get(id) || null, getByKey: (key) => byKey.get(key) || null, getAll: () => defs.slice() }),
      engine, hotbar, bus, stones,
      syncFromWorldState: syncFromState,
      getLoadoutSnapshot: () => stones.exportLoadout(STATE),
      validateLoadoutSnapshot: (snapshot) => stones.validateLoadoutSnapshot(snapshot, STATE),
      openStonePanel: openPanel,
    });
    window.KELO_STONE_AUDIT = { ready: true, schemaVersion: stones.SCHEMA_VERSION, abilityCount: defs.length, equippedCount: STATE.equipped.length, inventoryCount: STATE.inventory.length, loadoutFingerprint: fingerprint, migration };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
