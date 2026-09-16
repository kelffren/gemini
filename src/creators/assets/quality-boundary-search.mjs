/* KELO-INDEX
 * area: CREATORS / ASSET SEARCH
 * owner: Kelo Creator Asset Bridge
 * keys: QUALITY BOUNDARY SEARCH BINARY PROBE ENCODE BUDGET PARETO
 * purpose: spend expensive codec evaluations near the measured quality pass/fail frontier instead of scanning fixed quality ladders
 * public-api: searchIntegerQualityBoundary()
 * state-owned: none; callback results only
 * online: N/A; build/publish-time search capability
 * do-not: assume a candidate passes without evaluating it or infer bytes/quality between probes
 */

function uniqueDescending(values,min,max) {
  return [...new Set(values.map(value=>Math.max(min,Math.min(max,Math.round(value)))))]
    .sort((a,b)=>b-a);
}

export async function searchIntegerQualityBoundary(options = {}) {
  const min = Math.round(options.min ?? 50);
  const max = Math.round(options.max ?? 100);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) throw new Error('QUALITY_BOUNDARY_INVALID_RANGE');
  if (typeof options.evaluate !== 'function') throw new Error('QUALITY_BOUNDARY_EVALUATE_REQUIRED');

  const maxEvaluations = Math.max(1,Math.round(options.maxEvaluations ?? 7));
  const coarseStep = Math.max(2,Math.round(options.coarseStep ?? 8));
  const neighborRadius = Math.max(0,Math.round(options.neighborRadius ?? 1));
  const results = new Map();
  const order = [];

  async function probe(quality, phase) {
    quality=Math.max(min,Math.min(max,Math.round(quality)));
    if (results.has(quality)) return results.get(quality);
    if (results.size >= maxEvaluations) return null;
    let result;
    try {
      result=await options.evaluate(quality);
    } catch (error) {
      result={pass:false,bytes:null,score:0,reasons:['evaluate-error'],error:String(error?.message||error)};
    }
    const record={quality,phase,...result,pass:Boolean(result?.pass)};
    results.set(quality,record);
    order.push(quality);
    return record;
  }

  // Descend until the first measured failure below a passing point. This finds
  // the interesting interval quickly while still evaluating every claim.
  let lastPass=null;
  let firstFailBelow=null;
  const coarse=[];
  for (let q=max; q>=min; q-=coarseStep) coarse.push(q);
  if (coarse.at(-1)!==min) coarse.push(min);

  for (const q of uniqueDescending(coarse,min,max)) {
    const result=await probe(q,'coarse');
    if (!result) break;
    if (result.pass) {
      lastPass=q;
      continue;
    }
    if (lastPass!==null && q < lastPass) {
      firstFailBelow=q;
      break;
    }
    // If even max fails, lower quality is not a useful place to spend budget.
    if (q===max) break;
  }

  // Refine only the observed pass/fail interval. We do not mark unmeasured
  // points as pass/fail, and final selection always uses measured candidates.
  if (lastPass!==null && firstFailBelow!==null) {
    let high=lastPass; // measured pass
    let low=firstFailBelow; // measured fail
    while (high-low>1 && results.size<maxEvaluations) {
      const mid=Math.floor((high+low)/2);
      const result=await probe(mid,'refine');
      if (!result) break;
      if (result.pass) high=mid;
      else low=mid;
    }

    // Probe immediate neighbours when budget remains. This helps catch local
    // non-monotonic codec behaviour without doing a full linear scan.
    for (let delta=1; delta<=neighborRadius && results.size<maxEvaluations; delta+=1) {
      await probe(high-delta,'neighbor');
      if (results.size>=maxEvaluations) break;
      await probe(high+delta,'neighbor');
    }
  }

  const evaluated=[...results.values()];
  const accepted=evaluated.filter(item=>item.pass);
  const boundaryPass=accepted.length ? Math.min(...accepted.map(item=>item.quality)) : null;
  const bestByBytes=accepted
    .filter(item=>Number.isFinite(item.bytes))
    .sort((a,b)=>a.bytes-b.bytes || b.score-a.score || b.quality-a.quality)[0] || null;

  return {
    version:'kelo-quality-boundary-search-v1',
    range:{min,max},
    budget:{maxEvaluations,used:evaluated.length,coarseStep,neighborRadius},
    order,
    boundaryPass,
    bestByBytes,
    evaluated:evaluated.sort((a,b)=>b.quality-a.quality)
  };
}
