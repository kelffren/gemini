/* KELO-INDEX
 * area: CREATORS / ASSET SEARCH
 * owner: Kelo Creator Asset Bridge
 * keys: QUALITY SEARCH MULTI BOUNDARY NON MONOTONIC PROBE BUDGET PARETO
 * purpose: concentrate expensive codec evaluations around measured transitions while actively searching failed regions for hidden pass islands
 * public-api: searchIntegerQualityBoundary()
 * state-owned: none
 * online: N/A; build/publish-time search capability
 */

function clamp(q,min,max){return Math.max(min,Math.min(max,Math.round(q)));}
function unique(values,min,max){return[...new Set(values.map(v=>clamp(v,min,max)))].sort((a,b)=>b-a);}
function sortedRecords(records){return[...records].sort((a,b)=>b.quality-a.quality);}
function transitions(records){const sorted=sortedRecords(records),out=[];for(let i=0;i<sorted.length-1;i+=1){const a=sorted[i],b=sorted[i+1];if(a.pass!==b.pass)out.push({high:a.quality,low:b.quality,highPass:a.pass,lowPass:b.pass,width:a.quality-b.quality});}return out;}
function nonMonotonic(records){const sorted=sortedRecords(records);let seenFail=false;for(const item of sorted){if(!item.pass)seenFail=true;else if(seenFail)return true;}return false;}
function adjacentGaps(results){const sorted=sortedRecords(results.values()),gaps=[];for(let i=0;i<sorted.length-1;i+=1){const high=sorted[i],low=sorted[i+1],width=high.quality-low.quality;if(width>1)gaps.push({high:high.quality,low:low.quality,width,highPass:high.pass,lowPass:low.pass,sameState:high.pass===low.pass,state:high.pass});}return gaps;}
function explorationGap(results){
  const gaps=adjacentGaps(results);
  const sameState=gaps.filter(g=>g.sameState).sort((a,b)=>{
    // A hidden PASS inside a measured FAIL plateau can unlock a substantially
    // smaller codec candidate, so search FAIL–FAIL gaps before redundant PASS plateaus.
    if(a.state!==b.state)return a.state?1:-1;
    return b.width-a.width||b.high-a.high;
  });
  if(sameState.length)return sameState[0];
  return gaps.sort((a,b)=>b.width-a.width||b.high-a.high)[0]||null;
}
function largestUnmeasuredGap(results){return adjacentGaps(results).sort((a,b)=>b.width-a.width||b.high-a.high)[0]||null;}

export async function searchIntegerQualityBoundary(options={}){
  const min=Math.round(options.min??50),max=Math.round(options.max??100);if(!Number.isInteger(min)||!Number.isInteger(max)||min>max)throw new Error('QUALITY_BOUNDARY_INVALID_RANGE');if(typeof options.evaluate!=='function')throw new Error('QUALITY_BOUNDARY_EVALUATE_REQUIRED');
  const maxEvaluations=Math.max(1,Math.round(options.maxEvaluations??9)),coarseStep=Math.max(2,Math.round(options.coarseStep??8)),neighborRadius=Math.max(0,Math.round(options.neighborRadius??1)),results=new Map(),order=[];
  async function probe(q,phase){q=clamp(q,min,max);if(results.has(q))return results.get(q);if(results.size>=maxEvaluations)return null;let result;try{result=await options.evaluate(q);}catch(error){result={pass:false,bytes:null,score:0,reasons:['evaluate-error'],error:String(error?.message||error)};}const record={quality:q,phase,...result,pass:Boolean(result?.pass)};results.set(q,record);order.push(q);return record;}
  // Spread the first probes across the entire interval. This prevents a single
  // early pass→fail assumption from hiding a later pass island.
  const coarse=[];for(let q=max;q>=min;q-=coarseStep)coarse.push(q);if(coarse.at(-1)!==min)coarse.push(min);const anchors=[max,min,Math.round((max+min)/2),Math.round(max-(max-min)/4),Math.round(min+(max-min)/4),...coarse];
  const coarseBudget=Math.min(maxEvaluations,Math.max(3,Math.ceil(maxEvaluations*0.6)));for(const q of unique(anchors,min,max)){if(results.size>=coarseBudget)break;await probe(q,'coarse');}
  // Refine every observed transition, always choosing the widest unresolved
  // interval first. Every classification still comes from an actual encode.
  while(results.size<maxEvaluations){const ts=transitions(results.values()).filter(t=>t.width>1).sort((a,b)=>b.width-a.width);if(!ts.length)break;const t=ts[0],mid=Math.floor((t.high+t.low)/2);await probe(mid,'transition-refine');}
  // Before spending spare budget around a local winner, deliberately search a
  // same-state FAIL gap. Non-monotonic codecs can contain a valid low-quality
  // island inside a region whose coarse endpoints both failed.
  if(results.size<maxEvaluations){const gap=explorationGap(results);if(gap)await probe(Math.floor((gap.high+gap.low)/2),'outlier-explore');}
  // If budget remains, inspect neighbours around the byte winner and around
  // every measured transition. No neighbour is inferred; every point is encoded.
  const acceptedNow=[...results.values()].filter(r=>r.pass&&Number.isFinite(r.bytes)).sort((a,b)=>a.bytes-b.bytes||b.score-a.score),targets=[];if(acceptedNow[0])targets.push(acceptedNow[0].quality);for(const t of transitions(results.values()))targets.push(t.high,t.low);for(const center of [...new Set(targets)]){for(let d=1;d<=neighborRadius&&results.size<maxEvaluations;d+=1){await probe(center-d,'neighbor');if(results.size>=maxEvaluations)break;await probe(center+d,'neighbor');}}
  // Continue deterministic global coverage with any budget left.
  while(results.size<maxEvaluations){const gap=largestUnmeasuredGap(results);if(!gap)break;await probe(Math.floor((gap.high+gap.low)/2),'outlier');}
  const evaluated=[...results.values()],accepted=evaluated.filter(i=>i.pass),bestByBytes=accepted.filter(i=>Number.isFinite(i.bytes)).sort((a,b)=>a.bytes-b.bytes||b.score-a.score||b.quality-a.quality)[0]||null,transitionList=transitions(evaluated),nonMonotonicDetected=nonMonotonic(evaluated),boundaryPass=accepted.length?Math.min(...accepted.map(i=>i.quality)):null;
  return{version:'kelo-quality-boundary-search-v2.2',range:{min,max},budget:{maxEvaluations,used:evaluated.length,coarseStep,neighborRadius},order,boundaryPass,bestByBytes,transitions:transitionList,nonMonotonicDetected,evaluated:evaluated.sort((a,b)=>b.quality-a.quality)};
}
