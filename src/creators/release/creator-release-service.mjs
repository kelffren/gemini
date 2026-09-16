/* KELO-INDEX
 * area: CREATORS / RELEASE
 * owner: Kelo Creator Release Service
 * keys: CREATOR RELEASE REVIEW SUBMIT CONTENT REVISION PUBLICATION RUNTIME PREVIEW ONLINE AUTHORITY
 * purpose: expose a thin Creator-facing release boundary over the existing Supabase review/publication model and runtime registry
 * public-api: createCreatorReleaseService
 * consumes: contentSession, contentRepository, runtimeContent
 * state-owned: session-only submission hints; Supabase remains source of truth for review/publication
 * online: submitReview delegates to submit_content_revision; review/publication state is read from RLS-protected server tables
 * do-not: no local approval, no client publish RPC, no fake published state, no KC/payment settlement, no duplicate content repository
 */

const F=Object.freeze;
const text=value=>String(value??'');
const time=value=>{const n=Date.parse(value||'');return Number.isFinite(n)?n:0;};
const first=value=>Array.isArray(value)?value[0]:value;

function releaseState(review,publication,submittedHint=false){
  if(publication?.is_active)return 'PUBLISHED';
  const status=text(review?.status).toLowerCase();
  if(status==='approved')return 'APPROVED';
  if(status==='pending')return 'IN_REVIEW';
  if(status==='rejected')return 'REJECTED';
  if(status==='cancelled')return 'CANCELLED';
  return submittedHint?'SUBMITTED_PENDING_REFRESH':'INGESTED';
}
function canSubmit(review,publication){
  if(publication?.is_active)return false;
  const status=text(review?.status).toLowerCase();
  return !['pending','approved'].includes(status);
}

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
    const [contentRaw,reviewsRaw]=await Promise.all([contentRepository.listMyContent(),contentRepository.listMyReviews?.()||Promise.resolve([])]);
    const content=Array.from(contentRaw||[]).sort((a,b)=>time(b.created_at)-time(a.created_at)).slice(0,Math.max(1,Math.min(500,Number(limit)||120)));
    const publications=await (contentRepository.listActivePublicationsForRevisions?.(content.map(row=>row.id))||Promise.resolve([]));
    const reviewByRevision=new Map(Array.from(reviewsRaw||[]).map(row=>[text(row.revision_id),row]));
    const publicationByRevision=new Map(Array.from(publications||[]).map(row=>[text(row.revision_id),row]));
    return F(content.map(row=>{
      const revisionId=text(row.id),review=reviewByRevision.get(revisionId)||null,publication=publicationByRevision.get(revisionId)||null,state=releaseState(review,publication,submittedThisSession.has(revisionId));
      return F({
        revisionId,definitionId:text(row.definition_id),contentId:text(row.content_id),revision:Number(row.revision)||1,schemaVersion:Number(row.schema_version)||1,
        contentHash:text(row.content_hash),payload:F({...row.payload}),createdAt:text(row.created_at),releaseState:state,canSubmit:canSubmit(review,publication),
        review:review?F({requestId:text(review.id),status:text(review.status),submittedAt:text(review.submitted_at),decidedAt:text(review.decided_at),note:text(review.note)}):null,
        publication:publication?F({publicationId:text(publication.id),visibility:text(publication.visibility),publishedAt:text(publication.published_at),isActive:!!publication.is_active}):null
      });
    }));
  }
  async function snapshot({limit=120}={}){
    const online=await onlineRows(limit);
    return F({authenticated:authenticated(),userId:contentRepository.userId?.()||null,online,runtime:runtimeRows(limit),capturedAt:new Date().toISOString()});
  }
  async function submitReview(revisionId){
    const id=text(revisionId).trim();if(!id)throw new Error('CREATOR_RELEASE_REVISION_ID_REQUIRED');if(!authenticated())throw new Error('AUTH_REQUIRED');
    await contentSession.ensureFresh?.();
    const raw=await contentRepository.submitContentRevision(id),response=first(raw)||raw;
    submittedThisSession.add(id);
    return F({revisionId:id,releaseState:releaseState(response,null,true),reviewStatus:text(response?.status||'pending'),response,submittedAt:text(response?.submitted_at)||new Date().toISOString()});
  }
  return F({
    version:'kelo-creator-release-service-v1.1.0',authenticated,snapshot,submitReview,listRuntimePreviews:runtimeRows,
    get submittedCount(){return submittedThisSession.size;}
  });
}
