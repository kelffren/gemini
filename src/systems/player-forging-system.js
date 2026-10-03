/* KELO-INDEX
 * area: ECON / PLAYER FORGING
 * owner: KeloPlayerForging
 * keys: FORGE EQUIPMENT CUSTOM NAME CREATOR SERIAL SOCKET STONE MARKET CRAFT
 * purpose: create unique player-made equipment instances, socket stones, calculate forge power, and preserve provenance for commerce.
 * public-api: KeloPlayerForging.forge/socket/unsocket/rename/inspect/validate
 * consumes: KELO_EQUIPMENT_ITEM_CATALOG, optional KeloStones
 * state-owned: none; mutates only the explicit item passed by caller
 * online: server should re-run validate/forge/socket authoritatively before accepting valuable mutations
 * do-not: no direct gold/inventory/market mutation here; Commerce remains the only trade authority
 */
(function(root,factory){
'use strict';
const api=factory(root);
if(root)root.KeloPlayerForging=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';

const VERSION='player-forging-v1.0.0';
const SCHEMA_VERSION=1;
const MAX_NAME=28;
const MAX_SOCKETS=4;
const DEFAULT_SOCKETS=2;
const TIER_POWER=Object.freeze({Common:1,Uncommon:2,Rare:4,Epic:7,Legendary:11,Mythic:16});
const AFFIX_WEIGHT=Object.freeze({damage:22,cooldown:18,range:12,speed:14,area:13,shield:20,heal:18});

function clone(value){return value==null?value:JSON.parse(JSON.stringify(value));}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}
function randomId(prefix){
  if(typeof crypto!=='undefined'&&crypto&&typeof crypto.getRandomValues==='function'){
    const b=new Uint32Array(3);crypto.getRandomValues(b);
    return String(prefix||'forge')+'_'+Array.from(b,n=>n.toString(36)).join('');
  }
  return String(prefix||'forge')+'_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2,9);
}
function cleanName(raw,fallback){
  const s=String(raw==null?'':raw).replace(/[<>\n\r\t]/g,' ').replace(/\s+/g,' ').trim().slice(0,MAX_NAME);
  return s||String(fallback||'Equipo sin nombre').slice(0,MAX_NAME);
}
function creatorRecord(raw){
  const c=raw&&typeof raw==='object'?raw:{};
  return Object.freeze({
    id:String(c.id||c.playerId||'unknown'),
    name:cleanName(c.name||c.playerName||'Desconocido','Desconocido').slice(0,20)
  });
}
function serialFor(templateId,createdAt,uid){
  const text=String(templateId||'item')+'|'+String(createdAt||Date.now())+'|'+String(uid||'');
  let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
  return 'KW-'+(h>>>0).toString(36).toUpperCase().padStart(7,'0').slice(-7);
}
function baseCatalog(){return root&&root.KELO_EQUIPMENT_ITEM_CATALOG||null;}
function stoneApi(){return root&&root.KeloStones||null;}
function normalizeStone(raw){
  const api=stoneApi();
  if(api&&typeof api.normalizeStone==='function'){
    try{return api.normalizeStone(raw);}catch(_){}
  }
  if(!raw||typeof raw!=='object'||!(raw.uid||raw.id))return null;
  return {
    uid:String(raw.uid||raw.id),
    abilityKey:String(raw.abilityKey||raw.typeId||'unknown'),
    tier:String(raw.tier||'Common'),
    level:Math.max(1,Math.floor(Number(raw.level)||1)),
    affixes:Array.isArray(raw.affixes)?clone(raw.affixes):[],
    name:String(raw.name||raw.abilityKey||raw.typeId||'Piedra'),
    icon:String(raw.icon||'◆')
  };
}
function stoneSnapshot(raw){
  const s=normalizeStone(raw);if(!s)return null;
  return {
    stoneUid:String(s.uid||s.id),
    abilityKey:String(s.abilityKey||s.typeId||'unknown'),
    tier:String(s.tier||'Common'),
    level:Math.max(1,Math.floor(Number(s.level)||1)),
    affixes:(Array.isArray(s.affixes)?s.affixes:[]).map(a=>({id:String(a.id||''),value:Number(a.value)||0})).filter(a=>a.id&&a.value>0),
    name:String(s.name||s.abilityKey||'Piedra'),
    icon:String(s.icon||'◆')
  };
}
function socketPower(socket){
  if(!socket)return 0;
  const tier=TIER_POWER[socket.tier]||1;
  const level=Math.max(1,Number(socket.level)||1);
  let affix=0;
  for(const a of socket.affixes||[])affix+=(AFFIX_WEIGHT[a.id]||10)*clamp(Number(a.value)||0,0,0.5);
  return Number((tier*4+Math.min(20,level-1)*0.35+affix).toFixed(2));
}
function bonusFromSockets(sockets){
  const bonus={attackPct:0,defensePct:0,hpPct:0,cooldownPct:0,rangePct:0,speedPct:0,areaPct:0,shieldPct:0,healPct:0};
  for(const socket of sockets||[]){
    if(!socket)continue;
    const tierMul=1+(TIER_POWER[socket.tier]||1)*0.035;
    for(const a of socket.affixes||[]){
      const v=clamp(Number(a.value)||0,0,0.5)*100*tierMul;
      if(a.id==='damage')bonus.attackPct+=v;
      else if(a.id==='shield'){bonus.defensePct+=v*.55;bonus.shieldPct+=v;}
      else if(a.id==='heal'){bonus.hpPct+=v*.35;bonus.healPct+=v;}
      else if(a.id==='cooldown')bonus.cooldownPct+=v;
      else if(a.id==='range')bonus.rangePct+=v;
      else if(a.id==='speed')bonus.speedPct+=v;
      else if(a.id==='area')bonus.areaPct+=v;
    }
  }
  Object.keys(bonus).forEach(k=>bonus[k]=Number(bonus[k].toFixed(2)));
  return bonus;
}
function ensureForge(item,options){
  if(!item||item.kind!=='equipment')throw new Error('FORGE_REQUIRES_EQUIPMENT');
  const opts=options||{};
  if(!item.forge||typeof item.forge!=='object'){
    const createdAt=Number(item.createdAt)||Date.now();
    const uid=String(item.id||item.uid||randomId('equipment'));
    item.forge={
      schemaVersion:SCHEMA_VERSION,
      creator:creatorRecord(opts.creator),
      serial:serialFor(item.templateId,createdAt,uid),
      customName:cleanName(opts.name||item.name,item.name),
      craftedAt:createdAt,
      socketCount:clamp(Math.floor(Number(opts.socketCount)||DEFAULT_SOCKETS),0,MAX_SOCKETS),
      sockets:[],
      upgrades:[],
      forgePower:0,
      bonus:{}
    };
  }
  const f=item.forge;
  f.schemaVersion=SCHEMA_VERSION;
  f.creator=creatorRecord(f.creator||opts.creator);
  f.customName=cleanName(f.customName||item.name,item.name);
  f.socketCount=clamp(Math.floor(Number(f.socketCount)||0),0,MAX_SOCKETS);
  if(!Array.isArray(f.sockets))f.sockets=[];
  f.sockets=f.sockets.slice(0,f.socketCount).map(s=>s?stoneSnapshot(s):null);
  while(f.sockets.length<f.socketCount)f.sockets.push(null);
  if(!Array.isArray(f.upgrades))f.upgrades=[];
  f.forgePower=Number(f.sockets.reduce((n,s)=>n+socketPower(s),0).toFixed(2));
  f.bonus=bonusFromSockets(f.sockets);
  item.name=f.customName;
  item.craftedBy=f.creator.name;
  item.craftedById=f.creator.id;
  item.serial=f.serial;
  item.forgePower=f.forgePower;
  item.forgeBonus=clone(f.bonus);
  return item;
}
function forge(templateId,options){
  const catalog=baseCatalog();
  if(!catalog||typeof catalog.createItem!=='function')return{ok:false,error:'EQUIPMENT_CATALOG_UNAVAILABLE'};
  const opts=options||{};
  const createdAt=Number(opts.createdAt)||Date.now();
  const item=catalog.createItem(templateId,{id:opts.id||randomId('crafted'),createdAt});
  if(!item)return{ok:false,error:'UNKNOWN_EQUIPMENT_TEMPLATE'};
  ensureForge(item,opts);
  return{ok:true,item,summary:inspect(item)};
}
function rename(item,name){
  try{ensureForge(item);item.forge.customName=cleanName(name,item.name);ensureForge(item);return{ok:true,item,summary:inspect(item)};}
  catch(error){return{ok:false,error:String(error&&error.message||error)};}
}
function socket(item,stone,slotIndex){
  try{
    ensureForge(item);
    const snap=stoneSnapshot(stone);if(!snap)return{ok:false,error:'INVALID_STONE'};
    const f=item.forge;
    let index=slotIndex==null?f.sockets.findIndex(x=>!x):Math.floor(Number(slotIndex));
    if(index<0)return{ok:false,error:'NO_FREE_SOCKET'};
    if(!Number.isInteger(index)||index<0||index>=f.socketCount)return{ok:false,error:'INVALID_SOCKET'};
    if(f.sockets[index])return{ok:false,error:'SOCKET_OCCUPIED'};
    if(f.sockets.some(x=>x&&x.stoneUid===snap.stoneUid))return{ok:false,error:'STONE_ALREADY_SOCKETED'};
    f.sockets[index]=snap;ensureForge(item);
    return{ok:true,index,item,summary:inspect(item)};
  }catch(error){return{ok:false,error:String(error&&error.message||error)};}
}
function unsocket(item,slotIndex){
  try{
    ensureForge(item);
    const index=Math.floor(Number(slotIndex)),f=item.forge;
    if(!Number.isInteger(index)||index<0||index>=f.socketCount)return{ok:false,error:'INVALID_SOCKET'};
    if(!f.sockets[index])return{ok:false,error:'EMPTY_SOCKET'};
    const stone=clone(f.sockets[index]);f.sockets[index]=null;ensureForge(item);
    return{ok:true,index,stone,item,summary:inspect(item)};
  }catch(error){return{ok:false,error:String(error&&error.message||error)};}
}
function inspect(item){
  if(!item||item.kind!=='equipment')return null;
  try{ensureForge(item);}catch(_){return null;}
  const f=item.forge;
  return Object.freeze({
    instanceId:String(item.id||item.uid||''),
    templateId:String(item.templateId||''),
    name:String(f.customName||item.name||'Equipo'),
    creator:clone(f.creator),
    serial:String(f.serial),
    socketCount:f.socketCount,
    filledSockets:f.sockets.filter(Boolean).length,
    sockets:clone(f.sockets),
    forgePower:Number(f.forgePower)||0,
    bonus:clone(f.bonus),
    craftedAt:Number(f.craftedAt)||Number(item.createdAt)||0,
    tradable:item.bound!==true
  });
}
function validate(item){
  if(!item||item.kind!=='equipment')return{ok:false,reason:'NOT_EQUIPMENT'};
  try{ensureForge(item);}catch(error){return{ok:false,reason:String(error&&error.message||error)};}
  const f=item.forge;
  if(f.schemaVersion!==SCHEMA_VERSION)return{ok:false,reason:'SCHEMA_MISMATCH'};
  if(!f.serial||!f.customName||!f.creator||!Array.isArray(f.sockets))return{ok:false,reason:'FORGE_FIELDS_MISSING'};
  if(f.sockets.length!==f.socketCount)return{ok:false,reason:'SOCKET_SHAPE_INVALID'};
  const ids=f.sockets.filter(Boolean).map(x=>x.stoneUid);
  if(new Set(ids).size!==ids.length)return{ok:false,reason:'DUPLICATE_STONE'};
  return{ok:true,summary:inspect(item)};
}

return Object.freeze({
  version:VERSION,schemaVersion:SCHEMA_VERSION,maxSockets:MAX_SOCKETS,maxNameLength:MAX_NAME,
  forge,ensureForge,rename,socket,unsocket,inspect,validate,bonusFromSockets,socketPower
});
});
