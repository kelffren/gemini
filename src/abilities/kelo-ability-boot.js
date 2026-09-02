(function () {
  'use strict';

  if (!window.KeloStones) {
    console.error('KeloAbilities: KeloStones not loaded');
    return;
  }

  const stoneSystem = window.KeloStones;
  const TIER_COLORS = Object.freeze({
    Common: '#8b949e',
    Rare: '#58a6ff',
    Epic: '#bc8cff',
    Legendary: '#f2cc60',
    Mythic: '#ff7b72',
    Divine: '#f0f6fc',
  });

  function uid() {
    return 'ab_' + Math.random().toString(36).slice(2, 10);
  }

  function dist(a, b) {
    return Math.hypot((a.x || 0) - (b.x || 0), (a.y || 0) - (b.y || 0));
  }

  function norm(x, y) {
    const len = Math.hypot(x, y) || 1;
    return { x: x / len, y: y / len };
  }

  class RecipeResolver {
    constructor(abilities) {
      this.recipeMap = new Map();
      abilities.forEach((ability) => {
        const key = this.createRecipeKey(ability.recipe);
        if (this.recipeMap.has(key)) throw new Error('Duplicate recipe ' + key);
        this.recipeMap.set(key, ability);
      });
    }

    createRecipeKey(stones) {
      return [...(stones || [])].map(String).sort().join('|');
    }

    resolve(stones) {
      if (!stones || !stones.length) return { valid: false, ability: null, reason: 'EMPTY_RECIPE' };
      const ability = this.recipeMap.get(this.createRecipeKey(stones));
      return ability
        ? { valid: true, ability, reason: null }
        : { valid: false, ability: null, reason: 'UNKNOWN_RECIPE' };
    }
  }

  class AbilityRegistry {
    constructor(defs) {
      this.byId = new Map();
      this.byKey = new Map();
      (defs || []).forEach((definition) => this.register(definition));
    }

    register(definition) {
      if (
        !definition ||
        definition.id == null ||
        !definition.key ||
        !Array.isArray(definition.recipe) ||
        !definition.targeting ||
        !definition.resource ||
        definition.cooldown == null ||
        !definition.delivery ||
        !Array.isArray(definition.effects)
      ) {
        throw new Error('Invalid ability definition: ' + JSON.stringify(definition));
      }
      if (this.byId.has(definition.id) || this.byKey.has(definition.key)) {
        throw new Error('Duplicate ability: ' + definition.id + '/' + definition.key);
      }
      this.byId.set(definition.id, definition);
      this.byKey.set(definition.key, definition);
    }

    getById(id) { return this.byId.get(id) || null; }
    getByKey(key) { return this.byKey.get(key) || null; }
    getAll() { return [...this.byId.values()]; }
  }

  class AbilityValidator {
    validate({ request, player, instance, definition }) {
      if (!definition) return { valid: false, reason: instance ? 'INVALID_ABILITY' : 'EMPTY_SLOT' };
      if (!player || player.hp <= 0) return { valid: false, reason: 'DEAD' };
      if (instance && instance.enabled === false) return { valid: false, reason: 'DISABLED' };
      if (instance && instance.cooldownRemaining > 0) return { valid: false, reason: 'COOLDOWN' };
      if ((player.mana || 0) < (definition.resource.cost || 0)) return { valid: false, reason: 'NO_MANA' };

      const targeting = definition.targeting || {};
      if (targeting.type === 'direction') {
        if (!request || !request.direction) return { valid: false, reason: 'INVALID_TARGET' };
        if (!Number.isFinite(request.direction.x) || !Number.isFinite(request.direction.y)) {
          return { valid: false, reason: 'INVALID_TARGET' };
        }
      }
      if (targeting.type === 'position') {
        if (!request || !request.position) return { valid: false, reason: 'INVALID_POSITION' };
        if (!Number.isFinite(request.position.x) || !Number.isFinite(request.position.y)) {
          return { valid: false, reason: 'INVALID_POSITION' };
        }
        if (targeting.range && dist(player, request.position) > targeting.range + 8) {
          return { valid: false, reason: 'OUT_OF_RANGE' };
        }
      }
      return { valid: true };
    }
  }

  class CombatEventBus {
    constructor() {
      this.listeners = new Map();
    }

    on(name, callback) {
      if (!this.listeners.has(name)) this.listeners.set(name, new Set());
      this.listeners.get(name).add(callback);
      return () => this.listeners.get(name).delete(callback);
    }

    emit(name, payload) {
      const set = this.listeners.get(name);
      if (!set) return;
      set.forEach((callback) => {
        try { callback(payload); } catch (error) { console.error(error); }
      });
    }
  }

  class HotbarState {
    constructor(size) {
      this.slots = Array(size || stoneSystem.LOADOUT_SIZE).fill(null);
    }

    equip(index, instance) {
      this.assert(index);
      this.slots[index] = instance;
    }

    unequip(index) {
      this.assert(index);
      this.slots[index] = null;
    }

    get(index) {
      this.assert(index);
      return this.slots[index];
    }

    assert(index) {
      if (index < 0 || index >= this.slots.length) throw new Error('Invalid hotbar slot: ' + index);
    }
  }

  const registry = new AbilityRegistry(window.ABILITIES || []);
  const resolver = new RecipeResolver(registry.getAll());
  const validator = new AbilityValidator();
  const bus = new CombatEventBus();
  const hotbar = new HotbarState(stoneSystem.LOADOUT_SIZE);
  const projectiles = [];
  const areas = [];
  const walls = [];
  const traps = [];
  const statuses = [];
  let sequence = 1;
  let loadoutFingerprint = null;

  function toast(message) {
    if (typeof showToast === 'function') showToast(message);
  }

  function entities() {
    const list = [];
    if (typeof localPlayer !== 'undefined') list.push(localPlayer);
    if (typeof simulatedPlayers !== 'undefined') simulatedPlayers.forEach((player) => list.push(player));
    return list;
  }

  function others(owner) {
    return entities().filter((entity) => entity && entity !== owner && (entity.hp == null || entity.hp > 0));
  }

  function applyDamage(config) {
    const target = entities().find((entity) => entity === config.target || entity.id === config.targetId);
    if (!target) return;

    const requested = Math.max(0, Number(config.amount) || 0);
    let remaining = requested;
    let absorbed = 0;

    if (target.keloShield && target.keloShield > 0) {
      absorbed = Math.min(target.keloShield, remaining);
      target.keloShield -= absorbed;
      remaining -= absorbed;
      if (target.keloShield <= 0) bus.emit('SHIELD_BROKEN', { target });
    }

    target.hp = Math.max(0, (target.hp == null ? 100 : target.hp) - remaining);
    bus.emit('DAMAGE', Object.assign({}, config, { requested, absorbed, amount: remaining, hp: target.hp }));
    if (target.hp <= 0) bus.emit('DEATH', { target, source: config.source || null, abilityId: config.abilityId || null });
  }

  function applyHeal(config) {
    const target = config.target;
    if (!target) return;
    const maxHp = target.maxHp || 100;
    const before = target.hp == null ? maxHp : target.hp;
    target.hp = Math.min(maxHp, before + Math.max(0, Number(config.amount) || 0));
    bus.emit('HEAL', Object.assign({}, config, { amount: target.hp - before, hp: target.hp }));
  }

  function applyStatus(config) {
    statuses.push({
      id: uid(),
      type: config.status,
      target: config.target,
      source: config.source,
      remaining: config.duration || 1,
      magnitude: config.magnitude || 0,
      tickInterval: config.tickInterval || 1,
      tickRemaining: config.tickInterval || 1,
    });
    bus.emit('STATUS_APPLIED', config);
  }

  function applyEffects(definition, source, target, perTickOnly) {
    (definition.effects || []).forEach((effect) => {
      const isTick = effect.perTick === true;
      if (perTickOnly !== isTick) return;
      if (effect.type === 'damage') {
        applyDamage({ source, target, amount: effect.amount, damageType: effect.damageType, abilityId: definition.id });
      } else if (effect.type === 'heal') {
        applyHeal({ target, amount: effect.amount, source, abilityId: definition.id });
      } else if (effect.type === 'shield') {
        target.keloShield = (target.keloShield || 0) + effect.amount;
        target.keloShieldT = effect.duration || 4;
        bus.emit('SHIELD_APPLIED', { target, source, amount: effect.amount, abilityId: definition.id });
      } else if (effect.type === 'status') {
        applyStatus({
          status: effect.status,
          target,
          source,
          duration: effect.duration,
          magnitude: effect.magnitude,
          tickInterval: effect.tickInterval,
          abilityId: definition.id,
        });
      }
    });
  }

  function getRuntimeDefinition(instance) {
    return instance ? instance.definition || registry.getById(instance.abilityId) : null;
  }

  const engine = {
    cast(request) {
      const player = localPlayer;
      const instance = hotbar.get(request.slotIndex);
      const definition = getRuntimeDefinition(instance);
      const validation = validator.validate({ request, player, instance, definition });
      if (!validation.valid) {
        bus.emit('ABILITY_FAILED', { request, reason: validation.reason });
        return validation;
      }

      player.mana -= definition.resource.cost;
      instance.cooldownRemaining = definition.cooldown;
      bus.emit('ABILITY_CAST', {
        playerId: player.id || 'local',
        abilityId: definition.id,
        abilityKey: definition.key,
        stoneUid: instance.stoneUid,
        slotIndex: request.slotIndex,
        clientSequence: sequence++,
        loadoutFingerprint,
      });

      const type = definition.delivery.type;
      if (type === 'projectile') this.castProjectile(request, player, definition);
      else if (type === 'self_aoe') this.castSelfAoE(player, definition);
      else if (type === 'chain') this.castChain(request, player, definition);
      else if (type === 'dash') this.castDash(request, player, definition);
      else if (type === 'blink') this.castBlink(request, player, definition);
      else if (type === 'instant') applyEffects(definition, player, player, false);
      else if (type === 'persistent_area') this.castArea(request, player, definition);
      else if (type === 'wall') this.castWall(request, player, definition);
      else if (type === 'trap') this.castTrap(request, player, definition);
      else if (type === 'aura') this.castAura(player, definition);
      else return { valid: false, reason: 'UNSUPPORTED_DELIVERY' };

      return { valid: true, abilityId: definition.id, stoneUid: instance.stoneUid };
    },

    castProjectile(request, player, definition) {
      const direction = request.direction || { x: 1, y: 0 };
      const n = norm(direction.x, direction.y);
      projectiles.push({
        id: uid(), owner: player, def: definition,
        x: player.x, y: player.y,
        vx: n.x * definition.delivery.speed,
        vy: n.y * definition.delivery.speed,
        r: definition.delivery.radius,
        traveled: 0,
        max: definition.delivery.maxDistance,
        alive: true,
        hit: false,
      });
    },

    castSelfAoE(player, definition) {
      others(player).forEach((entity) => {
        if (dist(player, entity) <= definition.delivery.radius) applyEffects(definition, player, entity, false);
      });
      areas.push({ kind: 'flash', x: player.x, y: player.y, r: definition.delivery.radius, t: 0.35, color: definition.visuals.color });
    },

    castChain(request, player, definition) {
      const used = [];
      let origin = player;
      let damage = (definition.effects.find((effect) => effect.type === 'damage') || {}).amount || 20;
      let current = others(player)
        .filter((entity) => dist(player, entity) <= (definition.targeting.range || 400))
        .sort((a, b) => dist(player, a) - dist(player, b))[0];

      for (let i = 0; i < (definition.delivery.maxTargets || 3) && current; i++) {
        applyDamage({ target: current, amount: damage, source: player, abilityId: definition.id, damageType: 'lightning' });
        used.push(current);
        areas.push({ kind: 'bolt', x1: origin.x, y1: origin.y, x2: current.x, y2: current.y, t: 0.2, color: definition.visuals.color });
        origin = current;
        damage *= definition.delivery.damageFalloff || 0.8;
        current = others(player)
          .filter((entity) => used.indexOf(entity) < 0 && dist(origin, entity) <= definition.delivery.jumpRange)
          .sort((a, b) => dist(origin, a) - dist(origin, b))[0];
      }
    },

    castDash(request, player, definition) {
      const n = norm((request.direction && request.direction.x) || 1, (request.direction && request.direction.y) || 0);
      const distance = definition.delivery.distance || 160;
      const duration = definition.delivery.duration || 0.18;
      player._dash = {
        tx: player.x + n.x * distance,
        ty: player.y + n.y * distance,
        t: duration,
        max: duration,
        sx: player.x,
        sy: player.y,
      };
    },

    castBlink(request, player, definition) {
      const n = norm((request.direction && request.direction.x) || 1, (request.direction && request.direction.y) || 0);
      const distance = definition.delivery.distance || 130;
      const worldWidth = (typeof CONFIG !== 'undefined' && CONFIG.worldWidth) || 3600;
      const worldHeight = (typeof CONFIG !== 'undefined' && CONFIG.worldHeight) || 3200;
      player.x = Math.max(24, Math.min(worldWidth - 24, player.x + n.x * distance));
      player.y = Math.max(24, Math.min(worldHeight - 24, player.y + n.y * distance));
    },

    castArea(request, player, definition) {
      const position = request.position || player;
      areas.push({
        kind: 'persist', owner: player, def: definition,
        x: position.x, y: position.y,
        r: definition.delivery.radius,
        t: definition.delivery.duration,
        tick: definition.delivery.tickInterval,
        acc: 0,
        color: definition.visuals.color,
      });
    },

    castWall(request, player, definition) {
      const position = request.position || player;
      const width = definition.delivery.width || 150;
      const wall = { x: position.x - width / 2, y: position.y - 12, w: width, h: 24, hp: definition.delivery.hp || 250, t: definition.delivery.duration || 4 };
      walls.push(wall);
      if (typeof obstacles !== 'undefined') obstacles.push(wall);
    },

    castTrap(request, player, definition) {
      const position = request.position || player;
      traps.push({
        owner: player,
        def: definition,
        x: position.x,
        y: position.y,
        r: definition.delivery.activationRadius,
        arm: definition.delivery.armTime,
        t: definition.delivery.duration,
        state: 'ARMING',
      });
    },

    castAura(player, definition) {
      areas.push({
        kind: 'aura', owner: player, def: definition, follow: true,
        x: player.x, y: player.y,
        r: definition.delivery.radius,
        t: definition.delivery.duration,
        tick: definition.delivery.tickInterval,
        acc: 0,
        color: definition.visuals.color,
      });
    },
  };

  function syncHotbarFromWorldState(force) {
    if (typeof STATE === 'undefined') return;
    const snapshot = stoneSystem.exportLoadout(STATE);
    if (!force && snapshot.fingerprint === loadoutFingerprint) return;

    const previousByUid = new Map();
    hotbar.slots.forEach((instance) => {
      if (instance && instance.stoneUid) previousByUid.set(instance.stoneUid, instance);
    });

    for (let slot = 0; slot < stoneSystem.LOADOUT_SIZE; slot++) {
      const stone = STATE.equipped[slot];
      if (!stone) {
        hotbar.unequip(slot);
        continue;
      }

      const normalized = stoneSystem.normalizeStone(stone);
      const definition = normalized ? stoneSystem.resolveAbility(normalized) : null;
      if (!normalized || !definition) {
        hotbar.unequip(slot);
        continue;
      }

      const previous = previousByUid.get(normalized.uid);
      hotbar.equip(slot, {
        instanceId: previous ? previous.instanceId : uid(),
        stoneUid: normalized.uid,
        abilityId: normalized.abilityId,
        abilityKey: normalized.abilityKey,
        definition,
        tier: normalized.tier,
        cooldownRemaining: previous ? previous.cooldownRemaining : 0,
        enabled: true,
      });
    }

    loadoutFingerprint = snapshot.fingerprint;
    paintHotbar();
    bus.emit('LOADOUT_CHANGED', snapshot);
  }

  function updateSystems(dt) {
    if (typeof localPlayer !== 'undefined') {
      if (localPlayer.mana == null) {
        localPlayer.mana = 100;
        localPlayer.maxMana = 100;
      }
      localPlayer.mana = Math.min(localPlayer.maxMana || 100, localPlayer.mana + 8 * dt);

      if (localPlayer.keloShieldT > 0) {
        localPlayer.keloShieldT -= dt;
        if (localPlayer.keloShieldT <= 0) localPlayer.keloShield = 0;
      }

      if (localPlayer._dash) {
        const dash = localPlayer._dash;
        dash.t -= dt;
        const progress = 1 - Math.max(0, dash.t) / dash.max;
        localPlayer.x = dash.sx + (dash.tx - dash.sx) * Math.min(1, progress);
        localPlayer.y = dash.sy + (dash.ty - dash.sy) * Math.min(1, progress);
        if (dash.t <= 0) localPlayer._dash = null;
      }
    }

    syncHotbarFromWorldState(false);
    hotbar.slots.forEach((slot) => {
      if (slot) slot.cooldownRemaining = Math.max(0, slot.cooldownRemaining - dt);
    });

    for (let i = projectiles.length - 1; i >= 0; i--) {
      const projectile = projectiles[i];
      const step = Math.hypot(projectile.vx, projectile.vy) * dt;
      projectile.x += projectile.vx * dt;
      projectile.y += projectile.vy * dt;
      projectile.traveled += step;

      let hit = null;
      others(projectile.owner).forEach((entity) => {
        if (dist(projectile, entity) < projectile.r + (entity.radius || 16)) hit = entity;
      });
      walls.forEach((wall) => {
        if (projectile.x > wall.x && projectile.x < wall.x + wall.w && projectile.y > wall.y && projectile.y < wall.y + wall.h) {
          projectile.alive = false;
        }
      });

      if (hit) {
        applyEffects(projectile.def, projectile.owner, hit, false);
        projectile.alive = false;
        projectile.hit = true;
        bus.emit('ABILITY_HIT', { projectile, hit });
      }
      if (projectile.traveled >= projectile.max) {
        if (!projectile.hit) bus.emit('ABILITY_MISS', projectile);
        projectile.alive = false;
      }
      if (!projectile.alive) projectiles.splice(i, 1);
    }

    for (let i = areas.length - 1; i >= 0; i--) {
      const area = areas[i];
      area.t -= dt;
      if (area.follow && area.owner) {
        area.x = area.owner.x;
        area.y = area.owner.y;
      }
      if (area.tick) {
        area.acc += dt;
        if (area.acc >= area.tick) {
          area.acc -= area.tick;
          if (area.kind === 'aura') {
            applyEffects(area.def, area.owner, area.owner, true);
          } else if (area.kind === 'persist') {
            others(area.owner).forEach((entity) => {
              if (dist(area, entity) <= area.r) applyEffects(area.def, area.owner, entity, true);
            });
          }
        }
      }
      if (area.t <= 0) areas.splice(i, 1);
    }

    for (let i = walls.length - 1; i >= 0; i--) {
      walls[i].t -= dt;
      if (walls[i].t <= 0 || walls[i].hp <= 0) {
        if (typeof obstacles !== 'undefined') {
          const index = obstacles.indexOf(walls[i]);
          if (index >= 0) obstacles.splice(index, 1);
        }
        walls.splice(i, 1);
      }
    }

    for (let i = traps.length - 1; i >= 0; i--) {
      const trap = traps[i];
      trap.t -= dt;
      if (trap.state === 'ARMING') {
        trap.arm -= dt;
        if (trap.arm <= 0) trap.state = 'ARMED';
      }
      if (trap.state === 'ARMED') {
        const victim = others(trap.owner).find((entity) => dist(trap, entity) <= trap.r);
        if (victim) {
          applyEffects(trap.def, trap.owner, victim, false);
          traps.splice(i, 1);
          continue;
        }
      }
      if (trap.t <= 0) traps.splice(i, 1);
    }

    for (let i = statuses.length - 1; i >= 0; i--) {
      const status = statuses[i];
      status.remaining -= dt;
      status.tickRemaining -= dt;
      if (status.type === 'slow' && status.target) status.target._slowMul = 1 - (status.magnitude || 0.3);
      if (status.tickRemaining <= 0 && (status.type === 'burn' || status.type === 'poison')) {
        status.tickRemaining += status.tickInterval;
        applyDamage({ target: status.target, amount: status.magnitude || 5, source: status.source });
      }
      if (status.remaining <= 0) {
        if (status.type === 'slow' && status.target) status.target._slowMul = 1;
        statuses.splice(i, 1);
      }
    }

    paintHotbar();
  }

  function drawWorldFx() {
    if (typeof ctx === 'undefined') return;
    const zoom = (typeof CONFIG !== 'undefined' && CONFIG.zoom) || 1;
    ctx.save();
    ctx.translate(screenW / 2, screenH / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-camera.x, -camera.y);

    projectiles.forEach((projectile) => {
      ctx.fillStyle = (projectile.def.visuals && projectile.def.visuals.color) || '#ff6b35';
      ctx.beginPath();
      ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2);
      ctx.fill();
    });

    areas.forEach((area) => {
      if (area.kind === 'bolt') {
        ctx.strokeStyle = area.color || '#ffe066';
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.moveTo(area.x1, area.y1);
        ctx.lineTo(area.x2, area.y2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        return;
      }
      ctx.strokeStyle = area.color || '#fff';
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.arc(area.x || 0, area.y || 0, area.r || 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    });

    walls.forEach((wall) => {
      ctx.fillStyle = 'rgba(168,216,255,0.7)';
      ctx.fillRect(wall.x, wall.y, wall.w, wall.h);
    });

    traps.forEach((trap) => {
      ctx.strokeStyle = trap.state === 'ARMED' ? '#8ac926' : '#666';
      ctx.beginPath();
      ctx.arc(trap.x, trap.y, trap.r, 0, Math.PI * 2);
      ctx.stroke();
    });

    if (window.KELO_ABILITY_DEBUG) {
      ctx.strokeStyle = '#0f0';
      entities().forEach((entity) => {
        ctx.beginPath();
        ctx.arc(entity.x, entity.y, entity.radius || 16, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function paintHotbar() {
    const bar = document.getElementById('action-bar-container');
    if (!bar) return;

    if (!bar.dataset.keloStonesV3) {
      bar.innerHTML = '';
      bar.dataset.keloStonesV3 = '1';
      for (let i = 0; i < stoneSystem.LOADOUT_SIZE; i++) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'stone-slot' + (i === 4 ? ' ultimate' : '');
        button.dataset.slot = String(i);
        button.setAttribute('aria-label', 'Habilidad ' + (i + 1));
        bar.appendChild(button);
        bindSlot(button, i);
      }
    }

    bar.querySelectorAll('.stone-slot').forEach((button, index) => {
      const instance = hotbar.get(index);
      const definition = getRuntimeDefinition(instance);
      if (!definition) {
        button.style.borderColor = '';
        button.innerHTML = '<span style="font-size:16px;opacity:.3">◇</span><span style="opacity:.4">Vacío</span>';
        return;
      }

      const tier = instance.tier || 'Common';
      const cooldown = instance.cooldownRemaining || 0;
      const ratio = cooldown > 0 ? Math.min(1, cooldown / Math.max(0.01, definition.cooldown)) : 0;
      button.style.borderColor = TIER_COLORS[tier] || '#c9a24a';
      button.innerHTML =
        '<span style="font-size:' + (index === 4 ? 20 : 17) + 'px;line-height:1">' + (definition.icon || '◆') + '</span>' +
        '<span style="max-width:46px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + definition.name.split(' ')[0] + '</span>' +
        (definition.slotType === 'ultimate' ? '<span style="font-size:6px;letter-spacing:.08em;opacity:.8">ULT</span>' : '') +
        (cooldown > 0
          ? '<span style="position:absolute;inset:0;background:rgba(0,0,0,' + Math.min(0.78, 0.25 + ratio * 0.53) + ');border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff">' + cooldown.toFixed(1) + '</span>'
          : '');
      button.setAttribute('aria-label', definition.name + ', ' + tier);
    });
  }

  const aim = { slot: -1, down: false, x0: 0, y0: 0, x1: 0, y1: 0 };

  function bindSlot(element, index) {
    element.addEventListener('pointerdown', function (event) {
      event.preventDefault();
      event.stopPropagation();
      const instance = hotbar.get(index);
      if (!instance) {
        toast('Slot vacío');
        return;
      }
      const definition = getRuntimeDefinition(instance);
      if (!definition) return;

      if (definition.targeting.type === 'self') {
        engine.cast({ slotIndex: index });
        return;
      }

      aim.slot = index;
      aim.down = true;
      aim.x0 = event.clientX;
      aim.y0 = event.clientY;
      aim.x1 = event.clientX;
      aim.y1 = event.clientY;
      try { element.setPointerCapture(event.pointerId); } catch (error) {}
    });

    element.addEventListener('pointermove', function (event) {
      if (!aim.down || aim.slot !== index) return;
      aim.x1 = event.clientX;
      aim.y1 = event.clientY;
    });

    element.addEventListener('pointerup', function () {
      if (!aim.down || aim.slot !== index) return;
      aim.down = false;

      const instance = hotbar.get(index);
      const definition = getRuntimeDefinition(instance);
      if (!definition) return;

      const dx = aim.x1 - aim.x0;
      const dy = aim.y1 - aim.y0;
      const direction = norm(dx || 1, dy || 0);
      const zoom = (typeof CONFIG !== 'undefined' && CONFIG.zoom) || 1;

      if (definition.targeting.type === 'position') {
        const range = Math.min(definition.targeting.range || 300, (Math.hypot(dx, dy) / zoom) * 1.2 || 80);
        engine.cast({
          slotIndex: index,
          direction,
          position: { x: localPlayer.x + direction.x * range, y: localPlayer.y + direction.y * range },
        });
      } else {
        engine.cast({ slotIndex: index, direction });
      }
    });

    element.addEventListener('pointercancel', function () {
      if (aim.slot === index) aim.down = false;
    });
  }

  function saveAndRefresh() {
    if (typeof saveState === 'function') saveState();
    syncHotbarFromWorldState(true);
    paintHotbar();
    const panel = document.getElementById('kelo-builder');
    if (panel && panel.style.display === 'block') renderBuilder(panel);
    if (typeof renderBuildPanel === 'function') {
      try { renderBuildPanel(); } catch (error) {}
    }
  }

  function equipInventoryStone(inventoryIndex) {
    if (typeof STATE === 'undefined') return false;
    const index = Number(inventoryIndex);
    if (!Number.isInteger(index) || index < 0 || index >= STATE.inventory.length) return false;
    if (STATE.equipped.length >= stoneSystem.LOADOUT_SIZE) {
      toast('Tus 5 ranuras ya están ocupadas');
      return false;
    }
    const stone = stoneSystem.normalizeStone(STATE.inventory[index]);
    if (!stone) {
      toast('Esta piedra necesita migración');
      return false;
    }
    STATE.inventory.splice(index, 1);
    STATE.equipped.push(stone);
    saveAndRefresh();
    toast(stone.name + ' equipada');
    return true;
  }

  function unequipLoadoutStone(slotIndex) {
    if (typeof STATE === 'undefined') return false;
    const index = Number(slotIndex);
    if (!Number.isInteger(index) || index < 0 || index >= STATE.equipped.length) return false;
    const stone = STATE.equipped.splice(index, 1)[0];
    if (!stone) return false;
    STATE.inventory.push(stoneSystem.normalizeStone(stone));
    saveAndRefresh();
    toast(stone.name + ' guardada');
    return true;
  }

  function moveLoadoutStone(index, delta) {
    if (typeof STATE === 'undefined') return;
    const from = Number(index);
    const to = from + Number(delta);
    if (!Number.isInteger(from) || !Number.isInteger(to)) return;
    if (from < 0 || to < 0 || from >= STATE.equipped.length || to >= STATE.equipped.length) return;
    const temp = STATE.equipped[from];
    STATE.equipped[from] = STATE.equipped[to];
    STATE.equipped[to] = temp;
    saveAndRefresh();
  }

  function stoneCard(stone, actionsHtml) {
    const summary = stoneSystem.stoneSummary(stone);
    if (!summary) return '';
    const color = TIER_COLORS[summary.tier] || '#8b949e';
    const affixes = summary.affixes.length
      ? summary.affixes.map((label) => '<span style="display:inline-block;margin:2px 4px 0 0;padding:2px 5px;border-radius:999px;background:rgba(255,255,255,.06);font-size:9px">' + label + '</span>').join('')
      : '<span style="font-size:9px;opacity:.5">Sin afijos</span>';

    return '<div style="border:1px solid ' + color + ';border-radius:12px;padding:9px;background:rgba(255,255,255,.025);min-width:0">' +
      '<div style="display:flex;align-items:flex-start;gap:8px">' +
        '<div style="font-size:24px;line-height:1">' + summary.icon + '</div>' +
        '<div style="min-width:0;flex:1">' +
          '<div style="font-weight:800;color:#f0f6fc;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + summary.name + '</div>' +
          '<div style="font-size:9px;color:' + color + ';font-weight:800;text-transform:uppercase;letter-spacing:.08em">' + summary.tier + '</div>' +
          '<div style="font-size:9px;color:#8b949e;margin-top:3px">' + summary.recipe + '</div>' +
          '<div style="margin-top:4px">' + affixes + '</div>' +
        '</div>' +
      '</div>' +
      (actionsHtml || '') +
    '</div>';
  }

  function renderBuilder(panel) {
    if (typeof STATE === 'undefined') return;
    const snapshot = stoneSystem.exportLoadout(STATE);
    const equipped = STATE.equipped || [];
    const inventory = STATE.inventory || [];

    panel.innerHTML =
      '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px">' +
        '<div><div style="font-size:13px;font-weight:900;color:#e7c56a">ARSENAL DE PIEDRAS</div><div style="font-size:9px;color:#8b949e">Kelo World decide qué puedes usar en PvP</div></div>' +
        '<button type="button" id="kelo-builder-close" style="background:#161b22;color:#e6edf3;border:1px solid #30363d;border-radius:8px;padding:6px 9px">×</button>' +
      '</div>' +
      '<div style="margin-top:10px;padding:8px;border:1px solid rgba(231,197,106,.25);border-radius:10px;background:rgba(231,197,106,.04)">' +
        '<div style="display:flex;justify-content:space-between;gap:8px"><b>Loadout</b><span style="font-size:9px;color:#8b949e">' + equipped.length + '/5 · ' + snapshot.fingerprint + '</span></div>' +
        '<div id="kelo-loadout-grid" style="display:grid;grid-template-columns:1fr;gap:7px;margin-top:7px"></div>' +
      '</div>' +
      '<div style="margin-top:12px"><div style="display:flex;justify-content:space-between"><b>Inventario</b><span style="font-size:9px;color:#8b949e">' + inventory.length + ' piedras</span></div><div id="kelo-inventory-grid" style="display:grid;grid-template-columns:1fr;gap:7px;margin-top:7px"></div></div>';

    panel.querySelector('#kelo-builder-close').onclick = () => { panel.style.display = 'none'; };

    const loadoutGrid = panel.querySelector('#kelo-loadout-grid');
    for (let slot = 0; slot < stoneSystem.LOADOUT_SIZE; slot++) {
      const stone = equipped[slot];
      if (!stone) {
        const empty = document.createElement('div');
        empty.style.cssText = 'border:1px dashed #30363d;border-radius:10px;padding:10px;color:#484f58;text-align:center';
        empty.textContent = 'Slot ' + (slot + 1) + ' · vacío';
        loadoutGrid.appendChild(empty);
        continue;
      }
      const row = document.createElement('div');
      const controls = '<div style="display:flex;gap:5px;margin-top:7px">' +
        '<button type="button" data-act="left" style="flex:0 0 38px;background:#161b22;color:#ddd;border:1px solid #30363d;border-radius:7px">←</button>' +
        '<button type="button" data-act="remove" style="flex:1;background:#1f2937;color:#f0f6fc;border:1px solid #30363d;border-radius:7px;padding:6px">Quitar</button>' +
        '<button type="button" data-act="right" style="flex:0 0 38px;background:#161b22;color:#ddd;border:1px solid #30363d;border-radius:7px">→</button>' +
      '</div>';
      row.innerHTML = stoneCard(stone, controls);
      row.querySelector('[data-act="left"]').onclick = () => moveLoadoutStone(slot, -1);
      row.querySelector('[data-act="remove"]').onclick = () => unequipLoadoutStone(slot);
      row.querySelector('[data-act="right"]').onclick = () => moveLoadoutStone(slot, 1);
      loadoutGrid.appendChild(row);
    }

    const inventoryGrid = panel.querySelector('#kelo-inventory-grid');
    if (!inventory.length) {
      inventoryGrid.innerHTML = '<div style="padding:12px;border:1px dashed #30363d;border-radius:10px;color:#8b949e;text-align:center">No tienes piedras guardadas. Las piedras se consiguen jugando Kelo World.</div>';
    } else {
      inventory.forEach((stone, index) => {
        const row = document.createElement('div');
        const controls = '<button type="button" data-equip="' + index + '" style="width:100%;margin-top:7px;background:#1f6f4a;color:#fff;border:1px solid rgba(255,255,255,.12);border-radius:8px;padding:7px;font-weight:800">Equipar</button>';
        row.innerHTML = stoneCard(stone, controls);
        row.querySelector('[data-equip]').onclick = () => equipInventoryStone(index);
        inventoryGrid.appendChild(row);
      });
    }
  }

  function openBuilder() {
    let panel = document.getElementById('kelo-builder');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'kelo-builder';
      panel.style.cssText = 'display:none;position:absolute;top:82px;left:8px;width:min(360px,calc(100vw - 16px));z-index:120;background:rgba(10,13,18,.985);border:1px solid rgba(231,197,106,.55);border-radius:14px;padding:12px;color:#c9d1d9;font-size:11px;pointer-events:auto;max-height:72vh;overflow:auto;box-shadow:0 14px 40px rgba(0,0,0,.45)';
      document.body.appendChild(panel);
    }
    panel.style.display = panel.style.display === 'block' ? 'none' : 'block';
    if (panel.style.display === 'block') renderBuilder(panel);
  }

  function addBuilderButton() {
    if (document.getElementById('kelo-stones-btn')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.id = 'kelo-stones-btn';
    button.textContent = '◆ Piedras';
    button.style.cssText = 'position:absolute;bottom:160px;right:10px;z-index:90;pointer-events:auto;background:rgba(16,20,28,.94);color:#e7c56a;border:1px solid #c9a24a;border-radius:10px;padding:8px 11px;font-size:11px;font-weight:800';
    button.onclick = openBuilder;
    document.body.appendChild(button);
  }

  function installLegacyAdapters() {
    window.createStoneInstance = function (typeId, tier) {
      try {
        return stoneSystem.createFromLegacy(typeId, tier || 'Common', { source: 'world' });
      } catch (error) {
        console.error(error);
        return stoneSystem.createAbilityStone('fireball', tier || 'Common', { source: 'fallback' });
      }
    };

    window.equipStone = equipInventoryStone;
    window.unequipStone = unequipLoadoutStone;

    window.addTestStones = function () {
      if (!window.KELO_ABILITY_DEBUG) {
        toast('Las piedras de prueba están desactivadas');
        return;
      }
      STATE.inventory.push(
        stoneSystem.createAbilityStone('chain_lightning', 'Rare', { source: 'debug' }),
        stoneSystem.createAbilityStone('shadow_step', 'Epic', { source: 'debug' }),
        stoneSystem.createAbilityStone('poison_trap', 'Rare', { source: 'debug' })
      );
      saveAndRefresh();
    };

    window.selectForFusion = function (inventoryIndex) {
      if (typeof fusionSelection === 'undefined' || fusionSelection.length >= 3) return;
      const stone = stoneSystem.normalizeStone(STATE.inventory[inventoryIndex]);
      if (!stone) return;
      if (fusionSelection.length) {
        const first = stoneSystem.normalizeStone(fusionSelection[0]);
        if (!first || first.abilityKey !== stone.abilityKey) {
          toast('La fusión requiere 3 piedras de la misma habilidad');
          return;
        }
        if (first.tier !== stone.tier) {
          toast('Las 3 piedras deben tener el mismo tier');
          return;
        }
      }
      fusionSelection.push(stone);
      if (typeof renderFusionPanel === 'function') renderFusionPanel();
    };

    window.executeFusion = function () {
      if (typeof fusionSelection === 'undefined') return;
      const check = stoneSystem.canFuse(fusionSelection);
      if (!check.valid) {
        const messages = {
          NEED_THREE: 'Necesitas 3 piedras',
          ABILITY_MISMATCH: 'Solo puedes fusionar la misma habilidad',
          TIER_MISMATCH: 'Las 3 piedras deben tener el mismo tier',
          MAX_TIER: 'Esa piedra ya alcanzó Divine',
        };
        toast(messages[check.reason] || 'Fusión inválida');
        return;
      }
      if (STATE.gold < 100) {
        toast('Oro insuficiente');
        return;
      }

      STATE.gold -= 100;
      const uids = new Set(check.stones.map((stone) => stone.uid));
      STATE.inventory = STATE.inventory.filter((stone) => !uids.has(stone.uid));

      const rank = stoneSystem.tierRank(check.tier) + 1;
      const successOdds = Math.max(20, 75 - rank * 12 + STATE.fusionMastery * 2);
      const breakOdds = Math.min(40, rank * 8);
      const roll = Math.random() * 100;
      const log = document.getElementById('fusion-log');

      if (roll < successOdds) {
        const upgraded = stoneSystem.createAbilityStone(check.abilityKey, check.nextTier, { source: 'fusion' });
        STATE.inventory.push(upgraded);
        STATE.fusionXp += 25;
        if (STATE.fusionXp >= 100) {
          STATE.fusionMastery++;
          STATE.fusionXp = 0;
        }
        if (log) {
          log.style.color = '#39d353';
          log.textContent = 'ÉXITO: [' + check.nextTier + '] ' + upgraded.name;
        }
      } else if (roll < successOdds + breakOdds) {
        if (log) {
          log.style.color = '#ff7b72';
          log.textContent = 'FALLO CRÍTICO';
        }
      } else {
        STATE.inventory.push(check.stones[0]);
        if (log) {
          log.style.color = '#ffd166';
          log.textContent = 'Fallo regular: 1 piedra recuperada';
        }
      }

      fusionSelection = [];
      saveAndRefresh();
      if (typeof renderFusionPanel === 'function') renderFusionPanel();
    };

    window.renderActionBar = function () {
      syncHotbarFromWorldState(true);
      paintHotbar();
    };

    window.triggerStone = function (index) {
      const slot = Number(index);
      const instance = hotbar.get(slot);
      if (!instance) return;
      const direction = norm(localPlayer.vx || 1, localPlayer.vy || 0);
      return engine.cast({ slotIndex: slot, direction });
    };
  }

  function boot() {
    if (typeof STATE === 'undefined') {
      console.error('KeloAbilities: STATE unavailable');
      return;
    }

    const report = stoneSystem.migrateState(STATE);
    if (!STATE.equipped.length && !STATE.inventory.length) {
      STATE.equipped = stoneSystem.createStarterSet();
    }

    if (typeof localPlayer !== 'undefined') {
      localPlayer.mana = 100;
      localPlayer.maxMana = 100;
    }

    installLegacyAdapters();
    addBuilderButton();
    syncHotbarFromWorldState(true);
    paintHotbar();

    if (report.migrated || report.quarantined || report.rekeyed || report.overflow) {
      console.info('KeloStones migration', report);
      if (typeof saveState === 'function') saveState();
    }

    const previousUpdate = updateSimulation;
    updateSimulation = function (dt) {
      previousUpdate(dt);
      updateSystems(dt);
    };

    const previousRender = render;
    render = function () {
      previousRender();
      drawWorldFx();
    };

    window.KeloAbilities = Object.freeze({
      registry,
      resolver,
      engine,
      hotbar,
      bus,
      stones: stoneSystem,
      syncFromWorldState: syncHotbarFromWorldState,
      getLoadoutSnapshot: function () { return stoneSystem.exportLoadout(STATE); },
      openStonePanel: openBuilder,
    });

    window.KELO_STONE_AUDIT = {
      ready: true,
      schemaVersion: stoneSystem.SCHEMA_VERSION,
      abilityCount: registry.getAll().length,
      equippedCount: STATE.equipped.length,
      inventoryCount: STATE.inventory.length,
      loadoutFingerprint,
      migration: report,
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
