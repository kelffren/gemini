/* KELO-INDEX
 * area: QA / RELIABILITY
 * owner: KELO_FUSEBOX audit
 * keys: FEATURE FLAG KILL-SWITCH CIRCUIT-BREAKER BULKHEAD HALF-OPEN MODULE-LOADER
 * purpose: prueba determinista de aislamiento, switch manual, trip, probe y recuperación sin navegador
 * online: N/A; valida contrato cliente local reemplazable por policy server
 */
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const listeners=new Map();
const storage=()=>{const m=new Map();return {getItem:k=>m.has(String(k))?m.get(String(k)):null,setItem:(k,v)=>m.set(String(k),String(v)),removeItem:k=>m.delete(String(k)),clear:()=>m.clear()};};
class FakeCustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
const ctx={
  console,
  Date,
  JSON,
  Math,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Promise,
  TypeError,
  Error,
  CustomEvent:FakeCustomEvent,
  localStorage:storage(),
  sessionStorage:storage(),
  __KELO_FUSEBOX_CONFIG__:{failureThreshold:2,cooldownMs:10},
  addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,new Set());listeners.get(type).add(fn);},
  removeEventListener(type,fn){listeners.get(type)?.delete(fn);},
  dispatchEvent(event){for(const fn of listeners.get(event?.type)||[])fn(event);return true;}
};
ctx.window=ctx;
ctx.globalThis=ctx;
vm.createContext(ctx);
for(const file of ['src/core/feature-registry.js','src/core/asset-registry.js','src/core/feature-control-system.js'])vm.runInContext(read(file),ctx,{filename:file});

const flags=ctx.KELO_ASSET_REGISTRY;
const fuse=ctx.KELO_FUSEBOX;
assert.ok(flags,'asset registry missing');
assert.ok(fuse,'FuseBox missing');
assert.equal(fuse.failureThreshold,2);
assert.equal(fuse.cooldownMs,10);

// Manual kill switch stays owned by KELO_ASSET_REGISTRY and is exposed by FuseBox.
assert.equal(fuse.canRun('market'),true);
assert.equal(fuse.setEnabled('market',false),true);
assert.equal(flags.isEnabled('market'),false);
assert.equal(fuse.explain('market').status,'MANUAL_OFF');
assert.equal(fuse.beginAttempt('market'),false);
assert.equal(fuse.setEnabled('market',true),true);
assert.equal(flags.isEnabled('market'),true);
assert.equal(fuse.canRun('market'),true);

// Two consecutive failures trip only the failing feature.
assert.equal(fuse.beginAttempt('world'),true);
fuse.recordFailure('world',new Error('WORLD_FAIL_1'));
assert.equal(fuse.snapshot('world').mode,'CLOSED');
assert.equal(fuse.canRun('world'),true);
assert.equal(fuse.beginAttempt('world'),true);
fuse.recordFailure('world',new Error('WORLD_FAIL_2'));
assert.equal(fuse.snapshot('world').mode,'OPEN');
assert.equal(fuse.canRun('world'),false);
assert.equal(fuse.canRun('social'),true,'world failure leaked into social');
assert.equal(fuse.canRun('bag'),true,'world failure leaked into bag');

// Cooldown does not poll. The next request becomes the single HALF_OPEN probe.
await sleep(15);
assert.equal(fuse.explain('world').status,'HALF_OPEN_READY');
assert.equal(fuse.beginAttempt('world'),true);
assert.equal(fuse.snapshot('world').mode,'HALF_OPEN');
assert.equal(fuse.beginAttempt('world'),false,'second concurrent probe must be rejected');
fuse.recordSuccess('world',{operation:'audit-probe'});
assert.equal(fuse.snapshot('world').mode,'CLOSED');
assert.equal(fuse.snapshot('world').consecutiveFailures,0);
assert.equal(fuse.canRun('world'),true);

// Runtime owners can opt into the same circuit contract with run().
let fallbacks=0;
for(let i=0;i<2;i++){
  const value=await fuse.run('bag',async()=>{throw new Error('BAG_RUNTIME_FAIL');},{rethrow:false,fallback:()=>{fallbacks+=1;return'fallback';}});
  assert.equal(value,'fallback');
}
assert.equal(fallbacks,2);
assert.equal(fuse.snapshot('bag').mode,'OPEN');
assert.equal(fuse.canRun('titles'),true,'bag failure leaked into titles');

// Core/unknown IDs are deliberately unmanaged: FuseBox cannot accidentally shut down the core.
assert.equal(fuse.canRun('movement-core'),true);
assert.equal(fuse.recordFailure('movement-core',new Error('ignore')),false);
assert.equal(fuse.explain('movement-core').status,'UNMANAGED');

const index=read('index.html');
const loader=read('src/core/module-loader.js');
assert.match(index,/feature-control-system\.js/,'index must load FuseBox');
assert.ok(index.indexOf('feature-control-system.js')<index.indexOf('module-loader.js'),'FuseBox must load before ModuleLoader');
assert.match(loader,/KELO_FUSEBOX/,'ModuleLoader must consume FuseBox');
assert.match(loader,/beginAttempt/,'ModuleLoader must acquire a circuit attempt');
assert.match(loader,/recordFailure/,'ModuleLoader must report feature failures');
assert.match(loader,/recordSuccess/,'ModuleLoader must report successful recovery');

console.log('FuseBox audit PASS');
