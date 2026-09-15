/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / AI GOVERNANCE
 * purpose: prevent silent model drift and require shadow evaluation before an AI oracle version can be promoted
 * public-api: normalizeAssetOracle(), evaluateOracleShadow(), assertPinnedAssetOracle()
 */
const F=Object.freeze;
const text=value=>String(value??'').trim();const finite=(v,f=null)=>Number.isFinite(Number(v))?Number(v):f;
export function normalizeAssetOracle(raw={}){return F({id:text(raw.id),provider:text(raw.provider),model:text(raw.model),version:text(raw.version),promptPolicyHash:text(raw.promptPolicyHash),purpose:text(raw.purpose||'advisory'),authority:'ADVISORY_ONLY'});}
export function assertPinnedAssetOracle(raw={}){const oracle=normalizeAssetOracle(raw),problems=[];if(!oracle.id)problems.push('ORACLE_ID_REQUIRED');if(!oracle.model)problems.push('ORACLE_MODEL_REQUIRED');if(!oracle.version||/^(latest|auto|current|default)$/i.test(oracle.version))problems.push('ORACLE_VERSION_NOT_PINNED');if(!oracle.promptPolicyHash)problems.push('ORACLE_PROMPT_POLICY_HASH_REQUIRED');if(problems.length)throw new Error(`ASSET_ORACLE_UNPINNED:${problems.join(',')}`);return oracle;}
export function evaluateOracleShadow({baseline,candidate,cases=[],policy={}}={}){
 const base=assertPinnedAssetOracle(baseline),next=assertPinnedAssetOracle(candidate),minimumCases=Math.max(1,Math.round(finite(policy.minimumCases,30))),maxDisagreement=finite(policy.maxDisagreementRate,.15),maxCriticalRegression=Math.max(0,Math.round(finite(policy.maxCriticalRegressions,0)));let comparable=0,disagreements=0,criticalRegressions=0,improvements=0;
 for(const item of cases||[]){if(item?.baseline==null||item?.candidate==null)continue;comparable++;if(JSON.stringify(item.baseline)!==JSON.stringify(item.candidate))disagreements++;if(item.critical===true&&item.baselinePass===true&&item.candidatePass===false)criticalRegressions++;if(item.baselinePass===false&&item.candidatePass===true)improvements++;}
 const disagreementRate=comparable?disagreements/comparable:1,reasons=[];if(comparable<minimumCases)reasons.push('ORACLE_SHADOW_INSUFFICIENT_CASES');if(criticalRegressions>maxCriticalRegression)reasons.push('ORACLE_CRITICAL_REGRESSION');if(disagreementRate>maxDisagreement)reasons.push('ORACLE_DISAGREEMENT_RATE_HIGH');const status=reasons.length?'HOLD':'ELIGIBLE_FOR_HUMAN_PROMOTION';return F({schema:'kelo-oracle-shadow-v1',status,autoPromote:false,baseline:base,candidate:next,metrics:F({comparable,disagreements,disagreementRate,criticalRegressions,improvements}),policy:F({minimumCases,maxDisagreementRate:maxDisagreement,maxCriticalRegressions:maxCriticalRegression}),reasons:F(reasons),note:'Eligibility never grants release authority; AI remains advisory.'});
}
