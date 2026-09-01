(function () {
  function uid() { return 'ab_' + Math.random().toString(36).slice(2, 10); }
  function dist(a, b) { return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0)); }
  function norm(x, y) { const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; }

  class RecipeResolver {
    constructor(abilities) {
      this.recipeMap = new Map();
      abilities.forEach((ab) => {
        const key = this.createRecipeKey(ab.recipe);
        if (this.recipeMap.has(key)) throw new Error('Duplicate recipe ' + key);
        this.recipeMap.set(key, ab);
      });
    }
    createRecipeKey(stones) { return [...stones].map(String).sort().join('|'); }
    resolve(stones) {
      if (!stones || !stones.length) return { valid: false, ability: null, reason: 'EMPTY_RECIPE' };
      const ability = this.recipeMap.get(this.createRecipeKey(stones));
      return ability ? { valid: true, ability: ability, reason: null } : { valid: false, ability: null, reason: 'UNKNOWN_RECIPE' };
    }
  }

  class AbilityRegistry {
    constructor(defs) {
      this.byId = new Map(); this.byKey = new Map();
      (defs || []).forEach((d) => this.register(d));
    }
    register(d) {
      if (!d || d.id == null || !d.key || !d.recipe || !d.targeting || !d.resource || d.cooldown == null || !d.delivery || !Array.isArray(d.effects)) {
        console.error('Invalid ability definition', d); return;
      }
      if (this.byId.has(d.id) || this.byKey.has(d.key)) { console.error('Duplicate ability', d.id, d.key); return; }
      this.byId.set(d.id, d); this.byKey.set(d.key, d);
    }
    getById(id) { return this.byId.get(id) || null; }
    getByKey(key) { return this.byKey.get(key) || null; }
    getAll() { return [...this.byId.values()]; }
  }

  class AbilityValidator {
    validate(o) {
      const { request, player, instance, definition } = o;
      if (!definition) return { valid: false, reason: instance ? 'INVALID_ABILITY' : 'EMPTY_SLOT' };
      if (!player || player.hp <= 0) return { valid: false, reason: 'DEAD' };
      if (instance && instance.enabled === false) return { valid: false, reason: 'DISABLED' };
      if (instance && instance.cooldownRemaining > 0) return { valid: false, reason: 'COOLDOWN' };
      if ((player.mana || 0) < (definition.resource.cost || 0)) return { valid: false, reason: 'NO_MANA' };
      const t = definition.targeting || {};
      if (t.type === 'direction' && request && request.direction) {
        if (!Number.isFinite(request.direction.x)) return { valid: false, reason: 'INVALID_TARGET' };
      }
      if (t.type === 'position' && request && request.position) {
        if (!Number.isFinite(request.position.x)) return { valid: false, reason: 'INVALID_POSITION' };
        if (t.range && dist(player, request.position) > t.range + 8) return { valid: false, reason: 'OUT_OF_RANGE' };
      }
      return { valid: true };
    }
  }

  class CombatEventBus {
    constructor() { this.listeners = new Map(); }
    on(name, cb) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(cb);
      return () => this.listeners.get(name).delete(cb);
    }
    emit(name, payload) {
      const set = this.listeners.get(name); if (!set) return;
      set.forEach((cb) => { try { cb(payload); } catch (e) { console.error(e); } });
    }
  }

  class StoneInventory {
    constructor() { this.items = new Map(); }
    add(id, n) { this.items.set(id, (this.items.get(id) || 0) + (n || 1)); }
    has(id, n) { return (this.items.get(id) || 0) >= (n || 1); }
    list() { return [...this.items.entries()]; }
  }

  class HotbarState {
    constructor(size) { this.slots = Array(size || 5).fill(null); }
    equip(i, inst) { this.assert(i); this.slots[i] = inst; }
    unequip(i) { this.assert(i); this.slots[i] = null; }
    get(i) { this.assert(i); return this.slots[i]; }
    isEmpty(i) { return this.get(i) == null; }
    assert(i) { if (i < 0 || i >= this.slots.length) throw new Error('slot'); }
  }

  const registry = new AbilityRegistry(window.ABILITIES || []);
  const resolver = new RecipeResolver(registry.getAll());
  const validator = new AbilityValidator();
  const bus = new CombatEventBus();
  const stones = new StoneInventory();
  Object.keys(window.STONES || {}).forEach((id) => stones.add(id, 9));
  const hotbar = new HotbarState(5);
  const projectiles = [];
  const areas = [];
  const walls = [];
  const traps = [];
  const statuses = [];
  let seq = 1;

  function entities() {
    const list = [];
    if (typeof localPlayer !== 'undefined') list.push(localPlayer);
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach((p) => list.push(p));
    return list;
  }
  function others(owner) {
    return entities().filter((e) => e && e !== owner && (e.hp == null || e.hp > 0));
  }

  function applyDamage(cfg) {
    const t = entities().find((e) => e === cfg.target || e.id === cfg.targetId);
    if (!t) return;
    let amt = cfg.amount || 0;
    if (t.keloShield && t.keloShield > 0) {
      const use = Math.min(t.keloShield, amt);
      t.keloShield -= use; amt -= use;
      if (t.keloShield <= 0) bus.emit('SHIELD_BROKEN', { target: t });
    }
    t.hp = Math.max(0, (t.hp == null ? 100 : t.hp) - amt);
    bus.emit('DAMAGE', cfg);
    if (t.hp <= 0) bus.emit('DEATH', { target: t });
  }
  function applyHeal(cfg) {
    const t = cfg.target; if (!t) return;
    const max = t.maxHp || 100;
    t.hp = Math.min(max, (t.hp == null ? max : t.hp) + (cfg.amount || 0));
    bus.emit('HEAL', cfg);
  }
  function applyStatus(cfg) {
    statuses.push({
      id: uid(), type: cfg.status, target: cfg.target, source: cfg.source,
      remaining: cfg.duration || 1, magnitude: cfg.magnitude || 0,
      tickInterval: cfg.tickInterval || 1, tickRemaining: cfg.tickInterval || 1
    });
    bus.emit('STATUS_APPLIED', cfg);
  }
  function applyEffects(def, source, target) {
    (def.effects || []).forEach((fx) => {
      if (fx.perTick) return;
      if (fx.type === 'damage') applyDamage({ source: source, target: target, amount: fx.amount, damageType: fx.damageType, abilityId: def.id });
      if (fx.type === 'heal') applyHeal({ target: target, amount: fx.amount });
      if (fx.type === 'shield') { target.keloShield = (target.keloShield || 0) + fx.amount; target.keloShieldT = fx.duration || 4; }
      if (fx.type === 'status') applyStatus({ status: fx.status, target: target, source: source, duration: fx.duration, magnitude: fx.magnitude, tickInterval: fx.tickInterval });
    });
  }

  const engine = {
    cast: function (request) {
      const player = localPlayer;
      const instance = hotbar.get(request.slotIndex);
      const definition = instance ? registry.getById(instance.abilityId) : null;
      const validation = validator.validate({ request: request, player: player, instance: instance, definition: definition });
      if (!validation.valid) { bus.emit('ABILITY_FAILED', { request: request, reason: validation.reason }); return validation; }
      player.mana -= definition.resource.cost;
      instance.cooldownRemaining = definition.cooldown;
      bus.emit('ABILITY_CAST', { playerId: player.id || 'local', abilityId: definition.id, slotIndex: request.slotIndex, clientSequence: seq++ });
      const type = definition.delivery.type;
      if (type === 'projectile') this.castProjectile(request, player, definition);
      else if (type === 'self_aoe') this.castSelfAoE(player, definition);
      else if (type === 'chain') this.castChain(request, player, definition);
      else if (type === 'dash') this.castDash(request, player, definition);
      else if (type === 'blink') this.castBlink(request, player, definition);
      else if (type === 'instant') applyEffects(definition, player, player);
      else if (type === 'persistent_area') this.castArea(request, player, definition);
      else if (type === 'wall') this.castWall(request, player, definition);
      else if (type === 'trap') this.castTrap(request, player, definition);
      else if (type === 'aura') this.castAura(player, definition);
      return { valid: true };
    },
    castProjectile: function (req, player, def) {
      const d = req.direction || { x: 1, y: 0 };
      const n = norm(d.x, d.y);
      projectiles.push({ id: uid(), owner: player, def: def, x: player.x, y: player.y, vx: n.x * def.delivery.speed, vy: n.y * def.delivery.speed, r: def.delivery.radius, traveled: 0, max: def.delivery.maxDistance, alive: true, hit: false });
    },
    castSelfAoE: function (player, def) {
      others(player).forEach((e) => { if (dist(player, e) <= def.delivery.radius) applyEffects(def, player, e); });
      areas.push({ kind: 'flash', x: player.x, y: player.y, r: def.delivery.radius, t: 0.35, color: (def.visuals && def.visuals.color) || '#fff' });
    },
    castChain: function (req, player, def) {
      const used = [];
      let origin = player;
      let dmg = def.effects[0] ? def.effects[0].amount : 20;
      const first = others(player).filter((e) => dist(player, e) <= (def.targeting.range || 400)).sort((a, b) => dist(player, a) - dist(player, b))[0];
      let cur = first;
      for (let i = 0; i < (def.delivery.maxTargets || 3) && cur; i++) {
        applyDamage({ target: cur, amount: dmg, source: player, abilityId: def.id, damageType: 'lightning' });
        used.push(cur);
        areas.push({ kind: 'bolt', x1: origin.x, y1: origin.y, x2: cur.x, y2: cur.y, t: 0.2, color: '#ffe066' });
        origin = cur; dmg *= def.delivery.damageFalloff || 0.8;
        cur = others(player).filter((e) => used.indexOf(e) < 0 && dist(origin, e) <= def.delivery.jumpRange).sort((a, b) => dist(origin, a) - dist(origin, b))[0];
      }
    },
    castDash: function (req, player, def) {
      const n = norm((req.direction && req.direction.x) || 1, (req.direction && req.direction.y) || 0);
      const distn = def.delivery.distance || 160;
      player._dash = { tx: player.x + n.x * distn, ty: player.y + n.y * distn, t: def.delivery.duration || 0.18, max: def.delivery.duration || 0.18, sx: player.x, sy: player.y };
    },
    castBlink: function (req, player, def) {
      const n = norm((req.direction && req.direction.x) || 1, (req.direction && req.direction.y) || 0);
      const d0 = def.delivery.distance || 130;
      let nx = player.x + n.x * d0, ny = player.y + n.y * d0;
      nx = Math.max(24, Math.min((CONFIG && CONFIG.worldWidth || 3600) - 24, nx));
      ny = Math.max(24, Math.min((CONFIG && CONFIG.worldHeight || 3200) - 24, ny));
      player.x = nx; player.y = ny;
    },
    castArea: function (req, player, def) {
      const p = req.position || player;
      areas.push({ kind: 'persist', owner: player, def: def, x: p.x, y: p.y, r: def.delivery.radius, t: def.delivery.duration, tick: def.delivery.tickInterval, acc: 0, color: (def.visuals && def.visuals.color) || '#ff8c42' });
    },
    castWall: function (req, player, def) {
      const p = req.position || player;
      walls.push({ x: p.x - 75, y: p.y - 12, w: def.delivery.width || 150, h: 24, hp: def.delivery.hp || 250, t: def.delivery.duration || 4 });
      if (typeof obstacles !== 'undefined') obstacles.push(walls[walls.length - 1]);
    },
    castTrap: function (req, player, def) {
      const p = req.position || player;
      traps.push({ owner: player, def: def, x: p.x, y: p.y, r: def.delivery.activationRadius, arm: def.delivery.armTime, t: def.delivery.duration, state: 'ARMING' });
    },
    castAura: function (player, def) {
      areas.push({ kind: 'aura', owner: player, def: def, follow: true, r: def.delivery.radius, t: def.delivery.duration, tick: def.delivery.tickInterval, acc: 0, color: '#fff3b0' });
    }
  };

  function toast(msg) { if (typeof showToast === 'function') showToast(msg); }

  function updateSystems(dt) {
    if (localPlayer) {
      if (localPlayer.mana == null) { localPlayer.mana = 100; localPlayer.maxMana = 100; }
      localPlayer.mana = Math.min(localPlayer.maxMana || 100, localPlayer.mana + 8 * dt);
      if (localPlayer.keloShieldT > 0) { localPlayer.keloShieldT -= dt; if (localPlayer.keloShieldT <= 0) localPlayer.keloShield = 0; }
      if (localPlayer._dash) {
        const d = localPlayer._dash; d.t -= dt;
        const k = 1 - Math.max(0, d.t) / d.max;
        localPlayer.x = d.sx + (d.tx - d.sx) * Math.min(1, k);
        localPlayer.y = d.sy + (d.ty - d.sy) * Math.min(1, k);
        if (d.t <= 0) localPlayer._dash = null;
      }
    }
    hotbar.slots.forEach((s) => { if (s) s.cooldownRemaining = Math.max(0, s.cooldownRemaining - dt); });
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      const step = Math.hypot(p.vx, p.vy) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.traveled += step;
      let hit = null;
      others(p.owner).forEach((e) => { if (dist(p, e) < p.r + (e.radius || 16)) hit = e; });
      walls.forEach((w) => { if (p.x > w.x && p.x < w.x + w.w && p.y > w.y && p.y < w.y + w.h) { p.alive = false; } });
      if (hit) { applyEffects(p.def, p.owner, hit); p.alive = false; p.hit = true; bus.emit('ABILITY_HIT', { p: p, hit: hit }); }
      if (p.traveled >= p.max) { if (!p.hit) bus.emit('ABILITY_MISS', p); p.alive = false; }
      if (!p.alive) projectiles.splice(i, 1);
    }
    for (let i = areas.length - 1; i >= 0; i--) {
      const a = areas[i]; a.t -= dt;
      if (a.follow && a.owner) { a.x = a.owner.x; a.y = a.owner.y; }
      if (a.tick) {
        a.acc += dt;
        if (a.acc >= a.tick) {
          a.acc = 0;
          if (a.kind === 'aura') applyHeal({ target: a.owner, amount: 12 });
          else others(a.owner).forEach((e) => { if (dist(a, e) <= a.r) applyDamage({ target: e, amount: 10, source: a.owner }); });
        }
      }
      if (a.t <= 0) areas.splice(i, 1);
    }
    for (let i = walls.length - 1; i >= 0; i--) {
      walls[i].t -= dt;
      if (walls[i].t <= 0 || walls[i].hp <= 0) {
        if (typeof obstacles !== 'undefined') {
          const ix = obstacles.indexOf(walls[i]); if (ix >= 0) obstacles.splice(ix, 1);
        }
        walls.splice(i, 1);
      }
    }
    for (let i = traps.length - 1; i >= 0; i--) {
      const tr = traps[i]; tr.t -= dt;
      if (tr.state === 'ARMING') { tr.arm -= dt; if (tr.arm <= 0) tr.state = 'ARMED'; }
      if (tr.state === 'ARMED') {
        const vic = others(tr.owner).find((e) => dist(tr, e) <= tr.r);
        if (vic) { applyEffects(tr.def, tr.owner, vic); traps.splice(i, 1); continue; }
      }
      if (tr.t <= 0) traps.splice(i, 1);
    }
    for (let i = statuses.length - 1; i >= 0; i--) {
      const st = statuses[i]; st.remaining -= dt; st.tickRemaining -= dt;
      if (st.type === 'slow' && st.target) st.target._slowMul = 1 - (st.magnitude || 0.3);
      if (st.tickRemaining <= 0 && (st.type === 'burn' || st.type === 'poison')) {
        st.tickRemaining = st.tickInterval;
        applyDamage({ target: st.target, amount: st.magnitude || 5 });
      }
      if (st.remaining <= 0) {
        if (st.type === 'slow' && st.target) st.target._slowMul = 1;
        statuses.splice(i, 1);
      }
    }
    paintHotbar();
  }

  function drawWorldFx() {
    const z = (CONFIG && CONFIG.zoom) || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2); ctx.scale(z, z); ctx.translate(-camera.x, -camera.y);
    projectiles.forEach((p) => { ctx.fillStyle = (p.def.visuals && p.def.visuals.color) || '#ff6b35'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); });
    areas.forEach((a) => {
      ctx.strokeStyle = a.color || '#fff'; ctx.globalAlpha = 0.35;
      ctx.beginPath(); ctx.arc(a.x || 0, a.y || 0, a.r || 20, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = 1;
      if (a.kind === 'bolt') { ctx.strokeStyle = a.color; ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke(); }
    });
    walls.forEach((w) => { ctx.fillStyle = 'rgba(168,216,255,0.7)'; ctx.fillRect(w.x, w.y, w.w, w.h); });
    traps.forEach((tr) => { ctx.strokeStyle = tr.state === 'ARMED' ? '#8ac926' : '#666'; ctx.beginPath(); ctx.arc(tr.x, tr.y, tr.r, 0, Math.PI * 2); ctx.stroke(); });
    if (window.KELO_ABILITY_DEBUG) {
      ctx.strokeStyle = '#0f0'; entities().forEach((e) => { ctx.beginPath(); ctx.arc(e.x, e.y, e.radius || 16, 0, Math.PI * 2); ctx.stroke(); });
    }
    ctx.restore();
  }

  function paintHotbar() {
    const bar = document.getElementById('action-bar-container');
    if (!bar) return;
    if (!bar.dataset.keloStones) {
      bar.innerHTML = '';
      bar.dataset.keloStones = '1';
      for (let i = 0; i < 5; i++) {
        const b = document.createElement('button');
        b.className = 'stone-slot' + (i === 4 ? ' ultimate' : '');
        b.dataset.slot = String(i);
        bar.appendChild(b);
        bindSlot(b, i);
      }
    }
    bar.querySelectorAll('.stone-slot').forEach((b, i) => {
      const inst = hotbar.get(i);
      const def = inst ? registry.getById(inst.abilityId) : null;
      const cd = inst ? inst.cooldownRemaining : 0;
      b.innerHTML = def ? ('<span style="font-size:16px">' + ((window.STONES[def.recipe[0]] || {}).icon || '') + '</span><span>' + def.name.split(' ')[0] + '</span>' + (cd > 0 ? '<span style="position:absolute;inset:0;background:rgba(0,0,0,' + Math.min(0.75, cd / Math.max(0.01, def.cooldown)) + ');border-radius:50%"></span>' : '')) : '<span style="opacity:.35">O</span>';
    });
  }

  const aim = { slot: -1, down: false, x0: 0, y0: 0, x1: 0, y1: 0 };
  function bindSlot(el, i) {
    el.addEventListener('pointerdown', function (e) {
      e.preventDefault(); e.stopPropagation();
      const inst = hotbar.get(i); if (!inst) { toast('Slot vacio'); return; }
      const def = registry.getById(inst.abilityId); if (!def) return;
      if (def.targeting.type === 'self') { engine.cast({ slotIndex: i }); return; }
      aim.slot = i; aim.down = true; aim.x0 = e.clientX; aim.y0 = e.clientY; aim.x1 = e.clientX; aim.y1 = e.clientY;
      try { el.setPointerCapture(e.pointerId); } catch (err) {}
    });
    el.addEventListener('pointermove', function (e) { if (!aim.down || aim.slot !== i) return; aim.x1 = e.clientX; aim.y1 = e.clientY; });
    el.addEventListener('pointerup', function (e) {
      if (!aim.down || aim.slot !== i) return;
      aim.down = false;
      const def = registry.getById(hotbar.get(i).abilityId);
      const dx = aim.x1 - aim.x0, dy = aim.y1 - aim.y0;
      const n = norm(dx || 1, dy || 0);
      const z = (CONFIG && CONFIG.zoom) || 1;
      if (def.targeting.type === 'position') {
        const range = Math.min(def.targeting.range || 300, Math.hypot(dx, dy) / z * 1.2 || 80);
        engine.cast({ slotIndex: i, direction: n, position: { x: localPlayer.x + n.x * range, y: localPlayer.y + n.y * range } });
      } else {
        engine.cast({ slotIndex: i, direction: n });
      }
    });
  }

  function openBuilder() {
    let p = document.getElementById('kelo-builder');
    if (!p) {
      p = document.createElement('div');
      p.id = 'kelo-builder';
      p.style.cssText = 'display:none;position:absolute;top:90px;left:8px;width:min(320px,92vw);z-index:120;background:rgba(13,17,23,.97);border:1px solid #c9a24a;border-radius:12px;padding:12px;color:#ddd;font-size:12px;pointer-events:auto;max-height:70vh;overflow:auto';
      document.body.appendChild(p);
    }
    p.style.display = p.style.display === 'block' ? 'none' : 'block';
    if (p.style.display === 'block') renderBuilder(p);
  }
  let picked = [];
  function renderBuilder(p) {
    const res = resolver.resolve(picked);
    p.innerHTML = '<b style="color:#e7c56a">Piedras</b><div id="kelo-stone-pick" style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0"></div><div>Receta: ' + (picked.join(' + ') || '(vacia)') + '</div><div style="margin:8px 0;color:#e7c56a">' + (res.valid ? res.ability.name : (res.reason === 'UNKNOWN_RECIPE' ? 'COMBINACION DESCONOCIDA' : 'elige piedras')) + '</div><div id="kelo-eq-slots"></div><button id="kelo-clear-rec" style="margin-top:8px">Limpiar</button>';
    const box = p.querySelector('#kelo-stone-pick');
    Object.values(window.STONES).forEach((s) => {
      const b = document.createElement('button');
      b.textContent = s.icon + ' ' + s.name;
      b.style.cssText = 'background:#161b22;color:#eee;border:1px solid #30363d;border-radius:8px;padding:6px';
      b.onclick = function () { picked.push(s.id); renderBuilder(p); };
      box.appendChild(b);
    });
    const slots = p.querySelector('#kelo-eq-slots');
    if (res.valid) {
      for (let i = 0; i < 5; i++) {
        const b = document.createElement('button');
        b.textContent = 'Equipar slot ' + (i + 1);
        b.onclick = function () {
          hotbar.equip(i, { instanceId: uid(), abilityId: res.ability.id, ownerId: 'local', level: 1, stones: picked.slice(), cooldownRemaining: 0, enabled: true });
          toast(res.ability.name + ' en slot ' + (i + 1));
          paintHotbar();
        };
        slots.appendChild(b);
      }
    }
    for (let i = 0; i < 5; i++) {
      const b = document.createElement('button');
      b.textContent = 'Quitar ' + (i + 1);
      b.onclick = function () { hotbar.unequip(i); paintHotbar(); toast('Slot vacio'); };
      slots.appendChild(b);
    }
    p.querySelector('#kelo-clear-rec').onclick = function () { picked = []; renderBuilder(p); };
  }

  function addBuilderBtn() {
    if (document.getElementById('kelo-stones-btn')) return;
    const b = document.createElement('button');
    b.id = 'kelo-stones-btn';
    b.textContent = 'Piedras';
    b.style.cssText = 'position:absolute;bottom:160px;right:10px;z-index:90;pointer-events:auto;background:rgba(16,20,28,.9);color:#e7c56a;border:1px solid #c9a24a;border-radius:10px;padding:7px 10px;font-size:11px';
    b.onclick = openBuilder;
    document.body.appendChild(b);
  }

  function scaleTest101() {
    const fake = { id: 101, key: 'test_spark', name: 'Chispa Test', recipe: ['lightning', 'projectile'], targeting: { type: 'direction', range: 200 }, resource: { type: 'mana', cost: 1 }, cooldown: 1, delivery: { type: 'projectile', speed: 300, radius: 8, maxDistance: 200 }, effects: [{ type: 'damage', amount: 1 }], visuals: { color: '#fff' } };
    registry.register(fake);
    const r = new RecipeResolver(registry.getAll()).resolve(['projectile', 'lightning']);
    const pass = !!(registry.getById(101) && r.valid && r.ability.id === 101);
    window.KELO_SCALE_101 = pass ? 'PASS' : 'FAIL';
    console.log('ABILITY 101 scale', window.KELO_SCALE_101);
  }

  function boot() {
    if (typeof STATE !== 'undefined') { STATE.equipped = []; }
    if (typeof localPlayer !== 'undefined') { localPlayer.mana = 100; localPlayer.maxMana = 100; }
    addBuilderBtn();
    paintHotbar();
    scaleTest101();
    const _u = updateSimulation;
    updateSimulation = function (dt) { _u(dt); updateSystems(dt); };
    const _r = render;
    render = function () { _r(); drawWorldFx(); };
    window.KeloAbilities = { registry: registry, resolver: resolver, engine: engine, hotbar: hotbar, bus: bus, stones: stones };
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
