/* KELO-INDEX
 * area: CREATORS / EVOLUTION
 * owner: KeloEvolution generic candidate evaluation and acceptance gate
 * purpose: compare a baseline against proposed candidates and apply only measured improvements
 * public-api: createEvolutionMetricProfile, scoreEvolutionMetrics, compareEvolutionEvaluations, selectEvolutionCandidate, runEvolutionCycle
 * consumes: injected proposer/evaluator/apply/rollback callbacks; owns no gameplay or editor state
 * state-owned: none
 * extension-points: Map Forge styles today; AI/code patch candidates may use the same gate later
 * online: authority-neutral; caller decides where candidate generation, evaluation and apply execute
 * do-not: never self-apply an unevaluated candidate; never bypass hard metric gates
 */

const clone=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));
const freeze=value=>{if(value&&typeof value==='object'&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;};
const finite=value=>Number.isFinite(Number(value));
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const round=(value,places=4)=>{const factor=10**places;return Math.round(Number(value)*factor)/factor;};

export function createEvolutionMetricProfile(definitions=[]){
  if(!Array.isArray(definitions)||definitions.length===0)throw new Error('EVOLUTION_METRICS_REQUIRED');
  const ids=new Set(),rows=definitions.map(raw=>{
    const id=String(raw?.id||'').trim();
    if(!id)throw new Error('EVOLUTION_METRIC_ID_REQUIRED');
    if(ids.has(id))throw new Error(`EVOLUTION_METRIC_DUPLICATE:${id}`);ids.add(id);
    const min=finite(raw.min)?Number(raw.min):0,max=finite(raw.max)?Number(raw.max):100,weight=finite(raw.weight)?Number(raw.weight):1,direction=raw.direction==='minimize'?'minimize':'maximize';
    if(!(max>min))throw new Error(`EVOLUTION_METRIC_RANGE_INVALID:${id}`);
    if(!(weight>0))throw new Error(`EVOLUTION_METRIC_WEIGHT_INVALID:${id}`);
    return Object.freeze({id,min,max,weight,direction,required:raw.required!==false,hardMin:finite(raw.hardMin)?Number(raw.hardMin):null,hardMax:finite(raw.hardMax)?Number(raw.hardMax):null});
  });
  return freeze(rows);
}

export function scoreEvolutionMetrics(profile,measurements={}){
  if(!Array.isArray(profile)||profile.length===0)throw new Error('EVOLUTION_PROFILE_REQUIRED');
  const failures=[],normalized={},observed={};let weighted=0,totalWeight=0;
  for(const metric of profile){
    const raw=measurements?.[metric.id];
    if(!finite(raw)){
      if(metric.required)failures.push(`metric_missing:${metric.id}`);
      continue;
    }
    const value=Number(raw);observed[metric.id]=value;
    if(metric.hardMin!==null&&value<metric.hardMin)failures.push(`metric_below_hard_min:${metric.id}:${value}<${metric.hardMin}`);
    if(metric.hardMax!==null&&value>metric.hardMax)failures.push(`metric_above_hard_max:${metric.id}:${value}>${metric.hardMax}`);
    const fraction=clamp((value-metric.min)/(metric.max-metric.min),0,1),score=(metric.direction==='minimize'?1-fraction:fraction)*100;
    normalized[metric.id]=round(score,3);weighted+=score*metric.weight;totalWeight+=metric.weight;
  }
  if(totalWeight<=0)failures.push('metric_weight_total_zero');
  return freeze({valid:failures.length===0,score:round(totalWeight>0?weighted/totalWeight:0,3),measurements:observed,normalized,failures});
}

function normalizeEvaluation(value){
  const score=Number(value?.score);
  return freeze({valid:value?.valid!==false&&Number.isFinite(score),score:Number.isFinite(score)?score:0,metrics:clone(value?.metrics||value?.measurements||{}),failures:[...(value?.failures||[])]});
}

export function compareEvolutionEvaluations(baselineInput,candidateInput,{minImprovement=.25,minScore=0}={}){
  const baseline=normalizeEvaluation(baselineInput),candidate=normalizeEvaluation(candidateInput),delta=round(candidate.score-baseline.score,4),failures=[...candidate.failures];
  if(!candidate.valid)failures.push('candidate_invalid');
  if(candidate.score<Number(minScore||0))failures.push(`candidate_below_min_score:${candidate.score}<${Number(minScore||0)}`);
  if(delta<Number(minImprovement||0))failures.push(`candidate_improvement_too_small:${delta}<${Number(minImprovement||0)}`);
  return freeze({accepted:failures.length===0,baseline,candidate,delta,failures:[...new Set(failures)]});
}

export function selectEvolutionCandidate({baselineEvaluation,candidates=[],policy={}}={}){
  const evaluated=candidates.map((row,index)=>{
    const comparison=compareEvolutionEvaluations(baselineEvaluation,row.evaluation,policy);
    return freeze({index,candidate:row.candidate,evaluation:comparison.candidate,comparison});
  });
  const accepted=evaluated.filter(row=>row.comparison.accepted).sort((a,b)=>b.evaluation.score-a.evaluation.score||b.comparison.delta-a.comparison.delta||a.index-b.index);
  return freeze({accepted:accepted.length>0,selected:accepted[0]||null,evaluated});
}

export async function runEvolutionCycle({baseline,propose,evaluate,apply=null,rollback=null,policy={}}={}){
  if(typeof propose!=='function')throw new Error('EVOLUTION_PROPOSER_REQUIRED');
  if(typeof evaluate!=='function')throw new Error('EVOLUTION_EVALUATOR_REQUIRED');
  const baselineEvaluation=normalizeEvaluation(await evaluate(baseline,{role:'baseline'}));
  const proposed=await propose({baseline,baselineEvaluation});
  if(!Array.isArray(proposed))throw new Error('EVOLUTION_PROPOSALS_MUST_BE_ARRAY');
  const rows=[];
  for(let index=0;index<proposed.length;index++)rows.push({candidate:proposed[index],evaluation:normalizeEvaluation(await evaluate(proposed[index],{role:'candidate',index,baseline,baselineEvaluation}))});
  const selection=selectEvolutionCandidate({baselineEvaluation,candidates:rows,policy});
  if(!selection.selected)return freeze({accepted:false,applied:false,rolledBack:false,baseline,baselineEvaluation,selected:null,evaluated:selection.evaluated,result:baseline});
  const winner=selection.selected;
  if(typeof apply!=='function')return freeze({accepted:true,applied:false,rolledBack:false,baseline,baselineEvaluation,selected:winner,evaluated:selection.evaluated,result:winner.candidate});
  try{
    const appliedResult=await apply(winner.candidate,{baseline,baselineEvaluation,selection:winner});
    return freeze({accepted:true,applied:true,rolledBack:false,baseline,baselineEvaluation,selected:winner,evaluated:selection.evaluated,result:appliedResult??winner.candidate});
  }catch(error){
    let rolledBack=false,rollbackError=null;
    if(typeof rollback==='function')try{await rollback(baseline,{error,candidate:winner.candidate,selection:winner});rolledBack=true;}catch(inner){rollbackError=String(inner?.message||inner);}
    return freeze({accepted:false,applied:false,rolledBack,error:String(error?.message||error),rollbackError,baseline,baselineEvaluation,selected:winner,evaluated:selection.evaluated,result:baseline});
  }
}
