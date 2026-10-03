/* KELO-INDEX
 * area: PVE / ACTORS
 * owner: KeloPvEActors
 * purpose: catálogo data-driven de criaturas y lifecycle puro de actor PvE
 * public-api: getDefinition/createActor/isAlive
 * consumes: KeloCombatEngine externally
 * state-owned: no registry global; encounter/authority owns live actor instances
 * do-not: NO render, NO AI loop, NO damage engine
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloPvEActors=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='pve-actors-v1.0.0';
const DEFS=Object.freeze([
{id:'verdant_wolf',family:'beast',role:'skirmisher',levelBand:[1,4],stats:{hp:55,moveSpeed:1.15},brainProfile:'pack_melee',lootTableId:'wolf_basic',spawnCost:1,habitatTags:['forest','farm_edge']},
{id:'bandit_raider',family:'bandit',role:'bruiser',levelBand:[2,6],stats:{hp:90,moveSpeed:1},brainProfile:'melee_guard',lootTableId:'bandit_basic',spawnCost:2,habitatTags:['road','camp']},
{id:'bandit_archer',family:'bandit',role:'ranged',levelBand:[2,6],stats:{hp:60,moveSpeed:1},brainProfile:'ranged_kite',lootTableId:'bandit_basic',spawnCost:2,habitatTags:['road','camp']},
{id:'bandit_captain',family:'bandit',role:'elite',levelBand:[5,8],stats:{hp:260,moveSpeed:1.05},brainProfile:'captain',lootTableId:'bandit_captain',spawnCost:6,habitatTags:['camp']}
].map(Object.freeze));const map=new Map(DEFS.map(x=>[x.id,x]));const clone=x=>x?JSON.parse(JSON.stringify(x)):null;
function getDefinition(id){return clone(map.get(String(id)));}
function createActor(defId,opts){const d=map.get(String(defId));if(!d)return null;const o=opts||{},level=Math.max(d.levelBand[0],Math.min(d.levelBand[1],Math.floor(Number(o.level)||d.levelBand[0]))),hpScale=1+(level-d.levelBand[0])*.12,maxHp=Math.round(d.stats.hp*hpScale);return{id:String(o.id||defId+'_'+String(o.seed||'actor')),definitionId:d.id,family:d.family,role:d.role,level,x:Number(o.x)||0,y:Number(o.y)||0,hp:maxHp,maxHp,moveSpeed:d.stats.moveSpeed,brainProfile:d.brainProfile,lootTableId:d.lootTableId,encounterId:o.encounterId||null,state:'idle',targetId:null,spawnedAt:Number(o.spawnedAt)||0};}
function isAlive(a){return!!a&&Number(a.hp)>0&&a.state!=='dead';}
return Object.freeze({version:VERSION,definitions:DEFS,getDefinition,createActor,isAlive});});