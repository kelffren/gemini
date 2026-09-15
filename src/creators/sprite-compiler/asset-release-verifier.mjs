/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / TRUST
 * purpose: convert compiler/runtime evidence into an authority decision before publication
 * public-api: buildAssetReleaseEvidence(), verifyAssetRelease(), verifyReproducibleAssetOutputs()
 */
import {evaluateAssetAuthority,sanitizeAiAssetSuggestions} from './asset-authority-policy.mjs';
const F=Object.freeze;

export function buildAssetReleaseEvidence({input=null,compiled=null,budget=null,regression=null,temporal=null,defects=null,canary=null,backendSelection=null,aiSuggestions=null}={}){
 const evidence=[];
 evidence.push(F({id:'container-security',domain:'security',source:'deterministic',authoritative:true,pass:!!input?.valid&&Number(input?.width)>0&&Number(input?.height)>0,reason:'UNSAFE_OR_UNRESOLVED_CONTAINER',details:input}));
 evidence.push(F({id:'runtime-output',domain:'runtime',source:'deterministic',authoritative:true,pass:(!!compiled?.blob||!!compiled?.canvas)&&Number(compiled?.width)>0&&Number(compiled?.height)>0,reason:'RUNTIME_OUTPUT_INVALID',details:{width:compiled?.width,height:compiled?.height,type:compiled?.type}}));
 if(backendSelection)evidence.push(F({id:'backend-trust',domain:'security',source:'deterministic',authoritative:true,pass:backendSelection.status==='READY'&&!!backendSelection.selected,reason:'TRUSTED_BACKEND_UNAVAILABLE',details:backendSelection}));
 if(budget){const proven=budget.pass===true&&budget.status==='WITHIN_BUDGET';evidence.push(F({id:'runtime-budget',domain:'resource-budget',source:'deterministic',authoritative:true,pass:proven,reason:budget.status==='ESTIMATE_ONLY'?'RUNTIME_BUDGET_NOT_PROVEN':'RUNTIME_BUDGET_EXCEEDED',details:budget}));}
 if(regression)evidence.push(F({id:'visual-regression',domain:'integrity',source:'deterministic',authoritative:true,pass:regression.pass===true,reason:'VISUAL_REGRESSION_FAILED',details:regression}));
 if(temporal)evidence.push(F({id:'temporal-consistency',domain:'geometry-critical',source:'deterministic',authoritative:true,pass:temporal.pass===true&&temporal.status!=='REVIEW_REQUIRED',reason:'TEMPORAL_CONSISTENCY_FAILED',details:temporal}));
 if(canary)evidence.push(F({id:'runtime-canary',domain:'runtime',source:'deterministic',authoritative:true,pass:canary.pass===true&&canary.status==='PASSED',reason:'CANARY_RUNTIME_GATE_FAILED',details:canary}));
 if(defects){const blocking=(defects.defects||[]).filter(x=>x.severity==='blocking'||Number(x.score)>=.9);evidence.push(F({id:'ai-defect-scan',domain:'integrity',source:'deterministic',authoritative:true,pass:blocking.length===0,reason:'BLOCKING_ASSET_DEFECT',details:{blocking}}));}
 if(aiSuggestions){const advice=sanitizeAiAssetSuggestions(aiSuggestions);evidence.push(F({id:'ai-advice',domain:'semantics',source:'ai',authoritative:false,pass:null,confidence:Number(aiSuggestions.confidence)||0,details:advice}));}
 return F(evidence);
}

export function verifyAssetRelease({input=null,compiled=null,budget=null,regression=null,temporal=null,defects=null,canary=null,backendSelection=null,aiSuggestions=null,humanApprovals=[],requiredDomains=['security','runtime']}={}){
 const evidence=buildAssetReleaseEvidence({input,compiled,budget,regression,temporal,defects,canary,backendSelection,aiSuggestions});return evaluateAssetAuthority({evidence,requiredDomains,compiler:compiled,humanApprovals});
}

export function verifyReproducibleAssetOutputs(a,b){
 const mismatches=[];const compare=(key,x,y)=>{if(JSON.stringify(x)!==JSON.stringify(y))mismatches.push(key);};
 compare('width',a?.width,b?.width);compare('height',a?.height,b?.height);compare('type',a?.type,b?.type);compare('columns',a?.columns,b?.columns);compare('rows',a?.rows,b?.rows);compare('frameCounts',a?.frameCounts,b?.frameCounts);compare('directionKeys',a?.directionKeys,b?.directionKeys);compare('strategy',a?.strategy,b?.strategy);compare('status',a?.status,b?.status);compare('canonicalPixelHash',a?.canonicalPixelHash,b?.canonicalPixelHash);
 return F({schema:'kelo-asset-reproducibility-v2',pass:mismatches.length===0,mismatches:F(mismatches),authority:'canonical-structure-and-pixels',note:'Encoded KTX/Basis bytes are intentionally not compared cross-platform; canonical pixel hashes are the reproducibility authority when present.'});
}
