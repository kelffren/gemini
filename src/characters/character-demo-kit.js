/* KELO-INDEX
 * area: CHARACTERS
 * keys: CUSTOMIZATION DEMO KIT OUTFIT HELMET WEAPON VANGUARD
 * hace: registra el primer vertical slice de contenido modular sin modificar el motor de personalización
 * online: solo define IDs visuales; no contiene stats ni autoridad de combate
 */
(function (root) {
  'use strict';

  const VERSION = 'character-demo-kit-v1.0.0';
  const BASE = 'src/characters/customization-assets/';

  function api() { return root.KeloCharacterCustomization || null; }
  function sheet(source) {
    return {
      mode: 'sheet',
      source: BASE + source + '?v=1',
      columns: 4,
      rows: 4,
      faceRows: { down:0, left:1, right:2, up:3 },
      anchor: { x:0.5, y:1 },
      heightScale: 1,
      layer: 'front'
    };
  }
  function weapon(source) {
    return {
      mode: 'socket',
      source: BASE + source + '?v=1',
      socket: 'weapon',
      layer: 'front',
      width: 58,
      height: 58,
      anchor: { x:0.5, y:0.88 },
      offsets: {
        down: { x:2, y:7, rotation:180 },
        up: { x:-2, y:-5, rotation:0 },
        left: { x:-7, y:0, rotation:-90 },
        right: { x:7, y:0, rotation:90 }
      }
    };
  }
  function registerItemSafe(A, def) {
    return A.getItem(def.id) || A.registerItem(def);
  }
  function registerOutfitSafe(A, def) {
    const current = A.listOutfits().find(function (item) { return item.id === def.id; });
    return current || A.registerOutfit(def);
  }

  function register() {
    const A = api();
    if (!A) return false;

    registerItemSafe(A, {
      id:'torso_kelo_vanguard', slot:'torso', name:'Chaqueta Vanguard', group:'clothing', rarity:'Raro', icon:'◆',
      tags:['kelo','vanguard','outfit','teal','gold'], visual:sheet('vanguard-torso.svg')
    });
    registerItemSafe(A, {
      id:'legs_kelo_vanguard', slot:'legs', name:'Pantalón Vanguard', group:'clothing', rarity:'Raro', icon:'◆',
      tags:['kelo','vanguard','outfit'], visual:sheet('vanguard-legs.svg')
    });
    registerItemSafe(A, {
      id:'feet_kelo_vanguard', slot:'feet', name:'Botas Vanguard', group:'clothing', rarity:'Raro', icon:'◆',
      tags:['kelo','vanguard','outfit'], visual:sheet('vanguard-feet.svg')
    });
    registerItemSafe(A, {
      id:'head_vanguard_crown', slot:'head', name:'Corona Vanguard', group:'equipment', rarity:'Épico', icon:'♜',
      tags:['helmet','vanguard','gold'], visual:sheet('vanguard-crown.svg')
    });
    registerItemSafe(A, {
      id:'head_night_visor', slot:'head', name:'Visor Nocturno', group:'equipment', rarity:'Épico', icon:'▰',
      tags:['helmet','visor','night'], visual:sheet('night-visor.svg')
    });
    registerItemSafe(A, {
      id:'weapon_solar_saber', slot:'weaponMain', name:'Sable Solar', group:'equipment', rarity:'Épico', icon:'†',
      tags:['weapon','sword','gold'], visual:weapon('solar-saber.svg')
    });
    registerItemSafe(A, {
      id:'weapon_onyx_katana', slot:'weaponMain', name:'Katana Ónix', group:'equipment', rarity:'Épico', icon:'╱',
      tags:['weapon','katana','onyx'], visual:weapon('onyx-katana.svg')
    });

    registerOutfitSafe(A, {
      id:'outfit_kelo_vanguard',
      name:'Kelo Vanguard',
      slots:{ torso:'torso_kelo_vanguard', legs:'legs_kelo_vanguard', feet:'feet_kelo_vanguard' }
    });

    root.KELO_CHARACTER_DEMO_KIT_AUDIT = Object.freeze({
      version: VERSION,
      ready: true,
      outfitId: 'outfit_kelo_vanguard',
      pieceIds: Object.freeze([
        'torso_kelo_vanguard','legs_kelo_vanguard','feet_kelo_vanguard',
        'head_vanguard_crown','head_night_visor','weapon_solar_saber','weapon_onyx_katana'
      ]),
      assets: Object.freeze([
        BASE+'vanguard-torso.svg?v=1',BASE+'vanguard-legs.svg?v=1',BASE+'vanguard-feet.svg?v=1',
        BASE+'vanguard-crown.svg?v=1',BASE+'night-visor.svg?v=1',BASE+'solar-saber.svg?v=1',BASE+'onyx-katana.svg?v=1'
      ]),
      statsFree: true,
      modular: true
    });
    try { root.dispatchEvent(new CustomEvent('kelo:character-demo-kit-ready', { detail:root.KELO_CHARACTER_DEMO_KIT_AUDIT })); } catch (e) {}
    return true;
  }

  if (!register()) {
    let attempts = 0;
    const timer = setInterval(function () {
      attempts += 1;
      if (register() || attempts > 100) clearInterval(timer);
    }, 50);
  }
})(typeof globalThis !== 'undefined' ? globalThis : window);