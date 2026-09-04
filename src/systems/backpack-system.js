(function(){
'use strict';

const VERSION='backpack-v1.0.0';
const SCHEMA_VERSION=1;
const BASE_CAPACITY=20;
const COLUMNS=5;
let ensuring=false;

function nextCapacity(count){
  const needed=Math.max(BASE_CAPACITY,Math.max(0,Math.floor(Number(count)||0)));
  return Math.ceil(needed/COLUMNS)*COLUMNS;
}

function stableKey(item,index){
  if(!item||typeof item!=='object')return null;
  if(item.id)return 'id:'+String(item.id);
  if(item.uid)return 'uid:'+String(item.uid);
  if(!item._backpackId){
    item._backpackId='bp_'+Date.now().toString(36)+'_'+index.toString(36)+'_'+Math.random().toString(36).slice(2,8);
  }
  return 'bp:'+item._backpackId;
}

function ensure(){
  if(typeof STATE==='undefined')return null;
  if(ensuring)return STATE.backpack||null;
  ensuring=true;
  let changed=false;
  try{
    if(!Array.isArray(STATE.inventory)){STATE.inventory=[];changed=true;}
    const inventory=STATE.inventory;
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
  if(changed&&typeof saveState==='function')saveState();
  return STATE.backpack;
}

function itemMap(){
  ensure();
  const map=new Map();
  STATE.inventory.forEach(function(item,index){
    const key=stableKey(item,index);
    if(key&&!map.has(key))map.set(key,item);
  });
  return map;
}

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
    quantity:Math.max(1,Math.floor(Number(item.quantity)||1)),
    bound:!!item.bound,
    slot:item.slot||null,
    stackable:Number(item.maxStack)>1,
    maxStack:Math.max(1,Math.floor(Number(item.maxStack)||1))
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

function moveSlot(from,to){
  const bag=ensure();
  from=Math.floor(Number(from));to=Math.floor(Number(to));
  if(!bag||!Number.isInteger(from)||!Number.isInteger(to)||from<0||to<0||from>=bag.capacity||to>=bag.capacity)return {ok:false,error:'INVALID_SLOT'};
  if(from===to)return {ok:true,changed:false};
  if(!bag.slots[from])return {ok:false,error:'EMPTY_SOURCE'};
  const tmp=bag.slots[from];
  bag.slots[from]=bag.slots[to]||null;
  bag.slots[to]=tmp;
  if(typeof saveState==='function')saveState();
  return {ok:true,changed:true,from,to};
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
  describeItem:descriptor
});
window.KELO_BACKPACK_AUDIT=Object.freeze({
  version:VERSION,
  schemaVersion:SCHEMA_VERSION,
  baseCapacity:BASE_CAPACITY,
  columns:COLUMNS,
  source:'STATE.inventory-adapter-v1',
  ordering:'stable-slot-metadata-v1',
  mutatesLegacyInventoryOrder:false,
  stacksImplemented:false,
  warehouseImplemented:false,
  dragDropImplemented:false
});
})();
