/* KELO-INDEX
 * area: UI / BOOT
 * owner: profile/runtime bootstrap bridge
 * keys: PROFILE CLOSE CHARACTER CUSTOMIZER BOOT FOUNDATION
 * purpose: conserva el cierre del perfil legacy y carga en orden las foundations dinámicas del Character Creator
 * public-api: KELO_PROFILE_CLOSE_AUDIT
 * consumes: kelo-runtime-bootstrap + módulos de CharacterCustomization
 * state-owned: ninguno salvo DOM del botón close legacy
 * extension-points: cambiar versiones/orden solo cuando el contrato real lo requiera
 * reuse: late boot del creador sin duplicar scripts ya cargados
 * legacy: wrapInspectPlayer sigue siendo adapter temporal del sheet histórico
 * do-not: NO poseer estado del personaje ni input
 */
(function () {
  'use strict';
  const CLOSE_ID = 'kelo-profile-close';
  const FOUNDATION_SCRIPTS = [
    'src/core/kelo-runtime-bootstrap.js?v=1'
  ];
  const CUSTOMIZATION_SCRIPTS = [
    'src/characters/character-slot-schema.js?v=2',
    'src/characters/character-customization.js?v=6',
    'src/characters/character-visual-presets.js?v=3',
    'src/characters/character-content-packs.js?v=2',
    'src/characters/character-visual-stack.js?v=3',
    'src/characters/character-demo-kit.js?v=3',
    'src/ui/character-customizer-ui.js?v=3',
    'src/ui/character-customizer-preview.js?v=3'
  ];
  const BOOT_SCRIPTS = FOUNDATION_SCRIPTS.concat(CUSTOMIZATION_SCRIPTS);

  function closeProfilePanel() {
    const sheet = document.getElementById('inspect-sheet');
    if (typeof window.closeInspect === 'function') window.closeInspect();
    else if (sheet) sheet.style.display = 'none';
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
        'position:absolute','top:8px','right:8px','width:44px','height:44px','display:grid','place-items:center','z-index:5',
        'border:1px solid rgba(231,197,106,.65)','border-radius:10px','background:rgba(76,22,22,.96)','color:#f5e7bf',
        'font-size:28px','font-weight:800','line-height:1','cursor:pointer','pointer-events:auto','touch-action:manipulation',
        'box-shadow:0 6px 18px rgba(0,0,0,.35)'
      ].join(';');
      button.addEventListener('click', function (event) { event.preventDefault();event.stopPropagation();closeProfilePanel(); });
      sheet.appendChild(button);
    }
    return button;
  }

  function wrapInspectPlayer() {
    const original = window.inspectPlayer;
    if (typeof original !== 'function' || original.__keloProfileCloseWrapped) return;
    function wrappedInspectPlayer() { const result = original.apply(this, arguments);ensureCloseButton();return result; }
    wrappedInspectPlayer.__keloProfileCloseWrapped = true;
    window.inspectPlayer = wrappedInspectPlayer;
  }

  function loadScriptSequentially(index) {
    if (index >= BOOT_SCRIPTS.length) return;
    const src = BOOT_SCRIPTS[index], base = src.split('?')[0];
    if (Array.from(document.scripts).some(function (s) { return (s.getAttribute('src') || '').split('?')[0] === base; })) {
      loadScriptSequentially(index + 1);return;
    }
    const script = document.createElement('script');
    script.src = src;script.async = false;
    script.dataset.keloRuntimeBootstrap = FOUNDATION_SCRIPTS.indexOf(src) >= 0 ? 'foundation' : 'character';
    script.onload = function () { loadScriptSequentially(index + 1); };
    script.onerror = function () { console.error('[Kelo boot] module failed', base); };
    document.body.appendChild(script);
  }
  function ensureRuntimeModules() { loadScriptSequentially(0); }
  function boot() { ensureCloseButton();wrapInspectPlayer();ensureRuntimeModules(); }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();

  window.KELO_PROFILE_CLOSE_AUDIT = Object.freeze({
    version:'profile-close-v1.6.0',closeButtonId:CLOSE_ID,minTouchTargetPx:44,tapClose:true,legacyCloseHidden:true,
    runtimeFoundationBootstrap:true,characterCustomizationBootstrap:true,foundationScripts:FOUNDATION_SCRIPTS.slice(),
    customizationScripts:CUSTOMIZATION_SCRIPTS.slice(),bootScripts:BOOT_SCRIPTS.slice()
  });
})();
