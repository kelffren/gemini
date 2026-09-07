/* KELO-INDEX
 * area: UI
 * keys: CHARACTER CUSTOMIZER PREVIEW LAYERS DEMO KIT
 * hace: refleja en la vista previa del personalizador los overlays modulares seleccionados
 */
(function (root) {
  'use strict';

  const VERSION = 'character-customizer-preview-v1.0.0';
  const SHEET_SLOTS = ['torso','legs','feet','gloves','armor','hair','head','faceAccessory','accessory1','accessory2'];
  const audit = root.KELO_CHARACTER_CUSTOMIZER_PREVIEW_AUDIT = {
    version: VERSION,
    ready: false,
    renders: 0,
    layers: 0,
    lastKey: null
  };

  function api() { return root.KeloCharacterCustomization || null; }
  function ensureStyle() {
    if (document.getElementById('kelo-character-customizer-preview-style')) return;
    const s = document.createElement('style');
    s.id = 'kelo-character-customizer-preview-style';
    s.textContent = `
#kelo-character-customizer .kc-kit-layer{position:absolute;pointer-events:none;image-rendering:pixelated;background-repeat:no-repeat}
#kelo-character-customizer .kc-kit-sheet{z-index:4;left:50%;bottom:26px;transform:translateX(-50%);width:180px;height:270px;background-size:400% 400%;background-position:0 0}
#kelo-character-customizer .kc-kit-weapon{z-index:5;left:calc(50% + 38px);bottom:72px;width:62px;height:62px;object-fit:contain;transform:rotate(180deg);transform-origin:50% 88%;image-rendering:pixelated}
@media(max-width:680px){#kelo-character-customizer .kc-kit-sheet{width:104px;height:156px;bottom:17px}#kelo-character-customizer .kc-kit-weapon{left:calc(50% + 23px);bottom:48px;width:39px;height:39px}}
`;
    document.head.appendChild(s);
  }
  function selectedVisuals(A, state) {
    const out = [];
    SHEET_SLOTS.forEach(function (slot) {
      const item = A.getItem(state.slots[slot]);
      if (item && item.visual && item.visual.source && item.visual.mode === 'sheet') out.push({ slot:slot, item:item });
    });
    const weapon = A.getItem(state.slots.weaponMain);
    if (weapon && weapon.visual && weapon.visual.source) out.push({ slot:'weaponMain', item:weapon });
    return out;
  }
  function renderPreview() {
    const A = api();
    const stage = document.querySelector('#kelo-character-customizer .kc-stage');
    if (!A || !stage) return false;
    ensureStyle();
    const state = A.getState();
    const visuals = selectedVisuals(A, state);
    const key = visuals.map(function (entry) { return entry.slot + ':' + entry.item.id; }).join('|');
    if (stage.dataset.keloKitPreviewKey === key && stage.querySelectorAll('.kc-kit-layer').length === visuals.length) return true;

    stage.querySelectorAll('.kc-kit-layer').forEach(function (node) { node.remove(); });
    visuals.forEach(function (entry) {
      const visual = entry.item.visual;
      if (visual.mode === 'sheet') {
        const layer = document.createElement('div');
        layer.className = 'kc-kit-layer kc-kit-sheet';
        layer.dataset.kcPreviewSlot = entry.slot;
        layer.dataset.kcPreviewItem = entry.item.id;
        layer.style.backgroundImage = 'url("' + visual.source.replace(/"/g, '') + '")';
        stage.appendChild(layer);
      } else if (entry.slot === 'weaponMain') {
        const img = document.createElement('img');
        img.className = 'kc-kit-layer kc-kit-weapon';
        img.dataset.kcPreviewSlot = entry.slot;
        img.dataset.kcPreviewItem = entry.item.id;
        img.alt = '';
        img.src = visual.source;
        stage.appendChild(img);
      }
    });
    stage.dataset.keloKitPreviewKey = key;
    audit.renders += 1;
    audit.layers = visuals.length;
    audit.lastKey = key;
    return true;
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () { scheduled = false; renderPreview(); });
  }
  function boot() {
    ensureStyle();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList:true, subtree:true });
    root.addEventListener('kelo:character-customization-changed', schedule);
    root.addEventListener('kelo:character-demo-kit-ready', schedule);
    setTimeout(schedule, 0);
    audit.ready = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  root.KeloCharacterCustomizerPreview = Object.freeze({ version:VERSION, render:renderPreview });
})(typeof globalThis !== 'undefined' ? globalThis : window);