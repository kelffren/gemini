/* KELO-INDEX
 * area: CREATORS / RUNTIME TEST BRIDGE
 * owner: temporary Definition Studio test sessions
 * owns: reversible ENVIRONMENT tests, server-backed apply-world approval, bounded revision history and safe rollback
 * does-not-own: publish authorization, server storage, map versioning or gameplay authority
 */
import { createEnvironmentPreviewModel } from './environment-live-preview.mjs';
import { installEnvironmentRuntime } from '../../environment/environment-runtime.mjs';

const BRIDGE_VERSION='kelo-creator-test-bridge-v7';
const RESTORE_ID='kelo-environment-runtime-test-restore';
const HISTORY_ID='kelo-environment-runtime-world-history';
const APPLY_ID='kelo-environment-runtime-test-apply';
const UNDO_ID='kelo-environment-runtime-world-undo';
const PANEL_ID='kelo-environment-runtime-history-panel';
const STYLE_ID='kelo-environment-runtime-test-controls';

export function createCreatorTestPlan(type,draft={}){
  const key=String(type||draft?.type||'').trim().toUpperCase();
  if(key!=='ENVIRONMENT')return Object.freeze({supported:false,type:key,mode:'event-only'});
  return Object.freeze({supported:true,type:key,mode:'native-environment-runtime',environment:createEnvironmentPreviewModel(draft)});
}

