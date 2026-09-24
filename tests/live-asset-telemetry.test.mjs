/* KELO-INDEX
 * area: TEST / ASSET LIBRARY / LIVE QA
 * owner: Asset Intelligence acceptance
 * purpose: verify bounded telemetry and mobile live-preview lifecycle instrumentation
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {recordAssetMetric,beginAssetMetric,assetTelemetrySnapshot,clearAssetTelemetry} from '../src/creators/assets/live-asset-telemetry.mjs';

class MemoryStorage{constructor(){this.m=new Map()}getItem(k){return this.m.get(k)??null}setItem(k,v){this.m.set(k,String(v))}removeItem(k){this.m.delete(k)}}
globalThis.localStorage=new MemoryStorage();

test('live asset telemetry is bounded and summarizes timings',()=>{
 clearAssetTelemetry();
 for(let i=0;i<260;i++)recordAssetMetric('preview.open',{durationMs:i%20,previewBytes:i});
 const snap=assetTelemetrySnapshot();
 assert.equal(snap.count,240);
 assert.equal(snap.summary['preview.open'].count,240);
 assert.ok(snap.summary['preview.open'].maxDurationMs>=19);
});
test('timed metric records duration without throwing when memory API is absent',async()=>{
 clearAssetTelemetry();
 const done=beginAssetMetric('search',{queryLength:4});
 await new Promise(r=>setTimeout(r,2));
 const row=done({results:10});
 assert.equal(row.type,'search');
 assert.equal(row.results,10);
 assert.ok(row.durationMs>=0);
});
