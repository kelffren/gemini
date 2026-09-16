/* KELO-INDEX
 * area: CREATORS / RUNTIME TEST BRIDGE
 * owner: temporary Definition Studio test sessions
 * owns: reversible ENVIRONMENT tests, server-backed apply-world approval, bounded revision history and safe rollback
 * does-not-own: publish authorization, server storage, map versioning or gameplay authority
 */
import { createEnvironmentPreviewModel } from './environment-live-preview.mjs';
import { installEnvironmentRuntime } from '../../environment/environment-runtime.mjs';

const BRIDGE_VERSION='kelo-creator-test-bridge-v6';
const RESTORE_ID='kelo-environment-runtime-test-restore';
const APPLY_ID='kelo-environment-runtime-test-apply';
const UNDO_ID='kelo-environment-runtime-world-undo';
const STYLE_ID='kelo-environment-runtime-test-controls';

export function createCreatorTestPlan(type,draft={}){
  const key=String(type||draft?.type||'').trim().toUpperCase();
  if(key!=='ENVIRONMENT')return Object.freeze({supported:false,type:key,mode:'event-only'});
  return Object.freeze({supported:true,type:key,mode:'native-environment-runtime',environment:createEnvironmentPreviewModel(draft)});
}

function installControls(doc){
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
#${RESTORE_ID},#${APPLY_ID},#${UNDO_ID}{position:fixed;bottom:max(82px,calc(env(safe-area-inset-bottom) + 70px));z-index:2147483000;min-height:42px;padding:0 12px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.36);font:850 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;pointer-events:auto;-webkit-tap-highlight-color:transparent}
#${RESTORE_ID}{left:max(10px,env(safe-area-inset-left));border:1px solid rgba(232,201,111,.48);background:rgba(14,16,20,.92);color:#efd78f}
#${APPLY_ID}{right:max(10px,env(safe-area-inset-right));border:1px solid rgba(111,232,164,.5);background:rgba(12,34,24,.95);color:#9df0bd}
#${UNDO_ID}{right:max(10px,env(safe-area-inset-right));border:1px solid rgba(235,178,86,.58);background:rgba(37,25,10,.96);color:#f2cf83}
#${APPLY_ID}[disabled],#${UNDO_ID}[disabled]{opacity:.72;filter:saturate(.7)}
`;doc.head.append(style);
}

export function installCreatorTestBridge(root=globalThis,{contentSession=null}={}){
  if(root?.KELO_CREATOR_TEST_BRIDGE?.version===BRIDGE_VERSION){root.KELO_CREATOR_TEST_BRIDGE.configure?.({contentSession});return root.KELO_CREATOR_TEST_BRIDGE;}
  const doc=root?.document,runtime=installEnvironmentRuntime(root);let active=null,session=contentSession,publishing=false,lastPublished=null;

  function configure({contentSession:nextSession=null}={}){if(nextSession)session=nextSession;return api;}
  function token(){const value=String(session?.accessToken||'').trim();if(!value)throw new Error('AUTH_REQUIRED');return value;}
  function removePreviewControls(){doc?.getElementById?.(RESTORE_ID)?.remove?.();doc?.getElementById?.(APPLY_ID)?.remove?.();}
  function removeUndoControl(){doc?.getElementById?.(UNDO_ID)?.remove?.();}
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
    if(!doc?.createElement)return Object.freeze({restore:null,apply:null});installControls(doc);removeControls();lastPublished=null;
    const restoreBtn=doc.createElement('button');restoreBtn.id=RESTORE_ID;restoreBtn.type='button';restoreBtn.textContent='↶ RESTORE';restoreBtn.setAttribute('aria-label','Restore environment before test');restoreBtn.addEventListener('click',()=>restore('button'));
    const applyBtn=doc.createElement('button');applyBtn.id=APPLY_ID;applyBtn.type='button';applyBtn.textContent='✓ APPLY WORLD';applyBtn.setAttribute('aria-label','Publish this environment to the shared Kelo World state');applyBtn.addEventListener('click',()=>void approve('button'));
    doc.body.append(restoreBtn,applyBtn);return Object.freeze({restore:restoreBtn,apply:applyBtn});
  }
  function mountEnvironment(draft){
    const model=createEnvironmentPreviewModel(draft),result=runtime.applyTemporary(model,{source:'kelo-creator-test-bridge'});active={mode:'native-runtime',model,state:result.state,controls:null};active.controls=mountControls();
    const detail=Object.freeze({type:'ENVIRONMENT',draft,model,state:result.state,temporary:true,persistent:false,mode:'native-runtime',source:'kelo-creator-test-bridge'});
    try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-applied',{detail}));}catch{}
    return Object.freeze({...result,supported:true,temporary:true,persistent:false,message:`${result.message} · RESTORE or APPLY WORLD`,model});
  }
  async function run(type,draft={}){
    const plan=createCreatorTestPlan(type,draft);if(!plan.supported)return Object.freeze({ok:true,supported:false,temporary:false,message:`${plan.type||'Definition'} test draft emitted`});return mountEnvironment(draft);
  }

  const api=Object.freeze({version:BRIDGE_VERSION,configure,run,restore,approve,history,rollbackRevision,rollbackLast,get active(){return active?Object.freeze({type:'ENVIRONMENT',mode:active.mode,model:active.model,state:active.state,temporary:true,persistent:false,publishing}):null;},get lastPublished(){return lastPublished;},get worldRevision(){return root?.KELO_WORLD_ENVIRONMENT_SYNC?.revision||runtime.revision||0;},get worldConnected(){return root?.KELO_WORLD_ENVIRONMENT_SYNC?.connected===true;}});
  if(root)root.KELO_CREATOR_TEST_BRIDGE=api;removeControls();return api;
}

if(typeof window!=='undefined'&&window.document)installCreatorTestBridge(window);
