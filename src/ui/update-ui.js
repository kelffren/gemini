/* KELO-INDEX
 * area: UI / UPDATES
 * owner: KeloUpdaterUI
 * keys: UPDATE PWA MENU QUEUE SILENT READY LATER
 * purpose: keep background updates silent and expose status/queue/actions only from Menu > Actualizaciones
 * public-api: KeloUpdaterUI.open(), close(), refresh(), show(), hide(), getQueue()
 * consumes: KeloUpdater + kelo:update:* events
 * state-owned: presentation + local queue history only; updater remains authority for builds/cache/apply
 * do-not: no floating download banner, no build authority, no gameplay state
 */
(function initKeloUpdaterUI(global) {
  'use strict';
  if (global.KeloUpdaterUI) return;

  const QUEUE_KEY = 'kelo.world.updateCenter.queue.v1';
  const MAX_QUEUE = 20;
  let root = null;
  let list = null;
  let status = null;
  let detail = null;
  let primary = null;
  let secondary = null;
  let checkButton = null;

  function shortBuild(build) { return String(build || '').slice(0, 7); }
  function readQueue() {
    try {
      const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed.slice(0, MAX_QUEUE) : [];
    } catch (_) { return []; }
  }
  function writeQueue(queue) {
    try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(0, MAX_QUEUE))); } catch (_) {}
  }
  function upsert(build, patch) {
    const id = String(build || '').trim();
    if (!id) return;
    const queue = readQueue();
    const index = queue.findIndex((item) => item && item.build === id);
    const current = index >= 0 ? queue[index] : { build:id, firstSeenAt:new Date().toISOString(), status:'detected' };
    const next = Object.assign({}, current, patch || {}, { build:id, updatedAt:new Date().toISOString() });
    if (index >= 0) queue.splice(index, 1);
    queue.unshift(next);
    writeQueue(queue);
    render();
  }
  function markInstalled(build) {
    const queue = readQueue().map((item) => {
      if (!item) return item;
      if (item.build === build || item.status === 'ready' || item.status === 'applying') {
        return Object.assign({}, item, { status:'installed', installedAt:new Date().toISOString() });
      }
      return item;
    });
    writeQueue(queue);
    render();
  }

  function ensureStyles() {
    if (document.getElementById('kelo-update-center-style')) return;
    const style = document.createElement('style');
    style.id = 'kelo-update-center-style';
    style.textContent = `
#kelo-update-center{display:none;position:fixed;inset:0;z-index:2147482500;background:rgba(3,8,11,.72);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);padding:max(14px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) max(14px,env(safe-area-inset-bottom)) max(12px,env(safe-area-inset-left));font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#fff4d6;pointer-events:auto}
#kelo-update-center[data-open="1"]{display:flex;align-items:center;justify-content:center}
.ku-card{width:min(560px,100%);max-height:min(760px,100%);display:flex;flex-direction:column;overflow:hidden;border-radius:24px;border:1px solid rgba(231,197,106,.6);background:linear-gradient(155deg,rgba(9,22,23,.985),rgba(4,11,14,.995));box-shadow:0 28px 80px rgba(0,0,0,.58),inset 0 0 0 1px rgba(255,255,255,.035)}
.ku-head{display:flex;align-items:center;gap:10px;padding:16px 16px 13px;border-bottom:1px solid rgba(231,197,106,.16)}.ku-back{width:42px;height:42px;border-radius:13px;border:1px solid rgba(231,197,106,.38);background:#101c1e;color:#f4dc95;font-size:21px}.ku-title{flex:1;min-width:0}.ku-title b{display:block;font:850 20px/1.1 Georgia,serif;color:#f0d27d}.ku-title small{display:block;margin-top:4px;color:#849a92;font-size:11px}.ku-check{min-height:42px;padding:0 12px;border-radius:12px;border:1px solid rgba(231,197,106,.42);background:#142723;color:#e8cf86;font-weight:850;font-size:11px}
.ku-body{overflow:auto;-webkit-overflow-scrolling:touch;padding:14px 15px 16px}.ku-state{padding:14px;border:1px solid rgba(231,197,106,.2);border-radius:17px;background:rgba(18,46,39,.38)}.ku-state strong{display:block;font-size:15px;color:#fff7e4}.ku-state p{margin:5px 0 0;color:#9db0a9;font-size:12px;line-height:1.4}.ku-actions{display:none;grid-template-columns:1fr 1fr;gap:9px;margin-top:11px}.ku-actions[data-visible="1"]{display:grid}.ku-primary,.ku-secondary{min-height:48px;border-radius:14px;font-weight:900;font-size:12px}.ku-primary{border:1px solid rgba(231,197,106,.8);background:linear-gradient(180deg,#ead07f,#bd943c);color:#161109}.ku-secondary{border:1px solid rgba(231,197,106,.3);background:#101d20;color:#e9d28d}.ku-primary:disabled{opacity:.58}
.ku-section{margin-top:17px}.ku-section h3{margin:0 0 9px;font:800 13px/1 Georgia,serif;color:#dabe72;letter-spacing:.05em}.ku-list{display:flex;flex-direction:column;gap:7px}.ku-empty{padding:13px;border-radius:13px;background:rgba(255,255,255,.025);color:#82958f;font-size:11px}.ku-row{display:grid;grid-template-columns:10px minmax(0,1fr) auto;gap:10px;align-items:center;padding:11px;border-radius:14px;border:1px solid rgba(255,255,255,.055);background:rgba(255,255,255,.022)}.ku-dot{width:9px;height:9px;border-radius:50%;background:#61716d}.ku-row[data-status="ready"] .ku-dot{background:#e7c56a;box-shadow:0 0 10px rgba(231,197,106,.4)}.ku-row[data-status="installed"] .ku-dot{background:#75cf91}.ku-row[data-status="downloading"] .ku-dot,.ku-row[data-status="detected"] .ku-dot{background:#73a8d4}.ku-row[data-status="paused"] .ku-dot{background:#d6a45a}.ku-copy{min-width:0}.ku-copy b{display:block;color:#edf3ef;font-size:12px}.ku-copy small{display:block;margin-top:3px;color:#7f918b;font-size:10px}.ku-badge{padding:5px 7px;border-radius:999px;background:rgba(231,197,106,.08);color:#bba663;font-size:9px;font-weight:800}
.ku-note{margin-top:12px;padding:11px 12px;border-radius:13px;background:rgba(231,197,106,.055);color:#8fa19a;font-size:10px;line-height:1.45}
@media(max-width:420px){.ku-card{border-radius:20px}.ku-head{padding:13px 12px 11px}.ku-body{padding:12px}.ku-actions{grid-template-columns:1fr}.ku-title b{font-size:18px}}
`;
    document.head.appendChild(style);
  }

  function ensureUI() {
    if (root) return root;
    if (!document.body) return null;
    ensureStyles();
    root = document.createElement('section');
    root.id = 'kelo-update-center';
    root.setAttribute('aria-hidden', 'true');
    root.innerHTML = `<div class="ku-card" role="dialog" aria-modal="true" aria-labelledby="ku-title">
      <div class="ku-head"><button class="ku-back" type="button" aria-label="Volver al menú">‹</button><div class="ku-title"><b id="ku-title">Actualizaciones</b><small>KELO WORLD · Turbo Update</small></div><button class="ku-check" type="button">COMPROBAR</button></div>
      <div class="ku-body"><div class="ku-state"><strong id="ku-status">Todo actualizado</strong><p id="ku-detail">No hay una actualización lista pendiente.</p><div class="ku-actions"><button class="ku-primary" type="button">ACTUALIZAR AHORA</button><button class="ku-secondary" type="button">DEJAR PARA LUEGO</button></div></div>
      <div class="ku-section"><h3>COLA DE ACTUALIZACIONES</h3><div class="ku-list"></div></div>
      <div class="ku-note">Si se acumulan varias versiones, KELO WORLD activa directamente la más reciente. Esa build ya contiene las anteriores y reutiliza los archivos descargados, evitando reinstalar cinco veces lo mismo.</div></div></div>`;
    document.body.appendChild(root);
    list = root.querySelector('.ku-list'); status = root.querySelector('#ku-status'); detail = root.querySelector('#ku-detail');
    primary = root.querySelector('.ku-primary'); secondary = root.querySelector('.ku-secondary'); checkButton = root.querySelector('.ku-check');
    root.querySelector('.ku-back').addEventListener('click', () => close(true));
    secondary.addEventListener('click', () => close(true));
    checkButton.addEventListener('click', refresh);
    primary.addEventListener('click', applyLatest);
    root.addEventListener('pointerdown', (event) => event.stopPropagation());
    render();
    return root;
  }

  function labelFor(item) {
    const map = { detected:'Detectada', downloading:'Descargando', paused:'En pausa', ready:'Lista', applying:'Aplicando', installed:'Instalada', error:'Error' };
    return map[item && item.status] || 'Pendiente';
  }
  function renderQueue() {
    if (!list) return;
    const queue = readQueue();
    if (!queue.length) { list.innerHTML = '<div class="ku-empty">Todavía no hay actualizaciones en la cola.</div>'; return; }
    list.innerHTML = queue.map((item) => {
      const bytes = Number(item.deltaBytes);
      const meta = Number.isFinite(bytes) && bytes > 0 ? `${Math.round(bytes / 1024)} KB delta` : (item.status === 'installed' ? 'Aplicada correctamente' : 'Bytes reutilizados cuando sea posible');
      return `<div class="ku-row" data-status="${item.status || 'detected'}"><span class="ku-dot"></span><span class="ku-copy"><b>Build ${shortBuild(item.build)}</b><small>${meta}</small></span><span class="ku-badge">${labelFor(item)}</span></div>`;
    }).join('');
  }
  function render() {
    if (!root) return;
    const state = global.KeloUpdater && global.KeloUpdater.getState ? global.KeloUpdater.getState() : null;
    const stage = state && state.stage || {};
    const ready = !!(state && state.status === 'ready');
    const actions = root.querySelector('.ku-actions');
    if (!state) {
      status.textContent = 'Updater iniciando'; detail.textContent = 'El sistema de actualizaciones todavía está cargando.';
    } else if (ready) {
      const queued = readQueue().filter((item) => item.status === 'ready').length;
      status.textContent = 'Actualización lista';
      detail.textContent = `${queued > 1 ? queued + ' builds acumuladas. ' : ''}Puedes actualizar ahora o seguir jugando y dejarlo para luego.`;
    } else if (state.status === 'preparing') {
      status.textContent = stage.status === 'paused' ? 'Actualización en pausa' : 'Descargando en segundo plano';
      detail.textContent = stage.status === 'paused' ? 'KELO WORLD continuará automáticamente cuando la red/gameplay lo permita.' : 'Puedes seguir jugando. No necesitas mantener esta pantalla abierta.';
    } else if (state.status === 'available') {
      status.textContent = stage.status === 'error' ? 'No se pudo preparar la actualización' : 'Actualización detectada';
      detail.textContent = stage.status === 'error' ? 'Se reintentará sin interrumpir el juego.' : 'La descarga silenciosa comenzará cuando sea seguro.';
    } else {
      status.textContent = 'Todo actualizado'; detail.textContent = `Build actual ${shortBuild(state.installedBuild) || 'activa'} · sin actualización lista pendiente.`;
    }
    actions.dataset.visible = ready ? '1' : '0';
    primary.disabled = !ready;
    renderQueue();
  }

  async function refresh() {
    ensureUI();
    if (!global.KeloUpdater || typeof global.KeloUpdater.check !== 'function') return;
    checkButton.disabled = true; checkButton.textContent = 'COMPROBANDO…';
    try { await global.KeloUpdater.check({ force:true }); } catch (_) {}
    checkButton.disabled = false; checkButton.textContent = 'COMPROBAR'; render();
  }
  async function applyLatest() {
    if (!global.KeloUpdater || typeof global.KeloUpdater.applyUpdate !== 'function') return;
    const state = global.KeloUpdater.getState ? global.KeloUpdater.getState() : null;
    const build = state && (state.availableBuild || state.stage && state.stage.build);
    if (build) upsert(build, { status:'applying' });
    primary.disabled = true; primary.textContent = 'ACTUALIZANDO…';
    try { await global.KeloUpdater.applyUpdate(); }
    catch (_) { if (build) upsert(build, { status:'error' }); primary.disabled = false; primary.textContent = 'REINTENTAR'; render(); }
  }
  function open() { const el = ensureUI(); if (!el) return; el.dataset.open = '1'; el.setAttribute('aria-hidden', 'false'); render(); }
  function close(returnToMenu) { if (root) { root.dataset.open = '0'; root.setAttribute('aria-hidden', 'true'); } if (returnToMenu && global.KELO_LUXE && typeof global.KELO_LUXE.toggleMenu === 'function') global.KELO_LUXE.toggleMenu(true); }
  function show() { open(); }
  function hide() { close(false); }

  function buildFrom(detail) { return detail && (detail.build || detail.availableBuild || detail.stage && detail.stage.build); }
  global.addEventListener('kelo:update:available', (event) => { const d=event.detail||{}; upsert(buildFrom(d), { status:'detected' }); render(); });
  global.addEventListener('kelo:update:staging', (event) => { const d=event.detail||{}; upsert(buildFrom(d), { status:'downloading' }); render(); });
  global.addEventListener('kelo:update:staging-progress', (event) => { const d=event.detail||{}; upsert(buildFrom(d), { status:'downloading', deltaBytes:Number(d.deltaBytes)||undefined, percent:Number(d.percent)||0 }); render(); });
  global.addEventListener('kelo:update:staging-paused', (event) => { const d=event.detail||{}; upsert(buildFrom(d), { status:'paused' }); render(); });
  global.addEventListener('kelo:update:staging-resumed', (event) => { const d=event.detail||{}; upsert(buildFrom(d), { status:'downloading' }); render(); });
  global.addEventListener('kelo:update:staged', (event) => { const d=event.detail||{}; upsert(buildFrom(d), { status:'ready', deltaBytes:Number(d.deltaBytes)||undefined, timeToReadyMs:Number(d.timeToReadyMs)||undefined }); render(); });
  global.addEventListener('kelo:update:staging-error', (event) => { const d=event.detail||{}; upsert(buildFrom(d), { status:'error' }); render(); });
  global.addEventListener('kelo:update:applying', (event) => { const d=event.detail||{}; upsert(buildFrom(d), { status:'applying' }); render(); });
  global.addEventListener('kelo:update:current', (event) => { const d=event.detail||{}; const state=global.KeloUpdater&&global.KeloUpdater.getState?global.KeloUpdater.getState():null; markInstalled(buildFrom(d) || state && state.installedBuild); });

  global.KeloUpdaterUI = Object.freeze({ open, close, refresh, show, hide, getQueue:readQueue });
})(window);
