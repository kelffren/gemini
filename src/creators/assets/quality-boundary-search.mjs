/* KELO-INDEX
 * area: CREATORS / ASSET SEARCH
 * owner: Kelo Creator Asset Bridge
 * keys: QUALITY SEARCH MULTI BOUNDARY NON MONOTONIC PROBE BUDGET PARETO
 * purpose: concentrate expensive codec evaluations around every measured transition while retaining outliers and never inferring unmeasured pass/fail states
 * public-api: searchIntegerQualityBoundary()
 * state-owned: none
 * online: N/A; build/publish-time search capability
 */

function clamp(q,min,max){return Math.max(min,Math.min(max,Math.round(q)));}
function unique(values,min,max){return[...new Set(values.map(v=>clamp(v,min,max)))].sort((a,b)=>b-a);}
function transitions(records){const sorted=[...records].sort((a,b)=>b.quality-a.quality),out=[];for(let i=0;i<sorted.length-1;i+=1){const a=sorted[i],b=sorted[i+1];if(a.pass!==b.pass)out.push({high:a.quality,low:b.quality,highPass:a.pass,lowPass:b.pass,width:a.quality-b.quality});}return out;}
function nonMonotonic(records){const sorted=[...records].sort((a,b)=>b.quality-a.quality);let seenFail=false;for(const item of sorted){if(!item.pass)seenFail=true;else if(seenFail)return true;}return false;}
function largestUnmeasuredGap(results,min,max){const measured=[max,...results.keys(),min].sort((a,b)=>b-a);let gap=null;for(let i=0;i<measured.length-1;i+=1){const width=measured[i]-measured[i+1];if(width>1&&(!gap||width>gap.width))gap={high:measured[i],low:measured[i+1],width};}return gap;}

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
  // Before spending spare budget around a local winner, take one global
  // exploration probe in the largest unmeasured gap. This catches pass islands
  // that a locally focused neighbour search would otherwise never observe.
  if(results.size<maxEvaluations){const gap=largestUnmeasuredGap(results,min,max);if(gap)await probe(Math.floor((gap.high+gap.low)/2),'outlier-explore');}
  // If budget remains, inspect neighbours around the best accepted-by-bytes and
  // around each measured transition. This is cheap insurance against local codec jumps.
  const acceptedNow=[...results.values()].filter(r=>r.pass&&Number.isFinite(r.bytes)).sort((a,b)=>a.bytes-b.bytes||b.score-a.score),targets=[];if(acceptedNow[0])targets.push(acceptedNow[0].quality);for(const t of transitions(results.values()))targets.push(t.high,t.low);for(const center of targets){for(let d=1;d<=neighborRadius&&results.size<maxEvaluations;d+=1){await probe(center-d,'neighbor');if(results.size>=maxEvaluations)break;await probe(center+d,'neighbor');}}
  // Continue deterministic global exploration with any budget left. Largest-gap
  // probing is coverage-oriented and never labels an unmeasured quality.
  while(results.size<maxEvaluations){const gap=largestUnmeasuredGap(results,min,max);if(!gap)break;await probe(Math.floor((gap.high+gap.low)/2),'outlier');}
  const evaluated=[...results.values()],accepted=evaluated.filter(i=>i.pass),bestByBytes=accepted.filter(i=>Number.isFinite(i.bytes)).sort((a,b)=>a.bytes-b.bytes||b.score-a.score||b.quality-a.quality)[0]||null,transitionList=transitions(evaluated),nonMonotonicDetected=nonMonotonic(evaluated),boundaryPass=accepted.length?Math.min(...accepted.map(i=>i.quality)):null;
  return{version:'kelo-quality-boundary-search-v2.1',range:{min,max},budget:{maxEvaluations,used:evaluated.length,coarseStep,neighborRadius},order,boundaryPass,bestByBytes,transitions:transitionList,nonMonotonicDetected,evaluated:evaluated.sort((a,b)=>b.quality-a.quality)};
}
