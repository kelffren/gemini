/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER RATCHET NETWORK REQUEST PAYLOAD IPHONE FIRST PLAYABLE QUORUM STABLE CORE BOUNDARY PROMOTION
 * purpose: compare repeated browser observations using stable preboot core while treating base-observed timing-boundary promotions as advisory unless bytes/requests grow
 * public-api: normalizeObservedBootReport(), compareObservedBootTransfers()
 * state-owned: none
 * online: N/A; CI/build-time only
 * do-not: infer gameplay authority, mutate runtime, forgive truly new resources, or hide byte/request growth behind timing-boundary classification
 */
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const bytes=value=>Math.max(0,Math.round(n(value)));
const count=value=>Math.max(0,Math.round(n(value)));
const pathKey=item=>String(item?.path||'');
function normalizeResources(input){return (Array.isArray(input)?input:[]).map(item=>Object.freeze({path:pathKey(item),resourceType:String(item?.resourceType||'other'),requestCount:count(item?.requestCount),bytesPerResponse:bytes(item?.bytesPerResponse),totalPayloadBytes:bytes(item?.totalPayloadBytes),presenceCount:count(item?.presenceCount),statuses:Object.freeze(Array.isArray(item?.statuses)?item.statuses.map(count):[])})).filter(item=>item.path).sort((a,b)=>a.path.localeCompare(b.path));}

export function normalizeObservedBootReport(report={}){
  const resources=normalizeResources(report.resources);
  const stableResources=normalizeResources(Array.isArray(report.stableResources)?report.stableResources:resources);
  const stablePayloadBytes=bytes(report.stablePayloadBytes??report.totalPayloadBytes);
  const stableRequestCount=count(report.stableRequestCount??report.requestCount);
  return Object.freeze({
    schema:String(report?.schema||''),
    url:String(report?.url||''),
    runCount:Math.max(1,count(report?.runCount||1)),
    bootReadyMs:Math.max(0,n(report?.bootReadyMs)),
    requestCount:count(report?.requestCount),
    resourceCount:count(report?.resourceCount||resources.length),
    totalPayloadBytes:bytes(report?.totalPayloadBytes),
    stableRequestCount,
    stableResourceCount:count(report?.stableResourceCount||stableResources.length),
    stablePayloadBytes,
    unstableResourceCount:count(report?.unstableResourceCount),
    unknownLocalByteResponses:count(report?.unknownLocalByteResponses),
    resources:Object.freeze(resources),
    stableResources:Object.freeze(stableResources)
  });
}

