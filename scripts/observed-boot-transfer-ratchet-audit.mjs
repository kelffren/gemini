/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER RATCHET AUDIT PAYLOAD REQUEST COUNT REGRESSION STABLE CORE BOUNDARY
 * purpose: deterministic pure-data regression test for repeated observed preboot transfer comparison
 * public-api: CLI audit
 * state-owned: none
 * online: N/A
 */
import {compareObservedBootTransfers} from '../src/build/observed-boot-transfer-ratchet.mjs';
const assert=(value,message)=>{if(!value)throw new Error(message);};
const report=(entries,extra={})=>{const stable=entries.map(item=>({resourceType:'script',requestCount:1,bytesPerResponse:item.bytes,totalPayloadBytes:item.bytes,presenceCount:3,statuses:[200],...item}));return{schema:'kelo-observed-boot-transfer-v2-stable-core',runCount:3,bootReadyMs:200,resources:stable,stableResources:stable,requestCount:stable.reduce((s,item)=>s+item.requestCount,0),resourceCount:stable.length,totalPayloadBytes:stable.reduce((s,item)=>s+item.totalPayloadBytes,0),stableRequestCount:stable.reduce((s,item)=>s+item.requestCount,0),stableResourceCount:stable.length,stablePayloadBytes:stable.reduce((s,item)=>s+item.totalPayloadBytes,0),unstableResourceCount:0,unknownLocalByteResponses:0,...extra};};
const base=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300}]);
const smaller=report([{path:'/index.html',bytes:90},{path:'/core.js',bytes:180},{path:'/grass.png',bytes:300}]);
const larger=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:240},{path:'/grass.png',bytes:300}]);
const added=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300},{path:'/new.png',bytes:10}]);
const repeated=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200,requestCount:2,totalPayloadBytes:400},{path:'/grass.png',bytes:300}],{requestCount:4,totalPayloadBytes:800,stableRequestCount:4,stablePayloadBytes:800});
const unknown=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300}],{unknownLocalByteResponses:1});
const boundary={...base,resources:[...base.resources,{path:'/race.js',resourceType:'script',requestCount:1,bytesPerResponse:50,totalPayloadBytes:50,presenceCount:1,statuses:[200]}],resourceCount:4,totalPayloadBytes:650,unstableResourceCount:1};
assert(compareObservedBootTransfers(base,smaller).pass,'smaller stable observed boot must pass');
const grow=compareObservedBootTransfers(base,larger);assert(!grow.pass&&grow.regressions.some(r=>r.type==='observed-stable-preboot-resource-bytes-grew'&&r.path==='/core.js'),'stable resource byte growth must fail');
const add=compareObservedBootTransfers(base,added);assert(!add.pass&&add.regressions.some(r=>r.type==='observed-stable-preboot-resource-added'&&r.path==='/new.png'),'new stable observed resource must fail');
const repeat=compareObservedBootTransfers(base,repeated);assert(!repeat.pass&&repeat.regressions.some(r=>r.type==='observed-stable-preboot-resource-request-count-grew'),'stable duplicate request growth must fail');
const missing=compareObservedBootTransfers(base,unknown);assert(!missing.pass&&missing.regressions.some(r=>r.type==='observed-preboot-unknown-local-byte-response'),'unknown local byte response must fail closed');
assert(compareObservedBootTransfers(base,boundary).pass,'boundary-only resource must remain advisory and not hard-fail');
console.log('OBSERVED_BOOT_TRANSFER_RATCHET_AUDIT_PASS');
