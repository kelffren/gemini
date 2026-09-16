/* KELO-INDEX
 * area: CREATORS / APPROVAL
 * owner: CreatorApprovalDock
 * owns: in-editor submit/status UX for ApprovalRequest
 * does-not-own: publication authority, admin review decisions or service-role credentials
 * security: authenticated RPC only; one pending request per logical workspace entity
 */
const VERSION='creator-approval-dock-v1.0.0';
const STATUS=Object.freeze({
  draft:{label:'BORRADOR',action:'ENVIAR A APROBACIÓN'},
  pending:{label:'PENDIENTE',action:'PENDIENTE'},
  approved:{label:'APROBADO',action:'REENVIAR CAMBIOS'},
  rejected:{label:'RECHAZADO',action:'CORREGIR Y REENVIAR'},
  cancelled:{label:'CANCELADO',action:'REENVIAR'}
});
const TYPE_BY_WORKSPACE=Object.freeze({
  world:'world','map-forge':'map',parcel:'world',dungeon:'scene','game-mode':'other',mount:'other',ability:'ability','sprite-ability':'ability',npc:'other',quest:'other',item:'item',crafting:'item',avatar:'skin','asset-sheet':'asset','asset-forge':'asset',appearance:'skin',animation:'animation',vfx:'vfx',cinematic:'scene','content-studio':'other',prefab:'scene',environment:'world',audio:'other'
});
const LABELS=Object.freeze({world:'World','map-forge':'Map Forge',parcel:'Parcel',dungeon:'Dungeon','game-mode':'Game Mode',mount:'Mount',ability:'Ability','sprite-ability':'Sprite Ability',npc:'NPC',quest:'Quest',item:'Item',crafting:'Crafting',avatar:'Avatar','asset-sheet':'Asset Sheet','asset-forge':'Asset Forge',appearance:'Appearance',animation:'Animation',vfx:'VFX',cinematic:'Cinematic','content-studio':'Content Studio',prefab:'Prefab',environment:'Environment',audio:'Audio'});

