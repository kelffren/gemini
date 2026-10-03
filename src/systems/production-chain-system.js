/* KELO-INDEX
 * area: ECON / PRODUCTION
 * owner: KeloProductionChain
 * keys: PRODUCTION RECIPE STATION INPUT OUTPUT QUALITY EXPERTISE AUTOMATION
 * purpose: motor data-driven para transformar recursos en cadenas productivas reutilizables
 * public-api: definitions/getRecipe/canCraft/craft/previewQuality/listRecipes
 * consumes: KeloArtisanProfession opcional
 * state-owned: none; inventario/autoridad se inyectan por adapter
 * online: craft recibe un authority adapter; servidor sustituye el adapter sin cambiar recetas/UI
 */
(function(root,factory){
'use strict';
const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;
if(root)root.KeloProductionChain=Object.freeze(api);
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const VERSION='production-chain-v1.0.0';
const RECIPES=Object.freeze([
 {id:'olive_paste',station:'mill',job:'miller',seconds:12,inputs:{olive:4},outputs:{olive_paste:1},xp:8},
 {id:'olive_oil',station:'oil_press',job:'oil_maker',seconds:24,inputs:{olive_paste:2,empty_vessel:1},outputs:{olive_oil:1},xp:18},
 {id:'flour',station:'mill',job:'miller',seconds:10,inputs:{wheat:3},outputs:{flour:1},xp:6},
 {id:'bread',station:'bakery',job:'baker',seconds:18,inputs:{flour:2},outputs:{bread:1},xp:12},
 {id:'wine',station:'fermenter',job:'vintner',seconds:45,inputs:{grape:5,empty_vessel:1},outputs:{wine:1},xp:20},
 {id:'iron_ingot',station:'smelter',job:'smith',seconds:20,inputs:{iron_ore:3,coal:1},outputs:{iron_ingot:1},xp:15}
].map(Object.freeze));
const byId=new Map(RECIPES.map(r=>[r.id,r]));
const clone=v=>JSON.parse(JSON.stringify(v));
function getRecipe(id){const r=byId.get(String(id));return r?clone(r):null;}
function listRecipes(filter){return RECIPES.filter(r=>!filter||(!filter.station||r.station===filter.station)&&(!filter.job||r.job===filter.job)).map(clone);}
function amount(inv,id){return Math.max(0,Number(inv&&inv[id])||0);}
function canCraft(recipeId,inventory,batches){
 const r=byId.get(String(recipeId)),n=Math.max(1,Math.floor(Number(batches)||1));if(!r)return{ok:false,error:'RECIPE_NOT_FOUND'};
 const missing={};Object.keys(r.inputs).forEach(id=>{const need=r.inputs[id]*n,have=amount(inventory,id);if(have<need)missing[id]=need-have;});
 return Object.keys(missing).length?{ok:false,error:'MISSING_INPUTS',missing}:{ok:true};
}
function previewQuality(ctx){
 const c=ctx||{},material=Math.max(0,Math.min(100,Number(c.materialQuality)||50)),expertise=Math.max(0,Number(c.expertise)||0),station=Math.max(0,Number(c.stationLevel)||1);
 return Math.max(1,Math.min(100,Math.round(material*.72+Math.min(20,expertise*.12)+Math.min(8,(station-1)*2))));
}
async function craft(command,authority){
 const c=command||{},r=byId.get(String(c.recipeId)),n=Math.max(1,Math.floor(Number(c.batches)||1));if(!r)return{ok:false,error:'RECIPE_NOT_FOUND'};
 if(!authority||typeof authority.transact!=='function')return{ok:false,error:'AUTHORITY_ADAPTER_REQUIRED'};
 const payload={type:'CraftProductionRecipe',recipeId:r.id,station:r.station,job:r.job,batches:n,inputs:{},outputs:{},quality:previewQuality(c.qualityContext),xp:r.xp*n};
 Object.keys(r.inputs).forEach(k=>payload.inputs[k]=r.inputs[k]*n);Object.keys(r.outputs).forEach(k=>payload.outputs[k]=r.outputs[k]*n);
 return authority.transact(payload);
}
return Object.freeze({version:VERSION,definitions:RECIPES,getRecipe,listRecipes,canCraft,previewQuality,craft});
});