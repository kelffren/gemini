/* KELO-INDEX
 * area: CORE / INVENTORY STATE
 * owner: KeloInventory
 * purpose: owner único de identidad, colecciones portátiles, cantidades, snapshots y persistencia del dominio inventory
 * public-api: KeloInventory
 * consumes: legacy STATE + saveState
 * state-owned: STATE.inventory y acceso coordinado a item arrays de warehouse/market_escrow/emote_loadout
 * extension-points: addItem/removeItem/replaceItems/setQuantity/snapshot/restore
 * reuse: todo sistema que lea o mueva items portátiles debe consumir esta API antes de tocar STATE directamente
 * legacy: STATE y saveState siguen definidos por engine-a; este owner es la frontera Foundation sobre ese estado
 * do-not: NO crear otra identidad de item, otro stack helper ni mutar STATE.inventory directamente en features nuevas
 */
(function(){
'use strict';
if(window.KeloInventory)return;
const VERSION='inventory-state-v1.0.0';
const CONTAINER_PATHS=Object.freeze({
  backpack:null,
  warehouse:'warehouse',
  market_escrow:'marketEscrow',
  emote_loadout:'emoteLoadout'
});
function rootState(){return typeof STATE==='undefined'?null:STATE;}
function ensure(){
  const s=rootState();
  if(!s)return null;
  if(!Array.isArray(s.inventory))s.inventory=[];
  return s;
}
function persist(){if(typeof saveState==='function')saveState();}
function deepClone(v){return v==null?v:JSON.parse(JSON.stringify(v));}
function items(type){
  const s=ensure();if(!s)return null;
  type=String(type||'backpack');
  if(type==='backpack')return s.inventory;
  const path=CONTAINER_PATHS[type];
  if(!path)return null;
  const container=s[path];
  return container&&Array.isArray(container.items)?container.items:null;
}
function getItems(type){return items(type)||[];}
function itemIdentity(item){
  if(!item||typeof item!=='object')return null;
  if(item.id!=null)return String(item.id);
  if(item.uid!=null)return String(item.uid);
  if(item._backpackId!=null)return String(item._backpackId);
  return null;
}
function ensureIdentity(item,index){
  if(!item||typeof item!=='object')return null;
  let id=itemIdentity(item);
  if(id)return id;
  item._backpackId='bp_'+Date.now().toString(36)+'_'+String(index||0).toString(36)+'_'+Math.random().toString(36).slice(2,8);
  return String(item._backpackId);
}
function keyForItem(item,index){
  if(!item||typeof item!=='object')return null;
  if(item.id!=null)return 'id:'+String(item.id);
  if(item.uid!=null)return 'uid:'+String(item.uid);
  return 'bp:'+ensureIdentity(item,index);
}
function quantity(item){return Math.max(1,Math.floor(Number(item&&item.quantity)||1));}
function stackLimit(item){return Math.max(1,Math.floor(Number(item&&item.maxStack)||1));}
function stackSignature(item){
  if(!item||item.kind==='equipment'||item.kind==='emote'||stackLimit(item)<=1)return null;
  if(item.stackKey)return 'stack:'+String(item.stackKey);
  if(item.templateId)return 'template:'+String(item.templateId);
  if(item.typeId)return 'type:'+String(item.typeId)+':tier:'+String(item.tier||'')+':quality:'+String(item.quality||'');
  return null;
}
function canStack(a,b){const x=stackSignature(a),y=stackSignature(b);return !!(x&&y&&x===y);}
function itemMap(input){
  const list=Array.isArray(input)?input:getItems(input||'backpack');
  const map=new Map();
  list.forEach(function(item,index){const key=keyForItem(item,index);if(key&&!map.has(key))map.set(key,item);});
  return map;
}
function indexOfItem(type,itemOrKey){
  const list=items(type);if(!list)return -1;
  if(typeof itemOrKey==='string')return list.findIndex(function(item,index){return keyForItem(item,index)===itemOrKey;});
  return list.indexOf(itemOrKey);
}
function findByKey(type,key){const list=items(type);if(!list)return null;const index=indexOfItem(type,key);return index>=0?list[index]:null;}
function addItem(type,item,options){
  options=options||{};const list=items(type);if(!list||!item||typeof item!=='object')return {ok:false,error:'INVALID_ITEM_CONTAINER'};
  const key=keyForItem(item,list.length);if(indexOfItem(type,key)>=0)return {ok:false,error:'DUPLICATE_IDENTITY',key};
  list.push(item);if(options.persist!==false)persist();return {ok:true,item,key,index:list.length-1};
}
function removeItem(type,itemOrKey,options){
  options=options||{};const list=items(type);if(!list)return {ok:false,error:'INVALID_CONTAINER'};
  const index=indexOfItem(type,itemOrKey);if(index<0)return {ok:false,error:'ITEM_NOT_FOUND'};
  const removed=list.splice(index,1)[0];if(options.persist!==false)persist();return {ok:true,item:removed,index};
}
function replaceItems(type,next,options){
  options=options||{};const s=ensure();if(!s||!Array.isArray(next))return {ok:false,error:'INVALID_REPLACEMENT'};
  type=String(type||'backpack');
  if(type==='backpack')s.inventory=next;
  else{
    const path=CONTAINER_PATHS[type];if(!path||!s[path]||typeof s[path]!=='object')return {ok:false,error:'INVALID_CONTAINER'};
    s[path].items=next;
  }
  if(options.persist!==false)persist();return {ok:true,count:next.length};
}
function setQuantity(item,value,options){
  options=options||{};if(!item||typeof item!=='object')return {ok:false,error:'INVALID_ITEM'};
  const n=Math.max(0,Math.floor(Number(value)||0));item.quantity=n;if(options.persist!==false)persist();return {ok:true,quantity:n};
}
function newIdentity(prefix){return String(prefix||'stack')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);}
function cloneWithNewIdentity(item,overrides){
  const clone=Object.assign({},item||{},overrides||{}),id=newIdentity('stack');
  if(Object.prototype.hasOwnProperty.call(clone,'id'))clone.id=id;
  else if(Object.prototype.hasOwnProperty.call(clone,'uid'))clone.uid=id;
  else clone._backpackId=id;
  return clone;
}
function snapshot(keys){
  const s=ensure();if(!s)return null;
  const list=Array.isArray(keys)&&keys.length?keys:['inventory','backpack','warehouse','marketEscrow','emoteLoadout'];
  const out={};list.forEach(function(key){out[key]=deepClone(s[key]);});return out;
}
function restore(snap,options){
  options=options||{};const s=ensure();if(!s||!snap||typeof snap!=='object')return {ok:false,error:'INVALID_SNAPSHOT'};
  Object.keys(snap).forEach(function(key){s[key]=deepClone(snap[key]);});
  if(options.persist===true)persist();return {ok:true};
}
function identityAudit(types){
  const list=Array.isArray(types)&&types.length?types:Object.keys(CONTAINER_PATHS),seen=new Map(),errors=[];
  list.forEach(function(type){getItems(type).forEach(function(item,index){const key=keyForItem(item,index);if(!key)errors.push({code:'MISSING_IDENTITY',type,index});else if(seen.has(key))errors.push({code:'DUPLICATE_IDENTITY',key,types:[seen.get(key),type]});else seen.set(key,type);});});
  return {ok:errors.length===0,errors,unique:seen.size};
}
ensure();
window.KeloInventory=Object.freeze({
  version:VERSION,
  containerTypes:Object.freeze(Object.keys(CONTAINER_PATHS)),
  ensure,persist,getItems,itemIdentity,ensureIdentity,keyForItem,quantity,stackLimit,stackSignature,canStack,itemMap,indexOfItem,findByKey,addItem,removeItem,replaceItems,setQuantity,cloneWithNewIdentity,snapshot,restore,identityAudit
});
window.KELO_INVENTORY_AUDIT=Object.freeze({
  version:VERSION,
  owner:'KeloInventory',
  legacyState:'STATE',
  persistenceAdapter:'saveState',
  backpackSource:'STATE.inventory',
  identityCompatibility:'id|uid|_backpackId',
  oneIdentityAcrossContainers:true,
  sharedStackContract:true,
  snapshotRollbackPrimitive:true,
  serverAuthoritative:false
});
})();
