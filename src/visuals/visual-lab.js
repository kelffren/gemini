/* KELO-INDEX
 * area: VISUAL
 * keys: LAB DEBUG GALLERY ANIMATION VFX PROJECTILE SEQUENCE STATUS SFX PREVIEW MOBILE MINIMIZE PLAYFULL STOP DUMMY PIN LOOP GHOST RANGE HIT
 * hace: galería de desarrollo; SKILL usa playCue/eventos del combate, PIEZAS prueba componentes; dock móvil, pin, loop, ghost de rango
 * online: N/A; solo aparece con ?visualLab=1 y no muta HP/mana/inventario
 */
(function (root) {
  'use strict';

  let panel = null;
  let body = null;
  let collapsed = false;
  let compactPlay = false;
  let pinned = false;
  let currentTab = 'abilities';
  let dummyOn = false;
  let dummyFxId = null;
  let ghostOn = true;
  let ghostIds = [];
  let loopOn = false;
  let labTimers = [];
  let statusLine = null;
  let headerStatus = null;
  let chipLine = null;
  let pinBtn = null;

  function enabled() {
    try { return new URLSearchParams(root.location.search).get('visualLab') === '1'; }
    catch (e) { return false; }
  }
  if (!enabled()) return;

  function actor() { try { return typeof localPlayer !== 'undefined' ? localPlayer : null; } catch (e) { return null; } }
  function originFor(direction, distance) {
    const p = actor(); if (!p) return { x: 1400, y: 1600 };
    return { x: p.x + direction.x * (distance || 0), y: p.y + direction.y * (distance || 0) };
  }
  function directionOf(value) {
    if (value === 'up') return { x: 0, y: -1 };
    if (value === 'down') return { x: 0, y: 1 };
    if (value === 'left') return { x: -1, y: 0 };
    return { x: 1, y: 0 };
  }
  function options(select, values) {
    select.innerHTML = '';
    values.forEach(function (value) {
      const option = document.createElement('option');
      option.value = value.id || value;
      option.textContent = value.label || value.id || value;
      select.appendChild(option);
    });
  }
  function row(label, node) {
    const wrap = document.createElement('label'); wrap.style.cssText = 'display:grid;grid-template-columns:72px 1fr;gap:6px;align-items:center;margin:5px 0';
    const span = document.createElement('span'); span.textContent = label; span.style.color = '#a9b1bc'; wrap.appendChild(span); wrap.appendChild(node); return wrap;
  }
  function button(text, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.style.cssText = 'background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;padding:10px 9px;min-height:40px;font-weight:800;touch-action:manipulation'; b.onclick = fn; return b;
  }
  function later(ms, fn) {
    const id = setTimeout(fn, ms);
    labTimers.push(id);
    return id;
  }
  function clearLabTimers() {
    labTimers.forEach(function (id) { clearTimeout(id); });
    labTimers = [];
  }
  function setStatus(text) {
    const value = text || '';
    if (statusLine) statusLine.textContent = value;
    if (headerStatus) headerStatus.textContent = value;
  }
  function isMobile() { return (root.innerWidth || 390) < 720; }
  function slim() { return collapsed || compactPlay; }

  function abilityDef(key) {
    if (!key) return null;
    if (root.KeloAbilities && root.KeloAbilities.registry && typeof root.KeloAbilities.registry.getByKey === 'function') {
      const byKey = root.KeloAbilities.registry.getByKey(key); if (byKey) return byKey;
    }
    return (root.ABILITIES || []).find(function (item) { return item.key === key; }) || null;
  }

  function applyChrome() {
    if (!panel || !body) return;
    const mobile = isMobile();
    const hide = slim();
    body.style.display = hide ? 'none' : 'block';
    panel.dataset.visualLabDock = mobile ? 'bottom' : 'top';
    panel.style.left = mobile ? '8px' : 'auto';
    panel.style.right = '8px';
    panel.style.width = mobile ? 'auto' : (hide ? 'auto' : 'min(350px,calc(100vw - 16px))');
    panel.style.maxHeight = hide ? '58px' : (mobile ? '46vh' : '90vh');
    panel.style.overflow = hide ? 'hidden' : 'auto';
    if (mobile) {
      panel.style.top = 'auto';
      panel.style.bottom = 'max(8px,env(safe-area-inset-bottom))';
    } else {
      panel.style.top = 'max(8px,env(safe-area-inset-top))';
      panel.style.bottom = 'auto';
    }
    const toggle = panel.querySelector('[data-visual-lab-toggle]');
    if (toggle) {
      toggle.textContent = hide ? '＋' : '−';
      toggle.setAttribute('aria-label', hide ? 'Abrir Visual Lab' : 'Minimizar Visual Lab');
    }
    const label = panel.querySelector('[data-visual-lab-dev-label]');
    if (label) label.style.display = hide ? 'none' : 'inline';
    panel.querySelectorAll('[data-visual-lab-tab]').forEach(function (el) {
      el.style.display = hide ? 'none' : '';
    });
  }

  function setCollapsed(value) {
    collapsed = value === true;
    compactPlay = false;
    applyChrome();
  }

  function beginPreview(restoreMs) {
    if (!pinned && !collapsed) {
      compactPlay = true;
      applyChrome();
    }
    if (!pinned && !loopOn && restoreMs > 0) {
      later(restoreMs, function () {
        compactPlay = false;
        if (!collapsed) applyChrome();
      });
    }
  }

  function playActivationEyePreview() {
    const p = actor();
    if (!p || !root.KeloFX) return;
    const spawn = function () {
      root.KeloFX.spawn('sword_swap_activation_eye_anim', {
        actor: p, actorId: p.id, visual: { scale: 1.35, seed: Date.now() & 65535 }
      }, { socket: 'head', scale: 1.35, loop: false, duration: 1.0 });
      beginPreview(1100);
    };
    if (root.KeloAssetRegistry && !root.KeloAssetRegistry.isReady('sword_swap_activation_eye_anim_asset')) {
      root.KeloAssetRegistry.load('sword_swap_activation_eye_anim_asset').then(spawn);
    } else spawn();
  }

  function playKatanaThrowPreview() {
    const p = actor();
    if (!p || !root.KeloProjectileVisuals) return;
    const face = p._face || 'right';
    const dir = directionOf(face);
    const spawn = function () {
      const origin = root.KeloAnchors ? root.KeloAnchors.get(p, 'weapon') : { x: p.x, y: p.y };
      root.KeloProjectileVisuals.preview('sword_swap_katana_throw_visual', {
        actor: p, actorId: p.id, origin: origin, direction: dir,
        gameplay: { speed: 360, range: 290 },
        visual: { scale: 1, seed: Date.now() & 65535 }
      }, { scale: 1, loop: true });
      beginPreview(900);
    };
    if (root.KeloAssetRegistry && !root.KeloAssetRegistry.isReady('sword_swap_katana_throw_asset')) {
      root.KeloAssetRegistry.load('sword_swap_katana_throw_asset').then(spawn);
    } else spawn();
  }

  function build() {
    if (panel || !document.body) return;
    panel = document.createElement('div'); panel.id = 'kelo-visual-lab';
    panel.style.cssText = 'position:fixed;z-index:100000;background:rgba(7,10,15,.97);border:1px solid rgba(231,197,106,.55);border-radius:14px;padding:10px;color:#e6edf3;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto;touch-action:pan-y;box-shadow:0 8px 28px rgba(0,0,0,.42)';

    const header = document.createElement('div'); header.style.cssText = 'display:flex;align-items:center;gap:5px;min-height:36px';
    const title = document.createElement('button'); title.type = 'button'; title.textContent = 'LAB'; title.style.cssText = 'background:transparent;color:#e7c56a;border:0;padding:4px 2px;text-align:left;font:800 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;touch-action:manipulation'; title.onclick = function () { setCollapsed(!collapsed); }; header.appendChild(title);
    headerStatus = document.createElement('span'); headerStatus.dataset.visualLabHeaderStatus = '1'; headerStatus.style.cssText = 'flex:1;min-width:0;color:#8be0ac;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:700'; header.appendChild(headerStatus);
    const tabAbilities = document.createElement('button'); tabAbilities.type = 'button'; tabAbilities.dataset.visualLabTab = 'abilities'; tabAbilities.textContent = 'SKILL'; tabAbilities.style.cssText = 'background:#2a2112;color:#f3d48b;border:1px solid #c9a24a;border-radius:8px;padding:8px 8px;min-height:36px;font-weight:800;touch-action:manipulation';
    const tabPieces = document.createElement('button'); tabPieces.type = 'button'; tabPieces.dataset.visualLabTab = 'pieces'; tabPieces.textContent = 'PIEZAS'; tabPieces.style.cssText = 'background:#191f29;color:#a9b1bc;border:1px solid #4a5260;border-radius:8px;padding:8px 8px;min-height:36px;font-weight:800;touch-action:manipulation';
    header.appendChild(tabAbilities); header.appendChild(tabPieces);
    const stopHeader = button('■', function () { stopAll(true); compactPlay = false; if (!collapsed) applyChrome(); });
    stopHeader.dataset.visualLabStop = '1';
    stopHeader.setAttribute('aria-label', 'Stop preview');
    stopHeader.style.cssText += ';width:36px;height:36px;min-height:36px;padding:0;color:#ffb4b4;border-color:#7a3a3a';
    header.appendChild(stopHeader);
    pinBtn = button('PIN', function () {
      pinned = !pinned;
      pinBtn.style.borderColor = pinned ? '#8be0ac' : '#4a5260';
      pinBtn.style.color = pinned ? '#8be0ac' : '#f3d48b';
      if (pinned) { compactPlay = false; applyChrome(); }
    });
    pinBtn.dataset.visualLabPin = '1';
    pinBtn.setAttribute('aria-label', 'Pin Visual Lab');
    pinBtn.style.cssText += ';width:40px;height:36px;min-height:36px;padding:0;font-size:9px';
    header.appendChild(pinBtn);
    const dev = document.createElement('span'); dev.dataset.visualLabDevLabel = '1'; dev.textContent = 'DEV'; dev.style.cssText = 'color:#78808b;white-space:nowrap'; header.appendChild(dev);
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.dataset.visualLabToggle = '1'; toggle.textContent = '−'; toggle.setAttribute('aria-label', 'Minimizar Visual Lab'); toggle.style.cssText = 'width:36px;height:36px;background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;font-size:18px;font-weight:900;line-height:1;touch-action:manipulation'; toggle.onclick = function () { setCollapsed(!collapsed); }; header.appendChild(toggle);
    panel.appendChild(header);

    body = document.createElement('div'); body.dataset.visualLabBody = '1'; panel.appendChild(body);

    const shared = document.createElement('div'); shared.dataset.visualLabShared = '1'; body.appendChild(shared);
    const abilitiesPane = document.createElement('div'); abilitiesPane.dataset.visualLabPane = 'abilities';
    const piecesPane = document.createElement('div'); piecesPane.dataset.visualLabPane = 'pieces'; piecesPane.style.display = 'none';
    body.appendChild(abilitiesPane); body.appendChild(piecesPane);

    function setTab(tab) {
      currentTab = tab === 'pieces' ? 'pieces' : 'abilities';
      abilitiesPane.style.display = currentTab === 'abilities' ? 'block' : 'none';
      piecesPane.style.display = currentTab === 'pieces' ? 'block' : 'none';
      tabAbilities.style.background = currentTab === 'abilities' ? '#2a2112' : '#191f29';
      tabAbilities.style.color = currentTab === 'abilities' ? '#f3d48b' : '#a9b1bc';
      tabAbilities.style.borderColor = currentTab === 'abilities' ? '#c9a24a' : '#4a5260';
      tabPieces.style.background = currentTab === 'pieces' ? '#2a2112' : '#191f29';
      tabPieces.style.color = currentTab === 'pieces' ? '#f3d48b' : '#a9b1bc';
      tabPieces.style.borderColor = currentTab === 'pieces' ? '#c9a24a' : '#4a5260';
    }
    tabAbilities.onclick = function () { setTab('abilities'); };
    tabPieces.onclick = function () { setTab('pieces'); };

    const direction = document.createElement('select'); options(direction, ['right', 'down', 'left', 'up']);
    const scale = document.createElement('input'); scale.type = 'range'; scale.min = '0.5'; scale.max = '2'; scale.step = '0.1'; scale.value = '1';
    const speed = document.createElement('input'); speed.type = 'range'; speed.min = '0.25'; speed.max = '2'; speed.step = '0.25'; speed.value = '1';
    const dummyRange = document.createElement('input'); dummyRange.type = 'range'; dummyRange.min = '40'; dummyRange.max = '280'; dummyRange.step = '10'; dummyRange.value = '140';
    const loop = document.createElement('input'); loop.type = 'checkbox'; loop.dataset.visualLabLoop = '1';
    const anchor = document.createElement('select'); options(anchor, ['foot', 'center', 'chest', 'head', 'hand', 'weapon', 'castOrigin', 'ground']); anchor.value = 'head';

    function rangeRow(label, input, format) {
      const wrap = row(label, input);
      wrap.style.gridTemplateColumns = '72px 1fr 42px';
      const read = document.createElement('span');
      read.style.cssText = 'color:#f3d48b;text-align:right;font-weight:800';
      function sync() { read.textContent = format(input.value); }
      input.addEventListener('input', sync);
      sync();
      wrap.appendChild(read);
      return wrap;
    }

    const profile = document.createElement('select');
    profile.dataset.visualLabProfile = '1';
    function fillProfiles() {
      const defs = root.ABILITIES || [];
      const rows = defs.map(function (def) {
        const has = root.KeloAbilityVisuals && typeof root.KeloAbilityVisuals.hasProfile === 'function' && root.KeloAbilityVisuals.hasProfile(def);
        const type = def && def.delivery && def.delivery.type || 'visual';
        return { id: def.key, label: (def.name || def.key) + ' · ' + type + (has ? '' : ' · MISSING') };
      });
      options(profile, rows.length ? rows : [{ id: 'fireball', label: 'Bola de Fuego · projectile' }]);
      let pick = 'fireball';
      try { pick = sessionStorage.getItem('kelo-visual-lab-ability') || pick; } catch (e) {}
      const idx = Array.from(profile.options).findIndex(function (option) { return option.value === pick; });
      profile.selectedIndex = idx >= 0 ? idx : Math.max(0, Array.from(profile.options).findIndex(function (option) { return option.value === 'fireball'; }));
    }
    fillProfiles();

    function currentDef() { return abilityDef(profile.value); }
    function currentProfile() {
      const def = currentDef();
      if (root.KeloVisualProfileRegistry && typeof root.KeloVisualProfileRegistry.resolve === 'function') {
        return root.KeloVisualProfileRegistry.resolve(def && def.id, profile.value) || null;
      }
      return root.KeloVisualProfileRegistry && root.KeloVisualProfileRegistry.get(def && def.visualProfileId) || null;
    }
    function labContext(extra) {
      const p = actor();
      const dir = directionOf(direction.value);
      const origin = p ? { x: p.x, y: p.y } : originFor(dir, 0);
      const prof = currentProfile();
      const key = profile.value || (prof && prof.abilityKey) || null;
      const def = abilityDef(key);
      const delivery = def && def.delivery || {};
      const targeting = def && def.targeting || {};
      const telegraph = def && def.telegraph || {};
      const range = Number(dummyRange.value) || Number(delivery.maxDistance || targeting.range || delivery.distance) || 140;
      if (p) p._face = direction.value;
      return Object.assign({
        actor: p, actorId: p && p.id, abilityId: def && def.id, abilityKey: key,
        origin: origin, target: originFor(dir, range),
        direction: dir,
        gameplay: {
          speed: (Number(delivery.speed) || 420) * Number(speed.value),
          range: Number(delivery.maxDistance || targeting.range || delivery.distance || delivery.width) || range,
          radius: Number(delivery.radius || delivery.activationRadius || telegraph.radius) || 80,
          duration: Number(delivery.duration) || 0.18
        },
        visual: { scale: Number(scale.value), seed: Date.now() & 65535 },
        trapId: 'lab_trap'
      }, extra || {});
    }

    function familyOf(prof, def) {
      const type = def && def.delivery && def.delivery.type || '';
      if (prof && prof.projectileVisual || type === 'projectile') return 'projectile';
      if (prof && (prof.persistentFx || prof.placeSequence) || type === 'trap') return 'trap';
      if (prof && (prof.dashSequence || prof.travelEffect) || type === 'dash' || type === 'blink') return 'dash';
      if (prof && prof.throwVisual || type === 'swap_sword') return 'throw';
      if (type === 'chain') return 'chain';
      if (type === 'wall') return 'wall';
      if (type === 'aura' || type === 'persistent_area') return 'aura';
      if (type === 'instant') return 'self';
      return 'aoe';
    }

    const cueButtons = {};
    function playAbilityCue(cue, collapse, extra) {
      if (!root.KeloAbilityVisuals) return;
      const ctx = labContext(extra);
      root.KeloAbilityVisuals.playCue(ctx.abilityId, cue, ctx);
      if (cue === 'impact') dummyHit(ctx);
      if (collapse !== false) beginPreview(700);
    }

    function trapCtx() {
      const ctx = labContext({ trapId: 'lab_trap' });
      return Object.assign({}, ctx, { origin: ctx.target, target: ctx.target, position: ctx.target });
    }

    function spawnDummy() {
      if (dummyFxId && root.KeloFX) root.KeloFX.stop(dummyFxId);
      dummyFxId = null;
      if (!dummyOn || !root.KeloFX) return;
      const ctx = labContext();
      dummyFxId = root.KeloFX.spawn('magic_ground_ring_01', {
        origin: ctx.target, target: ctx.target, visual: { scale: 1, seed: 17 }
      }, { x: ctx.target.x, y: ctx.target.y, loop: true, duration: 0.9, scale: 1.15 });
    }

    function stopGhosts() {
      ghostIds.forEach(function (id) { if (id && root.KeloFX) root.KeloFX.stop(id); });
      ghostIds = [];
    }

    function spawnGhosts() {
      stopGhosts();
      if (!ghostOn || !root.KeloFX || typeof root.KeloFX.preview !== 'function') return;
      const ctx = labContext();
      const family = familyOf(currentProfile(), currentDef());
      const radius = Math.max(12, Number(ctx.gameplay.radius) || 80);
      const path = Math.max(24, Number(dummyRange.value) || 140);
      const atOrigin = family === 'aoe' || family === 'aura' || family === 'self';
      const diskAt = atOrigin ? ctx.origin : ctx.target;
      if (family === 'aoe' || family === 'aura' || family === 'self' || family === 'trap' || family === 'wall') {
        ghostIds.push(root.KeloFX.preview({
          id: 'lab_radius_ghost', type: 'area_disk', space: 'WORLD', layer: 'groundFX',
          duration: 0.9, loop: true, radius: family === 'wall' ? 36 : radius,
          color: 'rgba(231,197,106,0.12)', accent: 'rgba(243,212,139,0.9)',
          lineWidth: 2.2, alpha: 0.75, fade: 'pulse'
        }, ctx, { x: diskAt.x, y: diskAt.y, loop: true, duration: 0.9, scale: 1 }));
      }
      if (family === 'projectile' || family === 'dash' || family === 'throw' || family === 'chain') {
        ghostIds.push(root.KeloFX.preview({
          id: 'lab_range_ghost', type: 'streak', space: 'WORLD', layer: 'foregroundFX',
          duration: 0.8, loop: true, length: path, width: 7,
          color: 'rgba(231,197,106,0.7)', accent: 'rgba(255,255,255,0.4)', alpha: 0.8, fade: 'pulse'
        }, Object.assign({}, ctx, { origin: ctx.target }), { x: ctx.target.x, y: ctx.target.y, loop: true, duration: 0.8 }));
        ghostIds.push(root.KeloFX.preview({
          id: 'lab_impact_ghost', type: 'area_disk', space: 'WORLD', layer: 'groundFX',
          duration: 0.9, loop: true, radius: Math.max(16, Number(ctx.gameplay.radius) || 16),
          color: 'rgba(231,197,106,0.10)', accent: 'rgba(243,212,139,0.75)',
          lineWidth: 1.6, alpha: 0.7, fade: 'pulse'
        }, ctx, { x: ctx.target.x, y: ctx.target.y, loop: true, duration: 0.9 }));
      }
    }

    function dummyHit(ctx) {
      if (!dummyOn || !root.KeloFX || typeof root.KeloFX.preview !== 'function') return;
      const at = (ctx && ctx.target) || labContext().target;
      root.KeloFX.preview({
        id: 'lab_dummy_hit', type: 'burst', space: 'WORLD', layer: 'foregroundFX',
        duration: 0.28, loop: false, radius: 30, rays: 9,
        color: '#ffb4b4', accent: '#fff4f0', alpha: 0.95, fade: 'out'
      }, ctx || labContext(), { x: at.x, y: at.y, loop: false, duration: 0.28 });
    }

    function restoreHelpers() {
      dummyFxId = null;
      ghostIds = [];
      if (dummyOn) spawnDummy();
      if (ghostOn) spawnGhosts();
    }

    function stopAll(restoreDummy) {
      clearLabTimers();
      const ctx = labContext();
      if (root.KeloVisualEventBus) {
        root.KeloVisualEventBus.emit('TRAP_EXPIRED', Object.assign({}, ctx, { trapId: 'lab_trap', origin: ctx.target, target: ctx.target }));
        root.KeloVisualEventBus.emit('DASH_ENDED', ctx);
      }
      if (root.KeloSequence && root.KeloSequence.stopAll) root.KeloSequence.stopAll();
      if (root.KeloProjectileVisuals && root.KeloProjectileVisuals.stopAll) root.KeloProjectileVisuals.stopAll();
      if (root.KeloFX && root.KeloFX.stopAll) root.KeloFX.stopAll();
      dummyFxId = null;
      ghostIds = [];
      if (restoreDummy !== false) restoreHelpers();
      setStatus('stop');
    }

    function playFull() {
      const prof = currentProfile();
      const def = currentDef();
      if (!root.KeloAbilityVisuals) { setStatus('sin resolver'); return; }
      if (!prof) { setStatus('MISSING profile · ' + (def && def.name || profile.value || '')); beginPreview(900); return; }
      stopAll(true);
      const ctx = labContext();
      const family = familyOf(prof, def);
      const speedMs = Math.max(80, (Number(dummyRange.value) || 160) / Math.max(60, Number(ctx.gameplay.speed) || 420) * 1000);
      let restoreAt = 700;
      playAbilityCue('cast', false);
      if (family === 'projectile') {
        later(90, function () { root.KeloAbilityVisuals.playCue(ctx.abilityId, 'projectile', ctx); });
        later(90 + Math.min(900, speedMs), function () {
          root.KeloAbilityVisuals.playCue(ctx.abilityId, 'impact', Object.assign({}, ctx, { origin: ctx.target }));
          dummyHit(ctx);
        });
        restoreAt = 90 + Math.min(900, speedMs) + 420;
      } else if (family === 'aoe' || family === 'chain') {
        later(80, function () {
          root.KeloAbilityVisuals.playCue(ctx.abilityId, 'impact', ctx);
          if (prof.areaFx) root.KeloAbilityVisuals.playCue(ctx.abilityId, 'area', ctx);
          dummyHit(ctx);
        });
        restoreAt = 620;
      } else if (family === 'dash') {
        if (root.KeloVisualEventBus) {
          root.KeloVisualEventBus.emit('DASH_STARTED', ctx);
          later(Math.max(120, (Number(ctx.gameplay.duration) || 0.18) * 1000), function () {
            root.KeloVisualEventBus.emit('DASH_ENDED', ctx);
          });
        } else {
          playAbilityCue('dash', false);
          later(180, function () { playAbilityCue('dashEnd', false); });
        }
        restoreAt = Math.max(280, (Number(ctx.gameplay.duration) || 0.18) * 1000 + 200);
      } else if (family === 'trap') {
        const placed = trapCtx();
        if (root.KeloVisualEventBus) {
          root.KeloVisualEventBus.emit('TRAP_PLACED', placed);
          later(500, function () { root.KeloVisualEventBus.emit('TRAP_ARMED', placed); });
        } else {
          playAbilityCue('place', false, placed);
          playAbilityCue('persistent', false, placed);
          playAbilityCue('area', false, placed);
        }
        restoreAt = 900;
      } else if (family === 'throw') {
        later(80, function () { root.KeloAbilityVisuals.playCue(ctx.abilityId, 'throw', ctx); });
        restoreAt = 880;
      } else if (family === 'aura' || family === 'self') {
        later(80, function () {
          if (prof.areaFx) root.KeloAbilityVisuals.playCue(ctx.abilityId, 'area', ctx);
          else playAbilityCue('impact', false);
        });
        restoreAt = 700;
      } else if (family === 'wall') {
        later(80, function () { playAbilityCue('place', false, trapCtx()); });
        restoreAt = 700;
      }
      setStatus('play ' + (def && def.name || prof.abilityKey) + ' · ' + family);
      if (loopOn) {
        later(restoreAt, function () { if (loopOn) playFull(); });
        beginPreview(0);
      } else {
        beginPreview(restoreAt);
      }
    }

    function playInGame() {
      const def = currentDef();
      if (!def) { setStatus('sin definition'); return; }
      const run = function () {
        const ctx = labContext();
        const request = { direction: ctx.direction, position: ctx.target };
        const slots = root.KeloAbilities && root.KeloAbilities.hotbar && root.KeloAbilities.hotbar.slots || [];
        const slot = slots.findIndex(function (entry) { return entry && (entry.abilityKey === def.key || entry.definition && entry.definition.key === def.key); });
        let result = null;
        if (slot >= 0 && root.KeloAbilities.engine && root.KeloAbilities.engine.predict) {
          result = root.KeloAbilities.engine.predict(Object.assign({ slotIndex: slot }, request));
        } else if (root.KeloAbilities && root.KeloAbilities.engine && root.KeloAbilities.engine.predictSource) {
          result = root.KeloAbilities.engine.predictSource({
            sourceType: 'visual-lab', sourceId: 'lab', definition: def, request: request
          });
        } else {
          playFull();
          setStatus('fallback playCue');
          return;
        }
        if (result && result.valid === false) setStatus(result.reason || 'FAILED');
        else setStatus('in-game ' + def.key + (slot >= 0 ? ' slot ' + slot : ''));
        beginPreview(1100);
      };
      if (root.KeloAbilitiesLoader && typeof root.KeloAbilitiesLoader.ensure === 'function') {
        root.KeloAbilitiesLoader.ensure().then(run).catch(function (error) { setStatus(String(error && error.message || error)); });
      } else run();
    }

    const hint = document.createElement('div'); hint.textContent = 'Mismos datos que combate · PIN deja el panel abierto · GHOST pinta rango/radio'; hint.style.cssText = 'color:#78808b;margin:6px 0 8px'; abilitiesPane.appendChild(hint);

    shared.appendChild(row('Dirección', direction));
    shared.appendChild(rangeRow('Escala', scale, function (v) { return Number(v).toFixed(1) + '×'; }));
    shared.appendChild(rangeRow('Velocidad', speed, function (v) { return Number(v).toFixed(2) + '×'; }));
    const loopRow = row('Loop', loop);
    loopRow.style.gridTemplateColumns = '72px 1fr';
    shared.appendChild(loopRow);
    loop.addEventListener('change', function () { loopOn = loop.checked === true; });

    abilitiesPane.appendChild(rangeRow('Dummy m', dummyRange, function (v) { return String(Math.round(Number(v))); }));
    abilitiesPane.appendChild(row('Ability', profile));

    const mainActions = document.createElement('div'); mainActions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0';
    const playBtn = button('▶ PLAY FULL', playFull);
    playBtn.style.cssText += ';background:#2a2112;border-color:#c9a24a';
    mainActions.appendChild(playBtn);
    mainActions.appendChild(button('🎮 TEST IN GAME', playInGame));
    abilitiesPane.appendChild(mainActions);

    const cueGrid = document.createElement('div'); cueGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px';
    function addCue(key, label, fn) {
      const b = button(label, fn);
      b.dataset.visualLabCue = key;
      cueButtons[key] = b;
      cueGrid.appendChild(b);
    }
    addCue('cast', '▶ CAST', function () { playAbilityCue('cast'); });
    addCue('projectile', '➜ PROJECTILE', function () { playAbilityCue('projectile'); });
    addCue('impact', '✸ IMPACT', function () { playAbilityCue('impact'); });
    addCue('area', '◎ AREA', function () {
      const ctx = labContext();
      const family = familyOf(currentProfile(), currentDef());
      const extra = family === 'trap' || family === 'wall' ? trapCtx() : ctx;
      playAbilityCue('area', true, extra);
    });
    addCue('dash', '💨 DASH', function () {
      const ctx = labContext();
      if (root.KeloVisualEventBus) {
        root.KeloVisualEventBus.emit('DASH_STARTED', ctx);
        later(180, function () { root.KeloVisualEventBus.emit('DASH_ENDED', ctx); });
      } else playAbilityCue('dash');
      beginPreview(420);
    });
    addCue('end', '⏹ END', function () {
      const ctx = labContext();
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('DASH_ENDED', ctx);
      else playAbilityCue('dashEnd');
      beginPreview(420);
    });
    addCue('place', '🪤 PLACE', function () {
      const ctx = trapCtx();
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('TRAP_PLACED', ctx);
      else { playAbilityCue('place', false, ctx); playAbilityCue('persistent', false, ctx); playAbilityCue('area', false, ctx); }
      beginPreview(700);
    });
    addCue('arm', '⚡ ARM', function () {
      const ctx = trapCtx();
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('TRAP_ARMED', ctx);
      else playAbilityCue('arm', true, ctx);
      beginPreview(500);
    });
    addCue('trigger', '☠ TRIGGER', function () {
      const ctx = trapCtx();
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('TRAP_TRIGGERED', ctx);
      else playAbilityCue('trigger', true, ctx);
      dummyHit(ctx);
      beginPreview(500);
    });
    abilitiesPane.appendChild(cueGrid);

    const helperRow = document.createElement('div'); helperRow.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:0 0 8px';
    const dummyBtn = button('◎ DUMMY ON', function () {
      dummyOn = !dummyOn;
      dummyBtn.textContent = dummyOn ? '◎ DUMMY OFF' : '◎ DUMMY ON';
      dummyBtn.style.borderColor = dummyOn ? '#8be0ac' : '#4a5260';
      if (dummyOn) spawnDummy(); else if (dummyFxId && root.KeloFX) { root.KeloFX.stop(dummyFxId); dummyFxId = null; }
    });
    const ghostBtn = button('◯ GHOST OFF', function () {
      ghostOn = !ghostOn;
      ghostBtn.textContent = ghostOn ? '◯ GHOST OFF' : '◯ GHOST ON';
      ghostBtn.style.borderColor = ghostOn ? '#8be0ac' : '#4a5260';
      ghostBtn.dataset.visualLabGhost = ghostOn ? '1' : '0';
      if (ghostOn) spawnGhosts(); else stopGhosts();
    });
    ghostBtn.dataset.visualLabGhost = '1';
    ghostBtn.style.borderColor = '#8be0ac';
    helperRow.appendChild(dummyBtn);
    helperRow.appendChild(ghostBtn);
    abilitiesPane.appendChild(helperRow);
    dummyRange.addEventListener('input', function () { if (dummyOn) spawnDummy(); if (ghostOn) spawnGhosts(); });
    direction.addEventListener('change', function () { if (dummyOn) spawnDummy(); if (ghostOn) spawnGhosts(); });

    const missing = document.createElement('div'); missing.dataset.visualLabMissing = '1'; missing.style.cssText = 'color:#efd98f;margin:6px 0 8px;line-height:1.45'; abilitiesPane.appendChild(missing);
    function refreshMissing() {
      const registry = root.KeloVisualProfileRegistry;
      const defs = root.ABILITIES || [];
      const absent = defs.filter(function (def) {
        if (!def.visualProfileId) return false;
        if (root.KeloAbilityVisuals && typeof root.KeloAbilityVisuals.hasProfile === 'function') return !root.KeloAbilityVisuals.hasProfile(def);
        if (registry && registry.get(def.visualProfileId)) return false;
        if (registry && typeof registry.resolve === 'function' && registry.resolve(def.id, def.key)) return false;
        return true;
      }).map(function (def) { return def.name || def.key; });
      missing.textContent = absent.length ? 'MISSING · ' + absent.join(' · ') : '';
    }
    refreshMissing();

    statusLine = document.createElement('div'); statusLine.style.cssText = 'color:#8be0ac;margin:4px 0'; abilitiesPane.appendChild(statusLine);
    chipLine = document.createElement('div'); chipLine.style.cssText = 'color:#8b949e;border-top:1px solid #252b35;padding-top:8px;margin-top:6px'; abilitiesPane.appendChild(chipLine);

    function syncCues() {
      const prof = currentProfile();
      const def = currentDef();
      const family = familyOf(prof, def);
      const visible = {
        cast: !!(prof && (prof.castSequence || family === 'aoe' || family === 'chain' || family === 'aura' || family === 'self' || family === 'throw' || family === 'wall') && family !== 'dash'),
        projectile: !!(prof && prof.projectileVisual),
        impact: !!(prof && (prof.impactSequence || family === 'aoe' || family === 'projectile' || family === 'chain')),
        area: !!(prof && prof.areaFx) || family === 'aoe' || family === 'trap' || family === 'aura',
        dash: family === 'dash',
        end: family === 'dash',
        place: family === 'trap' || family === 'wall',
        arm: family === 'trap',
        trigger: family === 'trap'
      };
      Object.keys(cueButtons).forEach(function (key) {
        cueButtons[key].style.display = visible[key] ? '' : 'none';
      });
      if (ghostOn) spawnGhosts();
      if (dummyOn) spawnDummy();
    }
    profile.addEventListener('change', function () {
      try { sessionStorage.setItem('kelo-visual-lab-ability', profile.value); } catch (e) {}
      syncCues();
    });
    syncCues();

    const pieceHint = document.createElement('div'); pieceHint.textContent = 'Componentes sueltos · no son una skill · Dirección/Escala/Loop están arriba'; pieceHint.style.cssText = 'color:#78808b;margin:6px 0 8px'; piecesPane.appendChild(pieceHint);
    const eyeQuick = button('👁 ACTIVATION EYE', playActivationEyePreview);
    eyeQuick.style.cssText += ';display:block;width:100%;margin:0 0 7px;background:#2b1740;border-color:#8b5cf6;color:#f0ddff;font-size:11px';
    piecesPane.appendChild(eyeQuick);
    const katanaQuick = button('🗡 KATANA THROW', playKatanaThrowPreview);
    katanaQuick.style.cssText += ';display:block;width:100%;margin:0 0 10px;background:#21152f;border-color:#a774ff;color:#f0ddff;font-size:11px';
    piecesPane.appendChild(katanaQuick);
    piecesPane.appendChild(row('Anchor', anchor));

    const animation = document.createElement('select'); options(animation, root.KeloAnimationRegistry ? root.KeloAnimationRegistry.list() : []); piecesPane.appendChild(row('Animation', animation));
    piecesPane.appendChild(button('▶ PLAY ANIMATION', function () {
      const p = actor(); if (!p || !root.KeloAnimation) return;
      p._face = direction.value; root.KeloAnimation.play(p, animation.value, { speed: Number(speed.value), loop: loop.checked, force: true, context: { actor: p, visual: { scale: Number(scale.value) } } }); beginPreview(900);
    }));

    const fx = document.createElement('select'); options(fx, root.KeloFXRegistry ? root.KeloFXRegistry.list() : []); piecesPane.appendChild(row('VFX', fx));
    const eyeIndex = Array.from(fx.options).findIndex(function (option) { return option.value === 'sword_swap_activation_eye_anim'; });
    if (eyeIndex >= 0) fx.selectedIndex = eyeIndex;
    piecesPane.appendChild(button('✦ SPAWN VFX', function () {
      const p = actor(), dir = directionOf(direction.value), pos = originFor(dir, 70);
      const def = root.KeloFXRegistry && root.KeloFXRegistry.get(fx.value);
      const isActor = def && def.space === 'ACTOR';
      root.KeloFX && root.KeloFX.spawn(fx.value, { actor: isActor ? p : null, actorId: isActor && p ? p.id : null, origin: isActor ? null : pos, direction: dir, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { socket: anchor.value, scale: Number(scale.value), loop: loop.checked });
      beginPreview(900);
    }));

    const projectile = document.createElement('select'); options(projectile, root.KeloProjectileVisualRegistry ? root.KeloProjectileVisualRegistry.list() : []); piecesPane.appendChild(row('Projectile', projectile));
    const katanaIndex = Array.from(projectile.options).findIndex(function (option) { return option.value === 'sword_swap_katana_throw_visual'; });
    if (katanaIndex >= 0) projectile.selectedIndex = katanaIndex;
    piecesPane.appendChild(button('➜ PREVIEW PROJECTILE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = direction.value;
      root.KeloProjectileVisuals && root.KeloProjectileVisuals.preview(projectile.value, { actor: p, actorId: p && p.id, origin: p && root.KeloAnchors ? root.KeloAnchors.get(p, anchor.value) : originFor(dir, 0), direction: dir, gameplay: { speed: 420 * Number(speed.value), range: 320 }, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }); beginPreview(900);
    }));

    const sequence = document.createElement('select'); options(sequence, root.KeloSequenceRegistry ? root.KeloSequenceRegistry.list() : []); piecesPane.appendChild(row('Sequence', sequence));
    const seqIndex = Array.from(sequence.options).findIndex(function (option) { return option.value === 'sequence_sword_swap_activation_eye_anim'; });
    if (seqIndex >= 0) sequence.selectedIndex = seqIndex;
    piecesPane.appendChild(button('▶ PLAY SEQUENCE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = direction.value;
      root.KeloSequence && root.KeloSequence.play(sequence.value, { actor: p, actorId: p && p.id, origin: p ? { x: p.x, y: p.y } : originFor(dir, 0), direction: dir, target: originFor(dir, 100), gameplay: { speed: 420, range: 320 }, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { speed: Number(speed.value), loop: loop.checked }); beginPreview(900);
    }));

    const status = document.createElement('select'); const statuses = Object.keys(root.KELO_VISUAL_MANIFESTS && root.KELO_VISUAL_MANIFESTS.statusVisuals || {}).map(function (id) { return { id: id }; }); options(status, statuses); piecesPane.appendChild(row('Status', status));
    piecesPane.appendChild(button('◉ PREVIEW STATUS', function () {
      const p = actor(), ref = root.KELO_VISUAL_MANIFESTS.statusVisuals[status.value];
      if (p && ref && root.KeloFX) root.KeloFX.spawn(ref, { actor: p, actorId: p.id, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { socket: 'center', loop: loop.checked }); beginPreview(900);
    }));

    const sfx = document.createElement('select'); options(sfx, root.KeloSFXRegistry ? root.KeloSFXRegistry.list() : []); piecesPane.appendChild(row('SFX', sfx));
    piecesPane.appendChild(button('♪ PLAY SFX', function () { root.KeloSFX && root.KeloSFX.play(sfx.value, { actor: actor() }); }));

    const actions = document.createElement('div'); actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px';
    actions.appendChild(button('Shake', function () { root.KeloScreenFX && root.KeloScreenFX.shake('impact_medium'); beginPreview(400); }));
    actions.appendChild(button('Flash', function () { root.KeloScreenFX && root.KeloScreenFX.flash('flash_warm_small'); beginPreview(400); })); piecesPane.appendChild(actions);

    setInterval(function () {
      if (!chipLine || !root.KELO_VISUAL_AUDIT) return;
      const a = root.KELO_VISUAL_AUDIT;
      const last = a.lastEvent && a.lastEvent.name || '—';
      const ctx = labContext();
      chipLine.textContent = 'FX ' + (a.activeFX || 0) + ' · P ' + (a.activeProjectiles || 0) + ' · SEQ ' + (a.activeSequences || 0) + ' · R' + Math.round(ctx.gameplay.range) + ' r' + Math.round(ctx.gameplay.radius) + ' · ' + last;
    }, 250);

    document.body.appendChild(panel);
    setTab('abilities');
    applyChrome();
    later(80, function () { if (ghostOn) spawnGhosts(); });
    root.addEventListener('resize', applyChrome);

    root.KeloVisualLabPlayFull = playFull;
    root.KeloVisualLabStop = function () { stopAll(true); compactPlay = false; if (!collapsed) applyChrome(); };
    root.KeloVisualLabPlayInGame = playInGame;
  }

  root.KeloVisualLab = Object.freeze({
    version: 'visual-lab-v1.6.0',
    open: build,
    minimize: function () { setCollapsed(true); },
    expand: function () { setCollapsed(false); },
    playFull: function () { if (root.KeloVisualLabPlayFull) root.KeloVisualLabPlayFull(); },
    stop: function () { if (root.KeloVisualLabStop) root.KeloVisualLabStop(); },
    playInGame: function () { if (root.KeloVisualLabPlayInGame) root.KeloVisualLabPlayInGame(); },
    previewActivationEye: playActivationEyePreview,
    previewKatanaThrow: playKatanaThrowPreview,
    get enabled() { return enabled(); },
    get collapsed() { return collapsed; },
    get pinned() { return pinned; },
    get tab() { return currentTab; }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true }); else build();
})(typeof globalThis !== 'undefined' ? globalThis : window);
