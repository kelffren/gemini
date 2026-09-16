/* KELO-INDEX
 * area: CORE / PERSISTENCE
 * owner: KeloStateStore
 * keys: STATE SAVE MIGRATION SCHEMA BACKUP LEGACY COMPATIBILITY DEFAULTS
 * purpose: normaliza el save legacy antes de que engine-a lo consuma, preservando campos desconocidos, defaults actuales y backup previo
 * public-api: KeloStateStore.normalizeState/migrateStorage/snapshot
 * consumes: localStorage key kelo_world_state_v2_1 + defaults legacy de engine-a V6.69
 * state-owned: solo metadata de migración; gameplay STATE sigue legacy durante esta fase
 * extension-points: añadir migraciones versionadas y deterministas sin cambiar gameplay
 * reuse: cualquier futura migración de save debe entrar aquí, no repartirse por features
 * legacy: compatibility boundary; no reemplaza STATE todavía
 * do-not: NO gameplay rules, NO timers, NO listeners, NO borrar saves corruptos, NO defaults inventados fuera del baseline legacy
 */
(function(root,factory){
  'use strict';
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(root){
    root.KeloStateStore=api;
    try{if(root.localStorage)api.migrateStorage(root.localStorage);}catch(_){ }
  }
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';

  const VERSION='kelo-state-store-bootstrap-v1.1.0';
  const STORAGE_KEY='kelo_world_state_v2_1';
  const BACKUP_KEY=STORAGE_KEY+'.backup.pre-schema-v3';
  const SCHEMA_VERSION=3;
  const BOOT_NOW=Date.now();
  let last={status:'idle',changed:false,fromVersion:null,toVersion:SCHEMA_VERSION,backupCreated:false,error:null};

  // Mirrored from the V6.69 legacy STATE baseline. These values are compatibility
  // defaults only: an existing user value always wins, including intentionally empty arrays.
  const BASE=Object.freeze({
    gold:1500,kc:200,fusionMastery:1,fusionXp:0,farmLevel:1,farmXp:0,investorXp:0,investorRank:1,
    silo:Object.freeze({wheat:10,carrot:4,eggs:0,pork:0}),
    equipped:Object.freeze([]),
    inventory:Object.freeze([]),
    marketListings:Object.freeze([
      Object.freeze({
        id:'lst_1',seller:'Merchant_Zack',type:'stone',price:450,
        item:Object.freeze({uid:'st_migrated_default_meteor_epic',typeId:'meteor',name:'Meteoro',icon:'\u2604\uFE0F',tier:'Epic',isUlt:true,color:'#ff9f1c',baseCd:10,dmg:60,currentCd:0,positiveMod:'+15% Dano',negativeMod:'-5% Velocidad post-uso'})
      }),
      Object.freeze({id:'lst_2',seller:'Farmer_Bob',type:'resource',name:'Lote de 20 Trigo',icon:'\uD83C\uDF3E',price:180})
    ]),
    auctions:Object.freeze([
      Object.freeze({id:'auc_1',seller:'System_Vault',name:'Piedra Divina: Colapso Estelar',icon:'\u2728',tier:'Divine',currentBid:1200,topBidder:'Duelist_V',timeLeft:120})
    ]),
    markets:Object.freeze([
      Object.freeze({id:'m1',title:'Volumen diario de Oro > 500k?',payout:1.85,poolYes:1200,poolNo:800,myBet:null}),
      Object.freeze({id:'m2',title:'Mas de 100 combates PvP hoy?',payout:2.20,poolYes:450,poolNo:950,myBet:null})
    ]),
    plot:Object.freeze({
      x:2000,y:1500,w:400,h:300,lastMaintenance:BOOT_NOW,
      furniture:Object.freeze([
        Object.freeze({type:'floor',gx:0,gy:0,gw:10,gh:8}),
        Object.freeze({type:'wall',gx:0,gy:0,gw:10,gh:1}),
        Object.freeze({type:'mannequin',gx:3,gy:3,gw:1,gh:1}),
        Object.freeze({type:'showcase',gx:6,gy:3,gw:1,gh:1})
      ])
    }),
    farm:Object.freeze({
      x:600,y:1500,w:480,h:320,
      crops:Object.freeze([
        Object.freeze({id:0,type:'wheat',plantedAt:BOOT_NOW-12000,harvested:false}),
        Object.freeze({id:1,type:'carrot',plantedAt:BOOT_NOW-5000,harvested:false}),
        Object.freeze({id:2,type:'wheat',plantedAt:BOOT_NOW,harvested:false}),
        Object.freeze({id:3,type:null,plantedAt:0,harvested:false})
      ]),
      coop:Object.freeze({type:'chickens',fedAt:BOOT_NOW-15000,duration:20,ready:false}),
      pen:Object.freeze({type:'pigs',fedAt:0,duration:45,ready:false})
    })
  });

  function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function clone(value){
    if(Array.isArray(value))return value.map(clone);
    if(value&&typeof value==='object'){const out={};for(const key of Object.keys(value))out[key]=clone(value[key]);return out;}
    return value;
  }
  function array(value,fallback){return Array.isArray(value)?value:clone(Array.isArray(fallback)?fallback:[]);}
  function finite(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function integer(value,fallback){return Math.trunc(finite(value,fallback));}
  function bool(value,fallback){return typeof value==='boolean'?value:fallback;}
  function text(value,fallback){return typeof value==='string'&&value?value:fallback;}
  function nonNegative(value,fallback){return Math.max(0,finite(value,fallback));}

  function normalizeAnimal(raw,defaults){
    const src=object(raw);
    return Object.assign({},clone(defaults),src,{
      type:text(src.type,defaults.type),
      fedAt:nonNegative(src.fedAt,defaults.fedAt),
      duration:Math.max(1,finite(src.duration,defaults.duration)),
      ready:bool(src.ready,defaults.ready)
    });
  }

  function normalizeCrop(raw,index,defaults){
    const src=object(raw),fallback=object(defaults);
    return Object.assign({},clone(fallback),src,{
      id:src.id==null?(fallback.id==null?index:fallback.id):src.id,
      type:src.type==null?(fallback.type==null?null:String(fallback.type)):String(src.type),
      plantedAt:nonNegative(src.plantedAt,nonNegative(fallback.plantedAt,0)),
      harvested:bool(src.harvested,bool(fallback.harvested,false))
    });
  }

  function normalizeState(input){
    const src=object(input);
    const silo=object(src.silo),plot=object(src.plot),farm=object(src.farm);
    const cropSource=array(farm.crops,BASE.farm.crops);
    const normalized=Object.assign({},src,{
      schemaVersion:SCHEMA_VERSION,
      gold:nonNegative(src.gold,BASE.gold),
      kc:nonNegative(src.kc,BASE.kc),
      fusionMastery:Math.max(1,integer(src.fusionMastery,BASE.fusionMastery)),
      fusionXp:nonNegative(src.fusionXp,BASE.fusionXp),
      farmLevel:Math.max(1,integer(src.farmLevel,BASE.farmLevel)),
      farmXp:nonNegative(src.farmXp,BASE.farmXp),
      investorXp:nonNegative(src.investorXp,BASE.investorXp),
      investorRank:Math.max(1,integer(src.investorRank,BASE.investorRank)),
      silo:Object.assign({},clone(BASE.silo),silo,{
        wheat:nonNegative(silo.wheat,BASE.silo.wheat),
        carrot:nonNegative(silo.carrot,BASE.silo.carrot),
        eggs:nonNegative(silo.eggs,BASE.silo.eggs),
        pork:nonNegative(silo.pork,BASE.silo.pork)
      }),
      equipped:array(src.equipped,BASE.equipped),
      inventory:array(src.inventory,BASE.inventory),
      marketListings:array(src.marketListings,BASE.marketListings),
      auctions:array(src.auctions,BASE.auctions),
      markets:array(src.markets,BASE.markets),
      plot:Object.assign({},clone(BASE.plot),plot,{
        x:finite(plot.x,BASE.plot.x),y:finite(plot.y,BASE.plot.y),
        w:Math.max(1,finite(plot.w,BASE.plot.w)),h:Math.max(1,finite(plot.h,BASE.plot.h)),
        lastMaintenance:nonNegative(plot.lastMaintenance,BASE.plot.lastMaintenance),
        furniture:array(plot.furniture,BASE.plot.furniture)
      }),
      farm:Object.assign({},clone(BASE.farm),farm,{
        x:finite(farm.x,BASE.farm.x),y:finite(farm.y,BASE.farm.y),
        w:Math.max(1,finite(farm.w,BASE.farm.w)),h:Math.max(1,finite(farm.h,BASE.farm.h)),
        crops:cropSource.map(function(crop,index){return normalizeCrop(crop,index,BASE.farm.crops[index]);}),
        coop:normalizeAnimal(farm.coop,BASE.farm.coop),
        pen:normalizeAnimal(farm.pen,BASE.farm.pen)
      })
    });
    return normalized;
  }

  function migrateStorage(storage){
    let raw=null;
    try{raw=storage.getItem(STORAGE_KEY);}catch(error){last={status:'storage-read-error',changed:false,fromVersion:null,toVersion:SCHEMA_VERSION,backupCreated:false,error:String(error&&error.message||error)};return snapshot();}
    if(raw==null){last={status:'empty',changed:false,fromVersion:null,toVersion:SCHEMA_VERSION,backupCreated:false,error:null};return snapshot();}
    let parsed;
    try{parsed=JSON.parse(raw);}catch(error){
      last={status:'invalid-json-preserved',changed:false,fromVersion:null,toVersion:SCHEMA_VERSION,backupCreated:false,error:String(error&&error.message||error)};
      return snapshot();
    }
    if(!parsed||typeof parsed!=='object'||Array.isArray(parsed)){
      last={status:'invalid-shape-preserved',changed:false,fromVersion:null,toVersion:SCHEMA_VERSION,backupCreated:false,error:'root-state-must-be-object'};
      return snapshot();
    }
    const fromVersion=Number.isFinite(Number(parsed.schemaVersion))?Number(parsed.schemaVersion):0;
    const normalized=normalizeState(parsed);
    const nextRaw=JSON.stringify(normalized);
    if(nextRaw===raw){last={status:'current',changed:false,fromVersion,toVersion:SCHEMA_VERSION,backupCreated:false,error:null};return snapshot();}
    let backupCreated=false;
    try{
      if(storage.getItem(BACKUP_KEY)==null){storage.setItem(BACKUP_KEY,raw);backupCreated=true;}
      storage.setItem(STORAGE_KEY,nextRaw);
      last={status:'migrated',changed:true,fromVersion,toVersion:SCHEMA_VERSION,backupCreated,error:null};
    }catch(error){last={status:'storage-write-error',changed:false,fromVersion,toVersion:SCHEMA_VERSION,backupCreated,error:String(error&&error.message||error)};}
    return snapshot();
  }

  function snapshot(){return Object.freeze(Object.assign({version:VERSION,storageKey:STORAGE_KEY,backupKey:BACKUP_KEY,schemaVersion:SCHEMA_VERSION},last));}

  return Object.freeze({version:VERSION,storageKey:STORAGE_KEY,backupKey:BACKUP_KEY,schemaVersion:SCHEMA_VERSION,normalizeState,migrateStorage,snapshot});
});
