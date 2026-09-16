/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER RATCHET AUDIT PAYLOAD REQUEST COUNT REGRESSION STABLE CORE BOUNDARY PROMOTION REPLACEMENT DELIVERY
 * purpose: deterministic pure-data regression test for repeated observed preboot transfer comparison including exact delivery substitutions
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
const race={path:'/race.js',resourceType:'script',requestCount:1,bytesPerResponse:50,totalPayloadBytes:50,presenceCount:1,statuses:[200]};
const boundary={...base,resources:[...base.resources,race],resourceCount:4,totalPayloadBytes:650,unstableResourceCount:1};
const promoted=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300},{path:'/race.js',bytes:50}],{resources:[...base.resources,{...race,presenceCount:3}],requestCount:4,resourceCount:4,totalPayloadBytes:650,stableRequestCount:4,stableResourceCount:4,stablePayloadBytes:650});
const promotedBigger=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300},{path:'/race.js',bytes:60}],{resources:[...base.resources,{...race,presenceCount:3,totalPayloadBytes:60,bytesPerResponse:60}],requestCount:4,resourceCount:4,totalPayloadBytes:660,stableRequestCount:4,stableResourceCount:4,stablePayloadBytes:660});
const promotedRepeated=report([{path:'/index.html',bytes:100},{path:'/core.js',bytes:200},{path:'/grass.png',bytes:300},{path:'/race.js',bytes:50,requestCount:2,totalPayloadBytes:100}],{resources:[...base.resources,{...race,presenceCount:3,requestCount:2,totalPayloadBytes:100}],requestCount:5,resourceCount:4,totalPayloadBytes:700,stableRequestCount:5,stableResourceCount:4,stablePayloadBytes:700});
assert(compareObservedBootTransfers(base,smaller).pass,'smaller stable observed boot must pass');
const grow=compareObservedBootTransfers(base,larger);assert(!grow.pass&&grow.regressions.some(r=>r.type==='observed-stable-preboot-resource-bytes-grew'&&r.path==='/core.js'),'stable resource byte growth must fail');
const add=compareObservedBootTransfers(base,added);assert(!add.pass&&add.regressions.some(r=>r.type==='observed-stable-preboot-resource-added'&&r.path==='/new.png'),'new stable observed resource must fail');
const repeat=compareObservedBootTransfers(base,repeated);assert(!repeat.pass&&repeat.regressions.some(r=>r.type==='observed-stable-preboot-resource-request-count-grew'),'stable duplicate request growth must fail');
const missing=compareObservedBootTransfers(base,unknown);assert(!missing.pass&&missing.regressions.some(r=>r.type==='observed-preboot-unknown-local-byte-response'),'unknown local byte response must fail closed');
assert(compareObservedBootTransfers(base,boundary).pass,'boundary-only resource must remain advisory and not hard-fail');
const promote=compareObservedBootTransfers(boundary,promoted);assert(promote.pass,'base boundary promoted to stable with identical cost must pass');assert(promote.boundaryPromotions.length===1&&promote.boundaryPromotions[0].path==='/race.js','boundary promotion must be reported');assert(promote.summary.gateRequestDelta===0,'boundary promotion must not inflate aggregate request gate');
const promoteGrow=compareObservedBootTransfers(boundary,promotedBigger);assert(!promoteGrow.pass&&promoteGrow.regressions.some(r=>r.type==='observed-boundary-promotion-bytes-grew'),'boundary promotion byte growth must fail');
const promoteRepeat=compareObservedBootTransfers(boundary,promotedRepeated);assert(!promoteRepeat.pass&&promoteRepeat.regressions.some(r=>r.type==='observed-boundary-promotion-request-count-grew'),'boundary promotion request growth must fail');
const source=report([{path:'/assets/source.png',bytes:100}]),delivery=report([{path:'/assets/delivery.png',bytes:40}]),rule={id:'asset',source:'assets/source.png',delivery:{path:'assets/delivery.png',bytes:40,exact:true}};
const replaced=compareObservedBootTransfers(source,delivery,{replacements:[rule]});assert(replaced.pass&&replaced.replacementImprovements.length===1&&replaced.summary.savedBytes===60,'declared exact observed replacement must pass');
const undeclared=compareObservedBootTransfers(source,delivery);assert(!undeclared.pass&&undeclared.regressions.some(r=>r.type==='observed-stable-preboot-resource-added'),'undeclared observed rename must fail');
const wrongBytes=compareObservedBootTransfers(source,delivery,{replacements:[{...rule,delivery:{...rule.delivery,bytes:41}}]});assert(!wrongBytes.pass&&wrongBytes.regressions.some(r=>r.type==='observed-replacement-delivery-byte-contract-mismatch'),'observed delivery bytes must match declaration');
const tooBig=compareObservedBootTransfers(source,report([{path:'/assets/delivery.png',bytes:120}]),{replacements:[{...rule,delivery:{...rule.delivery,bytes:120}}]});assert(!tooBig.pass&&tooBig.regressions.some(r=>r.type==='observed-replacement-delivery-larger-than-source'),'larger observed replacement must fail');
const sourceStill=report([{path:'/assets/source.png',bytes:100},{path:'/assets/delivery.png',bytes:40}]);const duplicate=compareObservedBootTransfers(source,sourceStill,{replacements:[rule]});assert(!duplicate.pass&&duplicate.regressions.some(r=>r.type==='observed-replacement-source-still-preboot-in-head'),'SOURCE still preboot must fail replacement');
console.log('OBSERVED_BOOT_TRANSFER_RATCHET_AUDIT_PASS');
