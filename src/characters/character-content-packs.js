/* KELO-INDEX
 * area: CHARACTERS
 * keys: CONTENT PACK REGISTRY MODULAR ITEMS OUTFITS REUSABLE
 * hace: registra paquetes declarativos de piezas/outfits de forma idempotente sobre CharacterCustomization
 * online: registra IDs y metadatos visuales; no toca stats, inventario ni autoridad
 */
(function (root) {
  'use strict';

  const VERSION = 'character-content-packs-v1.0.0';
  const packs = new Map();
  const registered = new Set();
  let timer = null;

  const audit = root.KELO_CHARACTER_CONTENT_PACKS_AUDIT = {
    version:VERSION,
    ready:true,
    defined:0,
    registered:0,
    itemCount:0,
    outfitCount:0,
    lastPack:null,
    errors:[]
  };

  function api() { return root.KeloCharacterCustomization || null; }
  function freezePack(input) {
    if (!input || !input.id) throw new Error('INVALID_CHARACTER_CONTENT_PACK');
    return Object.freeze({
      id:String(input.id),
      version:String(input.version || '1'),
      items:Object.freeze((input.items || []).slice()),
      outfits:Object.freeze((input.outfits || []).slice()),
      tags:Object.freeze((input.tags || []).map(String))
    });
  }

  function registerPack(pack) {
    const A = api();
    if (!A || !pack || registered.has(pack.id)) return false;
    try {
      pack.items.forEach(function (def) {
        if (!def || !def.id) throw new Error('INVALID_CHARACTER_PACK_ITEM_' + pack.id);
        if (!A.getItem(def.id)) A.registerItem(def);
      });
      pack.outfits.forEach(function (def) {
        if (!def || !def.id) throw new Error('INVALID_CHARACTER_PACK_OUTFIT_' + pack.id);
        const exists = A.listOutfits().some(function (item) { return item.id === String(def.id); });
        if (!exists) A.registerOutfit(def);
      });
      registered.add(pack.id);
      audit.registered = registered.size;
      audit.itemCount += pack.items.length;
      audit.outfitCount += pack.outfits.length;
      audit.lastPack = pack.id;
      try { root.dispatchEvent(new CustomEvent('kelo:character-content-pack-ready', { detail:{ id:pack.id, version:pack.version } })); } catch (e) {}
      return true;
    } catch (error) {
      const message = String(error && error.message || error);
      if (audit.errors.indexOf(message) < 0) audit.errors.push(message);
      return false;
    }
  }

  function flush() {
    if (!api()) return false;
    let changed = false;
    packs.forEach(function (pack) { if (registerPack(pack)) changed = true; });
    return changed;
  }

  function ensureRetry() {
    if (api()) { flush(); return; }
    if (timer) return;
    let attempts = 0;
    timer = setInterval(function () {
      attempts += 1;
      if (api()) {
        clearInterval(timer); timer = null; flush();
      } else if (attempts >= 100) {
        clearInterval(timer); timer = null;
        if (audit.errors.indexOf('CHARACTER_CUSTOMIZATION_API_TIMEOUT') < 0) audit.errors.push('CHARACTER_CUSTOMIZATION_API_TIMEOUT');
      }
    }, 50);
  }

  function define(input) {
    const pack = freezePack(input);
    const existing = packs.get(pack.id);
    if (existing) return existing;
    packs.set(pack.id, pack);
    audit.defined = packs.size;
    if (!registerPack(pack)) ensureRetry();
    return pack;
  }

  root.KeloCharacterContentPacks = Object.freeze({
    version:VERSION,
    define:define,
    flush:flush,
    has:function (id) { return packs.has(String(id)); },
    isRegistered:function (id) { return registered.has(String(id)); },
    list:function () { return Array.from(packs.values()); }
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
