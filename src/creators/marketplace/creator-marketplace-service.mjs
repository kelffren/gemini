/* KELO-INDEX
 * area: CREATORS / MARKETPLACE
 * owner: Kelo Creator Marketplace client service
 * keys: DISCOVER LISTINGS OWNED PROFILE KC ENTITLEMENT PUBLISHED CONTENT
 * purpose: compose metadata-first marketplace reads/writes over the existing authenticated Supabase Creator repository
 * public-api: createCreatorMarketplaceService
 * consumes: contentSession + contentRepository + KeloCreatorEntitlements refresh hook
 * state-owned: none; server tables/RPCs remain authority
 * do-not: no local balances, no trusted client price during purchase, no asset-byte preloading, no fake entitlement
 */
const F=Object.freeze;
const arr=value=>Array.isArray(value)?value:[];
const text=value=>String(value??'');
const uuid=root=>root?.crypto?.randomUUID?.()||globalThis.crypto?.randomUUID?.()||`${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}-4000-8000-${Math.random().toString(16).slice(2).padEnd(12,'0').slice(0,12)}`;

export function createCreatorMarketplaceService({contentSession,contentRepository,root=globalThis}={}){
  if(!contentSession)throw new Error('CREATOR_MARKET_SESSION_REQUIRED');
  if(!contentRepository)throw new Error('CREATOR_MARKET_REPOSITORY_REQUIRED');
  const authenticated=()=>!!contentSession.accessToken&&!!contentRepository.userId?.();
  async function fresh(){if(authenticated())await contentSession.ensureFresh?.();}
  function decorateListing(row){
    const bucket=text(row.preview_bucket),path=text(row.preview_path),previewUrl=bucket&&path?contentRepository.publicUrl(bucket,path):null;
    return F({...row,previewUrl});
  }
  async function discover({query='',contentType='',limit=40,offset=0}={}){
    const rows=await contentRepository.discoverCreatorMarket({query,contentType,limit,offset});
    return F(arr(rows).map(decorateListing));
  }
  async function profile(userId=null){return contentRepository.getCreatorProfile(userId||null);}
  async function saveProfile(input={}){if(!authenticated())throw new Error('AUTH_REQUIRED');await fresh();return contentRepository.upsertCreatorProfile(input);}
  async function dashboard(){
    if(!authenticated())return F({authenticated:false,characters:F([]),wallets:F([]),listings:F([]),published:F([]),profile:null});
    await fresh();
    const [characters,content,definitions,listings,profileRow]=await Promise.all([
      contentRepository.listMyCharacters(),contentRepository.listMyContent(),contentRepository.listMyDefinitions(),contentRepository.listMyCreatorMarketListings(),contentRepository.getCreatorProfile(null)
    ]);
    const definitionById=new Map(arr(definitions).map(row=>[text(row.id),row]));
    const revisions=arr(content).map(row=>row.id).filter(Boolean),publications=await contentRepository.listActivePublicationsForRevisions(revisions),publicationByRevision=new Map(arr(publications).map(row=>[text(row.revision_id),row]));
    const listingByRevision=new Map(arr(listings).filter(row=>row.status==='active').map(row=>[text(row.revision_id),row]));
    const published=arr(content).map(row=>{
      const publication=publicationByRevision.get(text(row.id));if(!publication)return null;const definition=definitionById.get(text(row.definition_id))||{};
      return F({revisionId:text(row.id),definitionId:text(row.definition_id),contentId:text(row.content_id),contentType:text(definition.content_type||'generic'),displayName:text(definition.display_name||row.content_id),tags:F(arr(definition.tags).map(String)),revision:Number(row.revision)||1,publication:F({...publication}),listing:listingByRevision.get(text(row.id))||null,payload:F({...row.payload})});
    }).filter(Boolean);
    const wallets=[];for(const character of arr(characters)){const wallet=await contentRepository.getCharacterWallet(character.id,'kc');wallets.push(F({characterId:text(character.id),characterName:text(character.name),kc:Number(wallet?.amount)||0,revision:Number(wallet?.revision)||0}));}
    return F({authenticated:true,characters:F(arr(characters).map(x=>F({...x}))),wallets:F(wallets),listings:F(arr(listings).map(x=>F({...x}))),published:F(published),profile:profileRow||null});
  }
  async function createListing({revisionId,payoutCharacterId,priceKc,licenseKey='standard'}={}){
    if(!authenticated())throw new Error('AUTH_REQUIRED');await fresh();
    if(!revisionId||!payoutCharacterId)throw new Error('MARKET_LISTING_FIELDS_REQUIRED');
    return contentRepository.createCreatorMarketListing({revisionId,payoutCharacterId,priceKc,licenseKey});
  }
  async function cancelListing(listingId){if(!authenticated())throw new Error('AUTH_REQUIRED');await fresh();return contentRepository.cancelCreatorMarketListing(listingId);}
  async function purchase({listingId,buyerCharacterId}={}){
    if(!authenticated())throw new Error('AUTH_REQUIRED');if(!listingId||!buyerCharacterId)throw new Error('MARKET_PURCHASE_FIELDS_REQUIRED');await fresh();
    const correlationId=uuid(root),result=await contentRepository.purchaseCreatorMarketListing({listingId,buyerCharacterId,correlationId});
    try{await root.KeloCreatorEntitlements?.refresh?.({force:true});}catch(_){ }
    return F({correlationId,...result});
  }
  async function owned(){if(!authenticated())return F([]);await fresh();const rows=await contentRepository.listMyCreatorEntitlements();return F(arr(rows).map(row=>F({...row})));}
  return F({version:'kelo-creator-marketplace-service-v1.1.0-entitlement-refresh',authenticated,discover,profile,saveProfile,dashboard,createListing,cancelListing,purchase,owned});
}
