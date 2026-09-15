/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / TRUST
 * purpose: make subjective ambiguity reviewable while preventing humans from overriding hard safety/integrity failures
 * public-api: createAssetReviewPacket(), resolveAssetReviewPacket()
 */
const F=Object.freeze;
const HARD_PREFIXES=F(['AI_AUTHORITY_VIOLATION','MISSING_DETERMINISTIC_EVIDENCE','UNSAFE_','RUNTIME_','ASSET_CONTAINER','ASSET_FILE','ASSET_DIMENSION','ASSET_PIXEL','ASSET_DECODE','RUNTIME_BUDGET','VISUAL_REGRESSION','BLOCKING_ASSET_DEFECT','CANARY_']);
const hardReason=reason=>HARD_PREFIXES.some(prefix=>String(reason||'').startsWith(prefix));
export function createAssetReviewPacket({assetId='unknown',releaseDecision,evidence=[],aiAdvice=null,sourceSummary=null}={}){
 if(!releaseDecision)throw new Error('ASSET_REVIEW_RELEASE_DECISION_REQUIRED');const rejected=[...(releaseDecision.rejected||[])],review=[...(releaseDecision.reviewRequired||[])],hard=F([...new Set([...rejected,...review.filter(hardReason)])]),reviewable=F(review.filter(reason=>!hardReason(reason)));
 const status=hard.length?'QUARANTINED':reviewable.length?'HUMAN_REVIEW':'NO_REVIEW_NEEDED';
 return F({schema:'kelo-asset-review-packet-v1',assetId:String(assetId),status,hardFailures:hard,reviewableReasons:reviewable,evidence:F([...(evidence||[])]),aiAdvice:aiAdvice||null,sourceSummary:sourceSummary||null,rule:'Hard safety, integrity, resource and runtime-canary failures require a new/corrected asset; they cannot be overridden.'});
}
export function resolveAssetReviewPacket(packet,{approvals=[],rejections=[],notes=null,reviewer=null}={}){
 if(!packet||packet.schema!=='kelo-asset-review-packet-v1')throw new Error('ASSET_REVIEW_PACKET_REQUIRED');if(packet.hardFailures?.length)return F({...packet,status:'QUARANTINED',resolved:false,resolution:F({reason:'HARD_FAILURE_NOT_OVERRIDABLE',reviewer,notes})});
 const allowed=new Set(packet.reviewableReasons||[]),approved=new Set((approvals||[]).map(String)),rejected=new Set((rejections||[]).map(String));for(const reason of [...approved,...rejected])if(!allowed.has(reason))throw new Error(`ASSET_REVIEW_REASON_NOT_ALLOWED:${reason}`);
 const unresolved=(packet.reviewableReasons||[]).filter(reason=>!approved.has(reason)&&!rejected.has(reason));const denied=(packet.reviewableReasons||[]).filter(reason=>rejected.has(reason)),status=denied.length?'REJECTED':unresolved.length?'HUMAN_REVIEW':'APPROVED';return F({...packet,status,resolved:status!=='HUMAN_REVIEW',resolution:F({reviewer:reviewer?String(reviewer):null,approved:F([...approved]),rejected:F([...rejected]),unresolved:F(unresolved),notes:notes?String(notes):null})});
}
export const __assetHumanReview=F({hardReason});
