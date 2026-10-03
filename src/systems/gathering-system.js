/* KELO-INDEX
 * area: PVE / GATHERING
 * owner: KeloGathering
 * purpose: definitions + deterministic extraction requests for world resource nodes
 * public-api: getResource/getNode/canGather/previewGather/gather
 * consumes: authority adapter; future KeloContainers
 * state-owned: none; depletion/respawn belongs to authority
 * online: server validates node revision, tool, depletion and rewards
 * do-not: NO inventory writes, NO timers, NO respawn loop
 */
(function(root,factory){'use strict';const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.KeloGathering=Object.freeze(api);})(typeof globalThis!=='undefined'?globalThis:this,function(){'use strict';
const VERSION='gathering-v1.0.0';
const RESOURCES=Object.freeze([
{id:'wheat',family:'crop',quality:[35,75]},{id:'olive',family:'crop',quality:[40,82]},{id:'iron_ore',family:'ore',quality:[30,78]},{id:'wood',family:'wood',quality:[35,80]},{id:'herb',family:'herb',quality:[45,90]},{id:'raw_fish',family:'fish',quality:[30,88]}
].map(Object.freeze));
const NODES=Object.freeze([
{id:'wheat_field',resourceId:'wheat',tool:null,skill:0,charges:8,baseYield:[1,3],respawnPolicy:'regional'},
{id:'olive_tree',resourceId:'olive',tool:null,skill:0,charges:6,baseYield:[1,3],respawnPolicy:'regional'},
{id:'iron_vein',resourceId:'iron_ore',tool:'pickaxe',skill:1,charges:5,baseYield:[1,2],respawnPolicy:'regional'},
{id:'timber_tree',resourceId:'wood',tool:'axe',skill:1,charges:4,baseYield:[1,2],respawnPolicy:'regional'},
{id:'herb_patch',resourceId:'herb',tool:null,skill:0,charges:4,baseYield:[1,2],respawnPolicy:'regional'},
{id:'fishing_spot',resourceId:'raw_fish',tool:'fishing_rod',skill:1,charges:6,baseYield:[1,2],respawnPolicy:'regional'}
].map(Object.freeze));
const nodeMap=new Map(NODES.map(x=>[x.id,x])),resMap=new Map(RESOURCES.map(x=>[x.id,x]));
const clone=x=>x?JSON.parse(JSON.stringify(x)):null,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function getResource(id){return clone(resMap.get(String(id)));}function getNode(id){return clone(nodeMap.get(String(id)));}
function canGather(nodeId,ctx){const n=nodeMap.get(String(nodeId));if(!n)return{ok:false,error:'NODE_NOT_FOUND'};const c=ctx||{};if(n.tool&&!(c.tools||[]).includes(n.tool))return{ok:false,error:'TOOL_REQUIRED',tool:n.tool};if((Number(c.skill)||0)<n.skill)return{ok:false,error:'SKILL_REQUIRED',skill:n.skill};if(c.availableCharges!=null&&Number(c.availableCharges)<=0)return{ok:false,error:'NODE_DEPLETED'};return{ok:true};}
function previewGather(nodeId,ctx){const n=nodeMap.get(String(nodeId));if(!n)return null;const r=resMap.get(n.resourceId),c=ctx||{},expertise=Math.max(0,Number(c.expertise)||0),toolQuality=Math.max(0,Number(c.toolQuality)||0),quality=clamp(Math.round((r.quality[0]+r.quality[1])/2+expertise*.1+toolQuality*.05),1,100);return{resourceId:n.resourceId,quantity:n.baseYield[0],quality};}
async function gather(command,authority){const c=command||{},check=canGather(c.nodeId,c);if(!check.ok)return check;if(!authority||typeof authority.transact!=='function')return{ok:false,error:'AUTHORITY_ADAPTER_REQUIRED'};return authority.transact({type:'GatherResource',nodeId:String(c.nodeId),nodeRevision:c.nodeRevision==null?null:String(c.nodeRevision),toolId:c.toolId||null,skill:Number(c.skill)||0,expertise:Number(c.expertise)||0});}
return Object.freeze({version:VERSION,resources:RESOURCES,nodes:NODES,getResource,getNode,canGather,previewGather,gather});});