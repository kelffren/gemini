/* KELO-INDEX
 * area: CHARACTERS
 * keys: CUSTOMIZATION DEMO KIT OUTFIT HELMET WEAPON VANGUARD CONTENT PACK
 * hace: define el primer vertical slice como paquete declarativo usando factories reutilizables
 * online: solo define IDs/metadatos visuales; no contiene stats ni autoridad de combate
 */
(function (root) {
  'use strict';

  const VERSION = 'character-demo-kit-v1.1.0';
  const BASE = 'src/characters/customization-assets/';
  const V = root.KeloCharacterVisualPresets;
  const Packs = root.KeloCharacterContentPacks;

  if (!V || !Packs) throw new Error('CHARACTER_CONTENT_FOUNDATION_NOT_LOADED');

  function asset(name) { return V.source(BASE, name, 1); }
  function sheet(name) { return V.sheet(asset(name)); }
  function weapon(name) { return V.weapon(asset(name)); }

  const PIECE_IDS = Object.freeze([
    'torso_kelo_vanguard','legs_kelo_vanguard','feet_kelo_vanguard',
    'head_vanguard_crown','head_night_visor','weapon_solar_saber','weapon_onyx_katana'
  ]);
  const ASSETS = Object.freeze([
    asset('vanguard-torso.svg'),asset('vanguard-legs.svg'),asset('vanguard-feet.svg'),
    asset('vanguard-crown.svg'),asset('night-visor.svg'),asset('solar-saber.svg'),asset('onyx-katana.svg')
  ]);

  const pack = Packs.define({
    id:'kelo-vanguard-v1',
    version:VERSION,
    tags:['kelo','vanguard','starter','modular'],
    items:[
      { id:'torso_kelo_vanguard', slot:'torso', name:'Chaqueta Vanguard', group:'clothing', rarity:'Raro', icon:'◆', tags:['kelo','vanguard','outfit','teal','gold'], visual:sheet('vanguard-torso.svg') },
      { id:'legs_kelo_vanguard', slot:'legs', name:'Pantalón Vanguard', group:'clothing', rarity:'Raro', icon:'◆', tags:['kelo','vanguard','outfit'], visual:sheet('vanguard-legs.svg') },
      { id:'feet_kelo_vanguard', slot:'feet', name:'Botas Vanguard', group:'clothing', rarity:'Raro', icon:'◆', tags:['kelo','vanguard','outfit'], visual:sheet('vanguard-feet.svg') },
      { id:'head_vanguard_crown', slot:'head', name:'Corona Vanguard', group:'equipment', rarity:'Épico', icon:'♜', tags:['helmet','vanguard','gold'], visual:sheet('vanguard-crown.svg') },
      { id:'head_night_visor', slot:'head', name:'Visor Nocturno', group:'equipment', rarity:'Épico', icon:'▰', tags:['helmet','visor','night'], visual:sheet('night-visor.svg') },
      { id:'weapon_solar_saber', slot:'weaponMain', name:'Sable Solar', group:'equipment', rarity:'Épico', icon:'†', tags:['weapon','sword','gold'], visual:weapon('solar-saber.svg') },
      { id:'weapon_onyx_katana', slot:'weaponMain', name:'Katana Ónix', group:'equipment', rarity:'Épico', icon:'╱', tags:['weapon','katana','onyx'], visual:weapon('onyx-katana.svg') }
    ],
    outfits:[
      { id:'outfit_kelo_vanguard', name:'Kelo Vanguard', slots:{ torso:'torso_kelo_vanguard', legs:'legs_kelo_vanguard', feet:'feet_kelo_vanguard' } }
    ]
  });

  root.KELO_CHARACTER_DEMO_KIT_AUDIT = Object.freeze({
    version:VERSION,
    ready:true,
    packId:pack.id,
    outfitId:'outfit_kelo_vanguard',
    pieceIds:PIECE_IDS,
    assets:ASSETS,
    declarative:true,
    sharedVisualFactories:true,
    sharedPackRegistry:true,
    statsFree:true,
    modular:true
  });
  try { root.dispatchEvent(new CustomEvent('kelo:character-demo-kit-ready', { detail:root.KELO_CHARACTER_DEMO_KIT_AUDIT })); } catch (e) {}
})(typeof globalThis !== 'undefined' ? globalThis : window);
