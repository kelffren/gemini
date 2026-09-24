/* KELO-INDEX
 * area: CREATORS / SCENE KIT
 * owner: Scene Kit catalog
 * owns: recipe descriptors and slot → Forest Plaza template map
 * does-not-own: render, world authority, external provider bytes
 * public-api: listSceneKits(), getSceneKit()
 */
const T = id => `forest-plaza:asset-${id}`;

const KITS = Object.freeze([
  Object.freeze({
    id: 'plaza-noble',
    label: 'Plaza noble',
    profile: 'kelo-luxe-forest-plaza',
    pack: 'forest-plaza-v2',
    size: Object.freeze({ w: 640, h: 520 }),
    slots: Object.freeze([
      Object.freeze({ slot: 'fountain', templateId: T('062'), dx: 240, dy: 160, w: 160, h: 160, role: 'front' }),
      Object.freeze({ slot: 'banner_w', templateId: T('033'), dx: 120, dy: 200, w: 64, h: 120, role: 'front' }),
      Object.freeze({ slot: 'banner_e', templateId: T('038'), dx: 456, dy: 200, w: 64, h: 120, role: 'front' }),
      Object.freeze({ slot: 'planter_nw', templateId: T('054'), dx: 80, dy: 280, w: 88, h: 96, role: 'front' }),
      Object.freeze({ slot: 'planter_ne', templateId: T('057'), dx: 472, dy: 280, w: 88, h: 96, role: 'front' }),
      Object.freeze({ slot: 'planter_sw', templateId: T('058'), dx: 80, dy: 380, w: 88, h: 96, role: 'front' }),
      Object.freeze({ slot: 'planter_se', templateId: T('069'), dx: 472, dy: 380, w: 88, h: 96, role: 'front' }),
      Object.freeze({ slot: 'tree_sw', templateId: T('120'), dx: 16, dy: 340, w: 150, h: 180, role: 'back' }),
      Object.freeze({ slot: 'tree_se', templateId: T('123'), dx: 474, dy: 340, w: 150, h: 180, role: 'back' })
    ])
  }),
  Object.freeze({
    id: 'market-street',
    label: 'Calle mercado',
    profile: 'kelo-luxe-forest-plaza',
    pack: 'forest-plaza-v2',
    size: Object.freeze({ w: 720, h: 360 }),
    slots: Object.freeze([
      Object.freeze({ slot: 'cart_a', templateId: T('092'), dx: 40, dy: 120, w: 140, h: 110, role: 'front' }),
      Object.freeze({ slot: 'cart_b', templateId: T('110'), dx: 280, dy: 128, w: 120, h: 96, role: 'front' }),
      Object.freeze({ slot: 'crate', templateId: T('118'), dx: 430, dy: 180, w: 64, h: 56, role: 'front' }),
      Object.freeze({ slot: 'barrel', templateId: T('117'), dx: 500, dy: 176, w: 56, h: 56, role: 'front' }),
      Object.freeze({ slot: 'lantern', templateId: T('091'), dx: 580, dy: 80, w: 48, h: 96, role: 'front' }),
      Object.freeze({ slot: 'fence_a', templateId: T('094'), dx: 40, dy: 260, w: 180, h: 36, role: 'back' }),
      Object.freeze({ slot: 'fence_b', templateId: T('101'), dx: 280, dy: 260, w: 140, h: 36, role: 'back' })
    ])
  }),
  Object.freeze({
    id: 'enclosed-garden',
    label: 'Jardín cerrado',
    profile: 'kelo-luxe-forest-plaza',
    pack: 'forest-plaza-v2',
    size: Object.freeze({ w: 520, h: 480 }),
    slots: Object.freeze([
      Object.freeze({ slot: 'fountain_small', templateId: T('068'), dx: 200, dy: 160, w: 120, h: 120, role: 'front' }),
      Object.freeze({ slot: 'hedge_n', templateId: T('132'), dx: 160, dy: 40, w: 200, h: 72, role: 'back' }),
      Object.freeze({ slot: 'bush_w', templateId: T('129'), dx: 40, dy: 180, w: 96, h: 88, role: 'back' }),
      Object.freeze({ slot: 'bush_e', templateId: T('131'), dx: 380, dy: 180, w: 96, h: 88, role: 'back' }),
      Object.freeze({ slot: 'flowers_s', templateId: T('111'), dx: 180, dy: 320, w: 160, h: 80, role: 'front' }),
      Object.freeze({ slot: 'sapling', templateId: T('143'), dx: 40, dy: 300, w: 72, h: 96, role: 'back' })
    ])
  })
]);

export function listSceneKits() {
  return KITS.slice();
}

export function getSceneKit(id) {
  return KITS.find(kit => kit.id === String(id || '')) || null;
}

export const SCENE_KIT_VERSION = 'scene-kit-v1';