const safeText=(value,max=160)=>String(value??'').trim().slice(0,max);
const randomId=root=>root.crypto?.randomUUID?.()||`draft-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
function shellOf(root,session){
  const direct=session?.shell||session?.root||session?.element||null;
  if(direct?.isConnected)return direct;
  return root.document?.querySelector?.('#kelo-studio-live,#kelo-studio-workspace,#kelo-asset-forge,#kelo-content-studio,[data-kelo-creator-workspace]')||null;
}
function localFallbackId(root,workspace){
  const key=`kelo.creator.approval.logical.${workspace}`;
  try{let value=root.localStorage?.getItem(key);if(!value){value=randomId(root);root.localStorage?.setItem(key,value);}return value;}catch{return randomId(root);}
}
function contentTarget(session){
  const rows=typeof session?.results==='function'?session.results():session?.results;
  const first=Array.isArray(rows)?rows[0]:null;
  const revision=first?.revision||null;
  if(revision?.id||revision?.content_id)return {entityId:String(revision.id||revision.content_id),title:first?.runtime?.displayName||revision.content_id||'Contenido importado',metadata:{content_id:revision.content_id||null,revision_id:revision.id||null}};
  return null;
}
function customTarget(session,context){
  try{const value=typeof session?.getApprovalTarget==='function'?session.getApprovalTarget():session?.approvalTarget;if(value)return value;}catch{}
  return context?.approvalTarget||null;
}
function resolveTarget({root,workspace,session,context}){
  const custom=customTarget(session,context)||{};
  const selected=session?.selected;
  const content=workspace==='content-studio'?contentTarget(session):null;
  const entityId=safeText(custom.entityId||context?.projectId||session?.projectId||session?.project?.projectId||session?.assetId||selected?.metadata?.layoutHash||content?.entityId||localFallbackId(root,workspace),240);
  const selectedTitle=selected?.metadata?.name||selected?.name||null;
  const title=safeText(custom.title||content?.title||selectedTitle||`${LABELS[workspace]||workspace} · ${entityId.slice(0,18)}`,120);
  const summary=safeText(custom.summary||`Trabajo enviado desde ${LABELS[workspace]||workspace} para revisión administrativa.`,1200);
  const metadata=Object.assign({},custom.metadata||{},content?.metadata||{},context?.projectId?{project_id:context.projectId}:{},session?.assetId?{asset_id:session.assetId}:{},selected?.metadata?.layoutHash?{layout_hash:selected.metadata.layoutHash}:{},selected?.quality?.total!=null?{quality_score:selected.quality.total}:{}, {workspace,client_version:VERSION});
  return {workspace,entityId,title,summary,requestType:custom.requestType||TYPE_BY_WORKSPACE[workspace]||'other',metadata};
}
function css(){return `
.kcad{position:fixed;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));z-index:2147483540;display:grid;gap:6px;min-width:min(310px,calc(100vw - 20px));max-width:360px;padding:9px;border:1px solid rgba(219,183,88,.34);border-radius:15px;background:rgba(7,12,18,.96);box-shadow:0 16px 50px rgba(0,0,0,.48);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#eef4ff}.kcad-row{display:flex;align-items:center;gap:8px}.kcad-copy{min-width:0;flex:1}.kcad-copy b{display:block;font-size:10px;letter-spacing:.07em}.kcad-copy small{display:block;margin-top:2px;color:#8093a6;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kcad-state{border:1px solid rgba(255,255,255,.12);border-radius:999px;padding:4px 7px;font-size:8px;font-weight:950}.kcad-state.pending{color:#ffd28d;background:#382714}.kcad-state.approved{color:#9de0bd;background:#10291e}.kcad-state.rejected{color:#ffabab;background:#36161a}.kcad-state.draft,.kcad-state.cancelled{color:#b9dcff;background:#102338}.kcad-actions{display:flex;gap:6px}.kcad button{min-height:36px;border:1px solid rgba(219,183,88,.28);border-radius:10px;background:#142032;color:#eef4ff;font-size:9px;font-weight:900;padding:8px 10px}.kcad button.primary{flex:1;background:linear-gradient(135deg,#d5b35f,#9a752d);color:#11100b}.kcad button:disabled{opacity:.5}.kcad-note{font-size:8px;line-height:1.35;color:#9aacbd;max-height:34px;overflow:auto}@media(max-width:480px){.kcad{left:8px;right:8px;min-width:0;max-width:none}}
`;}

export async function installCreatorApprovalDock({root=globalThis,workspace,session,context={},repository,contentSession}={}){
  if(!root.document||!workspace||!session||!repository?.rpc)return null;
  const shell=shellOf(root,session);if(!shell)return null;
  const existing=root.document.querySelector(`.kcad[data-workspace="${CSS.escape(String(workspace))}"]`);existing?.remove();
  if(!root.document.getElementById('kelo-creator-approval-dock-style')){const style=root.document.createElement('style');style.id='kelo-creator-approval-dock-style';style.textContent=css();root.document.head.append(style);}
  const dock=root.document.createElement('aside');dock.className='kcad';dock.dataset.workspace=workspace;dock.innerHTML='<div class="kcad-row"><div class="kcad-copy"><b>APPROVALREQUEST</b><small></small></div><span class="kcad-state draft">BORRADOR</span></div><div class="kcad-actions"><button class="primary">ENVIAR A APROBACIÓN</button><button class="refresh" aria-label="Actualizar estado">↻</button></div><div class="kcad-note"></div>';
  root.document.body.append(dock);
  const subtitle=dock.querySelector('.kcad-copy small'),state=dock.querySelector('.kcad-state'),submit=dock.querySelector('button.primary'),refresh=dock.querySelector('button.refresh'),note=dock.querySelector('.kcad-note');
  let busy=false,current={status:'draft',request_id:null},target=null,destroyed=false;
  const toast=message=>typeof root.showToast==='function'?root.showToast(message):console.info('[CreatorApproval]',message);
  function paint(){
    const status=String(current?.status||'draft');const cfg=STATUS[status]||STATUS.draft;
    state.className=`kcad-state ${status}`;state.textContent=cfg.label;submit.textContent=cfg.action;submit.disabled=busy||status==='pending';refresh.disabled=busy;
    subtitle.textContent=`${LABELS[workspace]||workspace} · ${target?.title||'trabajo actual'}`;
    note.textContent=current?.decision_note?`Nota del revisor: ${current.decision_note}`:(status==='pending'?'Ya está en la bandeja de los revisores.':status==='approved'?'Aprobado. Si haces cambios, puedes reenviar una nueva revisión.':status==='rejected'?'Corrige el trabajo y vuelve a enviarlo.':'Este trabajo aún no se ha enviado.');
  }
  async function ensureAuth(){
    if(contentSession?.ensureFresh)await contentSession.ensureFresh();
    if(!contentSession?.accessToken&&!repository.userId?.())throw new Error('AUTH_REQUIRED');
  }
  async function load(){
    if(destroyed)return current;target=resolveTarget({root,workspace,session,context});paint();
    try{await ensureAuth();const data=await repository.rpc('get_my_creator_workspace_approval',{p_workspace:workspace,p_entity_id:target.entityId});current=data||{status:'draft'};}
    catch(error){if(!/AUTH_REQUIRED/.test(String(error?.message||error)))console.warn('[CreatorApproval status]',error);current={status:'draft',authRequired:true};}
    paint();return current;
  }
  async function send(){
    if(busy||current?.status==='pending')return current;busy=true;paint();
    try{
      await ensureAuth();target=resolveTarget({root,workspace,session,context});
      const data=await repository.rpc('submit_creator_workspace_approval',{p_workspace:workspace,p_entity_id:target.entityId,p_title:target.title,p_summary:target.summary,p_request_type:target.requestType,p_metadata:target.metadata});
      current=data||{status:'pending'};toast('Enviado a ApprovalRequest');paint();return current;
    }catch(error){console.warn('[CreatorApproval submit]',error);toast(/AUTH_REQUIRED/.test(String(error?.message||error))?'Inicia sesión para enviar a aprobación':'No se pudo enviar a ApprovalRequest');throw error;}
    finally{busy=false;paint();}
  }
  submit.onclick=()=>void send().catch(()=>{});refresh.onclick=()=>void load();
  const onFocus=()=>void load();const onVisible=()=>{if(root.document.visibilityState==='visible')void load();};root.addEventListener?.('focus',onFocus);root.document.addEventListener('visibilitychange',onVisible);
  const observer=new MutationObserver(()=>{if(!shell.isConnected)destroy();});observer.observe(root.document.body,{childList:true,subtree:true});
  function destroy(){if(destroyed)return;destroyed=true;observer.disconnect();root.removeEventListener?.('focus',onFocus);root.document.removeEventListener('visibilitychange',onVisible);dock.remove();}
  await load();
  return Object.freeze({version:VERSION,dock,refresh:load,submit:send,destroy,get target(){return target;},get status(){return current?.status||'draft';}});
}
