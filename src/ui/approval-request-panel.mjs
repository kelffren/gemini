/* KELO-INDEX
 * area: UI / APPROVAL REQUEST
 * owner: KeloApprovalRequestPanel
 * keys: APPROVALREQUEST EDITOR ASSET MAP REVIEW ADMIN MOBILE
 * purpose: mobile-first universal inbox for editor work awaiting an authorized admin decision
 * authority: decisions use review_approval_request(); this UI never publishes game content directly
 */
import {installApprovalRequestRuntime} from './../core/approval-request-runtime.mjs?v=1';

const VERSION='approval-request-panel-v1.0.0';
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fmt=value=>{if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString();};
const labels={asset:'Asset',map:'Mapa',scene:'Escena',skin:'Skin',item:'Item',animation:'Animación',vfx:'VFX',ability:'Habilidad',world:'Mundo',other:'Otro'};

export async function installApprovalRequestPanel({root=window}={}){
  if(root.KeloApprovalRequestPanel)return root.KeloApprovalRequestPanel;
  const runtime=await installApprovalRequestRuntime({root});
  let opened=false,busy=false,status='pending',rows=[];
  const $=id=>document.getElementById(id);
  const permissions=()=>root.KeloAccountPermissions||root.KeloPermissions;
  const allowed=()=>!!(permissions()?.hasRole?.('admin')||permissions()?.can?.('approval.view')||permissions()?.can?.('approval.review'));
  const canReview=()=>!!(permissions()?.hasRole?.('admin')||permissions()?.can?.('approval.review'));
  const toast=message=>typeof root.showToast==='function'?root.showToast(message):console.info('[ApprovalRequest]',message);

  function ensureStyle(){
    if($('kelo-approval-request-style'))return;
    const style=document.createElement('style');
    style.id='kelo-approval-request-style';
    style.textContent=`
#kelo-approval-request{position:fixed;z-index:495;inset:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));display:none;overflow:hidden;pointer-events:auto;border:1px solid rgba(219,183,88,.46);border-radius:24px;background:linear-gradient(180deg,rgba(8,13,22,.995),rgba(4,8,14,.995));color:#eef4ff;box-shadow:0 30px 110px rgba(0,0,0,.78);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}#kelo-approval-request *{box-sizing:border-box}.kar-shell{height:100%;display:grid;grid-template-rows:auto auto 1fr}.kar-head{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid rgba(255,255,255,.07);background:linear-gradient(90deg,rgba(44,65,99,.35),rgba(20,13,7,.22))}.kar-title{flex:1;font-weight:950;letter-spacing:.05em;color:#f0d47f}.kar-title small{display:block;margin-top:3px;font-size:9px;color:#8195ac;letter-spacing:.01em}.kar-close{width:38px;height:38px;border-radius:12px;border:1px solid rgba(219,183,88,.28);background:#111a28;color:#f0d47f;font-size:20px}.kar-tabs{display:flex;gap:7px;padding:9px 10px;overflow:auto;border-bottom:1px solid rgba(255,255,255,.06)}.kar-tab,.kar-btn{border:1px solid rgba(219,183,88,.22);border-radius:11px;background:#0d1724;color:#dce8f5;padding:9px 11px;font-size:11px;font-weight:850;white-space:nowrap}.kar-tab.on{background:#243b59;border-color:#d6b75c;color:#fff0ad}.kar-list{overflow:auto;padding:10px;-webkit-overflow-scrolling:touch}.kar-card{border:1px solid rgba(255,255,255,.08);border-radius:16px;background:rgba(15,25,39,.88);padding:12px;margin-bottom:9px}.kar-top{display:flex;gap:8px;align-items:flex-start}.kar-copy{flex:1;min-width:0}.kar-card h3{font-size:13px;margin:0;color:#eef4ff}.kar-meta{margin-top:4px;font-size:9px;line-height:1.5;color:#8195ac}.kar-summary{margin-top:8px;color:#bccbdd;font-size:11px;line-height:1.45;white-space:pre-wrap}.kar-pill{display:inline-flex;align-items:center;border:1px solid rgba(113,166,215,.2);border-radius:999px;padding:4px 7px;color:#a8cae8;background:#112438;font-size:8px;font-weight:900;text-transform:uppercase}.kar-pill.pending{color:#ffd28d;background:#382714;border-color:rgba(255,199,91,.28)}.kar-pill.approved{color:#9de0bd;background:#10291e;border-color:rgba(91,211,151,.28)}.kar-pill.rejected{color:#ffabab;background:#36161a;border-color:rgba(255,110,110,.25)}.kar-actions{display:flex;gap:7px;margin-top:10px;flex-wrap:wrap}.kar-btn.approve{border-color:rgba(91,211,151,.35);color:#9de0bd;background:#10291e}.kar-btn.reject{border-color:rgba(255,110,110,.38);color:#ffabab;background:#2b1216}.kar-note{width:100%;min-height:68px;resize:vertical;margin-top:9px;border:1px solid rgba(219,183,88,.18);border-radius:11px;background:#0b1522;color:#eef4ff;padding:9px;font-size:11px}.kar-empty{height:100%;display:grid;place-items:center;text-align:center;color:#6f8499;padding:28px}.kar-busy{opacity:.56;pointer-events:none}.kar-refresh{font-size:16px;padding-inline:12px}@media(max-width:620px){#kelo-approval-request{border-radius:18px}.kar-head{padding:10px}.kar-list{padding:8px}.kar-card{padding:10px}.kar-title{font-size:13px}.kar-tab,.kar-btn{min-height:38px}}
`;
    document.head.appendChild(style);
  }

  function ensureDom(){
    if($('kelo-approval-request'))return;
    ensureStyle();
    const panel=document.createElement('section');
    panel.id='kelo-approval-request';
    panel.innerHTML=`<div class="kar-shell"><div class="kar-head"><div class="kar-title">✓ APPROVALREQUEST<small>trabajo de editores · assets · mapas · contenido</small></div><button class="kar-btn kar-refresh" id="kar-refresh" aria-label="Actualizar">↻</button><button class="kar-close" id="kar-close" aria-label="Cerrar">×</button></div><div class="kar-tabs" id="kar-tabs"><button class="kar-tab on" data-status="pending">PENDIENTES</button><button class="kar-tab" data-status="approved">APROBADAS</button><button class="kar-tab" data-status="rejected">RECHAZADAS</button><button class="kar-tab" data-status="all">TODAS</button></div><div class="kar-list" id="kar-list"></div></div>`;
    panel.addEventListener('pointerdown',event=>event.stopPropagation());
    document.body.appendChild(panel);
    $('kar-close').onclick=close;
    $('kar-refresh').onclick=()=>void refresh();
    $('kar-tabs').onclick=event=>{const button=event.target.closest('[data-status]');if(!button)return;status=button.dataset.status||'pending';$('kar-tabs').querySelectorAll('[data-status]').forEach(node=>node.classList.toggle('on',node===button));void refresh();};
    $('kar-list').onclick=event=>{const button=event.target.closest('[data-decision]');if(button)void decide(button.dataset.id,button.dataset.decision);};
  }

  function render(){
    const host=$('kar-list');
    if(!host)return;
    if(!rows.length){host.innerHTML=`<div class="kar-empty">${status==='pending'?'No hay solicitudes pendientes.':'No hay solicitudes en esta vista.'}</div>`;return;}
    host.innerHTML=rows.map(row=>{
      const type=labels[row.request_type]||row.request_type||'Contenido';
      const reviewer=canReview()&&row.status==='pending';
      const metaBits=[type,row.submitted_by_name||'Editor',fmt(row.submitted_at)];
      if(row.entity_type)metaBits.push(row.entity_type);
      return `<article class="kar-card" data-request="${esc(row.id)}"><div class="kar-top"><div class="kar-copy"><h3>${esc(row.title)}</h3><div class="kar-meta">${metaBits.map(esc).join(' · ')}</div></div><span class="kar-pill ${esc(row.status)}">${esc(row.status)}</span></div>${row.summary?`<div class="kar-summary">${esc(row.summary)}</div>`:''}${row.decision_note?`<div class="kar-summary"><b>Nota:</b> ${esc(row.decision_note)}</div>`:''}${reviewer?`<textarea class="kar-note" data-note="${esc(row.id)}" placeholder="Nota opcional para el editor"></textarea><div class="kar-actions"><button class="kar-btn approve" data-id="${esc(row.id)}" data-decision="approved">✓ APROBAR</button><button class="kar-btn reject" data-id="${esc(row.id)}" data-decision="rejected">✕ RECHAZAR</button></div>`:''}</article>`;
    }).join('');
  }

  function setBusy(value){busy=!!value;$('kelo-approval-request')?.classList.toggle('kar-busy',busy);}

  async function refresh(){
    if(!allowed())throw new Error('APPROVAL_VIEW_DENIED');
    setBusy(true);
    try{rows=await runtime.list({status,limit:150})||[];render();return rows;}
    catch(error){console.warn('[ApprovalRequest refresh]',error);toast('No se pudo cargar ApprovalRequest');throw error;}
    finally{setBusy(false);}
  }

  async function decide(id,decision){
    if(busy||!canReview())return false;
    const note=$('kar-list')?.querySelector(`[data-note="${CSS.escape(String(id))}"]`)?.value||null;
    setBusy(true);
    try{await runtime.review(id,decision,note);toast(decision==='approved'?'Solicitud aprobada':'Solicitud rechazada');await refresh();return true;}
    catch(error){console.warn('[ApprovalRequest review]',error);toast(String(error?.message||error).includes('CANNOT_REVIEW_OWN_REQUEST')?'No puedes aprobar tu propia solicitud':'No se pudo guardar la decisión');return false;}
    finally{setBusy(false);}
  }

  async function open(){
    if(!allowed())throw new Error('APPROVAL_VIEW_DENIED');
    ensureDom();opened=true;$('kelo-approval-request').style.display='block';
    await runtime.markRead();
    await refresh();
    return true;
  }
  function close(){opened=false;const panel=$('kelo-approval-request');if(panel)panel.style.display='none';}

  const api=Object.freeze({version:VERSION,open,close,refresh,get opened(){return opened;}});
  root.KeloApprovalRequestPanel=api;
  return api;
}
