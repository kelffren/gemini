/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER RATCHET NETWORK REQUEST PAYLOAD IPHONE FIRST PLAYABLE QUORUM STABLE CORE BOUNDARY PROMOTION REPLACEMENT DELIVERY
 * purpose: compare repeated browser observations using stable preboot core while permitting only explicit, exact, cheaper SOURCE->DELIVERY substitutions
 * public-api: normalizeObservedBootReport(), compareObservedBootTransfers()
 * state-owned: none
 * online: N/A; CI/build-time only
 * do-not: infer gameplay authority, mutate runtime, forgive truly new resources, or hide byte/request growth behind timing-boundary/replacement classification
 */
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const bytes=value=>Math.max(0,Math.round(n(value)));
const count=value=>Math.max(0,Math.round(n(value)));
const pathKey=item=>String(item?.path||'');
const canon=p=>String(p||'').trim().replace(/^\/+/, '');
function normalizeReplacements(input){return(Array.isArray(input)?input:[]).map(item=>({id:String(item?.id||''),source:canon(item?.source),delivery:canon(item?.delivery?.path||item?.deliveryPath),bytes:bytes(item?.delivery?.bytes||item?.deliveryBytes),exact:item?.delivery?.exact===true||item?.exact===true})).filter(item=>item.source&&item.delivery);}
function resourceByPath(map,repoPath){const wanted=canon(repoPath);for(const item of map.values())if(canon(item?.path)===wanted)return item;return null;}
function normalizeResources(input){return (Array.isArray(input)?input:[]).map(item=>Object.freeze({path:pathKey(item),resourceType:String(item?.resourceType||'other'),requestCount:count(item?.requestCount),bytesPerResponse:bytes(item?.bytesPerResponse),totalPayloadBytes:bytes(item?.totalPayloadBytes),presenceCount:count(item?.presenceCount),statuses:Object.freeze(Array.isArray(item?.statuses)?item.statuses.map(count):[])})).filter(item=>item.path).sort((a,b)=>a.path.localeCompare(b.path));}

export function normalizeObservedBootReport(report={}){
  const resources=normalizeResources(report.resources);
  const stableResources=normalizeResources(Array.isArray(report.stableResources)?report.stableResources:resources);
  const stablePayloadBytes=bytes(report.stablePayloadBytes??report.totalPayloadBytes);
  const stableRequestCount=count(report.stableRequestCount??report.requestCount);
  return Object.freeze({schema:String(report?.schema||''),url:String(report?.url||''),runCount:Math.max(1,count(report?.runCount||1)),bootReadyMs:Math.max(0,n(report?.bootReadyMs)),requestCount:count(report?.requestCount),resourceCount:count(report?.resourceCount||resources.length),totalPayloadBytes:bytes(report?.totalPayloadBytes),stableRequestCount,stableResourceCount:count(report?.stableResourceCount||stableResources.length),stablePayloadBytes,unstableResourceCount:count(report?.unstableResourceCount),unknownLocalByteResponses:count(report?.unknownLocalByteResponses),resources:Object.freeze(resources),stableResources:Object.freeze(stableResources)});
}

