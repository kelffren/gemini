/* KELO-INDEX
 * area: QA / BOOT
 * owner: module loader regression tests
 * keys: LOAD FAILURE RETRY FIRST USE DEDUPLICATION
 * purpose: comprueba que un fallo de red no se presenta como una función lista
 * online: N/A
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync('src/core/module-loader.js','utf8');
const scripts=[];let fail=true;let requested=0;
const document={scripts,getElementById:()=>null,createElement:()=>({getAttribute(n){return this[n]||null;},remove(){scripts.splice(scripts.indexOf(this),1);}}),head:{appendChild(s){scripts.push(s);requested++;queueMicrotask(()=>{if(fail)s.onerror();else s.onload();});}}};
const ctx={document,performance:{now:()=>0},setTimeout:fn=>queueMicrotask(fn),localStorage:{setItem(){}},console};
vm.createContext(ctx);vm.runInContext(source,ctx);
const loader=ctx.KELO_MODULE_LOADER;
await assert.rejects(loader.ensure('bag'),/LOAD_FAILED/);
assert.equal(loader.isReady('bag'),false,'failed pack cannot become ready');
assert.equal(loader.needs('bag'),true,'failed pack must remain retryable');
assert.equal(scripts.length,0,'failed script must not poison retries');
fail=false;
await loader.ensure('bag');
assert.equal(loader.isReady('bag'),true);
assert.equal(requested,scripts.length+1,'each successful file is requested once, plus the failed attempt');
const paths=scripts.map(s=>s.src.split('?')[0]);
assert.equal(new Set(paths).size,paths.length,'no duplicate scripts are installed');
console.log('PASS: network failure rejects, remains retryable, and succeeds after retry');
