/* KELO-INDEX
 * area: UI
 * owner: KeloUpdaterUI
 * keys: UPDATE PWA IPHONE BANNER SAFEAREA STAGING PING NETWORK
 * purpose: muestra progreso discreto de precarga, pausas por red y la acción ACTUALIZAR solo cuando la build está lista
 * public-api: window.KeloUpdaterUI.show(), hide()
 * consumes: KeloUpdater + eventos kelo:update:*
 * state-owned: visibilidad y estado visual del banner; no posee versión, caché ni estado gameplay
 * extension-points: futura presentación de update obligatorio/changelog
 * reuse: superficie única de actualización del cliente instalado
 * legacy: N/A
 * do-not: no decidir builds ni escribir estado de KeloUpdater
 */
(function initKeloUpdaterUI(global) {
  'use strict';

  if (global.KeloUpdaterUI) return;

  let root = null;
  let title = null;
  let message = null;
  let button = null;

  function shortBuild(build) {
    return String(build || '').slice(0, 7);
  }

  function ensureStyles() {
    if (document.getElementById('kelo-updater-style')) return;
    const style = document.createElement('style');
    style.id = 'kelo-updater-style';
    style.textContent = `
      #kelo-update-banner{position:fixed;left:50%;bottom:calc(14px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:2147483000;width:min(430px,calc(100vw - 24px));display:none;align-items:center;gap:12px;padding:12px 12px 12px 14px;border:1px solid rgba(231,197,106,.42);border-radius:16px;background:rgba(8,17,21,.96);box-shadow:0 14px 42px rgba(0,0,0,.48);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);color:#eef3ef;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:auto}
      #kelo-update-banner[data-visible="1"]{display:flex}
      #kelo-update-banner[data-mode="preparing"],#kelo-update-banner[data-mode="paused"]{width:min(390px,calc(100vw - 30px));padding:9px 12px;border-color:rgba(231,197,106,.26);background:rgba(8,17,21,.91)}
      #kelo-update-copy{min-width:0;flex:1}
      #kelo-update-title{font-size:13px;font-weight:900;line-height:1.2;color:#f5dda0}
      #kelo-update-banner[data-mode="preparing"] #kelo-update-title,#kelo-update-banner[data-mode="paused"] #kelo-update-title{font-size:11px;color:#d8dfdc}
      #kelo-update-message{margin-top:3px;font-size:11px;line-height:1.25;color:#aabbb4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #kelo-update-action{appearance:none;-webkit-appearance:none;border:1px solid rgba(231,197,106,.7);border-radius:11px;min-height:42px;padding:0 14px;background:linear-gradient(180deg,#ead07f,#bd943c);color:#12100a;font-size:11px;font-weight:950;letter-spacing:.04em;touch-action:manipulation}
      #kelo-update-action:disabled{opacity:.62}
      #kelo-update-banner[data-mode="preparing"] #kelo-update-action,#kelo-update-banner[data-mode="paused"] #kelo-update-action{display:none}
      @media(max-width:420px){#kelo-update-banner{gap:9px;padding:10px 10px 10px 12px}#kelo-update-action{padding:0 11px}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    if (root) return root;
    if (!document.body) return null;

    ensureStyles();
    root = document.createElement('div');
    root.id = 'kelo-update-banner';
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.dataset.mode = 'preparing';
    root.innerHTML = `
      <div id="kelo-update-copy">
        <div id="kelo-update-title">Actualización en segundo plano</div>
        <div id="kelo-update-message">Comprobando conexión…</div>
      </div>
      <button id="kelo-update-action" type="button">ACTUALIZAR</button>
    `;
    document.body.appendChild(root);

    title = root.querySelector('#kelo-update-title');
    message = root.querySelector('#kelo-update-message');
    button = root.querySelector('#kelo-update-action');

    root.addEventListener('pointerdown', (event) => event.stopPropagation());
    root.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
    button.addEventListener('click', async () => {
      if (!global.KeloUpdater) return;
      button.disabled = true;
      button.textContent = 'ACTUALIZANDO…';
      if (message) message.textContent = 'Activando los archivos ya descargados…';
      try {
        await global.KeloUpdater.applyUpdate();
      } catch (_) {
        button.disabled = false;
        button.textContent = 'REINTENTAR';
        if (message) message.textContent = 'No se pudo activar. Comprueba tu conexión.';
      }
    });

    return root;
  }

  function setVisible(visible) {
    const element = ensureUI();
    if (element) element.dataset.visible = visible ? '1' : '0';
  }

  function networkSuffix(detail) {
    const ping = Number(detail && (detail.pingMs != null ? detail.pingMs : detail.network && detail.network.pingMs));
    return Number.isFinite(ping) ? ` · ${Math.round(ping)} ms` : '';
  }

  function pauseReason(reason) {
    switch (String(reason || '')) {
      case 'gameplay-priority': return 'priorizando PVP y gameplay';
      case 'offline': return 'sin conexión';
      case 'background': return 'app en segundo plano';
      case 'save-data': return 'Ahorro de Datos activado';
      case 'slow-network': return 'red móvil demasiado lenta';
      case 'low-throughput': return 'velocidad de descarga baja';
      case 'timeout': return 'conexión inestable';
      case 'latency':
      case 'latency-recovery': return 'ping alto';
      case 'download-failed':
      case 'probe-failed': return 'conexión inestable';
      default: return 'esperando una conexión estable';
    }
  }

  function showPreparing(detail) {
    const element = ensureUI();
    if (!element) return;
    const completed = Number(detail && detail.completed) || 0;
    const total = Number(detail && detail.total) || 0;
    const percent = Number.isFinite(Number(detail && detail.percent))
      ? Math.max(0, Math.min(100, Math.round(Number(detail.percent))))
      : (total ? Math.round((completed / total) * 100) : 0);

    element.dataset.mode = 'preparing';
    if (title) title.textContent = 'Actualización en segundo plano';
    if (message) {
      message.textContent = total
        ? `Preparando ${percent}% (${completed}/${total})${networkSuffix(detail)}`
        : `Evaluando la red${networkSuffix(detail)}`;
    }
    if (button) {
      button.disabled = true;
      button.textContent = 'ACTUALIZAR';
    }
    setVisible(true);
  }

  function showPaused(detail) {
    const element = ensureUI();
    if (!element) return;
    const reason = detail && (detail.reason || detail.network && detail.network.reason);
    element.dataset.mode = 'paused';
    if (title) title.textContent = 'Actualización pausada';
    if (message) message.textContent = `${pauseReason(reason)}${networkSuffix(detail)}`;
    if (button) button.disabled = true;
    setVisible(true);
  }

  function showReady(build) {
    const element = ensureUI();
    if (!element) return;
    element.dataset.mode = 'ready';
    if (title) title.textContent = 'Nueva versión lista';
    if (message) message.textContent = `Descargada sin interrumpir el juego · Build ${shortBuild(build) || 'nueva'}`;
    if (button) {
      button.style.display = '';
      button.disabled = false;
      button.textContent = 'ACTUALIZAR';
    }
    setVisible(true);
  }

  function showFallback(build) {
    const element = ensureUI();
    if (!element) return;
    element.dataset.mode = 'ready';
    if (title) title.textContent = 'Nueva versión de KELO WORLD';
    if (message) message.textContent = `Build ${shortBuild(build) || 'nueva'} lista para descargar`;
    if (button) {
      button.disabled = false;
      button.textContent = 'ACTUALIZAR';
    }
    setVisible(true);
  }

  function show(build) {
    showReady(build);
  }

  function hide() {
    if (root) root.dataset.visible = '0';
  }

  global.addEventListener('kelo:update:available', (event) => {
    const detail = event.detail || {};
    showPreparing({ completed: 0, total: 0, pingMs: detail.network && detail.network.pingMs });
  });
  global.addEventListener('kelo:update:staging', (event) => showPreparing(event.detail || {}));
  global.addEventListener('kelo:update:staging-progress', (event) => showPreparing(event.detail || {}));
  global.addEventListener('kelo:update:staging-resumed', (event) => showPreparing(event.detail || {}));
  global.addEventListener('kelo:update:staging-paused', (event) => showPaused(event.detail || {}));
  global.addEventListener('kelo:update:staged', (event) => {
    const detail = event.detail || {};
    showReady(detail.build || detail.availableBuild);
  });
  global.addEventListener('kelo:update:staging-unsupported', (event) => {
    const detail = event.detail || {};
    showFallback(detail.build || detail.availableBuild);
  });
  global.addEventListener('kelo:update:staging-error', (event) => {
    const detail = event.detail || {};
    showPaused({ reason: 'download-failed', pingMs: detail.network && detail.network.pingMs });
  });
  global.addEventListener('kelo:update:current', hide);
  global.addEventListener('kelo:update:applying', () => {
    ensureUI();
    if (root) root.dataset.mode = 'ready';
    if (title) title.textContent = 'Aplicando actualización';
    if (button) {
      button.style.display = '';
      button.disabled = true;
      button.textContent = 'ACTUALIZANDO…';
    }
    if (message) message.textContent = 'Activando los archivos ya descargados…';
    setVisible(true);
  });

  global.KeloUpdaterUI = Object.freeze({ show, hide });

  const initialState = global.KeloUpdater && global.KeloUpdater.getState();
  if (initialState) {
    if (initialState.status === 'ready') showReady(initialState.availableBuild || initialState.stage && initialState.stage.build);
    else if (initialState.status === 'preparing') showPreparing(initialState.stage || {});
    else if (initialState.status === 'available' && initialState.stage && initialState.stage.status === 'unsupported') showFallback(initialState.availableBuild);
  }
})(window);
