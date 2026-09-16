/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PARETO FRONTIER SIZE QUALITY DECODE MEMORY COMPATIBILITY TRADEOFF
 * purpose: expose non-dominated authoring and delivery tradeoffs instead of hiding everything behind one smallest-file winner
 * public-api: buildQualityParetoFrontier(), buildDeliveryParetoFrontier()
 * state-owned: none
 * online: N/A; build-time analysis
 */

function number(value,fallback){const parsed=Number(value);return Number.isFinite(parsed)?parsed:fallback;}
function base(candidate){return{label:String(candidate.label||'candidate'),format:String(candidate.format||candidate.kind||'png'),bytes:Number(candidate.bytes),score:number(candidate.score??candidate.qualityScore,candidate.metrics?.exactPixels?1:0),exactPixels:Boolean(candidate.metrics?.exactPixels??candidate.exactPixels),track:candidate.track||null};}
export function buildQualityParetoFrontier(candidates=[]){const valid=candidates.filter(c=>c&&c.pass!==false&&Number.isFinite(Number(c.bytes))).map(base),frontier=valid.filter(c=>!valid.some(o=>o!==c&&o.bytes<=c.bytes&&o.score>=c.score&&(o.bytes<c.bytes||o.score>c.score)));frontier.sort((a,b)=>a.bytes-b.bytes||b.score-a.score);if(!frontier.length)return[];const largest=Math.max(...frontier.map(i=>i.bytes));return frontier.map((item,index)=>({...item,order:index+1,relativeBytes:Number((item.bytes/Math.max(1,largest)).toFixed(6))}));}

export function buildDeliveryParetoFrontier(candidates=[]){
  const valid=candidates.filter(c=>c&&c.pass!==false&&Number.isFinite(Number(c.bytes))).map(c=>({...base(c),encodeMs:number(c.encodeMs??c.timings?.encodeMs,Infinity),decodeMs:number(c.decodeMs??c.timings?.decodeMs,Infinity),memoryBytes:number(c.memoryBytes??c.timings?.memoryBytes,Infinity),compatibility:number(c.compatibility,1)}));
  const dominates=(a,b)=>{
    const noWorse=a.bytes<=b.bytes&&a.score>=b.score&&a.encodeMs<=b.encodeMs&&a.decodeMs<=b.decodeMs&&a.memoryBytes<=b.memoryBytes&&a.compatibility>=b.compatibility;
    const better=a.bytes<b.bytes||a.score>b.score||a.encodeMs<b.encodeMs||a.decodeMs<b.decodeMs||a.memoryBytes<b.memoryBytes||a.compatibility>b.compatibility;
    return noWorse&&better;
  };
  const frontier=valid.filter(c=>!valid.some(o=>o!==c&&dominates(o,c))).sort((a,b)=>a.bytes-b.bytes||a.decodeMs-b.decodeMs||b.score-a.score);
  return frontier.map((item,index)=>({...item,order:index+1,encodeMs:Number.isFinite(item.encodeMs)?item.encodeMs:null,decodeMs:Number.isFinite(item.decodeMs)?item.decodeMs:null,memoryBytes:Number.isFinite(item.memoryBytes)?item.memoryBytes:null}));
}
