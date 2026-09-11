/* KELO-INDEX
 * area: VISUAL
 * keys: LAB DEBUG GALLERY ANIMATION VFX PROJECTILE SEQUENCE STATUS SFX PREVIEW MOBILE MINIMIZE PLAYFULL STOP DUMMY
 * hace: galería de desarrollo; pestaña Abilities usa playCue/eventos del combate, pestaña Piezas prueba componentes sueltos
 * online: N/A; solo aparece con ?visualLab=1 y no muta HP/mana/inventario
 */
(function (root) {
  'use strict';

  let panel = null;
  let body = null;
  let collapsed = false;
  let currentTab = 'abilities';
  let dummyOn = false;
  let dummyFxId = null;
  let labTimers = [];
  let statusLine = null;
  let chipLine = null;

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
    const wrap = document.createElement('label'); wrap.style.cssText = 'display:grid;grid-template-columns:86px 1fr;gap:6px;align-items:center;margin:5px 0';
    const span = document.createElement('span'); span.textContent = label; span.style.color = '#a9b1bc'; wrap.appendChild(span); wrap.appendChild(node); return wrap;
  }
  function button(text, fn) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = text; b.style.cssText = 'background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;padding:8px 9px;font-weight:800;touch-action:manipulation'; b.onclick = fn; return b;
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
  function setStatus(text) { if (statusLine) statusLine.textContent = text || ''; }

  function abilityDef(key) {
    if (!key) return null;
    if (root.KeloAbilities && root.KeloAbilities.registry && typeof root.KeloAbilities.registry.getByKey === 'function') {
      const byKey = root.KeloAbilities.registry.getByKey(key); if (byKey) return byKey;
    }
    return (root.ABILITIES || []).find(function (item) { return item.key === key; }) || null;
  }

  function setCollapsed(value) {
    collapsed = value === true;
    if (!panel || !body) return;
    body.style.display = collapsed ? 'none' : 'block';
    panel.style.width = collapsed ? 'auto' : 'min(350px,calc(100vw - 16px))';
    panel.style.maxHeight = collapsed ? '54px' : '90vh';
    panel.style.overflow = collapsed ? 'hidden' : 'auto';
    const toggle = panel.querySelector('[data-visual-lab-toggle]');
    if (toggle) {
      toggle.textContent = collapsed ? '＋' : '−';
      toggle.setAttribute('aria-label', collapsed ? 'Abrir Visual Lab' : 'Minimizar Visual Lab');
    }
    const label = panel.querySelector('[data-visual-lab-dev-label]');
    if (label) label.style.display = collapsed ? 'none' : 'inline';
    panel.querySelectorAll('[data-visual-lab-tab]').forEach(function (el) {
      el.style.display = collapsed ? 'none' : '';
    });
  }

  function collapseAfterPreview() {
    setTimeout(function () { setCollapsed(true); }, 40);
  }

  function playActivationEyePreview() {
    const p = actor();
    if (!p || !root.KeloFX) return;
    const spawn = function () {
      root.KeloFX.spawn('sword_swap_activation_eye_anim', {
        actor: p, actorId: p.id, visual: { scale: 1.35, seed: Date.now() & 65535 }
      }, { socket: 'head', scale: 1.35, loop: false, duration: 1.0 });
      collapseAfterPreview();
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
      collapseAfterPreview();
    };
    if (root.KeloAssetRegistry && !root.KeloAssetRegistry.isReady('sword_swap_katana_throw_asset')) {
      root.KeloAssetRegistry.load('sword_swap_katana_throw_asset').then(spawn);
    } else spawn();
  }

  function build() {
    if (panel || !document.body) return;
    panel = document.createElement('div'); panel.id = 'kelo-visual-lab';
    panel.style.cssText = 'position:fixed;top:max(8px,env(safe-area-inset-top));right:8px;width:min(350px,calc(100vw - 16px));max-height:90vh;overflow:auto;z-index:100000;background:rgba(7,10,15,.97);border:1px solid rgba(231,197,106,.55);border-radius:14px;padding:10px;color:#e6edf3;font:10px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;pointer-events:auto;touch-action:pan-y;box-shadow:0 8px 28px rgba(0,0,0,.42)';

    const header = document.createElement('div'); header.style.cssText = 'display:flex;align-items:center;gap:6px;min-height:28px';
    const title = document.createElement('button'); title.type = 'button'; title.textContent = '👁 LAB'; title.style.cssText = 'flex:1;background:transparent;color:#e7c56a;border:0;padding:4px 2px;text-align:left;font:800 11px/1.2 ui-monospace,SFMono-Regular,Menlo,monospace;touch-action:manipulation'; title.onclick = function () { setCollapsed(!collapsed); }; header.appendChild(title);
    const tabAbilities = document.createElement('button'); tabAbilities.type = 'button'; tabAbilities.dataset.visualLabTab = 'abilities'; tabAbilities.textContent = 'SKILL'; tabAbilities.style.cssText = 'background:#2a2112;color:#f3d48b;border:1px solid #c9a24a;border-radius:8px;padding:6px 8px;font-weight:800;touch-action:manipulation';
    const tabPieces = document.createElement('button'); tabPieces.type = 'button'; tabPieces.dataset.visualLabTab = 'pieces'; tabPieces.textContent = 'PIEZAS'; tabPieces.style.cssText = 'background:#191f29;color:#a9b1bc;border:1px solid #4a5260;border-radius:8px;padding:6px 8px;font-weight:800;touch-action:manipulation';
    header.appendChild(tabAbilities); header.appendChild(tabPieces);
    const stopHeader = button('■', function () { stopAll(true); });
    stopHeader.dataset.visualLabStop = '1';
    stopHeader.setAttribute('aria-label', 'Stop preview');
    stopHeader.style.cssText += ';width:34px;height:30px;padding:0;color:#ffb4b4;border-color:#7a3a3a';
    header.appendChild(stopHeader);
    const dev = document.createElement('span'); dev.dataset.visualLabDevLabel = '1'; dev.textContent = 'DEV'; dev.style.cssText = 'color:#78808b;white-space:nowrap'; header.appendChild(dev);
    const toggle = document.createElement('button'); toggle.type = 'button'; toggle.dataset.visualLabToggle = '1'; toggle.textContent = '−'; toggle.setAttribute('aria-label', 'Minimizar Visual Lab'); toggle.style.cssText = 'width:34px;height:30px;background:#191f29;color:#f3d48b;border:1px solid #4a5260;border-radius:8px;font-size:18px;font-weight:900;line-height:1;touch-action:manipulation'; toggle.onclick = function () { setCollapsed(!collapsed); }; header.appendChild(toggle);
    panel.appendChild(header);

    body = document.createElement('div'); body.dataset.visualLabBody = '1'; panel.appendChild(body);

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
    const loop = document.createElement('input'); loop.type = 'checkbox';
    const anchor = document.createElement('select'); options(anchor, ['foot', 'center', 'chest', 'head', 'hand', 'weapon', 'castOrigin', 'ground']); anchor.value = 'head';

    const profile = document.createElement('select');
    profile.dataset.visualLabProfile = '1';
    function fillProfiles() {
      const list = root.KeloVisualProfileRegistry ? root.KeloVisualProfileRegistry.list() : [];
      options(profile, list.map(function (prof) {
        const def = abilityDef(prof.abilityKey);
        const name = def && def.name || prof.abilityKey || prof.id;
        const type = def && def.delivery && def.delivery.type || 'visual';
        return { id: prof.id, label: name + ' · ' + type };
      }));
      const fireIdx = Array.from(profile.options).findIndex(function (option) { return option.value === 'ability_visual_fireball_01'; });
      if (fireIdx >= 0) profile.selectedIndex = fireIdx;
    }
    fillProfiles();

    function currentProfile() {
      return root.KeloVisualProfileRegistry && root.KeloVisualProfileRegistry.get(profile.value) || null;
    }
    function labContext(extra) {
      const p = actor();
      const dir = directionOf(direction.value);
      const origin = p ? { x: p.x, y: p.y } : originFor(dir, 0);
      const prof = currentProfile();
      const key = prof && prof.abilityKey || null;
      const def = abilityDef(key);
      const delivery = def && def.delivery || {};
      const targeting = def && def.targeting || {};
      const range = Number(dummyRange.value) || Number(delivery.maxDistance || targeting.range || delivery.distance) || 140;
      if (p) p._face = direction.value;
      return Object.assign({
        actor: p, actorId: p && p.id, abilityId: def && def.id, abilityKey: key,
        origin: origin, target: originFor(dir, range),
        direction: dir,
        gameplay: {
          speed: (Number(delivery.speed) || 420) * Number(speed.value),
          range: Number(delivery.maxDistance || targeting.range || delivery.distance) || range,
          radius: Number(delivery.radius || delivery.activationRadius) || 80,
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
      return 'aoe';
    }

    const cueButtons = {};
    function playAbilityCue(cue, collapse) {
      if (!root.KeloAbilityVisuals) return;
      const ctx = labContext();
      root.KeloAbilityVisuals.playCue(ctx.abilityId, cue, ctx);
      if (collapse !== false) collapseAfterPreview();
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

    function stopAll(restoreDummy) {
      clearLabTimers();
      const ctx = labContext();
      if (root.KeloVisualEventBus) {
        root.KeloVisualEventBus.emit('TRAP_EXPIRED', Object.assign({}, ctx, { trapId: 'lab_trap' }));
        root.KeloVisualEventBus.emit('DASH_ENDED', ctx);
      }
      if (root.KeloSequence && root.KeloSequence.stopAll) root.KeloSequence.stopAll();
      if (root.KeloProjectileVisuals && root.KeloProjectileVisuals.stopAll) root.KeloProjectileVisuals.stopAll();
      if (root.KeloFX && root.KeloFX.stopAll) root.KeloFX.stopAll();
      dummyFxId = null;
      if (restoreDummy !== false && dummyOn) spawnDummy();
      setStatus('stop');
    }

    function playFull() {
      const prof = currentProfile();
      const def = abilityDef(prof && prof.abilityKey);
      if (!prof || !root.KeloAbilityVisuals) { setStatus('sin profile'); return; }
      stopAll(true);
      const ctx = labContext();
      const family = familyOf(prof, def);
      const speedMs = Math.max(80, (Number(ctx.gameplay.range) || 160) / Math.max(60, Number(ctx.gameplay.speed) || 420) * 1000);
      playAbilityCue('cast', false);
      if (family === 'projectile') {
        later(90, function () { root.KeloAbilityVisuals.playCue(ctx.abilityId, 'projectile', ctx); });
        later(90 + Math.min(900, speedMs), function () {
          root.KeloAbilityVisuals.playCue(ctx.abilityId, 'impact', Object.assign({}, ctx, { origin: ctx.target }));
        });
      } else if (family === 'aoe') {
        later(80, function () {
          root.KeloAbilityVisuals.playCue(ctx.abilityId, 'impact', ctx);
          if (prof.areaFx) root.KeloAbilityVisuals.playCue(ctx.abilityId, 'area', ctx);
        });
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
      } else if (family === 'trap') {
        if (root.KeloVisualEventBus) {
          root.KeloVisualEventBus.emit('TRAP_PLACED', ctx);
          later(500, function () { root.KeloVisualEventBus.emit('TRAP_ARMED', ctx); });
        } else {
          playAbilityCue('place', false); playAbilityCue('persistent', false); playAbilityCue('area', false);
        }
      } else if (family === 'throw') {
        later(80, function () { root.KeloAbilityVisuals.playCue(ctx.abilityId, 'throw', ctx); });
      }
      setStatus('play ' + (def && def.name || prof.abilityKey));
      collapseAfterPreview();
    }

    function playInGame() {
      const prof = currentProfile();
      const def = abilityDef(prof && prof.abilityKey);
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
        collapseAfterPreview();
      };
      if (root.KeloAbilitiesLoader && typeof root.KeloAbilitiesLoader.ensure === 'function') {
        root.KeloAbilitiesLoader.ensure().then(run).catch(function (error) { setStatus(String(error && error.message || error)); });
      } else run();
    }

    const hint = document.createElement('div'); hint.textContent = 'Mismos datos que combate · PLAY reproduce el profile · ■ queda en la barra'; hint.style.cssText = 'color:#78808b;margin:6px 0 8px'; abilitiesPane.appendChild(hint);
    abilitiesPane.appendChild(row('Dirección', direction));
    abilitiesPane.appendChild(row('Escala', scale));
    abilitiesPane.appendChild(row('Velocidad', speed));
    abilitiesPane.appendChild(row('Dummy m', dummyRange));
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
    addCue('dash', '💨 DASH', function () {
      const ctx = labContext();
      if (root.KeloVisualEventBus) {
        root.KeloVisualEventBus.emit('DASH_STARTED', ctx);
        later(180, function () { root.KeloVisualEventBus.emit('DASH_ENDED', ctx); });
      } else playAbilityCue('dash');
      collapseAfterPreview();
    });
    addCue('place', '🪤 PLACE', function () {
      const ctx = labContext({ trapId: 'lab_trap' });
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('TRAP_PLACED', ctx);
      else { playAbilityCue('place', false); playAbilityCue('persistent', false); playAbilityCue('area', false); }
      collapseAfterPreview();
    });
    addCue('trigger', '☠ TRIGGER', function () {
      const ctx = labContext({ trapId: 'lab_trap' });
      if (root.KeloVisualEventBus) root.KeloVisualEventBus.emit('TRAP_TRIGGERED', ctx);
      else playAbilityCue('trigger');
    });
    abilitiesPane.appendChild(cueGrid);

    const dummyBtn = button('◎ DUMMY ON', function () {
      dummyOn = !dummyOn;
      dummyBtn.textContent = dummyOn ? '◎ DUMMY OFF' : '◎ DUMMY ON';
      dummyBtn.style.borderColor = dummyOn ? '#8be0ac' : '#4a5260';
      if (dummyOn) spawnDummy(); else if (dummyFxId && root.KeloFX) { root.KeloFX.stop(dummyFxId); dummyFxId = null; }
    });
    dummyBtn.style.cssText += ';display:block;width:100%;margin:0 0 8px';
    abilitiesPane.appendChild(dummyBtn);
    dummyRange.addEventListener('input', function () { if (dummyOn) spawnDummy(); });
    direction.addEventListener('change', function () { if (dummyOn) spawnDummy(); });

    const missing = document.createElement('div'); missing.dataset.visualLabMissing = '1'; missing.style.cssText = 'color:#efd98f;margin:6px 0 8px;line-height:1.45'; abilitiesPane.appendChild(missing);
    function refreshMissing() {
      const registry = root.KeloVisualProfileRegistry;
      const defs = root.ABILITIES || [];
      const absent = defs.filter(function (def) {
        if (!def.visualProfileId) return false;
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
      const def = abilityDef(prof && prof.abilityKey);
      const family = familyOf(prof, def);
      const visible = {
        cast: !!(prof && (prof.castSequence || family === 'aoe')),
        projectile: !!(prof && prof.projectileVisual),
        impact: !!(prof && (prof.impactSequence || family === 'aoe' || family === 'projectile')),
        dash: family === 'dash',
        place: family === 'trap',
        trigger: family === 'trap'
      };
      Object.keys(cueButtons).forEach(function (key) {
        cueButtons[key].style.display = visible[key] ? '' : 'none';
      });
    }
    profile.addEventListener('change', syncCues);
    syncCues();

    const pieceHint = document.createElement('div'); pieceHint.textContent = 'Componentes sueltos · no son una skill'; pieceHint.style.cssText = 'color:#78808b;margin:6px 0 8px'; piecesPane.appendChild(pieceHint);
    const eyeQuick = button('👁 ACTIVATION EYE', playActivationEyePreview);
    eyeQuick.style.cssText += ';display:block;width:100%;margin:0 0 7px;background:#2b1740;border-color:#8b5cf6;color:#f0ddff;font-size:11px';
    piecesPane.appendChild(eyeQuick);
    const katanaQuick = button('🗡 KATANA THROW', playKatanaThrowPreview);
    katanaQuick.style.cssText += ';display:block;width:100%;margin:0 0 10px;background:#21152f;border-color:#a774ff;color:#f0ddff;font-size:11px';
    piecesPane.appendChild(katanaQuick);
    piecesPane.appendChild(row('Loop', loop));
    piecesPane.appendChild(row('Anchor', anchor));

    const animation = document.createElement('select'); options(animation, root.KeloAnimationRegistry ? root.KeloAnimationRegistry.list() : []); piecesPane.appendChild(row('Animation', animation));
    piecesPane.appendChild(button('▶ PLAY ANIMATION', function () {
      const p = actor(); if (!p || !root.KeloAnimation) return;
      p._face = direction.value; root.KeloAnimation.play(p, animation.value, { speed: Number(speed.value), loop: loop.checked, force: true, context: { actor: p, visual: { scale: Number(scale.value) } } }); collapseAfterPreview();
    }));

    const fx = document.createElement('select'); options(fx, root.KeloFXRegistry ? root.KeloFXRegistry.list() : []); piecesPane.appendChild(row('VFX', fx));
    const eyeIndex = Array.from(fx.options).findIndex(function (option) { return option.value === 'sword_swap_activation_eye_anim'; });
    if (eyeIndex >= 0) fx.selectedIndex = eyeIndex;
    piecesPane.appendChild(button('✦ SPAWN VFX', function () {
      const p = actor(), dir = directionOf(direction.value), pos = originFor(dir, 70);
      const def = root.KeloFXRegistry && root.KeloFXRegistry.get(fx.value);
      const isActor = def && def.space === 'ACTOR';
      root.KeloFX && root.KeloFX.spawn(fx.value, { actor: isActor ? p : null, actorId: isActor && p ? p.id : null, origin: isActor ? null : pos, direction: dir, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { socket: anchor.value, scale: Number(scale.value), loop: loop.checked });
      collapseAfterPreview();
    }));

    const projectile = document.createElement('select'); options(projectile, root.KeloProjectileVisualRegistry ? root.KeloProjectileVisualRegistry.list() : []); piecesPane.appendChild(row('Projectile', projectile));
    const katanaIndex = Array.from(projectile.options).findIndex(function (option) { return option.value === 'sword_swap_katana_throw_visual'; });
    if (katanaIndex >= 0) projectile.selectedIndex = katanaIndex;
    piecesPane.appendChild(button('➜ PREVIEW PROJECTILE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = direction.value;
      root.KeloProjectileVisuals && root.KeloProjectileVisuals.preview(projectile.value, { actor: p, actorId: p && p.id, origin: p && root.KeloAnchors ? root.KeloAnchors.get(p, anchor.value) : originFor(dir, 0), direction: dir, gameplay: { speed: 420 * Number(speed.value), range: 320 }, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }); collapseAfterPreview();
    }));

    const sequence = document.createElement('select'); options(sequence, root.KeloSequenceRegistry ? root.KeloSequenceRegistry.list() : []); piecesPane.appendChild(row('Sequence', sequence));
    const seqIndex = Array.from(sequence.options).findIndex(function (option) { return option.value === 'sequence_sword_swap_activation_eye_anim'; });
    if (seqIndex >= 0) sequence.selectedIndex = seqIndex;
    piecesPane.appendChild(button('▶ PLAY SEQUENCE', function () {
      const p = actor(), dir = directionOf(direction.value); if (p) p._face = direction.value;
      root.KeloSequence && root.KeloSequence.play(sequence.value, { actor: p, actorId: p && p.id, origin: p ? { x: p.x, y: p.y } : originFor(dir, 0), direction: dir, target: originFor(dir, 100), gameplay: { speed: 420, range: 320 }, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { speed: Number(speed.value), loop: loop.checked }); collapseAfterPreview();
    }));

    const status = document.createElement('select'); const statuses = Object.keys(root.KELO_VISUAL_MANIFESTS && root.KELO_VISUAL_MANIFESTS.statusVisuals || {}).map(function (id) { return { id: id }; }); options(status, statuses); piecesPane.appendChild(row('Status', status));
    piecesPane.appendChild(button('◉ PREVIEW STATUS', function () {
      const p = actor(), ref = root.KELO_VISUAL_MANIFESTS.statusVisuals[status.value];
      if (p && ref && root.KeloFX) root.KeloFX.spawn(ref, { actor: p, actorId: p.id, visual: { scale: Number(scale.value), seed: Date.now() & 65535 } }, { socket: 'center', loop: loop.checked }); collapseAfterPreview();
    }));

    const sfx = document.createElement('select'); options(sfx, root.KeloSFXRegistry ? root.KeloSFXRegistry.list() : []); piecesPane.appendChild(row('SFX', sfx));
    piecesPane.appendChild(button('♪ PLAY SFX', function () { root.KeloSFX && root.KeloSFX.play(sfx.value, { actor: actor() }); }));

    const actions = document.createElement('div'); actions.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px';
    actions.appendChild(button('Shake', function () { root.KeloScreenFX && root.KeloScreenFX.shake('impact_medium'); collapseAfterPreview(); }));
    actions.appendChild(button('Flash', function () { root.KeloScreenFX && root.KeloScreenFX.flash('flash_warm_small'); collapseAfterPreview(); })); piecesPane.appendChild(actions);

    setInterval(function () {
      if (!chipLine || !root.KELO_VISUAL_AUDIT) return;
      const a = root.KELO_VISUAL_AUDIT;
      const last = a.lastEvent && a.lastEvent.name || '—';
      chipLine.textContent = 'FX ' + (a.activeFX || 0) + ' · P ' + (a.activeProjectiles || 0) + ' · SEQ ' + (a.activeSequences || 0) + ' · ' + last;
    }, 250);

    document.body.appendChild(panel);
    setTab('abilities');
    setCollapsed(false);

    root.KeloVisualLabPlayFull = playFull;
    root.KeloVisualLabStop = function () { stopAll(true); };
    root.KeloVisualLabPlayInGame = playInGame;
  }

  root.KeloVisualLab = Object.freeze({
    version: 'visual-lab-v1.5.0',
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
    get tab() { return currentTab; }
  });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build, { once: true }); else build();
})(typeof globalThis !== 'undefined' ? globalThis : window);
