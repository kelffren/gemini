/* KELO-INDEX
 * area: UI / CHARACTER PREVIEW
 * owner: KeloCharacterCustomizerPreview
 * keys: CHARACTER CUSTOMIZER PREVIEW VISUAL STACK GENERIC LAYERS SLEEP WAKE PERFORMANCE
 * purpose: renderiza piezas modulares solo cuando el Character Customizer está abierto, sin observar todo document.body
 * public-api: KeloCharacterCustomizerPreview.render/entries/wake/sleep/isAwake
 * consumes: KeloCharacterCustomization, KeloCharacterVisualStack, KeloCharacterCustomizer
 * state-owned: scheduling efímero de un único RAF de preview
 * extension-points: eventos semánticos de customization/content packs
 * reuse: preview modular de cualquier slot registrado
 * legacy: ninguno
 * do-not: NO MutationObserver global permanente, NO loop RAF continuo
 */
(function (root) {
  'use strict';

  const VERSION = 'character-customizer-preview-v1.2.0';
  const audit = root.KELO_CHARACTER_CUSTOMIZER_PREVIEW_AUDIT = {
    version:VERSION,
    ready:false,
    renders:0,
    layers:0,
    lastKey:null,
    genericVisualStack:true,
    hardcodedSlots:false,
    globalMutationObserver:false,
    continuousRaf:false,
    awake:false
  };
  let frameId = 0;

  function api() { return root.KeloCharacterCustomization || null; }
  function stackApi() { return root.KeloCharacterVisualStack || null; }
  function isOpen() { return !!(root.KeloCharacterCustomizer && typeof root.KeloCharacterCustomizer.isOpen === 'function' && root.KeloCharacterCustomizer.isOpen()); }
  function ensureStyle() {
    if (document.getElementById('kelo-character-customizer-preview-style')) return;
    const s = document.createElement('style');
    s.id = 'kelo-character-customizer-preview-style';
    s.textContent = `
#kelo-character-customizer .kc-kit-layer{position:absolute;pointer-events:none;image-rendering:pixelated;background-repeat:no-repeat}
#kelo-character-customizer .kc-kit-sheet{left:50%;bottom:26px;transform:translateX(-50%);width:180px;height:270px}
#kelo-character-customizer .kc-kit-socket{object-fit:contain;transform-origin:50% 88%;image-rendering:pixelated}
@media(max-width:680px){#kelo-character-customizer .kc-kit-sheet{width:104px;height:156px;bottom:17px}}
`;
    document.head.appendChild(s);
  }

  function previewEntries() {
    const A = api(), Stack = stackApi();
    if (!A || !Stack) return [];
    return Stack.resolve({ state:A.getState(), face:'down' });
  }
  function layerZ(entry) { return entry.section === 'back' ? 1 : 4 + Math.min(20, Number(entry.index) || 0); }
  function renderSheet(stage, entry) {
    const visual = entry.visual;
    const layer = document.createElement('div');
    layer.className = 'kc-kit-layer kc-kit-sheet';
    layer.dataset.kcPreviewSlot = entry.slot;
    layer.dataset.kcPreviewItem = entry.item.id;
    layer.style.zIndex = String(layerZ(entry));
    layer.style.backgroundImage = 'url("' + visual.source.replace(/"/g, '') + '")';
    layer.style.backgroundSize = (visual.columns * 100) + '% ' + (visual.rows * 100) + '%';
    const row = Math.max(0, Math.min(visual.rows - 1, Number(visual.faceRows && visual.faceRows.down) || 0));
    layer.style.backgroundPosition = '0% ' + (visual.rows > 1 ? (row / (visual.rows - 1) * 100) : 0) + '%';
    stage.appendChild(layer);
  }
  function renderSocket(stage, entry) {
    const visual = entry.visual;
    const p = visual.preview || {};
    const img = document.createElement('img');
    const left = Number.isFinite(Number(p.leftPercent)) ? Number(p.leftPercent) : 50;
    const bottom = Number.isFinite(Number(p.bottomPercent)) ? Number(p.bottomPercent) : 20;
    const width = Number.isFinite(Number(p.widthPercent)) ? Number(p.widthPercent) : 24;
    const rotation = Number(p.rotationDeg) || 0;
    const anchorX = Number.isFinite(Number(p.anchorX)) ? Number(p.anchorX) : Number(visual.anchor && visual.anchor.x) || 0.5;
    img.className = 'kc-kit-layer kc-kit-socket';
    img.dataset.kcPreviewSlot = entry.slot;
    img.dataset.kcPreviewItem = entry.item.id;
    img.alt = '';
    img.src = visual.source;
    img.style.zIndex = String(layerZ(entry));
    img.style.left = left + '%';
    img.style.bottom = bottom + '%';
    img.style.width = width + '%';
    img.style.height = 'auto';
    img.style.transform = 'translateX(-' + (anchorX * 100) + '%) rotate(' + rotation + 'deg)';
    stage.appendChild(img);
  }

  function renderPreview() {
    if (!isOpen()) return false;
    const stage = document.querySelector('#kelo-character-customizer .kc-stage');
    const A = api(), Stack = stackApi();
    if (!A || !Stack || !stage) return false;
    ensureStyle();
    const entries = previewEntries();
    const key = entries.map(function (entry) { return entry.slot + ':' + entry.item.id + ':' + entry.section; }).join('|');
    if (stage.dataset.keloKitPreviewKey === key && stage.querySelectorAll('.kc-kit-layer').length === entries.length) return true;
    stage.querySelectorAll('.kc-kit-layer').forEach(function (node) { node.remove(); });
    entries.forEach(function (entry) {
      if (entry.visual.mode === 'sheet') renderSheet(stage, entry);
      else renderSocket(stage, entry);
    });
    stage.dataset.keloKitPreviewKey = key;
    audit.renders += 1;
    audit.layers = entries.length;
    audit.lastKey = key;
    return true;
  }

  function sleep() {
    if (frameId) cancelAnimationFrame(frameId);
    frameId = 0;
    audit.awake = false;
    return true;
  }
  function schedule() {
    if (!isOpen()) { sleep(); return false; }
    audit.awake = true;
    if (frameId) return true;
    frameId = requestAnimationFrame(function () {
      frameId = 0;
      if (!isOpen()) { audit.awake = false; return; }
      renderPreview();
    });
    return true;
  }
  function wake() { return schedule(); }
  function boot() {
    ensureStyle();
    root.addEventListener('kelo:character-customization-changed', schedule);
    root.addEventListener('kelo:character-content-pack-ready', schedule);
    root.addEventListener('kelo:character-demo-kit-ready', schedule);
    setTimeout(schedule, 0);
    audit.ready = true;
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once:true });
  else boot();

  root.KeloCharacterCustomizerPreview = Object.freeze({ version:VERSION, render:renderPreview, entries:previewEntries, wake:wake, sleep:sleep, isAwake:function(){return audit.awake;} });
})(typeof globalThis !== 'undefined' ? globalThis : window);
