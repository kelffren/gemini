/* KELO-INDEX
 * area: CREATORS / LIBRARY
 * owner: Kelo Creator Library content-type registry
 * keys: CREATOR LIBRARY CHARACTER SKIN WEAPON ARMOR PROP VFX ANIMATION UI MOUNT NPC ABILITY ROUTING
 * purpose: define qué tipos de contenido puede crear Kelo Creators y a qué workspace existente debe dirigirse cada uno
 * public-api: CREATOR_CONTENT_TYPES, getCreatorContentType, listCreatorContentTypes, creatorTypeForProjectType
 * consumes: workspace ids only; no runtime catalogs
 * state-owned: none; pure immutable authoring metadata
 * extension-points: add a content type by routing it to an existing/new documented Creator workspace
 * reuse: Creator Library, future marketplace filters, seasonal/content authoring entry points
 * online: N/A; authoring routing only
 * do-not: no runtime asset catalog, no gameplay authority, no duplicate editor implementations
 */

const freezeList=value=>Object.freeze(value.map(row=>Object.freeze(row)));
const type=(id,label,group,workspaceId,{icon='◇',description='',projectTypes=[],kind='definition',runtimeOwner='content-owner',tools=[],marketable=true,defaults={}}={})=>Object.freeze({
  id,label,group,workspaceId,icon,description,kind,runtimeOwner,marketable,
  projectTypes:Object.freeze(projectTypes.map(v=>String(v).toUpperCase())),
  tools:Object.freeze([...tools]),defaults:Object.freeze({...defaults})
});

