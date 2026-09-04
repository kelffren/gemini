(function () {
  const CLOSE_ID = 'kelo-profile-close';

  function closeProfilePanel() {
    const sheet = document.getElementById('inspect-sheet');
    if (typeof window.closeInspect === 'function') {
      window.closeInspect();
    } else if (sheet) {
      sheet.style.display = 'none';
    }
  }

  function hideLegacyClose(sheet) {
    const legacy = sheet.querySelector('#inspect-body [onclick="closeInspect()"]');
    if (legacy) legacy.style.display = 'none';
  }

  function ensureCloseButton() {
    const sheet = document.getElementById('inspect-sheet');
    if (!sheet) return null;

    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-modal', 'true');
    hideLegacyClose(sheet);

    let button = document.getElementById(CLOSE_ID);
    if (!button) {
      button = document.createElement('button');
      button.id = CLOSE_ID;
      button.type = 'button';
      button.textContent = '×';
      button.setAttribute('aria-label', 'Cerrar personaje');
      button.style.cssText = [
        'position:absolute',
        'top:8px',
        'right:8px',
        'width:44px',
        'height:44px',
        'display:grid',
        'place-items:center',
        'z-index:5',
        'border:1px solid rgba(231,197,106,.65)',
        'border-radius:10px',
        'background:rgba(76,22,22,.96)',
        'color:#f5e7bf',
        'font-size:28px',
        'font-weight:800',
        'line-height:1',
        'cursor:pointer',
        'pointer-events:auto',
        'touch-action:manipulation',
        'box-shadow:0 6px 18px rgba(0,0,0,.35)'
      ].join(';');
      button.addEventListener('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        closeProfilePanel();
      });
      sheet.appendChild(button);
    }
    return button;
  }

  function wrapInspectPlayer() {
    const original = window.inspectPlayer;
    if (typeof original !== 'function' || original.__keloProfileCloseWrapped) return;

    function wrappedInspectPlayer() {
      const result = original.apply(this, arguments);
      ensureCloseButton();
      return result;
    }
    wrappedInspectPlayer.__keloProfileCloseWrapped = true;
    window.inspectPlayer = wrappedInspectPlayer;
  }

  function boot() {
    ensureCloseButton();
    wrapInspectPlayer();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.KELO_PROFILE_CLOSE_AUDIT = Object.freeze({
    version: 'profile-close-v1.0.1',
    closeButtonId: CLOSE_ID,
    minTouchTargetPx: 44,
    tapClose: true,
    legacyCloseHidden: true
  });
})();
