/* KELO-INDEX
 * area: CORE / PERSISTENCE
 * owner: KeloStateStore
 * keys: STATE SAVE MIGRATION SCHEMA BACKUP LEGACY COMPATIBILITY
 * purpose: normaliza el save legacy antes de que engine-a lo consuma, preservando campos desconocidos y creando backup antes de cualquier migración
 * public-api: KeloStateStore.normalizeState/migrateStorage/snapshot
 * consumes: localStorage key kelo_world_state_v2_1
 * state-owned: solo metadata de migración; gameplay STATE sigue legacy durante esta fase
 * extension-points: añadir migraciones versionadas y deterministas sin cambiar gameplay
 * reuse: cualquier futura migración de save debe entrar aquí, no en engine-a
 * legacy: compatibility boundary; no reemplaza STATE todavía
 * do-not: NO gameplay rules, NO timers, NO listeners, NO borrar saves corruptos, NO inventar contenido
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

  const VERSION='kelo-state-store-bootstrap-v1.0.0';
  const STORAGE_KEY='kelo_world_state_v2_1';
  const BACKUP_KEY=STORAGE_KEY+'.backup.pre-schema-v3';
  const SCHEMA_VERSION=3;
  let last={status:'idle',changed:false,fromVersion:null,toVersion:SCHEMA_VERSION,backupCreated:false,error:null};

  const BASE=Object.freeze({
    gold:1500,kc:200,fusionMastery:1,fusionXp:0,farmLevel:1,farmXp:0,investorXp:0,investorRank:1,
    silo:Object.freeze({wheat:10,carrot:4,eggs:0,pork:0}),
    equipped:Object.freeze([]),inventory:Object.freeze([]),marketListings:Object.freeze([]),auctions:Object.freeze([]),markets:Object.freeze([]),
    plot:Object.freeze({x:2000,y:1500,w:400,h:300,lastMaintenance:0,furniture:Object.freeze([])}),
    farm:Object.freeze({
      x:600,y:1500,w:480,h:320,crops:Object.freeze([]),
      coop:Object.freeze({type:'chickens',fedAt:0,duration:20,ready:false}),
      pen:Object.freeze({type:'pigs',fedAt:0,duration:45,ready:false})
    })
  });

  function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
  function array(value){return Array.isArray(value)?value:[];}
  function finite(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function integer(value,fallback){return Math.trunc(finite(value,fallback));}
  function bool(value,fallback){return typeof value==='boolean'?value:fallback;}
  function text(value,fallback){return typeof value==='string'&&value?value:fallback;}
  function nonNegative(value,fallback){return Math.max(0,finite(value,fallback));}

  function normalizeAnimal(raw,defaults){
    const src=object(raw);
    return Object.assign({},src,{
      type:text(src.type,defaults.type),
      fedAt:nonNegative(src.fedAt,defaults.fedAt),
      duration:Math.max(1,finite(src.duration,defaults.duration)),
      ready:bool(src.ready,defaults.ready)
    });
  }

  function normalizeCrop(raw,index){
    const src=object(raw);
    return Object.assign({},src,{
      id:src.id==null?index:src.id,
      type:src.type==null?null:String(src.type),
      plantedAt:nonNegative(src.plantedAt,0),
      harvested:bool(src.harvested,false)
    });
  }

  function normalizeState(input){
    const src=object(input);
    const silo=object(src.silo),plot=object(src.plot),farm=object(src.farm);
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
      silo:Object.assign({},silo,{
        wheat:nonNegative(silo.wheat,BASE.silo.wheat),
        carrot:nonNegative(silo.carrot,BASE.silo.carrot),
        eggs:nonNegative(silo.eggs,BASE.silo.eggs),
        pork:nonNegative(silo.pork,BASE.silo.pork)
      }),
      equipped:array(src.equipped),
      inventory:array(src.inventory),
      marketListings:array(src.marketListings),
      auctions:array(src.auctions),
      markets:array(src.markets),
      plot:Object.assign({},plot,{
        x:finite(plot.x,BASE.plot.x),y:finite(plot.y,BASE.plot.y),
        w:Math.max(1,finite(plot.w,BASE.plot.w)),h:Math.max(1,finite(plot.h,BASE.plot.h)),
        lastMaintenance:nonNegative(plot.lastMaintenance,Date.now()),
        furniture:array(plot.furniture)
      }),
      farm:Object.assign({},farm,{
        x:finite(farm.x,BASE.farm.x),y:finite(farm.y,BASE.farm.y),
        w:Math.max(1,finite(farm.w,BASE.farm.w)),h:Math.max(1,finite(farm.h,BASE.farm.h)),
        crops:array(farm.crops).map(normalizeCrop),
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
