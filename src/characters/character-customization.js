/* KELO-INDEX
 * area: CHARACTERS
 * keys: CUSTOMIZATION MODULAR LAYERS APPEARANCE OUTFIT EQUIPMENT COSMETIC SOCKET ONLINE
 * hace: estado visual modular del personaje + compositor de capas independientes sobre el avatar existente
 * online: serializa solo IDs visuales/revision; nunca stats, daño, inventario o autoridad
 */
(function (root) {
  'use strict';

  const VERSION = 'character-customization-v1.0.2';
  const STORAGE_KEY = 'kelo_character_customization_v1';
  const FACE_ORDER = Object.freeze({
    down: Object.freeze(['back','body','skinTone','legs','feet','torso','gloves','armor','face','eyes','facialHair','hair','head','faceAccessory','accessory1','accessory2','weaponSecondary','weaponMain','weaponSkin','aura','characterFX']),
    left: Object.freeze(['back','weaponSecondary','body','skinTone','legs','feet','torso','gloves','armor','face','eyes','facialHair','hair','head','faceAccessory','accessory1','accessory2','weaponMain','weaponSkin','aura','characterFX']),
    right: Object.freeze(['back','weaponSecondary','body','skinTone','legs','feet','torso','gloves','armor','face','eyes','facialHair','hair','head','faceAccessory','accessory1','accessory2','weaponMain','weaponSkin','aura','characterFX']),
    up: Object.freeze(['weaponMain','weaponSkin','weaponSecondary','back','body','skinTone','legs','feet','torso','gloves','armor','face','eyes','facialHair','hair','head','faceAccessory','accessory1','accessory2','aura','characterFX'])
  });
  const SLOT_GROUPS = Object.freeze({
    appearance: Object.freeze(['body','skinTone','face','eyes','hair','facialHair']),
    clothing: Object.freeze(['torso','legs','feet','gloves']),
    equipment: Object.freeze(['head','faceAccessory','armor','back','weaponMain','weaponSecondary','accessory1','accessory2']),
    cosmetics: Object.freeze(['aura','weaponSkin','characterFX'])
  });
  const ALL_SLOTS = Object.freeze(Array.from(new Set(Object.keys(SLOT_GROUPS).reduce(function (all, key) { return all.concat(SLOT_GROUPS[key]); }, []))));
  const GAMEPLAY_TO_VISUAL = Object.freeze({ weapon:'weaponMain', helmet:'head', chest:'armor', gloves:'gloves', boots:'feet', accessory:'accessory1' });
  const UP_BACK_SLOTS = new Set(['back','weaponSecondary','weaponMain','weaponSkin']);
  const imageCache = new Map();
  const catalog = new Map();
  const outfits = new Map();
  const remoteState = new Map();
  let revisionSeed = 1;

  const DEFAULT_STATE = Object.freeze({
    version: 1,
    mode: 'modular',
    baseAppearanceId: 'player_hero_v1',
    outfitId: 'outfit_default',
    slots: Object.freeze({
      body:'body_legacy_hero', skinTone:'skin_default', face:'face_default', eyes:'eyes_default', hair:null, facialHair:null,
      torso:null, legs:null, feet:null, gloves:null,
      head:null, faceAccessory:null, armor:null, back:null, weaponMain:null, weaponSecondary:null, accessory1:null, accessory2:null,
      aura:null, weaponSkin:null, characterFX:null
    }),
    revision: 1
  });

  const audit = root.KELO_CHARACTER_CUSTOMIZATION_AUDIT = {
    version: VERSION,
    ready: true,
    modular: true,
    legacyBaseFallback: true,
    sharedAnimationState: true,
    actionTransformShared: true,
    independentEquipmentLayers: true,
    outfitEquipmentIndependence: true,
    upFacingWeaponOcclusion: true,
    gameplayStatsOwnedElsewhere: true,
    onlineUsesIdsOnly: true,
    slotCount: ALL_SLOTS.length,
    registeredItems: 0,
    registeredOutfits: 0,
    draws: 0,
    missingAssets: [],
    lastChange: null,
    lastDraw: null
  };

  function cloneSlots(input) {
    const out = {};
    ALL_SLOTS.forEach(function (slot) { out[slot] = input && Object.prototype.hasOwnProperty.call(input, slot) ? input[slot] : DEFAULT_STATE.slots[slot]; });
    return out;
  }
  function normalizeState(input) {
    const src = input && typeof input === 'object' ? input : {};
    return {
      version: 1,
      mode: src.mode === 'fullBodyOverride' ? 'fullBodyOverride' : 'modular',
      baseAppearanceId: String(src.baseAppearanceId || DEFAULT_STATE.baseAppearanceId),
      outfitId: src.outfitId == null ? null : String(src.outfitId),
      slots: cloneSlots(src.slots),
      revision: Math.max(1, Math.floor(Number(src.revision) || revisionSeed++))
    };
  }
  function localStateContainer() {
    if (typeof STATE !== 'undefined' && STATE) return STATE;
    return null;
  }
  function readStored() {
    const container = localStateContainer();
    if (container && container.characterCustomization) return normalizeState(container.characterCustomization);
    try {
      const raw = root.localStorage && root.localStorage.getItem(STORAGE_KEY);
      return raw ? normalizeState(JSON.parse(raw)) : normalizeState(DEFAULT_STATE);
    } catch (e) { return normalizeState(DEFAULT_STATE); }
  }
  let state = readStored();

  function persist() {
    const container = localStateContainer();
    if (container) container.characterCustomization = normalizeState(state);
    try { if (root.localStorage) root.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    try { if (typeof saveState === 'function') saveState(); } catch (e) {}
  }
  function actorId(actor) { return String(actor && (actor.id || actor.playerKey) || 'local'); }
  function localActor() { try { return typeof localPlayer !== 'undefined' ? localPlayer : null; } catch (e) { return null; } }
  function stateForActor(actor) {
    const local = localActor();
    if (!actor || actor === local || actorId(actor) === actorId(local)) return state;
    return actor.characterCustomization ? normalizeState(actor.characterCustomization) : (remoteState.get(actorId(actor)) || normalizeState(DEFAULT_STATE));
  }
  function snapshot(inputState) {
    const s = normalizeState(inputState || state);
    return Object.freeze({ version:s.version, mode:s.mode, baseAppearanceId:s.baseAppearanceId, outfitId:s.outfitId, slots:Object.freeze(Object.assign({}, s.slots)), revision:s.revision });
  }
  function networkSnapshot(inputState) {
    const s = normalizeState(inputState || state);
    return Object.freeze({ schema:'kelo-character-visual-v1', mode:s.mode, baseAppearanceId:s.baseAppearanceId, outfitId:s.outfitId, slots:Object.freeze(Object.assign({}, s.slots)), revision:s.revision });
  }
  function emitChange(reason, detail) {
    state.revision = Math.max(state.revision + 1, revisionSeed++);
    persist();
    const payload = { reason:String(reason || 'change'), detail:detail || null, state:snapshot(), network:networkSnapshot() };
    audit.lastChange = { reason:payload.reason, revision:state.revision };
    try { root.dispatchEvent(new CustomEvent('kelo:character-customization-changed', { detail:payload })); } catch (e) {}
    return payload;
  }

  function normalizeVisual(visual) {
    if (!visual || typeof visual !== 'object') return null;
    const out = Object.assign({}, visual);
    out.mode = out.mode === 'sheet' ? 'sheet' : 'socket';
    out.source = out.source ? String(out.source) : null;
    out.socket = String(out.socket || 'center');
    out.layer = String(out.layer || 'front');
    out.columns = Math.max(1, Math.floor(Number(out.columns) || 1));
    out.rows = Math.max(1, Math.floor(Number(out.rows) || 1));
    out.faceRows = Object.assign({ down:0, left:1, right:2, up:3 }, out.faceRows || {});
    out.anchor = Object.assign({ x:0.5, y:1 }, out.anchor || {});
    out.width = Number(out.width) || 28;
    out.height = Number(out.height) || 28;
    out.heightScale = Number(out.heightScale) || 1;
    out.rotation = Number(out.rotation) || 0;
    out.offsets = out.offsets && typeof out.offsets === 'object' ? out.offsets : {};
    return Object.freeze(out);
  }
  function registerItem(def) {
    if (!def || !def.id || !def.slot || ALL_SLOTS.indexOf(String(def.slot)) < 0) throw new Error('INVALID_CHARACTER_ITEM');
    const id = String(def.id), slot = String(def.slot);
    const item = Object.freeze({
      id:id, slot:slot, name:String(def.name || id), group:String(def.group || groupOf(slot)), rarity:String(def.rarity || 'Normal'),
      icon:def.icon || null, visual:normalizeVisual(def.visual), tags:Object.freeze(Array.isArray(def.tags) ? def.tags.map(String) : []),
      gameplayItemId:def.gameplayItemId == null ? null : String(def.gameplayItemId), locked:def.locked === true, hidden:def.hidden === true
    });
    catalog.set(id, item); audit.registeredItems = catalog.size; return item;
  }
  function registerOutfit(def) {
    if (!def || !def.id) throw new Error('INVALID_OUTFIT');
    const sparse = {}; Object.keys(def.slots || {}).forEach(function (slot) { if (ALL_SLOTS.indexOf(slot) >= 0) sparse[slot] = def.slots[slot]; });
    const item = Object.freeze({ id:String(def.id), name:String(def.name || def.id), slots:Object.freeze(sparse), preview:def.preview || null, locked:def.locked === true });
    outfits.set(item.id, item); audit.registeredOutfits = outfits.size; return item;
  }
  function groupOf(slot) {
    const s = String(slot || '');
    return Object.keys(SLOT_GROUPS).find(function (g) { return SLOT_GROUPS[g].indexOf(s) >= 0; }) || 'equipment';
  }
  function getItem(id) { return id == null ? null : catalog.get(String(id)) || null; }
  function listItems(slot) { return Array.from(catalog.values()).filter(function (item) { return !item.hidden && (!slot || item.slot === slot); }); }
  function listOutfits() { return Array.from(outfits.values()); }

  function select(slot, itemId, options) {
    slot = String(slot || '');
    if (ALL_SLOTS.indexOf(slot) < 0) return { ok:false, error:'INVALID_SLOT' };
    if (itemId != null) {
      const item = getItem(itemId);
      if (!item) return { ok:false, error:'ITEM_NOT_REGISTERED' };
      if (item.slot !== slot) return { ok:false, error:'WRONG_SLOT' };
      if (item.locked && !(options && options.force)) return { ok:false, error:'ITEM_LOCKED' };
      state.slots[slot] = item.id;
    } else state.slots[slot] = null;
    if (!(options && options.keepOutfit) && state.outfitId) {
      const activeOutfit = outfits.get(state.outfitId);
      const outfitOwnsSlot = !!(activeOutfit && Object.prototype.hasOwnProperty.call(activeOutfit.slots, slot));
      if (!activeOutfit || (outfitOwnsSlot && activeOutfit.slots[slot] !== state.slots[slot])) state.outfitId = null;
    }
    emitChange('slot', { slot:slot, itemId:state.slots[slot] });
    return { ok:true, slot:slot, itemId:state.slots[slot], state:snapshot() };
  }
  function applyOutfit(id) {
    const outfit = outfits.get(String(id || ''));
    if (!outfit) return { ok:false, error:'OUTFIT_NOT_FOUND' };
    if (outfit.locked) return { ok:false, error:'OUTFIT_LOCKED' };
    Object.keys(outfit.slots).forEach(function (slot) { if (ALL_SLOTS.indexOf(slot) >= 0) state.slots[slot] = outfit.slots[slot]; });
    state.outfitId = outfit.id;
    emitChange('outfit', { outfitId:outfit.id });
    return { ok:true, outfitId:outfit.id, state:snapshot() };
  }
  function reset() { state = normalizeState(DEFAULT_STATE); emitChange('reset'); return snapshot(); }
  function setMode(mode) { state.mode = mode === 'fullBodyOverride' ? 'fullBodyOverride' : 'modular'; emitChange('mode', { mode:state.mode }); return state.mode; }
  function applyRemote(actor, payload) {
    if (!actor || !payload || payload.schema !== 'kelo-character-visual-v1') return false;
    const normalized = normalizeState(payload);
    actor.characterCustomization = normalized;
    remoteState.set(actorId(actor), normalized);
    return true;
  }

  function syncGameplayEquipment() {
    if (!root.KeloEquipment || typeof root.KeloEquipment.getEquipped !== 'function') return 0;
    let changed = 0;
    let items = [];
    try { items = root.KeloEquipment.getEquipped() || []; } catch (e) { return 0; }
    items.forEach(function (eq) {
      if (!eq || !eq.slot) return;
      const visualSlot = GAMEPLAY_TO_VISUAL[eq.slot];
      if (!visualSlot) return;
      const registered = Array.from(catalog.values()).find(function (item) { return item.gameplayItemId === String(eq.id || eq.templateId || ''); });
      if (registered && state.slots[visualSlot] !== registered.id) { state.slots[visualSlot] = registered.id; changed += 1; }
    });
    if (changed) emitChange('equipment-sync', { changed:changed });
    return changed;
  }

  registerItem({ id:'body_legacy_hero', slot:'body', name:'Kelo clásico', group:'appearance', tags:['legacy','base'] });
  registerItem({ id:'skin_default', slot:'skinTone', name:'Tono original', group:'appearance' });
  registerItem({ id:'face_default', slot:'face', name:'Rostro original', group:'appearance' });
  registerItem({ id:'eyes_default', slot:'eyes', name:'Ojos originales', group:'appearance' });
  registerOutfit({ id:'outfit_default', name:'Traje actual', slots:{ torso:null, legs:null, feet:null, gloves:null, armor:null, back:null } });

  function imageRuntime(source) {
    if (!source) return null;
    if (imageCache.has(source)) return imageCache.get(source);
    const rt = { image:new Image(), ready:false, failed:false };
    rt.image.decoding = 'async';
    rt.image.onload = function () { rt.ready = true; };
    rt.image.onerror = function () { rt.failed = true; if (audit.missingAssets.indexOf(source) < 0) audit.missingAssets.push(source); };
    rt.image.src = source;
    imageCache.set(source, rt);
    return rt;
  }
  function faceOf(actor) { return actor && actor._face || actor && actor._visualMotion && actor._visualMotion.face || 'down'; }
  function frameOf(actor, columns) {
    const visual = actor && actor._visualMotion;
    if (visual && Number.isFinite(Number(visual.frame))) return Math.abs(Math.floor(Number(visual.frame))) % columns;
    const moving = visual ? !!visual.on : Math.hypot(Number(actor && actor.vx)||0, Number(actor && actor.vy)||0) > 16;
    return moving ? Math.floor(performance.now()/130)%columns : 0;
  }
  function presentation(actor, face) {
    if (root.KeloAnchors && typeof root.KeloAnchors.presentation === 'function') return root.KeloAnchors.presentation(actor, face);
    const h = Math.max(72, (Number(actor && actor.radius)||20)*4.5), footY=(Number(actor && actor.y)||0)+10;
    return { footRootX:Number(actor && actor.x)||0, footRootY:footY, visualWidth:h*.62, visualHeight:h };
  }
  function offsetFor(visual, face) {
    const raw = visual.offsets && (visual.offsets[face] || visual.offsets.default) || {};
    return { x:Number(raw.x)||0, y:Number(raw.y)||0, rotation:Number(raw.rotation)||0, scale:Number(raw.scale)||1 };
  }
  function drawVisualItem(g, actor, item, face) {
    if (!g || !item || !item.visual || !item.visual.source) return false;
    const visual = item.visual, rt = imageRuntime(visual.source);
    if (!rt || !rt.ready || rt.failed) return false;
    const layout = presentation(actor, face), scaleBase=Math.max(.55,(Number(layout.visualHeight)||93)/93), off=offsetFor(visual,face);
    g.save(); g.imageSmoothingEnabled=false;
    if (visual.mode === 'sheet') {
      const iw=rt.image.naturalWidth||rt.image.width, ih=rt.image.naturalHeight||rt.image.height;
      const fw=iw/visual.columns, fh=ih/visual.rows, row=Math.max(0,Math.min(visual.rows-1,Number(visual.faceRows[face])||0)), col=frameOf(actor,visual.columns);
      const dh=(Number(layout.visualHeight)||93)*visual.heightScale*off.scale, dw=dh*(fw/fh), anchor=visual.anchor;
      const dx=(Number(layout.footRootX)||0)-dw*Number(anchor.x||.5)+off.x*scaleBase, dy=(Number(layout.footRootY)||0)-dh*Number(anchor.y==null?1:anchor.y)+off.y*scaleBase;
      g.translate(dx+dw*.5,dy+dh*.5);g.rotate((visual.rotation+off.rotation)*Math.PI/180);g.drawImage(rt.image,col*fw,row*fh,fw,fh,-dw*.5,-dh*.5,dw,dh);
    } else {
      let socket=null;
      if (root.KeloAnchors && typeof root.KeloAnchors.get === 'function') socket=root.KeloAnchors.get(actor,visual.socket);
      if (!socket) socket={x:Number(actor&&actor.x)||0,y:Number(actor&&actor.y)||0};
      const w=visual.width*scaleBase*off.scale,h=visual.height*scaleBase*off.scale;
      g.translate(socket.x+off.x*scaleBase,socket.y+off.y*scaleBase);g.rotate((visual.rotation+off.rotation)*Math.PI/180);g.drawImage(rt.image,-w*visual.anchor.x,-h*visual.anchor.y,w,h);
    }
    g.restore(); audit.draws += 1; audit.lastDraw={ actorId:actorId(actor), itemId:item.id, slot:item.slot, face:face }; return true;
  }
  function orderedItems(actor, section) {
    const s=stateForActor(actor), face=faceOf(actor), order=FACE_ORDER[face]||FACE_ORDER.down;
    const selected=[];
    order.forEach(function (slot,index) {
      const item=getItem(s.slots[slot]);
      if (!item || !item.visual) return;
      const behind = item.visual.layer === 'back' || (face === 'up' && UP_BACK_SLOTS.has(slot));
      if ((section==='back') === behind) selected.push({ item:item,index:index });
    });
    selected.sort(function(a,b){return a.index-b.index;}); return selected.map(function(x){return x.item;});
  }
  function drawSection(g, actor, section) {
    const face=faceOf(actor); orderedItems(actor,section).forEach(function(item){drawVisualItem(g,actor,item,face);});
  }
  function drawSectionWithActorTransform(g, actor, section) {
    if (!g || !actor) return;
    const transform = root.KeloAnimation && typeof root.KeloAnimation.sampleTransform === 'function' ? root.KeloAnimation.sampleTransform(actor) : null;
    const pivot = root.KeloAnchors && typeof root.KeloAnchors.get === 'function' ? root.KeloAnchors.get(actor,'foot') : { x:Number(actor.x)||0, y:Number(actor.y)||0 };
    g.save();
    if (transform && pivot) {
      g.translate(Number(transform.offsetX)||0,Number(transform.offsetY)||0);
      g.translate(Number(pivot.x)||0,Number(pivot.y)||0);
      if (Number(transform.rotation)) g.rotate(Number(transform.rotation));
      g.scale(Number(transform.scaleX)||1,Number(transform.scaleY)||1);
      g.translate(-(Number(pivot.x)||0),-(Number(pivot.y)||0));
    }
    drawSection(g,actor,section);
    g.restore();
  }

  function installRenderer() {
    if (typeof renderAvatar !== 'function' || renderAvatar.__keloModularCustomization) return false;
    const previous = renderAvatar;
    function modularRender(actor, isSelf) {
      if (typeof ctx !== 'undefined' && ctx) drawSectionWithActorTransform(ctx, actor, 'back');
      const out = previous.apply(this, arguments);
      if (typeof ctx !== 'undefined' && ctx) drawSectionWithActorTransform(ctx, actor, 'front');
      return out;
    }
    modularRender.__keloModularCustomization = true;
    modularRender.__previousRenderAvatar = previous;
    renderAvatar = modularRender;
    return true;
  }

  function refreshFromState() {
    const container=localStateContainer();
    if (container && container.characterCustomization) state=normalizeState(container.characterCustomization);
    return snapshot();
  }

  root.KeloCharacterCustomization = Object.freeze({
    version:VERSION, slots:ALL_SLOTS.slice(), slotGroups:SLOT_GROUPS, gameplaySlotMap:GAMEPLAY_TO_VISUAL, faceOrder:FACE_ORDER,
    getState:function(){return snapshot();}, refreshFromState:refreshFromState, getItem:getItem, listItems:listItems, registerItem:registerItem,
    listOutfits:listOutfits, registerOutfit:registerOutfit, select:select, clear:function(slot){return select(slot,null);}, applyOutfit:applyOutfit,
    reset:reset, setMode:setMode, stateForActor:function(actor){return snapshot(stateForActor(actor));}, networkSnapshot:networkSnapshot,
    applyRemote:applyRemote, syncGameplayEquipment:syncGameplayEquipment, installRenderer:installRenderer
  });

  persist();
  installRenderer();
  setTimeout(installRenderer,0);
})(typeof globalThis !== 'undefined' ? globalThis : window);