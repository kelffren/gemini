/* KELO-INDEX
 * area: TEST / MAP FORGE / STUDIO HANDOFF
 * owner: Map Forge Studio handoff contract audit
 * purpose: prove deterministic city projection into an authority-compatible editable draft without direct LIVE mutation
 * online: validates replaceable KELO_WORLD_EDIT import boundary
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {generateBestOf} from '../src/world/map-forge/map-forge-core.mjs';
import {getMapForgeRecipe} from '../src/world/map-forge/map-forge-recipes.mjs';
import {mapDefinitionToWorldDraftSnapshot,mapForgeDocumentMetadata} from '../src/studio/adapters/map-forge-draft-importer.mjs';

const recipe=getMapForgeRecipe('KELO_ROYAL_CAPITAL_V1');
const run=generateBestOf(recipe,{seed:48291,count:4,assetCatalogVersion:'handoff-ci'});
const map=run.best;
assert(map?.validation?.valid,'best Royal Capital candidate must be valid');
const a=mapDefinitionToWorldDraftSnapshot(map),b=mapDefinitionToWorldDraftSnapshot(map);
assert.deepEqual(a,b,'projection must be deterministic');
const rows=Object.values(a.cells);
assert(rows.length>5000,`city draft should contain real terrain cells; got ${rows.length}`);
assert(rows.some(x=>x.role==='path'),'generated roads must become editable path cells');
assert(rows.some(x=>x.role==='terrain'),'generated terrain must become editable terrain cells');
assert(rows.every(x=>x.material==='grass'||x.material==='marble'),'projection must emit only current runtime materials');
assert.equal(a.worldId,'world:kelo-main');

const mockTemplates=[
  {id:'imperial:fuente-justicia',label:'Fuente de la Justicia',family:'fountain',category:'architecture',width:128,height:128,placeable:true},
  {id:'imperial:kiosco',label:'Kiosco Imperial',family:'market',category:'architecture',width:160,height:160,placeable:true},
  {id:'imperial:arbol-florido-blanco',label:'Árbol Florido Blanco',family:'tree',category:'nature',width:128,height:128,placeable:true},
  {id:'imperial:farola',label:'Farola Imperial',family:'lamp',category:'decor',width:64,height:96,placeable:true},
  {id:'imperial:banco',label:'Banco Imperial',family:'bench',category:'decor',width:128,height:96,placeable:true},
  {id:'imperial:jardinera-curva',label:'Jardinera Imperial Curva',family:'flower garden',category:'decor',width:160,height:160,placeable:true},
  {id:'imperial:topiario',label:'Topiario Imperial',family:'bush',category:'nature',width:96,height:96,placeable:true},
  {id:'imperial:puente',label:'Puente Imperial',family:'harbor bridge',category:'architecture',width:160,height:128,placeable:true},
  {id:'imperial:obelisco',label:'Obelisco Imperial',family:'tower monument',category:'architecture',width:96,height:128,placeable:true}
];
const mockCatalog={list:()=>mockTemplates,get:id=>mockTemplates.find(x=>x.id===id)||null};
const visual=mapDefinitionToWorldDraftSnapshot(map,{assetCatalog:mockCatalog});
assert(visual.placements.length>0,'semantic Map Forge landmarks/decorations must project into Property placements for exterior preview');
assert(visual.placements.some(x=>x.assetId==='imperial:fuente-justicia'),'central fountain landmark must become a real exterior Property placement');
assert(visual.placements.some(x=>x.assetId==='imperial:farola'),'generated lamp decorations must become real exterior Property placements');
assert(visual.placements.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)&&x.x>=0&&x.y>=0),'derived placements must stay inside world coordinates');

const meta=mapForgeDocumentMetadata(map);
assert(meta.tags.includes('map-forge')&&meta.tags.some(x=>x.startsWith('seed:'))&&meta.tags.some(x=>x.startsWith('layout:')));
const importer=fs.readFileSync('src/studio/adapters/map-forge-draft-importer.mjs','utf8');
const world=fs.readFileSync('src/creators/workspaces/world-workspace.mjs','utf8');
const mapWorkspace=fs.readFileSync('src/creators/workspaces/map-forge-workspace.mjs','utf8');
const entry=fs.readFileSync('src/creators/creator-entry.mjs','utf8');
const hub=fs.readFileSync('src/creators/ui/creator-hub.mjs','utf8');
const ui=fs.readFileSync('src/creators/ui/map-forge-workspace.mjs','utf8');
assert(importer.includes("world:draft:create")&&importer.includes('forceNew:true')&&importer.includes("world:draft:import"),'handoff must use World authority draft boundary');
assert(importer.includes('KELO_PROPERTY_ASSET_CATALOG'),'semantic visual projection must reuse the Property asset catalog rather than inventing another asset owner');
for(const bad of['KELO_COLLISION.replaceOwner','KELO_WORLD_RENDERER=','KELO_PROPERTY_SYSTEM.request','obstacles.push'])assert(!importer.includes(bad),`direct LIVE mutation forbidden: ${bad}`);
assert(world.includes('importMapForgeIntoWorldDraft')&&world.includes('openKeloStudioLive'),'World workspace must remain final consumer');
assert(world.includes('previewOnly')&&world.includes("world:preview:enter"),'generated exterior preview must use the existing World authority preview boundary');
assert(mapWorkspace.includes('options={}')&&mapWorkspace.includes('...options'),'Map Forge workspace must forward handoff mode without creating another authority');
assert(entry.includes('registerMapForgeWorkspace')&&entry.includes('openWorkspace,...context'),'Creators must register Map Forge and inject generic workspace routing');
assert(hub.includes("['map-forge','Map Forge','active']"),'Creator Hub must expose Map Forge');
assert(ui.includes('ABRIR EN WORLD EDITOR')&&ui.includes('VER EN MAPA EXTERIOR')&&ui.includes('createMapForgeWorkerClient'),'Map Forge UI must expose generator, editor handoff and exterior preview');
assert(ui.includes('for(const [i,d] of (map.districts||[]).entries())'),'Map Forge preview must destructure Array.entries() as [index,district] so canvas rendering cannot crash on d.bounds');
console.log(JSON.stringify({ok:true,seed:map.metadata.seed,score:map.quality.total,cells:rows.length,paths:rows.filter(x=>x.role==='path').length,terrain:rows.filter(x=>x.role==='terrain').length,placements:visual.placements.length,layoutHash:map.metadata.layoutHash},null,2));