export function compareObservedBootTransfers(baseInput,headInput,{payloadToleranceBytes=0,requestTolerance=0,replacements=[]}={}){
  const base=normalizeObservedBootReport(baseInput),head=normalizeObservedBootReport(headInput);
  const baseMap=new Map(base.stableResources.map(item=>[item.path,item])),baseAnyMap=new Map(base.resources.map(item=>[item.path,item])),headMap=new Map(head.stableResources.map(item=>[item.path,item])),headAnyMap=new Map(head.resources.map(item=>[item.path,item]));
  const regressions=[],improvements=[],added=[],removed=[],boundaryPromotions=[],replacementImprovements=[];
  const promotedPaths=new Set(),replacementByDelivery=new Map(normalizeReplacements(replacements).map(rule=>[rule.delivery,rule]));
  for(const [path,item] of headMap){
    const prev=baseMap.get(path);
    if(!prev){
      const rule=replacementByDelivery.get(canon(path));
      if(rule){const source=resourceByPath(baseMap,rule.source),headSource=resourceByPath(headAnyMap,rule.source);let problem=null;if(!rule.exact)problem='observed-replacement-not-declared-exact';else if(!source)problem='observed-replacement-source-not-stable-in-base';else if(headSource)problem='observed-replacement-source-still-preboot-in-head';else if(rule.bytes&&item.bytesPerResponse!==rule.bytes)problem='observed-replacement-delivery-byte-contract-mismatch';else if(item.bytesPerResponse>source.bytesPerResponse)problem='observed-replacement-delivery-larger-than-source';else if(item.requestCount>source.requestCount+Math.max(0,count(requestTolerance)))problem='observed-replacement-request-count-grew';if(problem){added.push(item);regressions.push({type:problem,id:rule.id,source:rule.source,delivery:rule.delivery,baseBytes:source?.bytesPerResponse||0,headBytes:item.bytesPerResponse,declaredBytes:rule.bytes,baseCount:source?.requestCount||0,headCount:item.requestCount});continue;}const savedBytes=source.totalPayloadBytes-item.totalPayloadBytes,replacement={type:'observed-stable-preboot-resource-replaced',id:rule.id,source:source.path,delivery:item.path,baseBytes:source.totalPayloadBytes,headBytes:item.totalPayloadBytes,savedBytes,baseCount:source.requestCount,headCount:item.requestCount};replacementImprovements.push(replacement);improvements.push(replacement);continue;}
      const observed=baseAnyMap.get(path);
      if(observed){promotedPaths.add(path);const byteDelta=item.totalPayloadBytes-observed.totalPayloadBytes,requestDelta=item.requestCount-observed.requestCount;const promotion={type:'observed-boundary-resource-promoted-to-stable',path,basePresenceCount:observed.presenceCount,baseRunCount:base.runCount,baseBytes:observed.totalPayloadBytes,headBytes:item.totalPayloadBytes,baseCount:observed.requestCount,headCount:item.requestCount};boundaryPromotions.push(promotion);if(byteDelta>0)regressions.push({type:'observed-boundary-promotion-bytes-grew',path,baseBytes:observed.totalPayloadBytes,headBytes:item.totalPayloadBytes,deltaBytes:byteDelta});if(requestDelta>Math.max(0,count(requestTolerance)))regressions.push({type:'observed-boundary-promotion-request-count-grew',path,baseCount:observed.requestCount,headCount:item.requestCount,deltaCount:requestDelta});continue;}
      added.push(item);regressions.push({type:'observed-stable-preboot-resource-added',path,totalPayloadBytes:item.totalPayloadBytes,requestCount:item.requestCount});continue;
    }
    const byteDelta=item.totalPayloadBytes-prev.totalPayloadBytes,requestDelta=item.requestCount-prev.requestCount;
    if(byteDelta>0)regressions.push({type:'observed-stable-preboot-resource-bytes-grew',path,baseBytes:prev.totalPayloadBytes,headBytes:item.totalPayloadBytes,deltaBytes:byteDelta});else if(byteDelta<0)improvements.push({type:'observed-stable-preboot-resource-bytes-shrank',path,savedBytes:-byteDelta,baseBytes:prev.totalPayloadBytes,headBytes:item.totalPayloadBytes});
    if(requestDelta>Math.max(0,count(requestTolerance)))regressions.push({type:'observed-stable-preboot-resource-request-count-grew',path,baseCount:prev.requestCount,headCount:item.requestCount,deltaCount:requestDelta});
  }
  for(const [path,item] of baseMap)if(!headMap.has(path))removed.push(item);
  const payloadDelta=head.stablePayloadBytes-base.stablePayloadBytes,requestDelta=head.stableRequestCount-base.stableRequestCount;
  const gateHeadResources=head.stableResources.filter(item=>!promotedPaths.has(item.path)),gateHeadPayloadBytes=gateHeadResources.reduce((sum,item)=>sum+item.totalPayloadBytes,0),gateHeadRequestCount=gateHeadResources.reduce((sum,item)=>sum+item.requestCount,0),gatePayloadDelta=gateHeadPayloadBytes-base.stablePayloadBytes,gateRequestDelta=gateHeadRequestCount-base.stableRequestCount;
  if(gatePayloadDelta>Math.max(0,bytes(payloadToleranceBytes)))regressions.push({type:'observed-stable-preboot-total-bytes-grew',baseBytes:base.stablePayloadBytes,headBytes:gateHeadPayloadBytes,deltaBytes:gatePayloadDelta,toleranceBytes:bytes(payloadToleranceBytes),boundaryPromotionsExcluded:promotedPaths.size});
  if(gateRequestDelta>Math.max(0,count(requestTolerance)))regressions.push({type:'observed-stable-preboot-total-request-count-grew',baseCount:base.stableRequestCount,headCount:gateHeadRequestCount,deltaCount:gateRequestDelta,toleranceCount:count(requestTolerance),boundaryPromotionsExcluded:promotedPaths.size});
  if(head.unknownLocalByteResponses>0)regressions.push({type:'observed-preboot-unknown-local-byte-response',count:head.unknownLocalByteResponses});
  return Object.freeze({schema:'kelo-observed-boot-transfer-ratchet-v2-stable-core',pass:regressions.length===0,regressions:Object.freeze(regressions),improvements:Object.freeze(improvements),replacementImprovements:Object.freeze(replacementImprovements),added:Object.freeze(added),removed:Object.freeze(removed),boundaryPromotions:Object.freeze(boundaryPromotions),summary:Object.freeze({basePayloadBytes:base.stablePayloadBytes,headPayloadBytes:head.stablePayloadBytes,payloadDeltaBytes:payloadDelta,baseRequestCount:base.stableRequestCount,headRequestCount:head.stableRequestCount,requestDelta,baseResourceCount:base.stableResourceCount,headResourceCount:head.stableResourceCount,baseRawPayloadBytes:base.totalPayloadBytes,headRawPayloadBytes:head.totalPayloadBytes,baseUnstableResourceCount:base.unstableResourceCount,headUnstableResourceCount:head.unstableResourceCount,baseBootReadyMs:base.bootReadyMs,headBootReadyMs:head.bootReadyMs,gateHeadPayloadBytes,gatePayloadDeltaBytes:gatePayloadDelta,gateHeadRequestCount,gateRequestDelta,boundaryPromotionCount:boundaryPromotions.length,replacementCount:replacementImprovements.length,savedBytes:improvements.reduce((sum,item)=>sum+bytes(item.savedBytes),0)})});
}
