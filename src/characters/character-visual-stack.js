/* KELO-INDEX
 * area: CHARACTERS
 * keys: VISUAL STACK LAYER ORDER DEPTH SELECTED ITEMS REUSABLE
 * hace: resuelve piezas visuales activas, orden y profundidad sin dibujar ni tocar gameplay
 * online: consume snapshots visuales; no modifica estado, stats ni autoridad
 */
(function (root) {
  'use strict';

  const VERSION = 'character-visual-stack-v1.0.1';
  const UP_BACK_SLOTS = new Set(['back','weaponSecondary','weaponMain','weaponSkin']);
  const audit = root.KELO_CHARACTER_VISUAL_STACK_AUDIT = {
    version:VERSION,
    ready:true,
    resolves:0,
    lastFace:null,
    lastCount:0,
    pureResolver:true,
    sharedSlotSchema:true
  };

  function api() { return root.KeloCharacterCustomization || null; }
  function schema() { return root.KeloCharacterSlotSchema || null; }
  function stateFor(A, actor, explicitState) {
    if (explicitState && explicitState.slots) return explicitState;
    if (actor && typeof A.stateForActor === 'function') return A.stateForActor(actor);
    return A.getState();
  }
  function resolve(options) {
    const A = api(), Schema = schema();
    if (!A || !Schema) return [];
    const o = options || {};
    const face = Schema.normalizeFace(o.face || (o.actor && (o.actor._face || o.actor._visualMotion && o.actor._visualMotion.face)) || 'down');
    const state = stateFor(A, o.actor || null, o.state || null);
    const order = Schema.orderFor(face);
    const sectionFilter = o.section === 'back' || o.section === 'front' ? o.section : null;
    const entries = [];
    order.forEach(function (slot, index) {
      const item = A.getItem(state.slots && state.slots[slot]);
      if (!item || !item.visual || !item.visual.source) return;
      const section = item.visual.layer === 'back' || (face === 'up' && UP_BACK_SLOTS.has(slot)) ? 'back' : 'front';
      if (sectionFilter && section !== sectionFilter) return;
      entries.push(Object.freeze({ slot:String(slot), item:item, visual:item.visual, index:index, section:section, face:face }));
    });
    audit.resolves += 1;
    audit.lastFace = face;
    audit.lastCount = entries.length;
    return entries;
  }

  function ids(options) {
    return resolve(options).map(function (entry) { return entry.item.id; });
  }

  root.KeloCharacterVisualStack = Object.freeze({
    version:VERSION,
    resolve:resolve,
    ids:ids,
    upBackSlots:Object.freeze(Array.from(UP_BACK_SLOTS))
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
