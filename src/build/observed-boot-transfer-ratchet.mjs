/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: OBSERVED BOOT TRANSFER RATCHET NETWORK REQUEST PAYLOAD IPHONE FIRST PLAYABLE
 * purpose: compare browser-observed local requests started before boot-ready and reject silent transfer growth
 * public-api: normalizeObservedBootReport(), compareObservedBootTransfers()
 * state-owned: none
 * online: N/A; CI/build-time only
 * do-not: infer gameplay authority, mutate runtime, compare external-provider traffic as deterministic local bytes
 */
const n=value=>Number.isFinite(Number(value))?Number(value):0;
const bytes=value=>Math.max(0,Math.round(n(value)));
const count=value=>Math.max(0,Math.round(n(value)));
const pathKey=item=>String(item?.path||'');

export function normalizeObservedBootReport(report={}){
  const resources=(Array.isArray(report.resources)?report.resources:[]).map(item=>Object.freeze({
    path:pathKey(item),
    resourceType:String(item?.resourceType||'other'),
    requestCount:count(item?.requestCount),
    bytesPerResponse:bytes(item?.bytesPerResponse),
    totalPayloadBytes:bytes(item?.totalPayloadBytes),
    statuses:Object.freeze(Array.isArray(item?.statuses)?item.statuses.map(count):[])
  })).filter(item=>item.path).sort((a,b)=>a.path.localeCompare(b.path));
  return Object.freeze({
    schema:String(report?.schema||''),
    url:String(report?.url||''),
    bootReadyMs:Math.max(0,n(report?.bootReadyMs)),
    requestCount:count(report?.requestCount),
    resourceCount:count(report?.resourceCount||resources.length),
    totalPayloadBytes:bytes(report?.totalPayloadBytes),
    unknownLocalByteResponses:count(report?.unknownLocalByteResponses),
    resources:Object.freeze(resources)
  });
}

export function compareObservedBootTransfers(baseInput,headInput,{payloadToleranceBytes=0,requestTolerance=0}={}){
  const base=normalizeObservedBootReport(baseInput),head=normalizeObservedBootReport(headInput);
  const baseMap=new Map(base.resources.map(item=>[item.path,item]));
  const headMap=new Map(head.resources.map(item=>[item.path,item]));
  const regressions=[],improvements=[],added=[],removed=[];
  for(const [path,item] of headMap){
    const prev=baseMap.get(path);
    if(!prev){
      added.push(item);
      regressions.push({type:'observed-preboot-resource-added',path,totalPayloadBytes:item.totalPayloadBytes,requestCount:item.requestCount});
      continue;
    }
    const byteDelta=item.totalPayloadBytes-prev.totalPayloadBytes;
    const requestDelta=item.requestCount-prev.requestCount;
    if(byteDelta>0)regressions.push({type:'observed-preboot-resource-bytes-grew',path,baseBytes:prev.totalPayloadBytes,headBytes:item.totalPayloadBytes,deltaBytes:byteDelta});
    else if(byteDelta<0)improvements.push({type:'observed-preboot-resource-bytes-shrank',path,savedBytes:-byteDelta,baseBytes:prev.totalPayloadBytes,headBytes:item.totalPayloadBytes});
    if(requestDelta>Math.max(0,count(requestTolerance)))regressions.push({type:'observed-preboot-resource-request-count-grew',path,baseCount:prev.requestCount,headCount:item.requestCount,deltaCount:requestDelta});
  }
  for(const [path,item] of baseMap)if(!headMap.has(path))removed.push(item);
  const payloadDelta=head.totalPayloadBytes-base.totalPayloadBytes;
  const requestDelta=head.requestCount-base.requestCount;
  if(payloadDelta>Math.max(0,bytes(payloadToleranceBytes)))regressions.push({type:'observed-preboot-total-bytes-grew',baseBytes:base.totalPayloadBytes,headBytes:head.totalPayloadBytes,deltaBytes:payloadDelta,toleranceBytes:bytes(payloadToleranceBytes)});
  if(requestDelta>Math.max(0,count(requestTolerance)))regressions.push({type:'observed-preboot-total-request-count-grew',baseCount:base.requestCount,headCount:head.requestCount,deltaCount:requestDelta,toleranceCount:count(requestTolerance)});
  if(head.unknownLocalByteResponses>0)regressions.push({type:'observed-preboot-unknown-local-byte-response',count:head.unknownLocalByteResponses});
  return Object.freeze({
    schema:'kelo-observed-boot-transfer-ratchet-v1',
    pass:regressions.length===0,
    regressions:Object.freeze(regressions),
    improvements:Object.freeze(improvements),
    added:Object.freeze(added),
    removed:Object.freeze(removed),
    summary:Object.freeze({
      basePayloadBytes:base.totalPayloadBytes,
      headPayloadBytes:head.totalPayloadBytes,
      payloadDeltaBytes:payloadDelta,
      baseRequestCount:base.requestCount,
      headRequestCount:head.requestCount,
      requestDelta,
      baseResourceCount:base.resourceCount,
      headResourceCount:head.resourceCount,
      baseBootReadyMs:base.bootReadyMs,
      headBootReadyMs:head.bootReadyMs,
      savedBytes:improvements.reduce((sum,item)=>sum+item.savedBytes,0)
    })
  });
}
