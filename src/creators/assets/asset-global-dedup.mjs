/* KELO-INDEX
 * area: BUILD / CREATOR ASSET QA
 * owner: Kelo Creator Asset Bridge
 * keys: ASSET GLOBAL DEDUP CONTENT ADDRESS SHA256 RGBA CHAMPION BLOB
 * purpose: build a non-mutating exact-dedup and RGBA-convergence plan from asset-space snapshots
 * public-api: buildAssetGlobalDedupPlan()
 * state-owned: none
 * online: N/A; build/publish-time planning only
 * do-not: rewrite SOURCE, alias semantic IDs or promote RGBA-equivalent files automatically
 */

function finiteBytes(value){const n=Number(value);return Number.isFinite(n)&&n>=0?Math.round(n):0;}
function keyRgba(item){
  if(!item?.rgbaSha256||!Number.isFinite(Number(item.width))||!Number.isFinite(Number(item.height)))return null;
  return `${Number(item.width)}x${Number(item.height)}:${String(item.rgbaSha256)}`;
}
function groupBy(files,keyFn){
  const map=new Map();
  for(const item of files){const key=keyFn(item);if(!key)continue;if(!map.has(key))map.set(key,[]);map.get(key).push(item);}
  return map;
}
function normalizedFiles(report){
  return (Array.isArray(report?.files)?report.files:[])
    .filter(item=>item&&!item.error&&item.file)
    .map(item=>({file:String(item.file),sha256:item.sha256?String(item.sha256):null,rgbaSha256:item.rgbaSha256?String(item.rgbaSha256):null,width:Number(item.width)||null,height:Number(item.height)||null,storedBytes:finiteBytes(item.storedBytes)}));
}
function summarizeGroup(kind,key,items){
  const sorted=items.slice().sort((a,b)=>a.storedBytes-b.storedBytes||a.file.localeCompare(b.file));
  const logicalBytes=sorted.reduce((sum,item)=>sum+item.storedBytes,0);
  const champion=sorted[0];
  return Object.freeze({kind,key,count:sorted.length,champion:Object.freeze({...champion}),files:Object.freeze(sorted.map(item=>Object.freeze({...item}))),logicalBytes,championBytes:champion.storedBytes,potentialSavingBytes:Math.max(0,logicalBytes-champion.storedBytes)});
}

export function buildAssetGlobalDedupPlan(report){
  const files=normalizedFiles(report);
  const byteGroups=[...groupBy(files,item=>item.sha256).entries()]
    .filter(([,items])=>items.length>1)
    .map(([key,items])=>summarizeGroup('byte-exact',key,items))
    .sort((a,b)=>b.potentialSavingBytes-a.potentialSavingBytes||b.count-a.count);

  const rgbaGroups=[...groupBy(files,keyRgba).entries()]
    .filter(([,items])=>items.length>1)
    .map(([key,items])=>summarizeGroup('rgba-exact',key,items))
    .filter(group=>new Set(group.files.map(item=>item.sha256)).size>1)
    .sort((a,b)=>b.potentialSavingBytes-a.potentialSavingBytes||b.count-a.count);

  const logicalStoredBytes=files.reduce((sum,item)=>sum+item.storedBytes,0);
  const byteExactSavingBytes=byteGroups.reduce((sum,group)=>sum+group.potentialSavingBytes,0);
  const rgbaConvergenceCandidateBytes=rgbaGroups.reduce((sum,group)=>sum+group.potentialSavingBytes,0);
  return Object.freeze({
    schema:'kelo-asset-global-dedup-plan-v1',generatedAt:new Date().toISOString(),fileCount:files.length,
    totals:Object.freeze({logicalStoredBytes,byteExactPhysicalBytes:Math.max(0,logicalStoredBytes-byteExactSavingBytes),byteExactSavingBytes,rgbaConvergenceCandidateBytes}),
    byteExactGroups:Object.freeze(byteGroups),rgbaExactConvergenceCandidates:Object.freeze(rgbaGroups),
    invariants:Object.freeze({byteExactSafeToShareBlob:true,rgbaExactRequiresMetadataAndConsumerProof:true,sourceMutation:false})
  });
}
