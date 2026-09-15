/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / TRUST
 * purpose: convert compiler/runtime evidence into an authority decision before publication
 * public-api: buildAssetReleaseEvidence(), verifyAssetRelease(), verifyReproducibleAssetOutputs()
 */
import {evaluateAssetAuthority,sanitizeAiAssetSuggestions} from './asset-authority-policy.mjs';
const F=Object.freeze;

export function buildAssetReleaseEvidence({input=null,compiled=null,budget=null,regression=null,temporal=null,defects=null,aiSuggestions=null}={}){
 const evidence=[];
 evidence.push(F({id:'container-security',domain:'security',source:'deterministic',authoritative:true,pass:!!input?.valid&&Number(input?.width)>0&&Number(input?.height)>0,reason:'UNSAFE_OR_UNRESOLVED_CONTAINER',details:input}));
 evidence.push(F({id:'runtime-output',domain:'runtime',source:'deterministic',authoritative:true,pass:(!!compiled?.blob||!!compiled?.canvas)&&Number(compiled?.width)>0&&Number(compiled?.height)>0,reason:'RUNTIME_OUTPUT_INVALID',details:{width:compiled?.width,height:compiled?.height,type:compiled?.type}}));
 if(budget)evidence.push(F({id:'runtime-budget',domain:'resource-budget',source:'deterministic',authoritative:true,pass:budget.pass!==false&&budget.status!=='OVER_BUDGET',reason:'RUNTIME_BUDGET_EXCEEDED',details:budget}));
 if(regression)evidence.push(F({id:'visual-regression',domain:'integrity',source:'deterministic',authoritative:true,pass:regression.pass!==false,reason:'VISUAL_REGRESSION_FAILED',details:regression}));
 if(temporal)evidence.push(F({id:'temporal-consistency',domain:'geometry-critical',source:'deterministic',authoritative:true,pass:temporal.pass!==false&&temporal.status!=='REVIEW_REQUIRED',reason:'TEMPORAL_CONSISTENCY_FAILED',details:temporal}));
 if(defects){const blocking=(defects.defects||[]).filter(x=>x.severity==='blocking'||Number(x.score)>=.9);evidence.push(F({id:'ai-defect-scan',domain:'integrity',source:'deterministic',authoritative:true,pass:blocking.length===0,reason:'BLOCKING_ASSET_DEFECT',details:{blocking}}));}
 if(aiSuggestions){const advice=sanitizeAiAssetSuggestions(aiSuggestions);evidence.push(F({id:'ai-advice',domain:'semantics',source:'ai',authoritative:false,pass:null,confidence:Number(aiSuggestions.confidence)||0,details:advice}));}
 return F(evidence);
}

export function verifyAssetRelease({input=null,compiled=null,budget=null,regression=null,temporal=null,defects=null,aiSuggestions=null,humanApprovals=[],requiredDomains=['security','runtime']}={}){
 const evidence=buildAssetReleaseEvidence({input,compiled,budget,regression,temporal,defects,aiSuggestions});return evaluateAssetAuthority({evidence,requiredDomains,compiler:compiled,humanApprovals});
}

export function verifyReproducibleAssetOutputs(a,b){
 const mismatches=[];const compare=(key,x,y)=>{if(JSON.stringify(x)!==JSON.stringify(y))mismatches.push(key);};
 compare('width',a?.width,b?.width);compare('height',a?.height,b?.height);compare('type',a?.type,b?.type);compare('columns',a?.columns,b?.columns);compare('rows',a?.rows,b?.rows);compare('frameCounts',a?.frameCounts,b?.frameCounts);compare('directionKeys',a?.directionKeys,b?.directionKeys);compare('strategy',a?.strategy,b?.strategy);compare('status',a?.status,b?.status);
 return F({schema:'kelo-asset-reproducibility-v1',pass:mismatches.length===0,mismatches:F(mismatches)});
}
