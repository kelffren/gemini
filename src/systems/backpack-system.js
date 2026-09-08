/* KELO-INDEX
 * area: SYSTEMS / BACKPACK
 * owner: KeloBackpack
 * purpose: layout, slots, sorting y acciones UX del backpack sobre items propiedad de KeloInventory
 * public-api: KeloBackpack
 * consumes: KeloInventory, KeloEquipment
 * state-owned: STATE.backpack slot metadata/capacity
 * extension-points: moveSlot/mergeStacks/splitStack/sortSlots/discardSlot/expandCapacity
 * reuse: UI y features usan esta API para orden del backpack; almacenamiento/identidad usa KeloInventory
 * legacy: STATE.backpack persiste dentro del STATE monolítico
 * do-not: NO escribir STATE.inventory ni duplicar identidad/stack helpers
 */
(function(){
'use strict';

const VERSION='backpack-v1.2.0';
const SCHEMA_VERSION=2;
const BASE_CAPACITY=20;
const COLUMNS=5;
const inventoryOwner=window.KeloInventory;
if(!inventoryOwner)throw new Error('KeloInventory unavailable before backpack-system');
let ensuring=false;

function nextCapacity(count){
  const needed=Math.max(BASE_CAPACITY,Math.max(0,Math.floor(Number(count)||0)));
  return Math.ceil(needed/COLUMNS)*COLUMNS;
}
function stableKey(item,index){return inventoryOwner.keyForItem(item,index);}
function stackLimit(item){return inventoryOwner.stackLimit(item);}
function quantity(item){return inventoryOwner.quantity(item);}
function stackSignature(item){return inventoryOwner.stackSignature(item);}
function canStack(a,b){return inventoryOwner.canStack(a,b);}

function ensure(){
  if(typeof STATE==='undefined')return null;
  if(ensuring)return STATE.backpack||null;
  ensuring=true;
  let changed=false;
  try{
    inventoryOwner.ensure();
    const inventory=inventoryOwner.getItems('backpack');
    const capacity=nextCapacity(inventory.length);
    if(!STATE.backpack||typeof STATE.backpack!=='object'){
      STATE.backpack={schemaVersion:SCHEMA_VERSION,capacity,slots:[]};
      changed=true;
    }
    const bag=STATE.backpack;
    if(bag.schemaVersion!==SCHEMA_VERSION){bag.schemaVersion=SCHEMA_VERSION;changed=true;}
    if(!Number.isFinite(Number(bag.capacity))||Number(bag.capacity)<capacity){bag.capacity=capacity;changed=true;}
    bag.capacity=nextCapacity(bag.capacity);
    if(!Array.isArray(bag.slots)){bag.slots=[];changed=true;}

    const keys=[];
    const valid=new Set();
    inventory.forEach(function(item,index){
      const q=quantity(item);if(Number(item.quantity)!==q){inventoryOwner.setQuantity(item,q,{persist:false});changed=true;}
      if(stackLimit(item)>1&&Number(item.maxStack)!==stackLimit(item)){item.maxStack=stackLimit(item);changed=true;}
      const key=stableKey(item,index);
      if(key&&!valid.has(key)){keys.push(key);valid.add(key);}
    });

    const rebuilt=new Array(bag.capacity).fill(null);
    const placed=new Set();
    bag.slots.slice(0,bag.capacity).forEach(function(key,index){
      if(key&&valid.has(key)&&!placed.has(key)){
        rebuilt[index]=key;
        placed.add(key);
      }
    });
    keys.forEach(function(key){
      if(placed.has(key))return;
      let free=rebuilt.indexOf(null);
      if(free<0){
        const old=rebuilt.length;
        bag.capacity=nextCapacity(old+COLUMNS);
        while(rebuilt.length<bag.capacity)rebuilt.push(null);
        free=old;
      }
      rebuilt[free]=key;
      placed.add(key);
    });
    if(JSON.stringify(bag.slots)!==JSON.stringify(rebuilt)){bag.slots=rebuilt;changed=true;}
    if(bag.capacity!==rebuilt.length){bag.capacity=rebuilt.length;changed=true;}
  }finally{ensuring=false;}
  if(changed)inventoryOwner.persist();
  return STATE.backpack;
}

function itemMap(){ensure();return inventoryOwner.itemMap('backpack');}

function descriptor(item,index){
  if(!item)return null;
  const equipment=item.kind==='equipment';
  const stone=!equipment&&!!(item.typeId&&item.tier);
  let rarity='Normal';
  if(equipment&&window.KeloEquipment&&typeof window.KeloEquipment.qualityName==='function')rarity=window.KeloEquipment.qualityName(item.quality);
  else if(item.tier)rarity=String(item.tier);
  else if(item.rarity)rarity=String(item.rarity);
  const category=equipment?'equipment':(stone?'stone':(item.kind||'item'));
  return Object.freeze({
    index,
    name:String(item.name||item.templateId||item.typeId||'Objeto'),
    icon:String(item.icon||({equipment:'◈',stone:'◆'}[category]||'▪')),
    category,
    rarity,
    quantity:quantity(item),
    bound:!!item.bound,
    slot:item.slot||null,
    stackable:!!stackSignature(item),
    maxStack:stackLimit(item),
    stackSignature:stackSignature(item)
  });
}

function getSlots(){
  const bag=ensure();
  if(!bag)return [];
  const map=itemMap();
  return bag.slots.map(function(key,index){
    const item=key?map.get(key)||null:null;
    return {index,key:item?key:null,item,descriptor:descriptor(item,index)};
  });
}

function slotAt(index){
  index=Math.floor(Number(index));
  const slots=getSlots();
  return Number.isInteger(index)&&index>=0&&index<slots.length?slots[index]:null;
}
function save(){inventoryOwner.persist();}

function mergeStacks(from,to){
  const bag=ensure();
  const source=slotAt(from),target=slotAt(to);
  if(!bag||!source||!target||!source.item||!target.item)return {ok:false,error:'INVALID_STACK_SLOTS'};
  if(!canStack(source.item,target.item))return {ok:false,error:'INCOMPATIBLE_STACKS'};
  const room=stackLimit(target.item)-quantity(target.item);
  if(room<=0)return {ok:false,error:'TARGET_STACK_FULL'};
  const moved=Math.min(room,quantity(source.item));
  inventoryOwner.setQuantity(target.item,quantity(target.item)+moved,{persist:false});
  inventoryOwner.setQuantity(source.item,quantity(source.item)-moved,{persist:false});
  if(Number(source.item.quantity)<=0){
    inventoryOwner.removeItem('backpack',source.item,{persist:false});
    bag.slots[from]=null;
  }
  save();
  return {ok:true,moved,sourceRemaining:Math.max(0,Number(source.item.quantity)||0),targetQuantity:target.item.quantity};
}

function moveSlot(from,to){
  const bag=ensure();
  from=Math.floor(Number(from));to=Math.floor(Number(to));
  if(!bag||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=bag.capacity||to>=bag.capacity)return {ok:false,error:'INVALID_SLOT'};
  if(from===to)return {ok:true,changed:false};
  if(!bag.slots[from])return {ok:false,error:'EMPTY_SOURCE'};
  const source=slotAt(from),target=slotAt(to);
  if(source&&target&&source.item&&target.item&&canStack(source.item,target.item)){
    const merged=mergeStacks(from,to);
    if(merged.ok)return Object.assign({changed:true,merged:true,from,to},merged);
  }
  const tmp=bag.slots[from];
  bag.slots[from]=bag.slots[to]||null;
  bag.slots[to]=tmp;
  save();
  return {ok:true,changed:true,merged:false,from,to};
}

function splitStack(from,to,amount){
  const bag=ensure();
  const source=slotAt(from),target=slotAt(to);
  amount=Math.floor(Number(amount));
  if(!bag||!source||!source.item||!target)return {ok:false,error:'INVALID_SLOT'};
  if(target.item)return {ok:false,error:'TARGET_NOT_EMPTY'};
  if(!stackSignature(source.item))return {ok:false,error:'NOT_STACKABLE'};
  const current=quantity(source.item);
  if(!Number.isInteger(amount)||amount<1||amount>=current)return {ok:false,error:'INVALID_AMOUNT'};
  const clone=inventoryOwner.cloneWithNewIdentity(source.item,{quantity:amount,createdAt:Date.now(),splitFrom:source.item.id||source.item.uid||source.item._backpackId||null});
  inventoryOwner.setQuantity(source.item,current-amount,{persist:false});
  const added=inventoryOwner.addItem('backpack',clone,{persist:false});
  if(!added.ok)return added;
  bag.slots[to]=added.key;
  save();
  return {ok:true,from,to,amount,sourceQuantity:source.item.quantity,newItem:clone};
}

const CATEGORY_ORDER={equipment:0,consumable:1,material:2,stone:3,item:4};
function sortSlots(){
  const bag=ensure();
  const occupied=getSlots().filter(function(s){return s.item;});
  occupied.sort(function(a,b){
    const da=a.descriptor,db=b.descriptor;
    const ca=Object.prototype.hasOwnProperty.call(CATEGORY_ORDER,da.category)?CATEGORY_ORDER[da.category]:9;
    const cb=Object.prototype.hasOwnProperty.call(CATEGORY_ORDER,db.category)?CATEGORY_ORDER[db.category]:9;
    if(ca!==cb)return ca-cb;
    const r=String(da.rarity).localeCompare(String(db.rarity));if(r)return r;
    return String(da.name).localeCompare(String(db.name));
  });
  bag.slots=new Array(bag.capacity).fill(null);
  occupied.forEach(function(s,i){bag.slots[i]=s.key;});
  save();
  return {ok:true,used:occupied.length,capacity:bag.capacity};
}

function discardSlot(index,amount){
  const bag=ensure();
  const slot=slotAt(index);
  amount=amount==null?null:Math.floor(Number(amount));
  if(!bag||!slot||!slot.item)return {ok:false,error:'EMPTY_SLOT'};
  if(slot.item.kind==='equipment')return {ok:false,error:'EQUIPMENT_PROTECTED'};
  if(slot.item.bound)return {ok:false,error:'BOUND_ITEM_PROTECTED'};
  const current=quantity(slot.item);
  const drop=amount==null?current:amount;
  if(!Number.isInteger(drop)||drop<1||drop>current)return {ok:false,error:'INVALID_AMOUNT'};
  if(drop===current){inventoryOwner.removeItem('backpack',slot.item,{persist:false});bag.slots[index]=null;}
  else inventoryOwner.setQuantity(slot.item,current-drop,{persist:false});
  save();
  return {ok:true,discarded:drop,remaining:drop===current?0:slot.item.quantity};
}

function expandCapacity(slots){
  const bag=ensure();
  slots=Math.max(COLUMNS,Math.floor(Number(slots)||COLUMNS));
  const old=bag.capacity;
  bag.capacity=nextCapacity(old+slots);
  while(bag.slots.length<bag.capacity)bag.slots.push(null);
  save();
  return {ok:true,oldCapacity:old,capacity:bag.capacity,added:bag.capacity-old};
}

function stats(){
  const bag=ensure();
  if(!bag)return {capacity:0,used:0,free:0};
  const used=bag.slots.filter(Boolean).length;
  return {capacity:bag.capacity,used,free:bag.capacity-used};
}

ensure();
window.KeloBackpack=Object.freeze({
  version:VERSION,
  schemaVersion:SCHEMA_VERSION,
  baseCapacity:BASE_CAPACITY,
  columns:COLUMNS,
  ensure,
  getSlots,
  getStats:stats,
  moveSlot,
  mergeStacks,
  splitStack,
  sortSlots,
  discardSlot,
  expandCapacity,
  canStack,
  describeItem:descriptor
});
window.KELO_BACKPACK_AUDIT=Object.freeze({
  version:VERSION,
  schemaVersion:SCHEMA_VERSION,
  baseCapacity:BASE_CAPACITY,
  columns:COLUMNS,
  source:'KeloInventory-backpack-view-v3',
  inventoryOwner:'KeloInventory',
  directInventoryWrites:false,
  ordering:'stable-slot-metadata-v2',
  mutatesLegacyInventoryOrderOnMove:false,
  stacksImplemented:true,
  stackMode:'KeloInventory-shared-signature-v2',
  splitImplemented:true,
  sortImplemented:true,
  discardImplemented:true,
  boundDiscardProtected:true,
  equipmentDiscardProtected:true,
  expansionPrimitive:true,
  warehouseImplemented:false,
  dragDropImplemented:false
});
})();