/* KELO-INDEX
 * area: UI
 * owner: KeloUpdaterUI
 * keys: UPDATE PWA IPHONE BANNER SAFEAREA
 * purpose: muestra una acción táctil cuando KeloUpdater detecta una build nueva y delega la actualización al owner
 * public-api: window.KeloUpdaterUI.show(), hide()
 * consumes: KeloUpdater + eventos kelo:update:*
 * state-owned: visibilidad y estado visual del banner; no posee la versión ni estado gameplay
 * extension-points: futura presentación de update obligatorio/changelog
 * reuse: superficie única de actualización del cliente instalado
 * legacy: N/A
 * do-not: no decidir builds ni escribir estado de KeloUpdater
 */
(function initKeloUpdaterUI(global) {
  'use strict';

  if (global.KeloUpdaterUI) return;

  let root = null;
  let buildLabel = null;
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
      #kelo-update-copy{min-width:0;flex:1}
      #kelo-update-title{font-size:13px;font-weight:900;line-height:1.2;color:#f5dda0}
      #kelo-update-message{margin-top:3px;font-size:11px;line-height:1.25;color:#aabbb4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      #kelo-update-build{font-variant-numeric:tabular-nums}
      #kelo-update-action{appearance:none;-webkit-appearance:none;border:1px solid rgba(231,197,106,.7);border-radius:11px;min-height:42px;padding:0 14px;background:linear-gradient(180deg,#ead07f,#bd943c);color:#12100a;font-size:11px;font-weight:950;letter-spacing:.04em;touch-action:manipulation}
      #kelo-update-action:disabled{opacity:.62}
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
    root.innerHTML = `
      <div id="kelo-update-copy">
        <div id="kelo-update-title">Nueva versión de KELO WORLD</div>
        <div id="kelo-update-message">Build <span id="kelo-update-build">—</span> lista para instalar</div>
      </div>
      <button id="kelo-update-action" type="button">ACTUALIZAR</button>
    `;
    document.body.appendChild(root);

    buildLabel = root.querySelector('#kelo-update-build');
    message = root.querySelector('#kelo-update-message');
    button = root.querySelector('#kelo-update-action');

    root.addEventListener('pointerdown', (event) => event.stopPropagation());
    root.addEventListener('touchstart', (event) => event.stopPropagation(), { passive: true });
    button.addEventListener('click', async () => {
      if (!global.KeloUpdater) return;
      button.disabled = true;
      button.textContent = 'ACTUALIZANDO…';
      message.textContent = 'Cargando los archivos nuevos…';
      try {
        await global.KeloUpdater.applyUpdate();
      } catch (_) {
        button.disabled = false;
        button.textContent = 'REINTENTAR';
        message.textContent = 'No se pudo actualizar. Comprueba tu conexión.';
      }
    });

    return root;
  }

  function show(build) {
    const element = ensureUI();
    if (!element) return;
    if (buildLabel) buildLabel.textContent = shortBuild(build) || 'nueva';
    if (message) message.innerHTML = `Build <span id="kelo-update-build">${shortBuild(build) || 'nueva'}</span> lista para instalar`;
    buildLabel = root.querySelector('#kelo-update-build');
    if (button) {
      button.disabled = false;
      button.textContent = 'ACTUALIZAR';
    }
    element.dataset.visible = '1';
  }

  function hide() {
    if (root) root.dataset.visible = '0';
  }

  global.addEventListener('kelo:update:available', (event) => {
    show(event.detail && (event.detail.build || event.detail.availableBuild));
  });
  global.addEventListener('kelo:update:current', hide);
  global.addEventListener('kelo:update:applying', () => {
    ensureUI();
    if (button) {
      button.disabled = true;
      button.textContent = 'ACTUALIZANDO…';
    }
    if (message) message.textContent = 'Cargando los archivos nuevos…';
  });

  global.KeloUpdaterUI = Object.freeze({ show, hide });

  const initialState = global.KeloUpdater && global.KeloUpdater.getState();
  if (initialState && initialState.status === 'available') show(initialState.availableBuild);
})(window);
