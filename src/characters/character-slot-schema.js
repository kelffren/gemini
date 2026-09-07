/* KELO-INDEX
 * area: CHARACTERS
 * keys: SLOT SCHEMA GROUPS FACE ORDER GAMEPLAY VISUAL REUSABLE
 * hace: fuente única de verdad para slots, grupos, orden direccional y mapeo gameplay->visual
 * online: datos puros; no dibuja, no persiste y no modifica gameplay
 */
(function (root) {
  'use strict';

  const VERSION = 'character-slot-schema-v1.0.0';
  const FACE_ORDER = Object.freeze({
    down:Object.freeze(['back','body','skinTone','legs','feet','torso','gloves','armor','face','eyes','facialHair','hair','head','faceAccessory','accessory1','accessory2','weaponSecondary','weaponMain','weaponSkin','aura','characterFX']),
    left:Object.freeze(['back','weaponSecondary','body','skinTone','legs','feet','torso','gloves','armor','face','eyes','facialHair','hair','head','faceAccessory','accessory1','accessory2','weaponMain','weaponSkin','aura','characterFX']),
    right:Object.freeze(['back','weaponSecondary','body','skinTone','legs','feet','torso','gloves','armor','face','eyes','facialHair','hair','head','faceAccessory','accessory1','accessory2','weaponMain','weaponSkin','aura','characterFX']),
    up:Object.freeze(['weaponMain','weaponSkin','weaponSecondary','back','body','skinTone','legs','feet','torso','gloves','armor','face','eyes','facialHair','hair','head','faceAccessory','accessory1','accessory2','aura','characterFX'])
  });
  const SLOT_GROUPS = Object.freeze({
    appearance:Object.freeze(['body','skinTone','face','eyes','hair','facialHair']),
    clothing:Object.freeze(['torso','legs','feet','gloves']),
    equipment:Object.freeze(['head','faceAccessory','armor','back','weaponMain','weaponSecondary','accessory1','accessory2']),
    cosmetics:Object.freeze(['aura','weaponSkin','characterFX'])
  });
  const SLOTS = Object.freeze(Array.from(new Set(Object.keys(SLOT_GROUPS).reduce(function (all, key) { return all.concat(SLOT_GROUPS[key]); }, []))));
  const GAMEPLAY_TO_VISUAL = Object.freeze({ weapon:'weaponMain', helmet:'head', chest:'armor', gloves:'gloves', boots:'feet', accessory:'accessory1' });

  function normalizeFace(face) {
    const value = String(face || 'down');
    return Object.prototype.hasOwnProperty.call(FACE_ORDER, value) ? value : 'down';
  }
  function isSlot(slot) { return SLOTS.indexOf(String(slot || '')) >= 0; }
  function groupOf(slot) {
    const value = String(slot || '');
    return Object.keys(SLOT_GROUPS).find(function (group) { return SLOT_GROUPS[group].indexOf(value) >= 0; }) || null;
  }
  function orderFor(face) { return FACE_ORDER[normalizeFace(face)]; }
  function visualSlotForGameplay(slot) { return GAMEPLAY_TO_VISUAL[String(slot || '')] || null; }

  root.KeloCharacterSlotSchema = Object.freeze({
    version:VERSION,
    slots:SLOTS,
    slotGroups:SLOT_GROUPS,
    faceOrder:FACE_ORDER,
    gameplayToVisual:GAMEPLAY_TO_VISUAL,
    normalizeFace:normalizeFace,
    isSlot:isSlot,
    groupOf:groupOf,
    orderFor:orderFor,
    visualSlotForGameplay:visualSlotForGameplay
  });

  root.KELO_CHARACTER_SLOT_SCHEMA_AUDIT = Object.freeze({
    version:VERSION,
    ready:true,
    pureData:true,
    slotCount:SLOTS.length,
    groups:Object.freeze(Object.keys(SLOT_GROUPS)),
    faces:Object.freeze(Object.keys(FACE_ORDER)),
    gameplayMappings:Object.freeze(Object.keys(GAMEPLAY_TO_VISUAL))
  });
})(typeof globalThis !== 'undefined' ? globalThis : window);
