/* KELO-INDEX
 * area: CREATORS / RELEASE
 * owner: Kelo Creator Release Service
 * keys: CREATOR RELEASE REVIEW SUBMIT CONTENT REVISION RUNTIME PREVIEW ONLINE AUTHORITY
 * purpose: expose a thin Creator-facing release boundary over the existing Supabase content repository and runtime registry
 * public-api: createCreatorReleaseService
 * consumes: contentSession, contentRepository, runtimeContent
 * state-owned: session-only submitted revision ids; server remains source of truth for review/publication
 * online: submitReview delegates to submit_content_revision through the existing authenticated repository adapter
 * do-not: no local approval, no fake published state, no KC/payment settlement, no duplicate content repository
 */

const F=Object.freeze;
const text=value=>String(value??'');
const time=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0;};

export function createCreatorReleaseService({contentSession,contentRepository,runtimeContent}={}){
  if(!contentSession)throw new Error('CREATOR_RELEASE_SESSION_REQUIRED');
  if(!contentRepository)throw new Error('CREATOR_RELEASE_REPOSITORY_REQUIRED');
  if(!runtimeContent)throw new Error('CREATOR_RELEASE_RUNTIME_REGISTRY_REQUIRED');
  const submittedThisSession=new Set();

  function authenticated(){return !!contentSession.accessToken&&!!contentRepository.userId?.();}
  function runtimeRows(limit=120){
    const rows=typeof runtimeContent.list==='function'?runtimeContent.list():[];
    return F(rows.slice(-Math.max(1,Math.min(500,Number(limit)||120))).reverse().map(row=>F({
      contentId:text(row.contentId),revision:Number(row.revision)||1,contentType:text(row.contentType||'generic'),displayName:text(row.displayName||row.contentId),
      activation:F({...row.activation}),contentHash:text(row.contentHash),source:text(row.source||'creator')
    })));
  }
  async function onlineRows(limit=120){
    if(!authenticated())return F([]);
    await contentSession.ensureFresh?.();
    const raw=await contentRepository.listMyContent();
    return F(Array.from(raw||[]).sort((a,b)=>time(b.created_at)-time(a.created_at)).slice(0,Math.max(1,Math.min(500,Number(limit)||120))).map(row=>F({
      revisionId:text(row.id),definitionId:text(row.definition_id),contentId:text(row.content_id),revision:Number(row.revision)||1,schemaVersion:Number(row.schema_version)||1,
      contentHash:text(row.content_hash),payload:F({...row.payload}),createdAt:text(row.created_at),
      releaseState:submittedThisSession.has(text(row.id))?'SUBMITTED_THIS_SESSION':'INGESTED',
      serverReviewState:'UNKNOWN_NOT_EXPOSED'
    })));
  }
  async function snapshot({limit=120}={}){
    const online=await onlineRows(limit);
    return F({authenticated:authenticated(),userId:contentRepository.userId?.()||null,online,runtime:runtimeRows(limit),capturedAt:new Date().toISOString()});
  }
  async function submitReview(revisionId){
    const id=text(revisionId).trim();if(!id)throw new Error('CREATOR_RELEASE_REVISION_ID_REQUIRED');if(!authenticated())throw new Error('AUTH_REQUIRED');
    await contentSession.ensureFresh?.();
    const response=await contentRepository.submitContentRevision(id);
    submittedThisSession.add(id);
    return F({revisionId:id,releaseState:'SUBMITTED_THIS_SESSION',serverReviewState:'SERVER_DECIDES',response,submittedAt:new Date().toISOString()});
  }
  return F({
    version:'kelo-creator-release-service-v1.0.0',authenticated,snapshot,submitReview,listRuntimePreviews:runtimeRows,
    get submittedCount(){return submittedThisSession.size;}
  });
}
