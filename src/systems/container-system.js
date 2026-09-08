/* KELO-INDEX
 * area: INVENTORY / CONTAINERS
 * owner: KeloContainers
 * keys: BACKPACK WAREHOUSE MARKET ESCROW TRADE TRANSACTION CHECKPOINT IDENTITY
 * purpose: movimiento físico único de items entre contenedores con rollback e identidad estable
 * public-api: KeloContainers.transferItem/checkpoint/restoreCheckpoint/receiveItem/extractItem
 * consumes: KeloBackpack, KeloEquipment, STATE/saveState
 * state-owned: warehouse, marketEscrow, tradeEscrow, emoteLoadout; backpack sigue adaptando STATE.inventory
 * reuse: todo sistema que reserve, mueva, reciba o extraiga items debe pasar por este owner
 * online: el servidor puede replicar la misma semántica transaccional; este owner local no decide autoridad compartida
 * do-not: no mutar arrays de contenedores desde UI ni reutilizar market_escrow para trade
 */
(function(){
'use strict';
const VERSION='container-v1.3.0';
const SCHEMA_VERSION=1;
const WAREHOUSE_CAPACITY=30;
const ESCROW_BASE_CAPACITY=20;
const TRADE_ESCROW_CAPACITY=12;
const EMOTE_LOADOUT_CAPACITY=4;
const OWNER='local_pioneer';
let ensuring=false;
function save(){if(typeof saveState==='function')saveState();}
function keyForItem(item,index){
  if(!item||typeof item!=='object')return null;
  if(item.id)return 'id:'+String(item.id);
  if(item.uid)return 'uid:'+String(item.uid);
  if(!item._backpackId)item._backpackId='bp_'+Date.now().toString(36)+'_'+String(index||0)+'_'+Math.random().toString(36).slice(2,8);
  return 'bp:'+item._backpackId;
}
function normalizeSlots(slots,n){const out=Array.isArray(slots)?slots.slice(0,n):[];while(out.length<n)out.push(null);return out;}
function itemMap(items){const m=new Map();(items||[]).forEach((item,i)=>{const k=keyForItem(item,i);if(k&&!m.has(k))m.set(k,item);});return m;}
function rebuildSlots(slots,items,capacity){
  const valid=itemMap(items),rebuilt=new Array(capacity).fill(null),placed=new Set();
  normalizeSlots(slots,capacity).forEach((k,i)=>{if(k&&valid.has(k)&&!placed.has(k)){rebuilt[i]=k;placed.add(k);}});
  valid.forEach((item,k)=>{if(placed.has(k))return;const free=rebuilt.indexOf(null);if(free>=0){rebuilt[free]=k;placed.add(k);}});
  return rebuilt;
}
function ensureContainerState(current,defaults,minimumCapacity){
  let c=current,changed=false;
  if(!c||typeof c!=='object'){c=Object.assign({},defaults,{slots:[],items:[],permissions:Object.assign({},defaults.permissions)});changed=true;}
  c.schemaVersion=SCHEMA_VERSION;c.id=defaults.id;c.type=defaults.type;c.owner=c.owner||OWNER;
  c.capacity=Math.max(minimumCapacity,Math.floor(Number(c.capacity)||minimumCapacity));
  if(!Array.isArray(c.items)){c.items=[];changed=true;}
  c.permissions=Object.assign({},defaults.permissions,c.permissions||{});
  const rebuilt=rebuildSlots(c.slots,c.items,c.capacity);
  if(JSON.stringify(c.slots)!==JSON.stringify(rebuilt)){c.slots=rebuilt;changed=true;}
  return {container:c,changed};
}
function ensure(){
  if(typeof STATE==='undefined')return null;
  if(ensuring)return STATE.warehouse||null;
  ensuring=true;let changed=false;
  try{
    if(!Array.isArray(STATE.inventory)){STATE.inventory=[];changed=true;}
    if(window.KeloBackpack&&typeof window.KeloBackpack.ensure==='function')window.KeloBackpack.ensure();
    const wh=ensureContainerState(STATE.warehouse,{schemaVersion:SCHEMA_VERSION,id:'warehouse_main',type:'warehouse',owner:OWNER,capacity:WAREHOUSE_CAPACITY,permissions:{deposit:true,withdraw:true,merge:true}},WAREHOUSE_CAPACITY);
    STATE.warehouse=wh.container;changed=changed||wh.changed;
    const me=ensureContainerState(STATE.marketEscrow,{schemaVersion:SCHEMA_VERSION,id:'market_escrow',type:'market_escrow',owner:OWNER,capacity:ESCROW_BASE_CAPACITY,permissions:{deposit:true,withdraw:true,merge:false,elastic:true}},ESCROW_BASE_CAPACITY);
    STATE.marketEscrow=me.container;changed=changed||me.changed;
    const te=ensureContainerState(STATE.tradeEscrow,{schemaVersion:SCHEMA_VERSION,id:'trade_escrow',type:'trade_escrow',owner:OWNER,capacity:TRADE_ESCROW_CAPACITY,permissions:{deposit:true,withdraw:true,merge:false,elastic:false}},TRADE_ESCROW_CAPACITY);
    STATE.tradeEscrow=te.container;changed=changed||te.changed;
    const em=ensureContainerState(STATE.emoteLoadout,{schemaVersion:SCHEMA_VERSION,id:'emote_loadout',type:'emote_loadout',owner:OWNER,capacity:EMOTE_LOADOUT_CAPACITY,permissions:{deposit:true,withdraw:true,merge:false,elastic:false}},EMOTE_LOADOUT_CAPACITY);
    STATE.emoteLoadout=em.container;changed=changed||em.changed;
  }finally{ensuring=false;}
  if(changed)save();return STATE.warehouse;
}
function source(type){
  ensure();
  if(type==='backpack'){
    if(window.KeloBackpack&&typeof window.KeloBackpack.ensure==='function')window.KeloBackpack.ensure();
    return {type:'backpack',id:'backpack',owner:OWNER,items:STATE.inventory,slots:STATE.backpack.slots,capacity:STATE.backpack.capacity,permissions:{deposit:true,withdraw:true,merge:true}};
  }
  if(type==='warehouse')return {type:'warehouse',id:STATE.warehouse.id,owner:STATE.warehouse.owner,items:STATE.warehouse.items,slots:STATE.warehouse.slots,capacity:STATE.warehouse.capacity,permissions:STATE.warehouse.permissions};
  if(type==='market_escrow')return {type:'market_escrow',id:STATE.marketEscrow.id,owner:STATE.marketEscrow.owner,items:STATE.marketEscrow.items,slots:STATE.marketEscrow.slots,capacity:STATE.marketEscrow.capacity,permissions:STATE.marketEscrow.permissions};
  if(type==='trade_escrow')return {type:'trade_escrow',id:STATE.tradeEscrow.id,owner:STATE.tradeEscrow.owner,items:STATE.tradeEscrow.items,slots:STATE.tradeEscrow.slots,capacity:STATE.tradeEscrow.capacity,permissions:STATE.tradeEscrow.permissions};
  if(type==='emote_loadout')return {type:'emote_loadout',id:STATE.emoteLoadout.id,owner:STATE.emoteLoadout.owner,items:STATE.emoteLoadout.items,slots:STATE.emoteLoadout.slots,capacity:STATE.emoteLoadout.capacity,permissions:STATE.emoteLoadout.permissions};
  return null;
}
function quantity(item){return Math.max(1,Math.floor(Number(item&&item.quantity)||1));}
function stackLimit(item){return Math.max(1,Math.floor(Number(item&&item.maxStack)||1));}
function stackSignature(item){if(!item||item.kind==='equipment'||item.kind==='emote'||stackLimit(item)<=1)return null;if(item.stackKey)return 'stack:'+String(item.stackKey);if(item.templateId)return 'template:'+String(item.templateId);if(item.typeId)return 'type:'+String(item.typeId)+':tier:'+String(item.tier||'')+':quality:'+String(item.quality||'');return null;}
function canStack(a,b){const x=stackSignature(a),y=stackSignature(b);return !!(x&&y&&x===y);}
function getSlots(type){const c=source(type);if(!c)return[];const map=itemMap(c.items);return c.slots.map((key,index)=>({index,key:key||null,item:key?map.get(key)||null:null}));}
function getStats(type){const c=source(type);if(!c)return{capacity:0,used:0,free:0};const used=c.slots.filter(Boolean).length;return{id:c.id,type:c.type,owner:c.owner,capacity:c.capacity,used,free:c.capacity-used};}
function newIdentity(clone){const id='stack_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);if(Object.prototype.hasOwnProperty.call(clone,'id'))clone.id=id;else if(Object.prototype.hasOwnProperty.call(clone,'uid'))clone.uid=id;else clone._backpackId=id;return clone;}
function cloneJson(value){return JSON.parse(JSON.stringify(value));}
function cloneState(){ensure();return {inventory:cloneJson(STATE.inventory),backpack:cloneJson(STATE.backpack),warehouse:cloneJson(STATE.warehouse),marketEscrow:cloneJson(STATE.marketEscrow),tradeEscrow:cloneJson(STATE.tradeEscrow),emoteLoadout:cloneJson(STATE.emoteLoadout)};}
function restore(s){if(!s)return false;STATE.inventory=s.inventory;STATE.backpack=s.backpack;STATE.warehouse=s.warehouse;STATE.marketEscrow=s.marketEscrow;STATE.tradeEscrow=s.tradeEscrow;STATE.emoteLoadout=s.emoteLoadout;return true;}
function checkpoint(){return cloneState();}
function restoreCheckpoint(s,options){const ok=restore(cloneJson(s));if(ok&&(!options||options.persist!==false))save();return{ok};}
function allContainerSources(){return['backpack','warehouse','market_escrow','trade_escrow','emote_loadout'].map(source).filter(Boolean);}
function identityExists(key){if(!key)return false;return allContainerSources().some(c=>c.slots.includes(key)||itemMap(c.items).has(key));}
function ensureElasticRoom(dst,item,amount){
  if(!dst||!dst.permissions||dst.permissions.elastic!==true)return;
  const perSlot=stackLimit(item),neededSlots=Math.max(1,Math.ceil(amount/perSlot)),free=dst.slots.filter(k=>!k).length;
  if(free>=neededSlots)return;
  const add=neededSlots-free;
  for(let i=0;i<add;i++)dst.slots.push(null);
  dst.capacity=dst.slots.length;
  if(dst.type==='market_escrow'){STATE.marketEscrow.capacity=dst.capacity;STATE.marketEscrow.slots=dst.slots;}
}
function transferItem(sourceType,destType,itemKey,amount,options){
  options=options||{};
  const src=source(sourceType),dst=source(destType);if(!src||!dst||sourceType===destType)return{ok:false,error:'INVALID_CONTAINER'};
  const srcMap=itemMap(src.items),dstMap=itemMap(dst.items),item=srcMap.get(itemKey);if(!item)return{ok:false,error:'ITEM_NOT_FOUND'};
  const sourceIndex=src.slots.indexOf(itemKey);if(sourceIndex<0)return{ok:false,error:'INVALID_SOURCE'};
  const current=quantity(item);amount=amount==null?current:Math.floor(Number(amount));if(!Number.isInteger(amount)||amount<1||amount>current)return{ok:false,error:'INVALID_AMOUNT'};
  if(sourceType==='backpack'&&item.kind==='equipment'&&window.KeloEquipment&&typeof window.KeloEquipment.isEquipped==='function'&&window.KeloEquipment.isEquipped(item.id))return{ok:false,error:'EQUIPPED_ITEM_PROTECTED'};
  if(destType==='emote_loadout'&&item.kind!=='emote')return{ok:false,error:'EMOTE_ONLY_CONTAINER'};
  ensureElasticRoom(dst,item,amount);
  const compatible=[];let mergeRoom=0;
  if(options.allowMerge!==false&&dst.permissions.merge!==false&&stackSignature(item))dst.slots.forEach((k,i)=>{const target=k?dstMap.get(k):null;if(target&&canStack(item,target)){const room=Math.max(0,stackLimit(target)-quantity(target));if(room){compatible.push({index:i,item:target,room});mergeRoom+=room;}}});
  const emptyCount=dst.slots.filter(k=>!k).length;const available=mergeRoom+emptyCount*stackLimit(item);
  if(available<amount)return{ok:false,error:'DESTINATION_FULL',requested:amount,available};
  const snap=cloneState();let remaining=amount,merged=0,createdKeys=[],preservedIdentity=false,movedItemKey=null;
  try{
    for(const target of compatible){if(!remaining)break;const n=Math.min(target.room,remaining);target.item.quantity=quantity(target.item)+n;remaining-=n;merged+=n;}
    if(amount===current){
      item.quantity=current-merged;
      if(remaining>0){const free=dst.slots.indexOf(null);if(free<0)throw new Error('DESTINATION_FULL');src.slots[sourceIndex]=null;const pos=src.items.indexOf(item);if(pos>=0)src.items.splice(pos,1);dst.items.push(item);dst.slots[free]=itemKey;preservedIdentity=true;movedItemKey=itemKey;remaining=0;}
      else{src.slots[sourceIndex]=null;const pos=src.items.indexOf(item);if(pos>=0)src.items.splice(pos,1);}
    }else{
      item.quantity=current-amount;
      while(remaining>0){const free=dst.slots.indexOf(null);if(free<0)throw new Error('DESTINATION_FULL');const n=Math.min(stackLimit(item),remaining);const clone=newIdentity(Object.assign({},item,{quantity:n,createdAt:Date.now(),splitFrom:item.id||item.uid||item._backpackId||null}));dst.items.push(clone);const key=keyForItem(clone,dst.items.length-1);dst.slots[free]=key;createdKeys.push(key);if(!movedItemKey)movedItemKey=key;remaining-=n;}
    }
    if(options.persist!==false)save();
    return{ok:true,source:sourceType,destination:destType,itemKey,requested:amount,moved:amount,merged,createdKeys,preservedIdentity,movedItemKey,sourceRemaining:amount===current?0:quantity(item)};
  }catch(err){restore(snap);if(options.persist!==false)save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
}
function receiveItem(destType,item,options){
  options=options||{};
  const dst=source(destType);if(!dst)return{ok:false,error:'INVALID_CONTAINER'};
  if(!item||typeof item!=='object')return{ok:false,error:'INVALID_ITEM'};
  const incoming=options.preserveIdentity===true?item:newIdentity(Object.assign({},item));
  incoming.quantity=quantity(incoming);if(stackLimit(incoming)>1)incoming.maxStack=stackLimit(incoming);
  if(incoming.quantity>stackLimit(incoming))return{ok:false,error:'INVALID_STACK_STATE'};
  if(destType==='emote_loadout'&&incoming.kind!=='emote')return{ok:false,error:'EMOTE_ONLY_CONTAINER'};
  const key=keyForItem(incoming,dst.items.length);if(!key)return{ok:false,error:'MISSING_IDENTITY'};
  if(identityExists(key))return{ok:false,error:'DUPLICATE_IDENTITY',itemKey:key};
  ensureElasticRoom(dst,incoming,incoming.quantity);
  const dstMap=itemMap(dst.items),compatible=[];let mergeRoom=0;
  if(options.allowMerge!==false&&dst.permissions.merge!==false&&stackSignature(incoming))dst.slots.forEach((k,i)=>{const target=k?dstMap.get(k):null;if(target&&canStack(incoming,target)){const room=Math.max(0,stackLimit(target)-quantity(target));if(room){compatible.push({index:i,item:target,room});mergeRoom+=room;}}});
  const free=dst.slots.filter(k=>!k).length,available=mergeRoom+free*stackLimit(incoming);if(available<incoming.quantity)return{ok:false,error:'DESTINATION_FULL',requested:incoming.quantity,available};
  const snap=cloneState();let remaining=incoming.quantity,merged=0;
  try{
    for(const target of compatible){if(!remaining)break;const n=Math.min(target.room,remaining);target.item.quantity=quantity(target.item)+n;remaining-=n;merged+=n;}
    if(remaining>0){if(merged>0)incoming.quantity=remaining;const slot=dst.slots.indexOf(null);if(slot<0)throw new Error('DESTINATION_FULL');dst.items.push(incoming);dst.slots[slot]=key;}
    if(options.persist!==false)save();
    return{ok:true,destination:destType,item:remaining>0?incoming:null,itemKey:remaining>0?key:null,moved:quantity(item),merged,preservedIdentity:options.preserveIdentity===true};
  }catch(err){restore(snap);if(options.persist!==false)save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
}
function extractItem(sourceType,itemKey,options){
  options=options||{};
  const src=source(sourceType);if(!src)return{ok:false,error:'INVALID_CONTAINER'};
  const map=itemMap(src.items),item=map.get(itemKey);if(!item)return{ok:false,error:'ITEM_NOT_FOUND'};
  const slot=src.slots.indexOf(itemKey);if(slot<0)return{ok:false,error:'INVALID_SOURCE'};
  if(sourceType==='backpack'&&item.kind==='equipment'&&window.KeloEquipment&&typeof window.KeloEquipment.isEquipped==='function'&&window.KeloEquipment.isEquipped(item.id))return{ok:false,error:'EQUIPPED_ITEM_PROTECTED'};
  const snap=cloneState();
  try{src.slots[slot]=null;const i=src.items.indexOf(item);if(i<0)throw new Error('ITEM_NOT_FOUND');src.items.splice(i,1);if(options.persist!==false)save();return{ok:true,source:sourceType,item,itemKey};}
  catch(err){restore(snap);if(options.persist!==false)save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
}
function auditIdentities(){
  ensure();const seen=new Map(),errors=[];
  allContainerSources().forEach(c=>c.items.forEach((item,index)=>{const key=keyForItem(item,index);if(!key){errors.push({code:'MISSING_IDENTITY',container:c.type,index});return;}if(seen.has(key))errors.push({code:'DUPLICATE_IDENTITY',key,containers:[seen.get(key),c.type]});else seen.set(key,c.type);}));
  return{ok:errors.length===0,errors,uniqueIdentities:seen.size};
}
ensure();
window.KeloContainers=Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,warehouseCapacity:WAREHOUSE_CAPACITY,marketEscrowBaseCapacity:ESCROW_BASE_CAPACITY,tradeEscrowCapacity:TRADE_ESCROW_CAPACITY,emoteLoadoutCapacity:EMOTE_LOADOUT_CAPACITY,ensure,keyForItem,getSlots,getStats,transferItem,receiveItem,extractItem,checkpoint,restoreCheckpoint,auditIdentities,canStack,stackSignature});
window.KELO_CONTAINER_AUDIT=Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,identityRule:'one-item-one-container',containerModel:'separate-item-arrays-shared-contract-v4',transferMode:'validate-prepare-execute-persist-rollback-v3',strictDestinationCapacity:true,warehouseImplemented:true,marketEscrowImplemented:true,marketEscrowMerge:false,marketEscrowElastic:true,tradeEscrowImplemented:true,tradeEscrowMerge:false,tradeEscrowCapacity:TRADE_ESCROW_CAPACITY,emoteLoadoutImplemented:true,emoteLoadoutCapacity:EMOTE_LOADOUT_CAPACITY,emoteOnlyContainer:true,deferredPersistSupported:true,checkpointTransactions:true,detachedReceiveExtract:true,serverAuthoritative:false});
})();