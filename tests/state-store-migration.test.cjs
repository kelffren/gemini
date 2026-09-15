/* KELO-INDEX
 * area: QA / PERSISTENCE
 * owner: KeloStateStore migration characterization
 * purpose: garantiza migración idempotente, backup, preservación de campos y tolerancia a JSON corrupto
 */
'use strict';
const assert=require('node:assert/strict');
const store=require('../src/core/state-store-bootstrap.js');

function storage(seed){
  const data=new Map(Object.entries(seed||{}));
  return {
    getItem(k){return data.has(k)?data.get(k):null;},
    setItem(k,v){data.set(k,String(v));},
    removeItem(k){data.delete(k);},
    dump(){return Object.fromEntries(data);}
  };
}

(function migratesPartialSaveWithoutDroppingUnknownFields(){
  const legacy={gold:77,customFutureField:{keep:true},farm:{crops:[{id:9,type:'wheat'}]}};
  const mem=storage({[store.storageKey]:JSON.stringify(legacy)});
  const result=store.migrateStorage(mem);
  assert.equal(result.status,'migrated');
  assert.equal(result.backupCreated,true);
  const next=JSON.parse(mem.getItem(store.storageKey));
  assert.equal(next.gold,77);
  assert.deepEqual(next.customFutureField,{keep:true});
  assert.ok(Array.isArray(next.inventory));
  assert.ok(Array.isArray(next.equipped));
  assert.ok(Array.isArray(next.marketListings));
  assert.ok(next.silo&&typeof next.silo==='object');
  assert.ok(next.plot&&Array.isArray(next.plot.furniture));
  assert.ok(next.farm&&Array.isArray(next.farm.crops));
  assert.equal(next.farm.crops[0].id,9);
  assert.equal(next.schemaVersion,store.schemaVersion);
  assert.equal(mem.getItem(store.backupKey),JSON.stringify(legacy));
})();

(function migrationIsIdempotentAndDoesNotReplaceFirstBackup(){
  const legacy={gold:5};
  const mem=storage({[store.storageKey]:JSON.stringify(legacy)});
  store.migrateStorage(mem);
  const firstBackup=mem.getItem(store.backupKey);
  const second=store.migrateStorage(mem);
  assert.equal(second.changed,false);
  assert.equal(second.status,'current');
  assert.equal(mem.getItem(store.backupKey),firstBackup);
})();

(function invalidJsonIsPreservedByteForByte(){
  const raw='{not-json';
  const mem=storage({[store.storageKey]:raw});
  const result=store.migrateStorage(mem);
  assert.equal(result.status,'invalid-json-preserved');
  assert.equal(mem.getItem(store.storageKey),raw);
  assert.equal(mem.getItem(store.backupKey),null);
})();

(function invalidRootShapeIsPreserved(){
  const raw='[]';
  const mem=storage({[store.storageKey]:raw});
  const result=store.migrateStorage(mem);
  assert.equal(result.status,'invalid-shape-preserved');
  assert.equal(mem.getItem(store.storageKey),raw);
})();

(function clampsOnlyStructurallyUnsafeValues(){
  const next=store.normalizeState({gold:-10,kc:'25',farmLevel:0,plot:{w:0,h:-2},farm:{coop:{duration:0},pen:{duration:'4'}}});
  assert.equal(next.gold,0);
  assert.equal(next.kc,25);
  assert.equal(next.farmLevel,1);
  assert.equal(next.plot.w,1);
  assert.equal(next.plot.h,1);
  assert.equal(next.farm.coop.duration,1);
  assert.equal(next.farm.pen.duration,4);
})();

console.log('STATE STORE MIGRATION PASS');
