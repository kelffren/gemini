/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER RATCHET AUDIT PAYLOAD REQUEST COUNT REGRESSION
 * purpose: deterministic pure-data regression test for observed preboot transfer comparison
 * public-api: CLI audit
 * state-owned: none
 * online: N/A
 */
import {compareObservedBootTransfers} from '../src/build/observed-boot-transfer-ratchet.mjs';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const report=(entries,extra={})=>({schema:'kelo-observed-boot-transfer-v1',bootReadyMs:200,resources:entries.map(item=>({resourceType:'script',requestCount:1,bytesPerResponse:item.bytes,totalPayloadBytes:item.bytes,statuses:[200],...item})),requestCount:entries.reduce((s,item)=>s+(item.requestCount||1),0),resourceCount:entries.length,totalPayloadBytes:entries.reduce((s,item)=>s+(item.totalPayloadBytes??item.bytes),0),unknownLocalByteResponses:0,...extra});
const base=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300}]);
const smaller=report([{path:'/index.html',bytes:90},{path:'/core.js',bytes:180},{path:'/grass.png',bytes:300}]);
const larger=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:240},{path:'/grass.png',bytes:300}]);
const added=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300},{path:'/new.png',bytes:10}]);
const repeated=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200,requestCount:2,totalPayloadBytes:400},{path:'/grass.png',bytes:300}],{requestCount:4,totalPayloadBytes:800});
const unknown=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300}],{unknownLocalByteResponses:1});
assert(compareObservedBootTransfers(base,smaller).pass,'smaller observed boot must pass');
const grow=compareObservedBootTransfers(base,larger);assert(!grow.pass&&grow.regressions.some(r=>r.type==='observed-preboot-resource-bytes-grew'&&r.path==='/core.js'),'resource byte growth must fail');
const add=compareObservedBootTransfers(base,added);assert(!add.pass&&add.regressions.some(r=>r.type==='observed-preboot-resource-added'&&r.path==='/new.png'),'new observed resource must fail');
const repeat=compareObservedBootTransfers(base,repeated);assert(!repeat.pass&&repeat.regressions.some(r=>r.type==='observed-preboot-resource-request-count-grew'),'duplicate request growth must fail');
const missing=compareObservedBootTransfers(base,unknown);assert(!missing.pass&&missing.regressions.some(r=>r.type==='observed-preboot-unknown-local-byte-response'),'unknown local byte response must fail closed');
console.log('OBSERVED_BOOT_TRANSFER_RATCHET_AUDIT_PASS');
