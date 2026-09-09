'use strict';
/* KELO-INDEX
 * area: SERVER / ECONOMY
 * owner: PlayerEconomyStore
 * keys: GOLD INVENTORY EQUIPMENT TRANSACTION CHECKPOINT AUTHORITY
 * purpose: única fuente autoritativa server-side para saldo y propiedad valiosa del jugador
 * reuse: Forge, Commerce y futuros Auction/Gift/Repair deben compartir este mismo store
 * do-not: no crear otro Map de gold/inventory dentro de features consumidoras
 */
const VERSION='player-economy-store-v1.0.0';
const DEFAULT_SLOTS=['weapon','helmet','chest','gloves','boots','accessory','necklace','ring','belt'];
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));

function seedPlayer(id){
  const equipment={};
  DEFAULT_SLOTS.forEach(slot=>{
    equipment['eq_'+slot]={id:'eq_'+slot,owner:id,templateId:'starter_'+slot,name:'Equipo '+slot,slot,itemLevel:1,quality:1,grade:1,equipped:true,baseStats:{attack:0,defense:0,hp:0},specialStats:{attackPct:0,defensePct:0,hpPct:0}};
  });
  const inventory={};
  ['ruby','sapphire','emerald','forge_crystal'].forEach(f=>{for(let l=1;l<=4;l++)inventory[f+'_'+l]=l===1?18:0;});
  return {
    id:String(id),
    gold:500000,
    equipment,
    inventory,
    items:[],
    reservations:{},
    history:[],
    commerceHistory:[],
    commerceRevision:1,
    commerceMigrated:false
  };
}

function replaceRecord(target,snapshot){
  Object.keys(target).forEach(k=>delete target[k]);
  Object.assign(target,clone(snapshot));
  return target;
}

function createPlayerEconomyStore(opts={}){
  const players=opts.players instanceof Map?opts.players:new Map();
  const source=opts.supabaseUrl&&opts.supabaseServiceKey?'supabase-prepared':'ram-authoritative';
  function ensure(id){
    const key=String(id||'').trim();
    if(!key)throw new Error('INVALID_PLAYER_ID');
    if(!players.has(key))players.set(key,seedPlayer(key));
    const p=players.get(key);
    if(!Array.isArray(p.items))p.items=[];
    if(!p.reservations||typeof p.reservations!=='object')p.reservations={};
    if(!Array.isArray(p.history))p.history=[];
    if(!Array.isArray(p.commerceHistory))p.commerceHistory=[];
    if(!Number.isFinite(Number(p.commerceRevision)))p.commerceRevision=1;
    if(typeof p.commerceMigrated!=='boolean')p.commerceMigrated=false;
    return p;
  }
  function checkpoint(ids){
    const unique=[...new Set((Array.isArray(ids)?ids:[ids]).filter(Boolean).map(String))];
    const records={};
    unique.forEach(id=>{records[id]=clone(ensure(id));});
    return {version:VERSION,ids:unique,records};
  }
  function restore(cp){
    if(!cp||!Array.isArray(cp.ids)||!cp.records)throw new Error('INVALID_ECONOMY_CHECKPOINT');
    cp.ids.forEach(id=>replaceRecord(ensure(id),cp.records[id]));
    return true;
  }
  async function transaction(ids,fn){
    if(typeof fn!=='function')throw new Error('TRANSACTION_CALLBACK_REQUIRED');
    const cp=checkpoint(ids);
    try{return await fn(...cp.ids.map(ensure));}
    catch(err){restore(cp);throw err;}
  }
  function snapshot(id){return clone(ensure(id));}
  function auditPlayer(id){
    const p=ensure(id),ids=[];
    Object.values(p.equipment||{}).forEach(x=>{if(x?.id)ids.push(String(x.id));});
    (p.items||[]).forEach(x=>{if(x?.id)ids.push(String(x.id));});
    const duplicates=ids.filter((x,i)=>ids.indexOf(x)!==i);
    return {ok:duplicates.length===0,duplicates:[...new Set(duplicates)],gold:Number(p.gold)||0,itemInstances:(p.items||[]).length,equipmentInstances:Object.keys(p.equipment||{}).length};
  }
  return Object.freeze({version:VERSION,source,ensure,snapshot,checkpoint,restore,transaction,auditPlayer,_debugPlayer:ensure,_players:players});
}

module.exports={VERSION,DEFAULT_SLOTS,seedPlayer,createPlayerEconomyStore};