function installControls(doc){
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
#${RESTORE_ID},#${HISTORY_ID},#${APPLY_ID},#${UNDO_ID}{position:fixed;bottom:max(82px,calc(env(safe-area-inset-bottom) + 70px));z-index:2147483000;min-height:42px;padding:0 11px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.36);font:850 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;pointer-events:auto;-webkit-tap-highlight-color:transparent}
#${RESTORE_ID}{left:max(10px,env(safe-area-inset-left));border:1px solid rgba(232,201,111,.48);background:rgba(14,16,20,.92);color:#efd78f}
#${HISTORY_ID}{left:50%;transform:translateX(-50%);border:1px solid rgba(125,178,235,.45);background:rgba(11,24,39,.95);color:#a9d6ff}
#${APPLY_ID}{right:max(10px,env(safe-area-inset-right));border:1px solid rgba(111,232,164,.5);background:rgba(12,34,24,.95);color:#9df0bd}
#${UNDO_ID}{right:max(10px,env(safe-area-inset-right));border:1px solid rgba(235,178,86,.58);background:rgba(37,25,10,.96);color:#f2cf83}
#${APPLY_ID}[disabled],#${HISTORY_ID}[disabled],#${UNDO_ID}[disabled]{opacity:.72;filter:saturate(.7)}
#${PANEL_ID}{position:fixed;z-index:2147483100;left:50%;bottom:max(136px,calc(env(safe-area-inset-bottom) + 124px));transform:translateX(-50%);width:min(94vw,520px);max-height:min(58vh,520px);overflow:auto;overscroll-behavior:contain;padding:12px;border:1px solid rgba(125,178,235,.28);border-radius:18px;background:rgba(7,11,17,.97);box-shadow:0 24px 70px rgba(0,0,0,.58);color:#e9eef5;font:700 10px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:auto;-webkit-overflow-scrolling:touch}
#${PANEL_ID} .kewh-head{position:sticky;top:-12px;z-index:2;margin:-12px -12px 8px;padding:11px 12px;background:rgba(7,11,17,.985);border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:8px}
#${PANEL_ID} .kewh-head strong{font-size:11px;letter-spacing:.05em}#${PANEL_ID} .kewh-head small{margin-left:auto;color:#7f8b99;font-size:8px}#${PANEL_ID} .kewh-close{border:0;background:transparent;color:#c8d0da;font-size:19px;line-height:1;padding:5px}
#${PANEL_ID} .kewh-row{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.055)}#${PANEL_ID} .kewh-row:last-child{border-bottom:0}
#${PANEL_ID} .kewh-meta{min-width:0}#${PANEL_ID} .kewh-meta b{display:block;color:#dce8f3;font-size:10px}#${PANEL_ID} .kewh-meta small{display:block;margin-top:3px;color:#7f8b99;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${PANEL_ID} .kewh-action{min-width:82px;min-height:34px;padding:0 9px;border-radius:10px;border:1px solid rgba(232,201,111,.28);background:rgba(31,25,13,.7);color:#e8cf89;font:850 8px/1 system-ui}#${PANEL_ID} .kewh-current{color:#82e2ad;border-color:rgba(111,232,164,.25);background:rgba(12,34,24,.5)}#${PANEL_ID} .kewh-error{padding:10px;border-radius:10px;color:#ffb0b0;background:rgba(255,100,100,.07)}
@media(max-width:390px){#${RESTORE_ID},#${HISTORY_ID},#${APPLY_ID}{padding:0 8px;font-size:9px;min-height:40px}#${PANEL_ID}{width:96vw}}
`;doc.head.append(style);
}

export function installCreatorTestBridge(root=globalThis,{contentSession=null}={}){
  if(root?.KELO_CREATOR_TEST_BRIDGE?.version===BRIDGE_VERSION){root.KELO_CREATOR_TEST_BRIDGE.configure?.({contentSession});return root.KELO_CREATOR_TEST_BRIDGE;}
  const doc=root?.document,runtime=installEnvironmentRuntime(root);let active=null,session=contentSession,publishing=false,lastPublished=null,historyConfirmRevision=0;

  function configure({contentSession:nextSession=null}={}){if(nextSession)session=nextSession;return api;}
  function token(){const value=String(session?.accessToken||'').trim();if(!value)throw new Error('AUTH_REQUIRED');return value;}
  function removePreviewControls(){doc?.getElementById?.(RESTORE_ID)?.remove?.();doc?.getElementById?.(HISTORY_ID)?.remove?.();doc?.getElementById?.(APPLY_ID)?.remove?.();removeHistoryPanel();}
  function removeUndoControl(){doc?.getElementById?.(UNDO_ID)?.remove?.();}
  function removeHistoryPanel(){doc?.getElementById?.(PANEL_ID)?.remove?.();historyConfirmRevision=0;}
  function removeControls(){removePreviewControls();removeUndoControl();}
  function restore(reason='manual'){
    if(publishing)return Object.freeze({ok:false,restored:false,message:'World publish is still in progress'});
    removePreviewControls();const result=runtime.restoreTemporary(reason);active=null;
    try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-restored',{detail:{type:'ENVIRONMENT',reason,mode:'native-runtime',state:result.state,source:'kelo-creator-test-bridge'}}));}catch{}
    return Object.freeze({...result,message:result.message||'Native environment restored'});
  }
  async function getWorldSync(){
    const existing=root?.KELO_WORLD_ENVIRONMENT_SYNC;
    if(existing?.version==='kelo-world-environment-sync-v4')return existing;
    const mod=await import('../../environment/environment-world-sync.mjs');return mod.installWorldEnvironmentSync(root);
  }
  function mountUndoControl(){
    if(!doc?.createElement||!lastPublished)return null;installControls(doc);removeUndoControl();
    const undoBtn=doc.createElement('button');undoBtn.id=UNDO_ID;undoBtn.type='button';undoBtn.textContent='↶ UNDO WORLD';undoBtn.setAttribute('aria-label',`Undo world environment revision ${lastPublished.publishedRevision} back to revision ${lastPublished.targetRevision}`);undoBtn.addEventListener('click',()=>void rollbackLast('button'));doc.body.append(undoBtn);return undoBtn;
  }
  async function history(limit=10){
    const sync=await getWorldSync();if(!sync.revision)await sync.refresh({source:'creator-history'});
    return sync.history({accessToken:token(),limit});
  }
  async function rollbackRevision(targetRevision,reason='history'){
    if(publishing)return Object.freeze({ok:false,rolledBack:false,message:'World mutation already in progress'});
    publishing=true;
    try{
      const sync=await getWorldSync();await sync.refresh({source:'creator-history-rollback'});const beforeRevision=sync.revision,target=Math.trunc(Number(targetRevision)||0);
      if(target<1)throw new Error('INVALID_TARGET_REVISION');
      if(target>=beforeRevision)throw new Error('ROLLBACK_TARGET_MUST_BE_OLDER');
      const envelope=await sync.rollback(target,{accessToken:token(),expectedRevision:beforeRevision,source:'creator-history-rollback'});
      const result=runtime.publish(envelope.state,{source:'creator-history-rollback',revision:envelope.revision,updatedAt:envelope.updatedAt,updatedBy:envelope.updatedBy});
      removePreviewControls();active=null;lastPublished=Object.freeze({targetRevision:beforeRevision,publishedRevision:envelope.revision,state:result.state,publishedAt:Date.now(),kind:'rollback'});mountUndoControl();
      const detail=Object.freeze({type:'ENVIRONMENT',reason,mode:'native-runtime',state:result.state,revision:envelope.revision,restoredRevision:target,previousRevision:beforeRevision,persistent:true,synchronized:true,source:'kelo-creator-test-bridge'});
      try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-world-history-rollback',{detail}));}catch{}
      return Object.freeze({...result,rolledBack:true,revision:envelope.revision,restoredRevision:target,previousRevision:beforeRevision,synchronized:true,undoAvailable:true,message:`WORLD ROLLBACK · restored revision ${target} for all players`});
    }catch(error){
      const message=String(error?.message||error),conflict=message.includes('ENVIRONMENT_REVISION_CONFLICT');
      try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-world-history-rollback-failed',{detail:{type:'ENVIRONMENT',reason,error:message,conflict,source:'kelo-creator-test-bridge'}}));}catch{}
      return Object.freeze({ok:false,rolledBack:false,conflict,error:message,message:conflict?'Rollback blocked safely because the world changed while you were choosing a revision':message==='AUTH_REQUIRED'?'Sign in with an admin or official account before opening world history':`Could not rollback world environment · ${message}`});
    }finally{publishing=false;}
  }
  async function renderHistoryPanel(){
    if(!doc?.createElement)return null;installControls(doc);removeHistoryPanel();
    const panel=doc.createElement('section');panel.id=PANEL_ID;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','World environment revision history');
    const head=doc.createElement('div');head.className='kewh-head';const title=doc.createElement('strong');title.textContent='WORLD HISTORY';const live=doc.createElement('small');live.textContent='LOADING…';const close=doc.createElement('button');close.type='button';close.className='kewh-close';close.textContent='×';close.setAttribute('aria-label','Close world history');close.onclick=removeHistoryPanel;head.append(title,live,close);panel.append(head);doc.body.append(panel);
    try{
      const entries=await history(10),current=root?.KELO_WORLD_ENVIRONMENT_SYNC?.revision||runtime.revision||0;live.textContent=`WORLD r${current} · ${root?.KELO_WORLD_ENVIRONMENT_SYNC?.connected?'LIVE':'SYNCING'}`;
      if(!entries.length){const empty=doc.createElement('div');empty.className='kewh-error';empty.textContent='No environment revisions yet';panel.append(empty);return panel;}
      for(const entry of entries){
        const row=doc.createElement('div');row.className='kewh-row';const meta=doc.createElement('div');meta.className='kewh-meta';const b=doc.createElement('b');b.textContent=`r${entry.revision} · ${String(entry.action||'publish').toUpperCase()}`;const small=doc.createElement('small');small.textContent=`${entry.state.biome} · ${entry.state.weather} · ${entry.state.timeOfDay} · density ${entry.state.ambientDensity}`;meta.append(b,small);const action=doc.createElement('button');action.type='button';action.className='kewh-action';
        if(entry.revision===current){action.textContent='CURRENT';action.disabled=true;action.classList.add('kewh-current');}
        else{action.textContent=historyConfirmRevision===entry.revision?'CONFIRM':'ROLLBACK';action.onclick=async()=>{if(historyConfirmRevision!==entry.revision){historyConfirmRevision=entry.revision;await renderHistoryPanel();return;}action.disabled=true;action.textContent='ROLLING BACK…';const result=await rollbackRevision(entry.revision,'history-panel');notify(root,result.message);if(result.ok){removeHistoryPanel();}else{historyConfirmRevision=0;await renderHistoryPanel();}};}
        row.append(meta,action);panel.append(row);
      }
      return panel;
    }catch(error){live.textContent='UNAVAILABLE';const box=doc.createElement('div');box.className='kewh-error';box.textContent=String(error?.message||error)==='AUTH_REQUIRED'?'Admin/official sign-in required to view world history':String(error?.message||error);panel.append(box);return panel;}
  }
  async function rollbackLast(reason='manual'){
    if(!lastPublished)return Object.freeze({ok:false,rolledBack:false,message:'No world environment publish to undo'});
    if(publishing)return Object.freeze({ok:false,rolledBack:false,message:'World mutation already in progress'});
    const undoBtn=doc?.getElementById?.(UNDO_ID),plan={...lastPublished};publishing=true;
    if(undoBtn){undoBtn.disabled=true;undoBtn.textContent='UNDOING WORLD…';}
    try{
      const sync=await getWorldSync();
      const envelope=await sync.rollback(plan.targetRevision,{accessToken:token(),expectedRevision:plan.publishedRevision,source:'creator-undo'});
      const result=runtime.publish(envelope.state,{source:'creator-undo-world',revision:envelope.revision,updatedAt:envelope.updatedAt,updatedBy:envelope.updatedBy});
      removeUndoControl();lastPublished=null;
      const detail=Object.freeze({type:'ENVIRONMENT',reason,mode:'native-runtime',state:result.state,revision:envelope.revision,restoredRevision:plan.targetRevision,persistent:true,synchronized:true,source:'kelo-creator-test-bridge'});
      try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-world-undo',{detail}));}catch{}
      return Object.freeze({...result,rolledBack:true,revision:envelope.revision,restoredRevision:plan.targetRevision,synchronized:true,message:`WORLD UNDONE · restored revision ${plan.targetRevision} for all players`});
    }catch(error){
      const message=String(error?.message||error),conflict=message.includes('ENVIRONMENT_REVISION_CONFLICT');
      if(undoBtn){undoBtn.disabled=conflict;undoBtn.textContent=conflict?'UNDO BLOCKED · WORLD CHANGED':'UNDO FAILED · RETRY';undoBtn.title=message;}
      try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-world-undo-failed',{detail:{type:'ENVIRONMENT',reason,error:message,conflict,source:'kelo-creator-test-bridge'}}));}catch{}
      return Object.freeze({ok:false,rolledBack:false,conflict,error:message,message:conflict?'Undo blocked safely because another world revision was published':message==='AUTH_REQUIRED'?'Sign in with an admin or official account before undoing the world':`Could not undo world environment · ${message}`});
    }finally{publishing=false;}
  }
  async function approve(reason='button'){
    if(!active)return Object.freeze({ok:false,persistent:false,message:'No active environment test to apply'});
    if(publishing)return Object.freeze({ok:false,persistent:false,message:'World publish already in progress'});
    const applyBtn=doc?.getElementById?.(APPLY_ID),model=active.model;publishing=true;
    if(applyBtn){applyBtn.disabled=true;applyBtn.textContent='SYNCING WORLD…';}
    try{
      const sync=await getWorldSync();if(!sync.revision)await sync.refresh({source:'creator-approve'});
      const beforeRevision=sync.revision;
      const envelope=await sync.publish(model,{accessToken:token(),expectedRevision:beforeRevision||null,source:'creator-approved'});
      const result=runtime.publish(envelope.state,{source:'creator-approved-world',revision:envelope.revision,updatedAt:envelope.updatedAt,updatedBy:envelope.updatedBy});
      removePreviewControls();active=null;lastPublished=Object.freeze({targetRevision:beforeRevision,publishedRevision:envelope.revision,state:result.state,publishedAt:Date.now(),kind:'publish'});mountUndoControl();
      const detail=Object.freeze({type:'ENVIRONMENT',reason,mode:'native-runtime',state:result.state,revision:envelope.revision,previousRevision:beforeRevision,persistent:true,synchronized:true,undoAvailable:beforeRevision>0,source:'kelo-creator-test-bridge'});
      try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-approved',{detail}));}catch{}
      return Object.freeze({...result,revision:envelope.revision,previousRevision:beforeRevision,synchronized:true,undoAvailable:beforeRevision>0,message:`${result.message} · synchronized for all players · UNDO WORLD available`});
    }catch(error){
      const message=String(error?.message||error),conflict=message.includes('ENVIRONMENT_REVISION_CONFLICT');
      if(applyBtn){applyBtn.disabled=false;applyBtn.textContent=conflict?'WORLD CHANGED · RETRY':'APPLY FAILED · RETRY';applyBtn.title=message;}
      const detail=Object.freeze({type:'ENVIRONMENT',reason,error:message,conflict,temporary:true,persistent:false,source:'kelo-creator-test-bridge'});
      try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-approval-failed',{detail}));}catch{}
      return Object.freeze({ok:false,temporary:true,persistent:false,conflict,error:message,message:conflict?'World changed remotely · preview kept · retry APPLY WORLD':message==='AUTH_REQUIRED'?'Sign in with an admin or official account before APPLY WORLD':`Could not publish world environment · ${message}`});
    }finally{publishing=false;}
  }
  function mountControls(){
    if(!doc?.createElement)return Object.freeze({restore:null,history:null,apply:null});installControls(doc);removeControls();lastPublished=null;
    const restoreBtn=doc.createElement('button');restoreBtn.id=RESTORE_ID;restoreBtn.type='button';restoreBtn.textContent='↶ RESTORE';restoreBtn.setAttribute('aria-label','Restore environment before test');restoreBtn.addEventListener('click',()=>restore('button'));
    const historyBtn=doc.createElement('button');historyBtn.id=HISTORY_ID;historyBtn.type='button';historyBtn.textContent=`HISTORY r${root?.KELO_WORLD_ENVIRONMENT_SYNC?.revision||runtime.revision||'—'}`;historyBtn.setAttribute('aria-label','Open shared world environment revision history');historyBtn.addEventListener('click',()=>void renderHistoryPanel());
    const applyBtn=doc.createElement('button');applyBtn.id=APPLY_ID;applyBtn.type='button';applyBtn.textContent='✓ APPLY WORLD';applyBtn.setAttribute('aria-label','Publish this environment to the shared Kelo World state');applyBtn.addEventListener('click',()=>void approve('button'));
    doc.body.append(restoreBtn,historyBtn,applyBtn);return Object.freeze({restore:restoreBtn,history:historyBtn,apply:applyBtn});
  }
  function mountEnvironment(draft){
    const model=createEnvironmentPreviewModel(draft),result=runtime.applyTemporary(model,{source:'kelo-creator-test-bridge'});active={mode:'native-runtime',model,state:result.state,controls:null};active.controls=mountControls();
    const detail=Object.freeze({type:'ENVIRONMENT',draft,model,state:result.state,temporary:true,persistent:false,mode:'native-runtime',source:'kelo-creator-test-bridge'});
    try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-applied',{detail}));}catch{}
    return Object.freeze({...result,supported:true,temporary:true,persistent:false,message:`${result.message} · RESTORE / HISTORY / APPLY WORLD`,model});
  }
  async function run(type,draft={}){
    const plan=createCreatorTestPlan(type,draft);if(!plan.supported)return Object.freeze({ok:true,supported:false,temporary:false,message:`${plan.type||'Definition'} test draft emitted`});return mountEnvironment(draft);
  }

  const api=Object.freeze({version:BRIDGE_VERSION,configure,run,restore,approve,history,rollbackRevision,rollbackLast,openHistory:renderHistoryPanel,get active(){return active?Object.freeze({type:'ENVIRONMENT',mode:active.mode,model:active.model,state:active.state,temporary:true,persistent:false,publishing}):null;},get lastPublished(){return lastPublished;},get worldRevision(){return root?.KELO_WORLD_ENVIRONMENT_SYNC?.revision||runtime.revision||0;},get worldConnected(){return root?.KELO_WORLD_ENVIRONMENT_SYNC?.connected===true;}});
  if(root)root.KELO_CREATOR_TEST_BRIDGE=api;removeControls();return api;
}

if(typeof window!=='undefined'&&window.document)installCreatorTestBridge(window);