export function compareObservedBootTransfers(baseInput,headInput,{payloadToleranceBytes=0,requestTolerance=0}={}){
  const base=normalizeObservedBootReport(baseInput),head=normalizeObservedBootReport(headInput);
  const baseMap=new Map(base.stableResources.map(item=>[item.path,item]));
  const baseAnyMap=new Map(base.resources.map(item=>[item.path,item]));
  const headMap=new Map(head.stableResources.map(item=>[item.path,item]));
  const regressions=[],improvements=[],added=[],removed=[],boundaryPromotions=[];
  const promotedPaths=new Set();
  for(const [path,item] of headMap){
    const prev=baseMap.get(path);
    if(!prev){
      const observed=baseAnyMap.get(path);
      if(observed){
        promotedPaths.add(path);
        const byteDelta=item.totalPayloadBytes-observed.totalPayloadBytes,requestDelta=item.requestCount-observed.requestCount;
        const promotion={type:'observed-boundary-resource-promoted-to-stable',path,basePresenceCount:observed.presenceCount,baseRunCount:base.runCount,baseBytes:observed.totalPayloadBytes,headBytes:item.totalPayloadBytes,baseCount:observed.requestCount,headCount:item.requestCount};
        boundaryPromotions.push(promotion);
        if(byteDelta>0)regressions.push({type:'observed-boundary-promotion-bytes-grew',path,baseBytes:observed.totalPayloadBytes,headBytes:item.totalPayloadBytes,deltaBytes:byteDelta});
        if(requestDelta>Math.max(0,count(requestTolerance)))regressions.push({type:'observed-boundary-promotion-request-count-grew',path,baseCount:observed.requestCount,headCount:item.requestCount,deltaCount:requestDelta});
        continue;
      }
      added.push(item);regressions.push({type:'observed-stable-preboot-resource-added',path,totalPayloadBytes:item.totalPayloadBytes,requestCount:item.requestCount});continue;
    }
    const byteDelta=item.totalPayloadBytes-prev.totalPayloadBytes,requestDelta=item.requestCount-prev.requestCount;
    if(byteDelta>0)regressions.push({type:'observed-stable-preboot-resource-bytes-grew',path,baseBytes:prev.totalPayloadBytes,headBytes:item.totalPayloadBytes,deltaBytes:byteDelta});
    else if(byteDelta<0)improvements.push({type:'observed-stable-preboot-resource-bytes-shrank',path,savedBytes:-byteDelta,baseBytes:prev.totalPayloadBytes,headBytes:item.totalPayloadBytes});
    if(requestDelta>Math.max(0,count(requestTolerance)))regressions.push({type:'observed-stable-preboot-resource-request-count-grew',path,baseCount:prev.requestCount,headCount:item.requestCount,deltaCount:requestDelta});
  }
  for(const [path,item] of baseMap)if(!headMap.has(path))removed.push(item);

  const payloadDelta=head.stablePayloadBytes-base.stablePayloadBytes,requestDelta=head.stableRequestCount-base.stableRequestCount;
  const gateHeadResources=head.stableResources.filter(item=>!promotedPaths.has(item.path));
  const gateHeadPayloadBytes=gateHeadResources.reduce((sum,item)=>sum+item.totalPayloadBytes,0),gateHeadRequestCount=gateHeadResources.reduce((sum,item)=>sum+item.requestCount,0);
  const gatePayloadDelta=gateHeadPayloadBytes-base.stablePayloadBytes,gateRequestDelta=gateHeadRequestCount-base.stableRequestCount;
  if(gatePayloadDelta>Math.max(0,bytes(payloadToleranceBytes)))regressions.push({type:'observed-stable-preboot-total-bytes-grew',baseBytes:base.stablePayloadBytes,headBytes:gateHeadPayloadBytes,deltaBytes:gatePayloadDelta,toleranceBytes:bytes(payloadToleranceBytes),boundaryPromotionsExcluded:promotedPaths.size});
  if(gateRequestDelta>Math.max(0,count(requestTolerance)))regressions.push({type:'observed-stable-preboot-total-request-count-grew',baseCount:base.stableRequestCount,headCount:gateHeadRequestCount,deltaCount:gateRequestDelta,toleranceCount:count(requestTolerance),boundaryPromotionsExcluded:promotedPaths.size});
  if(head.unknownLocalByteResponses>0)regressions.push({type:'observed-preboot-unknown-local-byte-response',count:head.unknownLocalByteResponses});
  return Object.freeze({
    schema:'kelo-observed-boot-transfer-ratchet-v2-stable-core',pass:regressions.length===0,
    regressions:Object.freeze(regressions),improvements:Object.freeze(improvements),added:Object.freeze(added),removed:Object.freeze(removed),boundaryPromotions:Object.freeze(boundaryPromotions),
    summary:Object.freeze({basePayloadBytes:base.stablePayloadBytes,headPayloadBytes:head.stablePayloadBytes,payloadDeltaBytes:payloadDelta,baseRequestCount:base.stableRequestCount,headRequestCount:head.stableRequestCount,requestDelta,baseResourceCount:base.stableResourceCount,headResourceCount:head.stableResourceCount,baseRawPayloadBytes:base.totalPayloadBytes,headRawPayloadBytes:head.totalPayloadBytes,baseUnstableResourceCount:base.unstableResourceCount,headUnstableResourceCount:head.unstableResourceCount,baseBootReadyMs:base.bootReadyMs,headBootReadyMs:head.bootReadyMs,gateHeadPayloadBytes,gatePayloadDeltaBytes:gatePayloadDelta,gateHeadRequestCount,gateRequestDelta,boundaryPromotionCount:boundaryPromotions.length,savedBytes:improvements.reduce((sum,item)=>sum+item.savedBytes,0)})
  });
}