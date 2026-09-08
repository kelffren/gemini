/* KELO-INDEX
 * area: PROGRESSION / TITLES
 * owner: KeloTitles
 * keys: TITLES ACHIEVEMENTS UNLOCK EQUIP SNAPSHOT AUTHORITY UI
 * purpose: evalúa requisitos data-driven, posee títulos desbloqueados/equipado y sirve la UI integrada de Nobleza
 * public-api: KeloTitles.getCatalog/getTitle/getUnlocked/isUnlocked/getProgress/getEquipped/equip/unequip/ingestServerSnapshot/evaluate/refresh
 * consumes: KeloTitleCatalog, KeloPlayerStats, KeloEvents, KeloNetAuthority, STATE/saveState
 * state-owned: unlocked IDs + equippedTitleId offline; snapshot read-only online
 * extension-points: nuevas definiciones en title-catalog; nuevas stats desde KeloPlayerStats
 * reuse: identidad/prestigio, achievements y futuras recompensas visuales
 * legacy: sustituye localPlayer.title hardcodeado; Nobleza sigue siendo owner separado
 * do-not: NO resolver combate/kills; NO renderAvatar wrapper; NO aceptar unlock desde cliente online
 */
(function (root) {
  'use strict';
  if (root.KeloTitles) return;
  if (!root.KeloTitleCatalog || !root.KeloPlayerStats) return;

  const VERSION = 'kelo-titles-v1.1';
  const catalog = root.KeloTitleCatalog;
  const stats = root.KeloPlayerStats;
  let serverSnapshot = null;
  let receivedServerSnapshot = false;

  function worldState() {
    try { if (typeof STATE !== 'undefined') return STATE; } catch (e) {}
    return root.STATE || null;
  }
  function player() {
    try { if (typeof localPlayer !== 'undefined') return localPlayer; } catch (e) {}
    return root.localPlayer || null;
  }
  function online() { return !!(root.KeloNetAuthority && root.KeloNetAuthority.isOnline && root.KeloNetAuthority.isOnline()); }
  function ensureLocal() {
    const state = worldState(); if (!state) return null;
    if (!state.titles || typeof state.titles !== 'object' || Array.isArray(state.titles)) state.titles = { unlocked: [], equippedTitleId: null };
    const t = state.titles;
    t.unlocked = Array.from(new Set((Array.isArray(t.unlocked) ? t.unlocked : []).filter(function (id) { return !!catalog.get(id); })));
    if (t.equippedTitleId && (!catalog.get(t.equippedTitleId) || t.unlocked.indexOf(t.equippedTitleId) < 0)) t.equippedTitleId = null;
    return t;
  }
  function persist() { try { if (typeof saveState === 'function') saveState(); } catch (e) {} }
  function emit(name, payload) { if (root.KeloEvents && root.KeloEvents.emit) root.KeloEvents.emit(name, payload); }
  function currentState() {
    if (online()) return serverSnapshot || { unlocked: [], equippedTitleId: null, progress: {} };
    return ensureLocal() || { unlocked: [], equippedTitleId: null, progress: stats.snapshot() };
  }
  function getUnlocked() { return Object.freeze((currentState().unlocked || []).slice()); }
  function isUnlocked(id) { return getUnlocked().indexOf(String(id || '')) >= 0; }
  function getEquipped() { return currentState().equippedTitleId || null; }
  function requirementMet(requirement, value) {
    if (!requirement) return false;
    if (requirement.operator === 'gte') return Number(value) >= Number(requirement.value);
    return false;
  }
  function syncActor() {
    const p = player(); if (!p) return;
    p.equippedTitleId = getEquipped();
  }
  function notifyUnlock(title) {
    if (!title || typeof document === 'undefined') return;
    let toast = document.getElementById('kelo-title-unlock-toast');
    if (toast) toast.remove();
    toast = document.createElement('div');
    toast.id = 'kelo-title-unlock-toast';
    toast.className = 'title-unlock-toast rarity-' + title.rarity;
    toast.innerHTML = '<small>TÍTULO DESBLOQUEADO</small><strong>《' + escapeHtml(title.name) + '》</strong><span>' + escapeHtml(title.description) + '</span>';
    document.body.appendChild(toast);
    requestAnimationFrame(function () { toast.classList.add('show'); });
    setTimeout(function () { toast.classList.remove('show'); setTimeout(function () { if (toast.parentNode) toast.remove(); }, 260); }, 3000);
  }

  // KELO-INDEX TITLES/EVALUATE solo corre cuando cambia una stat/carga; nunca dentro del frame loop.
  function evaluate(stat, options) {
    if (online()) return Object.freeze([]);
    const local = ensureLocal(); if (!local) return Object.freeze([]);
    const candidates = stat ? catalog.byStat(stat) : catalog.list();
    const unlocked = new Set(local.unlocked);
    const added = [];
    candidates.forEach(function (title) {
      if (unlocked.has(title.id)) return;
      const value = stats.get(title.requirement.stat);
      if (!requirementMet(title.requirement, value)) return;
      unlocked.add(title.id); added.push(title.id);
    });
    if (!added.length) return Object.freeze([]);
    local.unlocked = Array.from(unlocked); persist();
    added.forEach(function (id) {
      const title = catalog.get(id);
      emit('title:unlocked', Object.freeze({ titleId: id, title: title, source: 'local-evaluator' }));
      if (!(options && options.silent)) notifyUnlock(title);
    });
    return Object.freeze(added.slice());
  }
  function getProgress(id) {
    const title = catalog.get(id);
    if (!title) return null;
    const current = Math.max(0, stats.get(title.requirement.stat));
    const goal = Math.max(0, Number(title.requirement.value) || 0);
    return Object.freeze({ titleId: title.id, stat: title.requirement.stat, current: current, goal: goal, ratio: goal ? Math.min(1, current / goal) : 1, unlocked: isUnlocked(title.id) });
  }

  async function equip(id) {
    const titleId = String(id || '');
    if (!catalog.get(titleId)) return Object.freeze({ ok: false, error: 'UNKNOWN_TITLE' });
    if (online()) {
      if (!root.KeloNetAuthority || !root.KeloNetAuthority.equipTitle) return Object.freeze({ ok: false, error: 'SERVER_AUTHORITY_UNAVAILABLE' });
      try { const snapshot = await root.KeloNetAuthority.equipTitle(titleId); ingestServerSnapshot(snapshot); emit('title:equipped', { titleId: titleId, source: 'server' }); return Object.freeze({ ok: true, titleId: titleId }); }
      catch (err) { return Object.freeze({ ok: false, error: String(err && err.message || err) }); }
    }
    const local = ensureLocal();
    if (!local || local.unlocked.indexOf(titleId) < 0) return Object.freeze({ ok: false, error: 'TITLE_LOCKED' });
    local.equippedTitleId = titleId; persist(); syncActor(); emit('title:equipped', { titleId: titleId, source: 'local' });
    return Object.freeze({ ok: true, titleId: titleId });
  }
  async function unequip() {
    if (online()) {
      if (!root.KeloNetAuthority || !root.KeloNetAuthority.unequipTitle) return Object.freeze({ ok: false, error: 'SERVER_AUTHORITY_UNAVAILABLE' });
      try { const snapshot = await root.KeloNetAuthority.unequipTitle(); ingestServerSnapshot(snapshot); emit('title:unequipped', { source: 'server' }); return Object.freeze({ ok: true }); }
      catch (err) { return Object.freeze({ ok: false, error: String(err && err.message || err) }); }
    }
    const local = ensureLocal(); if (!local) return Object.freeze({ ok: false, error: 'STATE_UNAVAILABLE' });
    local.equippedTitleId = null; persist(); syncActor(); emit('title:unequipped', { source: 'local' }); return Object.freeze({ ok: true });
  }

  function ingestServerSnapshot(snapshot) {
    if (!snapshot || snapshot.version !== 'server-titles-v1') return false;
    const before = new Set(serverSnapshot && Array.isArray(serverSnapshot.unlocked) ? serverSnapshot.unlocked : []);
    const normalized = {
      version: 'server-titles-v1', source: snapshot.source || 'server-authoritative',
      equippedTitleId: catalog.get(snapshot.equippedTitleId) ? snapshot.equippedTitleId : null,
      unlocked: Array.from(new Set((Array.isArray(snapshot.unlocked) ? snapshot.unlocked : []).filter(function (id) { return !!catalog.get(id); }))),
      progress: snapshot.progress && typeof snapshot.progress === 'object' ? snapshot.progress : {}
    };
    if (normalized.equippedTitleId && normalized.unlocked.indexOf(normalized.equippedTitleId) < 0) normalized.equippedTitleId = null;
    serverSnapshot = normalized;
    stats.ingestServerSnapshot(normalized.progress);
    syncActor();
    if (receivedServerSnapshot) normalized.unlocked.forEach(function (id) { if (!before.has(id)) notifyUnlock(catalog.get(id)); });
    receivedServerSnapshot = true;
    const visible = typeof document !== 'undefined' ? document.querySelector('#kelo-nobility [data-title-pane-content]') : null;
    if (visible) refreshPane(visible.closest('#kelo-nobility'));
    return true;
  }
  async function refresh() {
    if (!online() || !root.KeloNetAuthority || !root.KeloNetAuthority.getTitles) return null;
    try { const snapshot = await root.KeloNetAuthority.getTitles(); ingestServerSnapshot(snapshot); return snapshot; } catch (e) { return null; }
  }

  function escapeHtml(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, function (c) { return ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]; }); }
  function rarityLabel(r) { return ({ common:'Común', uncommon:'Poco común', rare:'Raro', epic:'Épico', legendary:'Legendario', mythic:'Mítico' })[r] || r; }
  function card(title) {
    const p = getProgress(title.id), unlocked = p.unlocked, equipped = getEquipped() === title.id;
    const percent = Math.round(p.ratio * 100);
    return '<article class="title-card rarity-' + escapeHtml(title.rarity) + (unlocked ? ' unlocked' : ' locked') + '">' +
      '<div class="title-card-top"><div><strong>《' + escapeHtml(title.name) + '》</strong><small>PvP · ' + escapeHtml(rarityLabel(title.rarity)) + '</small></div><span>' + (unlocked ? '✓' : '🔒') + '</span></div>' +
      '<p>' + escapeHtml(title.description) + '</p>' +
      '<div class="title-progress"><i style="width:' + percent + '%"></i></div><div class="title-progress-label"><span>' + p.current.toLocaleString('es-ES') + '</span><b>/ ' + p.goal.toLocaleString('es-ES') + '</b></div>' +
      (equipped ? '<button type="button" class="title-action equipped" data-title-unequip>Equipado · quitar</button>' : unlocked ? '<button type="button" class="title-action" data-title-equip="' + escapeHtml(title.id) + '">Equipar</button>' : '<button type="button" class="title-action" disabled>Bloqueado</button>') +
      '</article>';
  }
  function renderNobilityPane() {
    const equippedId = getEquipped(), equipped = equippedId && catalog.get(equippedId);
    const unlocked = catalog.list().filter(function (t) { return isUnlocked(t.id); });
    const locked = catalog.list().filter(function (t) { return !isUnlocked(t.id); });
    return '<div data-title-pane-content class="titles-pane">' +
      '<div class="titles-equipped"><span>Título equipado</span><strong>' + (equipped ? '《' + escapeHtml(equipped.name) + '》' : 'Ninguno') + '</strong>' +
      (equipped ? '<button type="button" data-title-unequip>Desequipar</button>' : '<small>Puedes mostrar un título desbloqueado bajo tu nombre.</small>') + '</div>' +
      '<h4>Desbloqueados</h4>' + (unlocked.length ? unlocked.map(card).join('') : '<div class="nob-empty">Todavía no has desbloqueado títulos.</div>') +
      '<h4>Por desbloquear</h4>' + (locked.length ? locked.map(card).join('') : '<div class="nob-empty">Has desbloqueado todos los títulos disponibles.</div>') +
      '<p class="nob-note">Las bajas válidas de Mundo Abierto se cuentan desde gameplay confirmado. NPCs, dummies, entrenamiento y arena no avanzan este progreso.</p></div>';
  }
  function refreshPane(rootEl) {
    if (!rootEl) return;
    const current = rootEl.querySelector('[data-title-pane-content]');
    if (!current) return;
    const holder = document.createElement('div'); holder.innerHTML = renderNobilityPane();
    current.replaceWith(holder.firstElementChild); bindNobilityPane(rootEl);
  }
  function bindNobilityPane(rootEl) {
    if (!rootEl) return;
    rootEl.querySelectorAll('[data-title-equip]').forEach(function (button) {
      if (button.dataset.boundTitle === '1') return; button.dataset.boundTitle = '1';
      button.addEventListener('click', async function () {
        button.disabled = true; const result = await equip(button.dataset.titleEquip);
        if (!result.ok && typeof showToast === 'function') showToast(result.error === 'TITLE_LOCKED' ? 'Título bloqueado' : 'No se pudo equipar el título');
        refreshPane(rootEl);
      });
    });
    rootEl.querySelectorAll('[data-title-unequip]').forEach(function (button) {
      if (button.dataset.boundTitle === '1') return; button.dataset.boundTitle = '1';
      button.addEventListener('click', async function () { button.disabled = true; await unequip(); refreshPane(rootEl); });
    });
  }
  function installStyle() {
    if (typeof document === 'undefined' || document.getElementById('kelo-title-style')) return;
    const style = document.createElement('style'); style.id = 'kelo-title-style'; style.textContent = `
      .titles-pane{display:grid;gap:8px;padding-bottom:10px}.titles-pane h4{margin:8px 2px 2px;color:#d8c17c;font:800 11px Georgia,serif;text-transform:uppercase;letter-spacing:.09em}
      .titles-equipped{display:grid;gap:6px;text-align:center;padding:13px;border:1px solid rgba(231,197,106,.35);border-radius:12px;background:radial-gradient(circle at 50% 0,rgba(231,197,106,.12),rgba(255,255,255,.02))}.titles-equipped>span,.titles-equipped small{color:#87949f;font-size:9px}.titles-equipped strong{font:800 20px Georgia,serif;color:#f1d278}.titles-equipped button,.title-action{min-height:38px;border:1px solid #8b6a2d;border-radius:9px;background:linear-gradient(#493819,#261d0d);color:#f4d47e;font-weight:850}.title-card{display:grid;gap:7px;padding:10px;border:1px solid #34414c;border-radius:11px;background:rgba(255,255,255,.025)}.title-card.locked{opacity:.72}.title-card-top{display:flex;justify-content:space-between;gap:10px;align-items:center}.title-card-top strong{font:800 15px Georgia,serif}.title-card-top small{display:block;margin-top:2px;color:#8896a1;font-size:9px}.title-card p{margin:0;color:#aeb8c0;font-size:10px;line-height:1.4}.title-progress{height:5px;border-radius:99px;background:#151d24;overflow:hidden}.title-progress i{display:block;height:100%;background:linear-gradient(90deg,#8f6b27,#f0cf72)}.title-progress-label{display:flex;justify-content:flex-end;gap:4px;color:#8e9aa5;font-size:9px}.title-progress-label span{color:#e8cb78}.title-action:disabled{border-color:#333;background:#171d22;color:#6f7a83}.title-action.equipped{border-color:#627d67;background:#17241b;color:#a9deb2}
      .rarity-common strong{color:#d5dde3}.rarity-uncommon strong{color:#9edca8}.rarity-rare strong{color:#8bc5ff}.rarity-epic strong{color:#cf9cff}.rarity-legendary strong{color:#ffd36a}.rarity-mythic strong{color:#ff9f8f}
      #kelo-title-unlock-toast{position:fixed;left:50%;top:max(72px,calc(env(safe-area-inset-top) + 64px));z-index:420;width:min(360px,calc(100vw - 28px));transform:translate(-50%,-12px) scale(.97);opacity:0;pointer-events:none;display:grid;gap:3px;text-align:center;padding:14px 18px;border:1px solid rgba(231,197,106,.66);border-radius:14px;background:linear-gradient(180deg,rgba(28,24,14,.98),rgba(9,13,17,.98));box-shadow:0 16px 50px rgba(0,0,0,.55);transition:.24s ease}#kelo-title-unlock-toast.show{opacity:1;transform:translate(-50%,0) scale(1)}#kelo-title-unlock-toast small{font-size:9px;letter-spacing:.13em;color:#bca86d}#kelo-title-unlock-toast strong{font:900 21px Georgia,serif}#kelo-title-unlock-toast span{font-size:10px;color:#aeb9bf}
    `; document.head.appendChild(style);
  }

  ensureLocal(); installStyle(); evaluate(null, { silent: true }); syncActor();
  if (root.KeloEvents && root.KeloEvents.on) root.KeloEvents.on(stats.event || 'player:stat_changed', function (payload) { if (payload && payload.stat) evaluate(payload.stat); });

  root.KeloTitles = Object.freeze({
    version: VERSION,
    getCatalog: catalog.list,
    getTitle: catalog.get,
    getUnlocked: getUnlocked,
    isUnlocked: isUnlocked,
    getProgress: getProgress,
    getEquipped: getEquipped,
    equip: equip,
    unequip: unequip,
    ingestServerSnapshot: ingestServerSnapshot,
    evaluate: evaluate,
    refresh: refresh,
    renderNobilityPane: renderNobilityPane,
    bindNobilityPane: bindNobilityPane,
    isAuthoritative: function () { return !!(online() && serverSnapshot); }
  });
  root.KELO_TITLES_AUDIT = Object.freeze({ version: VERSION, ready: true, catalogSize: catalog.list().length, indexedByStat: true, frameEvaluation: false, onlineClientUnlock: false, onlinePreSnapshotFailClosed: true });
})(typeof globalThis !== 'undefined' ? globalThis : window);
