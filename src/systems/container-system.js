/* KELO-INDEX
 * area: INVENTORY / CONTAINERS
 * owner: KeloContainers
 * keys: INVENTORY CONTAINER BACKPACK WAREHOUSE ESCROW DYNAMIC CART TRANSACTION IDENTITY
 * purpose: owner único de contenedores físicos y transferencias; extiende el contrato validado para contenedores arbitrarios sin duplicar inventarios
 * public-api: KeloContainers.ensure/registerContainer/removeContainer/getContainer/getSlots/getStats/transferItem/receiveItem/extractItem/checkpoint/restoreCheckpoint/auditIdentities
 * consumes: STATE, saveState, KeloBackpack, KeloEquipment
 * state-owned: warehouse, marketEscrow, tradeEscrow, emoteLoadout y STATE.dynamicContainers; Backpack conserva STATE.inventory
 * extension-points: registerContainer permite carts/house storage/futuros almacenes con el mismo contrato
 * reuse: todo inventario físico nuevo referencia este owner; nunca crear CartInventorySystem o inventarios paralelos
 * legacy: Backpack permanece en STATE.inventory por compatibilidad validada
 * do-not: NO duplicar una misma identidad entre contenedores; NO meter pricing/economía/UI aquí
 */
(function(root){
'use strict';
const VERSION='container-v1.3.0';
const SCHEMA_VERSION=1;
const WAREHOUSE_CAPACITY=30;
const ESCROW_BASE_CAPACITY=20;
const TRADE_ESCROW_CAPACITY=20;
const EMOTE_LOADOUT_CAPACITY=4;
const OWNER='local_pioneer';
let ensuring=false;
function save(){if(typeof saveState==='function')saveState();}
function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
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
  c.schemaVersion=SCHEMA_VERSION;c.id=String(defaults.id);c.type=String(defaults.type||defaults.id);c.owner=c.owner||defaults.owner||OWNER;
  c.capacity=Math.max(minimumCapacity||1,Math.floor(Number(c.capacity)||minimumCapacity||1));
  if(!Array.isArray(c.items)){c.items=[];changed=true;}
  c.permissions=Object.assign({},defaults.permissions||{},c.permissions||{});
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
    if(root.KeloBackpack&&typeof root.KeloBackpack.ensure==='function')root.KeloBackpack.ensure();
    const wh=ensureContainerState(STATE.warehouse,{id:'warehouse_main',type:'warehouse',owner:OWNER,capacity:WAREHOUSE_CAPACITY,permissions:{deposit:true,withdraw:true,merge:true}},WAREHOUSE_CAPACITY);STATE.warehouse=wh.container;changed=changed||wh.changed;
    const me=ensureContainerState(STATE.marketEscrow,{id:'market_escrow',type:'market_escrow',owner:OWNER,capacity:ESCROW_BASE_CAPACITY,permissions:{deposit:true,withdraw:true,merge:false,elastic:true}},ESCROW_BASE_CAPACITY);STATE.marketEscrow=me.container;changed=changed||me.changed;
    const te=ensureContainerState(STATE.tradeEscrow,{id:'trade_escrow',type:'trade_escrow',owner:OWNER,capacity:TRADE_ESCROW_CAPACITY,permissions:{deposit:true,withdraw:true,merge:false,elastic:false}},TRADE_ESCROW_CAPACITY);STATE.tradeEscrow=te.container;changed=changed||te.changed;
    const em=ensureContainerState(STATE.emoteLoadout,{id:'emote_loadout',type:'emote_loadout',owner:OWNER,capacity:EMOTE_LOADOUT_CAPACITY,permissions:{deposit:true,withdraw:true,merge:false,elastic:false}},EMOTE_LOADOUT_CAPACITY);STATE.emoteLoadout=em.container;changed=changed||em.changed;
    if(!STATE.dynamicContainers||typeof STATE.dynamicContainers!=='object'||Array.isArray(STATE.dynamicContainers)){STATE.dynamicContainers={};changed=true;}
    Object.keys(STATE.dynamicContainers).forEach(function(id){const raw=STATE.dynamicContainers[id];if(!raw||typeof raw!=='object'){delete STATE.dynamicContainers[id];changed=true;return;}const normalized=ensureContainerState(raw,{id:id,type:raw.type||'generic',owner:raw.owner||OWNER,capacity:Math.max(1,Number(raw.capacity)||1),permissions:Object.assign({deposit:true,withdraw:true,merge:true},raw.permissions||{})},Math.max(1,Number(raw.capacity)||1));STATE.dynamicContainers[id]=normalized.container;changed=changed||normalized.changed;});
  }finally{ensuring=false;}
  if(changed)save();return STATE.warehouse;
}
function source(type){
  ensure();const key=String(type||'');
  if(key==='backpack'){if(root.KeloBackpack&&typeof root.KeloBackpack.ensure==='function')root.KeloBackpack.ensure();return {type:'backpack',id:'backpack',owner:OWNER,items:STATE.inventory,slots:STATE.backpack.slots,capacity:STATE.backpack.capacity,permissions:{deposit:true,withdraw:true,merge:true}};}
  if(key==='warehouse'||key==='warehouse_main')return STATE.warehouse;
  if(key==='market_escrow')return STATE.marketEscrow;
  if(key==='trade_escrow')return STATE.tradeEscrow;
  if(key==='emote_loadout')return STATE.emoteLoadout;
  return STATE.dynamicContainers&&STATE.dynamicContainers[key]||null;
}
function registerContainer(definition,options){
  ensure();const def=definition||{},id=String(def.id||'').trim();if(!id)return{ok:false,error:'INVALID_CONTAINER_ID'};
  const exists=STATE.dynamicContainers[id];if(exists&&!(options&&options.update))return{ok:true,created:false,container:exists};
  const minimum=Math.max(1,Math.floor(Number(def.capacity)||(exists&&exists.capacity)||1));
  const normalized=ensureContainerState(exists,Object.assign({id:id,type:def.type||'generic',owner:def.owner||OWNER,capacity:minimum,permissions:{deposit:true,withdraw:true,merge:true}},def),minimum);
  STATE.dynamicContainers[id]=normalized.container;if(!options||options.persist!==false)save();return{ok:true,created:!exists,container:normalized.container};
}
function removeContainer(id,options){
  ensure();const key=String(id||''),c=STATE.dynamicContainers[key];if(!c)return{ok:false,error:'CONTAINER_NOT_FOUND'};
  if(!(options&&options.force)&&((c.items&&c.items.length)||(c.slots||[]).some(Boolean)))return{ok:false,error:'CONTAINER_NOT_EMPTY'};
  delete STATE.dynamicContainers[key];if(!options||options.persist!==false)save();return{ok:true,id:key};
}
function quantity(item){return Math.max(1,Math.floor(Number(item&&item.quantity)||1));}
function stackLimit(item){return Math.max(1,Math.floor(Number(item&&item.maxStack)||1));}
function stackSignature(item){if(!item||item.kind==='equipment'||item.kind==='emote'||stackLimit(item)<=1)return null;if(item.stackKey)return 'stack:'+String(item.stackKey);if(item.templateId)return 'template:'+String(item.templateId);if(item.resourceId)return 'resource:'+String(item.resourceId)+':tier:'+String(item.tier||'T1');if(item.typeId)return 'type:'+String(item.typeId)+':tier:'+String(item.tier||'')+':quality:'+String(item.quality||'');return null;}
function canStack(a,b){const x=stackSignature(a),y=stackSignature(b);return !!(x&&y&&x===y);}
function getSlots(type){const c=source(type);if(!c)return[];const map=itemMap(c.items);return c.slots.map((key,index)=>({index,key:key||null,item:key?map.get(key)||null:null}));}
function getStats(type){const c=source(type);if(!c)return{capacity:0,used:0,free:0};const used=c.slots.filter(Boolean).length;return{id:c.id,type:c.type,owner:c.owner,capacity:c.capacity,used:used,free:c.capacity-used};}
function getContainer(type){return source(type);}
function newIdentity(item,prefix){const id=(prefix||'stack')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);if(Object.prototype.hasOwnProperty.call(item,'id'))item.id=id;else if(Object.prototype.hasOwnProperty.call(item,'uid'))item.uid=id;else item._backpackId=id;return item;}
function cloneState(){return {inventory:clone(STATE.inventory),backpack:clone(STATE.backpack),warehouse:clone(STATE.warehouse),marketEscrow:clone(STATE.marketEscrow),tradeEscrow:clone(STATE.tradeEscrow),emoteLoadout:clone(STATE.emoteLoadout),dynamicContainers:clone(STATE.dynamicContainers)};}
function restore(snapshot){STATE.inventory=snapshot.inventory;STATE.backpack=snapshot.backpack;STATE.warehouse=snapshot.warehouse;STATE.marketEscrow=snapshot.marketEscrow;STATE.tradeEscrow=snapshot.tradeEscrow;STATE.emoteLoadout=snapshot.emoteLoadout;STATE.dynamicContainers=snapshot.dynamicContainers||{};}
function checkpoint(){ensure();return cloneState();}
function restoreCheckpoint(snapshot,options){if(!snapshot)return false;restore(clone(snapshot));if(!options||options.persist!==false)save();return true;}
function ensureElasticRoom(dst,item,amount){if(!dst||!dst.permissions||dst.permissions.elastic!==true)return;const needed=Math.max(1,Math.ceil(amount/stackLimit(item))),free=dst.slots.filter(k=>!k).length;if(free>=needed)return;for(let i=0;i<needed-free;i++)dst.slots.push(null);dst.capacity=dst.slots.length;}
function availableRoom(dst,item,allowMerge){let room=0;if(allowMerge!==false&&dst.permissions.merge!==false&&stackSignature(item)){const map=itemMap(dst.items);dst.slots.forEach(function(k){const target=k?map.get(k):null;if(target&&canStack(item,target))room+=Math.max(0,stackLimit(target)-quantity(target));});}room+=dst.slots.filter(k=>!k).length*stackLimit(item);return room;}
function guardSourceItem(containerId,item){if(containerId==='backpack'&&item.kind==='equipment'&&root.KeloEquipment&&typeof root.KeloEquipment.isEquipped==='function'&&root.KeloEquipment.isEquipped(item.id))return'EQUIPPED_ITEM_PROTECTED';return null;}
function transferItem(sourceType,destType,itemKey,amount,options){
  options=options||{};const src=source(sourceType),dst=source(destType);if(!src||!dst||src.id===dst.id)return{ok:false,error:'INVALID_CONTAINER'};
  const srcMap=itemMap(src.items),dstMap=itemMap(dst.items),item=srcMap.get(itemKey);if(!item)return{ok:false,error:'ITEM_NOT_FOUND'};const sourceIndex=src.slots.indexOf(itemKey);if(sourceIndex<0)return{ok:false,error:'INVALID_SOURCE'};
  const protectedError=guardSourceItem(sourceType,item);if(protectedError)return{ok:false,error:protectedError};
  const current=quantity(item);amount=amount==null?current:Math.floor(Number(amount));if(!Number.isInteger(amount)||amount<1||amount>current)return{ok:false,error:'INVALID_AMOUNT'};
  if(destType==='emote_loadout'&&item.kind!=='emote')return{ok:false,error:'EMOTE_ONLY_CONTAINER'};
  ensureElasticRoom(dst,item,amount);if(availableRoom(dst,item,options.allowMerge)<amount)return{ok:false,error:'DESTINATION_FULL',requested:amount,available:availableRoom(dst,item,options.allowMerge)};
  const snap=checkpoint();let remaining=amount,merged=0,createdKeys=[],preservedIdentity=false,movedItemKey=null;
  try{
    if(options.allowMerge!==false&&dst.permissions.merge!==false&&stackSignature(item))dst.slots.forEach(function(k){if(!remaining||!k)return;const target=dstMap.get(k);if(!target||!canStack(item,target))return;const room=Math.max(0,stackLimit(target)-quantity(target)),n=Math.min(room,remaining);if(n){target.quantity=quantity(target)+n;remaining-=n;merged+=n;}});
    if(amount===current){
      item.quantity=current-merged;
      if(remaining>0){const free=dst.slots.indexOf(null);if(free<0)throw new Error('DESTINATION_FULL');src.slots[sourceIndex]=null;const pos=src.items.indexOf(item);if(pos>=0)src.items.splice(pos,1);dst.items.push(item);dst.slots[free]=itemKey;preservedIdentity=true;movedItemKey=itemKey;remaining=0;}else{src.slots[sourceIndex]=null;const pos=src.items.indexOf(item);if(pos>=0)src.items.splice(pos,1);}
    }else{
      item.quantity=current-amount;
      while(remaining>0){const free=dst.slots.indexOf(null);if(free<0)throw new Error('DESTINATION_FULL');const n=Math.min(stackLimit(item),remaining),piece=newIdentity(Object.assign({},item,{quantity:n,createdAt:Date.now(),splitFrom:item.id||item.uid||item._backpackId||null}));dst.items.push(piece);const key=keyForItem(piece,dst.items.length-1);dst.slots[free]=key;createdKeys.push(key);if(!movedItemKey)movedItemKey=key;remaining-=n;}
    }
    if(options.persist!==false)save();return{ok:true,source:sourceType,destination:destType,itemKey:itemKey,requested:amount,moved:amount,merged:merged,createdKeys:createdKeys,preservedIdentity:preservedIdentity,movedItemKey:movedItemKey,sourceRemaining:amount===current?0:quantity(item)};
  }catch(err){restore(snap);if(options.persist!==false)save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
}
function receiveItem(containerId,item,options){
  options=options||{};const dst=source(containerId);if(!dst||!item||typeof item!=='object')return{ok:false,error:'INVALID_RECEIVE'};const incoming=clone(item),amount=quantity(incoming);ensureElasticRoom(dst,incoming,amount);if(availableRoom(dst,incoming,options.allowMerge)<amount)return{ok:false,error:'DESTINATION_FULL'};
  const snap=checkpoint();let remaining=amount,firstItem=null,firstKey=null;
  try{
    const map=itemMap(dst.items);
    if(options.allowMerge!==false&&dst.permissions.merge!==false&&stackSignature(incoming))dst.slots.forEach(function(k){if(!remaining||!k)return;const target=map.get(k);if(!target||!canStack(incoming,target))return;const n=Math.min(Math.max(0,stackLimit(target)-quantity(target)),remaining);if(n){target.quantity=quantity(target)+n;remaining-=n;if(!firstItem){firstItem=target;firstKey=k;}}});
    let firstPiece=true;
    while(remaining>0){const free=dst.slots.indexOf(null);if(free<0)throw new Error('DESTINATION_FULL');const n=Math.min(stackLimit(incoming),remaining),piece=Object.assign({},incoming,{quantity:n});if(!(options.preserveIdentity===true&&firstPiece))newIdentity(piece,'recv');let key=keyForItem(piece,dst.items.length);if(dst.slots.indexOf(key)>=0){newIdentity(piece,'recv');key=keyForItem(piece,dst.items.length);}dst.items.push(piece);dst.slots[free]=key;if(!firstItem){firstItem=piece;firstKey=key;}firstPiece=false;remaining-=n;}
    if(options.persist!==false)save();return{ok:true,containerId:dst.id,item:firstItem,itemKey:firstKey,quantity:amount};
  }catch(err){restore(snap);if(options.persist!==false)save();return{ok:false,error:'ROLLBACK',reason:String(err&&err.message||err)};}
}
function extractItem(containerId,itemKey,options){
  options=options||{};const src=source(containerId);if(!src)return{ok:false,error:'INVALID_CONTAINER'};const map=itemMap(src.items),item=map.get(String(itemKey));if(!item)return{ok:false,error:'ITEM_NOT_FOUND'};const protectedError=guardSourceItem(containerId,item);if(protectedError)return{ok:false,error:protectedError};const current=quantity(item),amount=options.amount==null?current:Math.floor(Number(options.amount));if(!Number.isInteger(amount)||amount<1||amount>current)return{ok:false,error:'INVALID_AMOUNT'};
  const index=src.slots.indexOf(String(itemKey));if(index<0)return{ok:false,error:'INVALID_SOURCE'};let out;
  if(amount===current){out=item;src.slots[index]=null;const pos=src.items.indexOf(item);if(pos>=0)src.items.splice(pos,1);}else{item.quantity=current-amount;out=newIdentity(Object.assign({},item,{quantity:amount,splitFrom:item.id||item.uid||item._backpackId||null}),'extract');}
  if(options.persist!==false)save();return{ok:true,item:out,quantity:amount,sourceRemaining:amount===current?0:quantity(item)};
}
function allContainers(){ensure();const out=[source('backpack'),STATE.warehouse,STATE.marketEscrow,STATE.tradeEscrow,STATE.emoteLoadout];Object.keys(STATE.dynamicContainers||{}).forEach(id=>out.push(STATE.dynamicContainers[id]));return out.filter(Boolean);}
function auditIdentities(){const seen=new Map(),duplicates=[];allContainers().forEach(function(c){(c.items||[]).forEach(function(item,i){const key=keyForItem(item,i);if(seen.has(key))duplicates.push({identity:key,first:seen.get(key),second:c.id});else seen.set(key,c.id);});});return{ok:duplicates.length===0,duplicates:duplicates,containers:allContainers().length,identities:seen.size};}
ensure();
root.KeloContainers=Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,warehouseCapacity:WAREHOUSE_CAPACITY,marketEscrowBaseCapacity:ESCROW_BASE_CAPACITY,tradeEscrowCapacity:TRADE_ESCROW_CAPACITY,emoteLoadoutCapacity:EMOTE_LOADOUT_CAPACITY,ensure:ensure,registerContainer:registerContainer,removeContainer:removeContainer,getContainer:getContainer,keyForItem:keyForItem,getSlots:getSlots,getStats:getStats,transferItem:transferItem,receiveItem:receiveItem,extractItem:extractItem,checkpoint:checkpoint,restoreCheckpoint:restoreCheckpoint,auditIdentities:auditIdentities,canStack:canStack,stackSignature:stackSignature});
root.KELO_CONTAINER_AUDIT=Object.freeze({version:VERSION,schemaVersion:SCHEMA_VERSION,identityRule:'one-item-one-container',containerModel:'static-plus-dynamic-shared-contract-v4',transferMode:'validate-prepare-execute-persist-rollback-v3',strictDestinationCapacity:true,warehouseImplemented:true,marketEscrowImplemented:true,tradeEscrowImplemented:true,dynamicContainers:true,arbitraryContainerRegistration:true,checkpointApi:true,receiveExtractApi:true,deferredPersistSupported:true,serverAuthoritative:false});
})(typeof globalThis!=='undefined'?globalThis:window);