export const CREATOR_CONTENT_TYPES=freezeList([
  type('character','Character','CHARACTERS','avatar',{icon:'♟',description:'Create/import a playable character or NPC visual base.',kind:'visual',runtimeOwner:'KeloCharacterCustomization + KeloAvatar',tools:['image-lab','asset-forge'],marketable:true}),
  type('skin','Skin / Clothing','CHARACTERS','appearance',{icon:'◆',description:'Outfits, clothing, cosmetics and visual equipment.',projectTypes:['APPEARANCE'],kind:'appearance',runtimeOwner:'KeloAppearance',tools:['image-lab','asset-forge'],defaults:{target:'character'}}),
  type('weapon','Weapon','ITEMS','item',{icon:'⚔',description:'Weapon definition plus its art, icon and animation references.',projectTypes:['ITEM'],kind:'item',runtimeOwner:'KeloEquipment + KeloAbilities',tools:['image-lab','asset-forge','animation'],defaults:{itemType:'weapon'}}),
  type('armor','Armor','ITEMS','item',{icon:'⬟',description:'Armor/equipment definition with visual references.',projectTypes:['ITEM'],kind:'item',runtimeOwner:'KeloEquipment + KeloAppearance',tools:['image-lab','asset-forge'],defaults:{itemType:'armor'}}),
  type('item','Item','ITEMS','item',{icon:'◇',description:'Inventory, crafting, consumable or quest item.',projectTypes:['ITEM'],kind:'item',runtimeOwner:'inventory/equipment owners',tools:['image-lab','asset-forge']}),
  type('prop','Prop / Object','WORLD','asset-forge',{icon:'▣',description:'Trees, rocks, lamps, furniture and reusable world objects.',kind:'asset',runtimeOwner:'KELO_PROPERTY_CATALOG + KELO_PROP_CONTRACT',tools:['image-lab','asset-sheet'],defaults:{category:'prop'}}),
  type('furniture','Furniture','WORLD','asset-forge',{icon:'▤',description:'Placeable interior/exterior furniture prepared as reusable art.',kind:'asset',runtimeOwner:'KELO_PROPERTY_CATALOG + PropertySystem',tools:['image-lab','asset-sheet'],defaults:{category:'decoration'}}),
  type('environment','Environment','WORLD','environment',{icon:'☼',description:'Biome mood, weather, time and ambient direction.',projectTypes:['ENVIRONMENT'],kind:'definition',runtimeOwner:'environment owners',tools:['image-lab','asset-forge']}),
  type('prefab','Prefab','WORLD','prefab',{icon:'▦',description:'Reusable compositions that reference existing assets.',projectTypes:['PREFAB'],kind:'definition',runtimeOwner:'KELO_WORLD_RENDERER + property/world contracts',tools:['asset-forge','world']}),
  type('world','World / Scene','WORLD','world',{icon:'⌘',description:'Compose and place approved assets inside the world editor.',kind:'world',runtimeOwner:'Studio Kernel + KELO_WORLD_EDIT',tools:['map-forge'],marketable:false}),
  type('map','Map Forge','WORLD','map-forge',{icon:'⌗',description:'Generate and compose map layouts without creating a second runtime.',kind:'world',runtimeOwner:'KeloMapForge',tools:['world'],marketable:false}),
  type('vfx','VFX','VISUAL','vfx',{icon:'✦',description:'Visual effects routed through the existing visual system.',projectTypes:['VFX'],kind:'visual',runtimeOwner:'KeloVisualSystem',tools:['image-lab','animation']}),
  type('animation','Animation','VISUAL','animation',{icon:'▶',description:'Sprite/frame motion authored against reusable animation contracts.',projectTypes:['ANIMATION'],kind:'visual',runtimeOwner:'animation/avatar consumers',tools:['asset-sheet','image-lab']}),
  type('ui-art','UI Art / Icon','VISUAL','asset-forge',{icon:'▱',description:'Icons, badges and UI sprites prepared as lightweight assets.',kind:'asset',runtimeOwner:'UI consumers',tools:['image-lab'],defaults:{category:'ui'}}),
  type('mount','Mount','GAMEPLAY','mount',{icon:'♞',description:'Data-driven mount definition, appearance and ability references.',projectTypes:['MOUNT'],kind:'definition',runtimeOwner:'KeloMounts + KeloMountCatalog',tools:['image-lab','asset-forge','animation']}),
  type('npc','NPC','GAMEPLAY','npc',{icon:'♟',description:'NPC behavior/faction/dialogue definition with visual references.',projectTypes:['NPC'],kind:'definition',runtimeOwner:'NPC/gameplay owners',tools:['avatar','image-lab']}),
  type('ability','Ability','GAMEPLAY','ability',{icon:'✧',description:'Gameplay ability definition using the existing ability runtime.',projectTypes:['ABILITY'],kind:'definition',runtimeOwner:'KeloAbilities',tools:['vfx','sprite-ability']}),
  type('sprite-ability','Sprite Ability','GAMEPLAY','sprite-ability',{icon:'✹',description:'Ability sprite/effect authoring, repair and test pipeline.',projectTypes:['SPRITE_ABILITY'],kind:'visual',runtimeOwner:'KeloAbilities + KeloVisualSystem',tools:['image-lab']}),
  type('audio','Audio','MEDIA','audio',{icon:'♫',description:'Music/SFX/ambient definition and trigger metadata.',projectTypes:['AUDIO'],kind:'definition',runtimeOwner:'audio consumers',tools:[]}),
  type('cinematic','Cinematic','MEDIA','cinematic',{icon:'▸',description:'Camera/shot pacing definitions and visual references.',projectTypes:['CINEMATIC'],kind:'definition',runtimeOwner:'cinematic consumers',tools:['image-lab']}),
  type('seasonal-pack','Seasonal Pack','PACKS','content-studio',{icon:'❄',description:'Batch content prepared around a season/event using existing content contracts.',kind:'pack',runtimeOwner:'Kelo Universal Content Studio',tools:['image-lab','asset-forge','asset-sheet']})
]);

const byId=new Map(CREATOR_CONTENT_TYPES.map(row=>[row.id,row]));
const preferredProjectType=Object.freeze({ITEM:'item',APPEARANCE:'skin',MOUNT:'mount',NPC:'npc',ABILITY:'ability',SPRITE_ABILITY:'sprite-ability',VFX:'vfx',ANIMATION:'animation',ENVIRONMENT:'environment',PREFAB:'prefab',AUDIO:'audio',CINEMATIC:'cinematic'});

export function getCreatorContentType(id){return byId.get(String(id||'').toLowerCase())||null;}
export function creatorTypeForProjectType(projectType){const id=preferredProjectType[String(projectType||'').toUpperCase()];return id?getCreatorContentType(id):null;}
export function listCreatorContentTypes({group=null,query=''}={}){
  const needle=String(query||'').trim().toLowerCase();
  return CREATOR_CONTENT_TYPES.filter(row=>(!group||row.group===String(group).toUpperCase())&&(!needle||`${row.id} ${row.label} ${row.description} ${row.runtimeOwner}`.toLowerCase().includes(needle)));
}
