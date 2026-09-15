/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / TRUST
 * purpose: ensure AI is advisory and never authoritative for safety, integrity or gameplay-critical geometry
 * public-api: evaluateAssetAuthority(), sanitizeAiAssetSuggestions(), ASSET_AUTHORITY_POLICY
 */
const F=Object.freeze;
const LOCKED_DOMAINS=F(new Set(['security','integrity','runtime','resource-budget','reproducibility','collision','portal','pivot','footprint','geometry-critical']));
const AI_ADVISORY_DOMAINS=F(new Set(['semantics','taxonomy','tags','description','style','layers','depth','anchor-suggestion','repair-suggestion']));
const AI_ALLOWED_KEYS=F(new Set(['categorySuggestion','tags','description','styleSuggestion','layers','depth','anchorSuggestions','repairSuggestions','rationale','confidence']));
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const unique=a=>[...new Set(a.filter(Boolean))];

export const ASSET_AUTHORITY_POLICY=F({version:'kelo-asset-authority-v1',lockedDomains:LOCKED_DOMAINS,aiAdvisoryDomains:AI_ADVISORY_DOMAINS,principle:'AI may propose; deterministic evidence or explicit human review decides.'});

export function sanitizeAiAssetSuggestions(input={}){
 const output={};for(const [key,value] of Object.entries(input||{}))if(AI_ALLOWED_KEYS.has(key))output[key]=value;
 return F({schema:'kelo-ai-asset-advice-v1',authority:'ADVISORY_ONLY',suggestions:F(output),discardedKeys:F(Object.keys(input||{}).filter(key=>!AI_ALLOWED_KEYS.has(key)))});
}

function normalizeEvidence(item,index){
 const source=['deterministic','human','ai'].includes(item?.source)?item.source:'unknown',domain=String(item?.domain||'unknown'),pass=item?.pass===true?true:item?.pass===false?false:null;
 return F({id:String(item?.id||`evidence-${index+1}`),domain,key:String(item?.key||''),source,pass,confidence:clamp(item?.confidence??(source==='deterministic'?1:0)),authoritative:item?.authoritative===true,reason:item?.reason?String(item.reason):null,details:item?.details??null});
}

export function evaluateAssetAuthority({evidence=[],requiredDomains=['security','runtime'],compiler=null,humanApprovals=[]}={}){
 const normalized=F((evidence||[]).map(normalizeEvidence)),approvals=new Set((humanApprovals||[]).map(String)),rejections=[],reviews=[],warnings=[];
 for(const item of normalized){
   if(item.source==='ai'&&item.authoritative&&LOCKED_DOMAINS.has(item.domain))rejections.push(`AI_AUTHORITY_VIOLATION:${item.domain}${item.key?`:${item.key}`:''}`);
   if(item.source==='ai'&&!AI_ADVISORY_DOMAINS.has(item.domain)&&LOCKED_DOMAINS.has(item.domain))warnings.push(`AI_CLAIM_IGNORED:${item.domain}`);
   if(item.source==='deterministic'&&item.pass===false){if(LOCKED_DOMAINS.has(item.domain)||item.authoritative)rejections.push(item.reason||`DETERMINISTIC_GATE_FAILED:${item.domain}`);else reviews.push(item.reason||`DETERMINISTIC_REVIEW:${item.domain}`);}
   if(item.source==='ai'&&item.pass===false&&item.confidence>=.8)warnings.push(item.reason||`AI_WARNING:${item.domain}`);
 }
 for(const domain of requiredDomains||[]){const candidates=normalized.filter(item=>item.domain===domain&&item.source==='deterministic'&&item.pass===true);if(!candidates.length)rejections.push(`MISSING_DETERMINISTIC_EVIDENCE:${domain}`);}
 if(compiler?.reviewRequired===true)reviews.push(...(compiler.reviewReasons||['COMPILER_REVIEW_REQUIRED']));
 const unresolved=unique(reviews).filter(reason=>!approvals.has(reason));const rejected=unique(rejections),decision=rejected.length?'REJECTED':unresolved.length?'REVIEW_REQUIRED':'APPROVED';
 return F({schema:'kelo-asset-authority-decision-v1',decision,approved:decision==='APPROVED',rejected:F(rejected),reviewRequired:F(unresolved),warnings:F(unique(warnings)),evidence:normalized,policyVersion:ASSET_AUTHORITY_POLICY.version});
}
