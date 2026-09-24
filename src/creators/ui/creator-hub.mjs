/* KELO-INDEX
 * area: CREATORS / HUB UI
 * owner: Kelo Creator Hub
 * owns: creator project navigation shell only
 * does-not-own: global navigation, Studio implementation, project persistence, permissions or publish policy
 * lazy: imported only after explicit CREATORS action; active cards dispatch through workspace registry
 * mobile: World launch paints Studio chrome immediately; Hub stays parked until .ks-status exists without a loading flag and is restored if the editor never mounts
 */
import { bootKeloCreators } from '../creator-entry.mjs?v=world-editor-20260924-2';

let active=null;

const CATALOG=Object.freeze([
  {category:'BUILD',items:[['world','World','active'],['map-forge','Map Forge','active'],['parcel','Parcel','active'],['dungeon','Dungeon','active'],['game-mode','Game Mode','active']]},
  {category:'GAMEPLAY',items:[['mount','Mount','active'],['ability','Ability','active'],['sprite-ability','Sprite Ability','active'],['npc','NPC','active'],['quest','Quest / Dialogue','active'],['item','Item','active'],['crafting','Crafting','active']]},
  {category:'VISUAL',items:[['avatar','Avatar','active'],['asset-sheet','Asset Sheet Studio','active'],['appearance','Appearance','active'],['animation','Animation','active'],['vfx','VFX','active'],['cinematic','Cinematic','active']]},
  {category:'CONTENT',items:[['content-studio','Content Studio','active'],['scene-kit','Scene Kit','active'],['prefab','Prefab','active'],['environment','Environment','active'],['audio','Audio','active']]}
]);
