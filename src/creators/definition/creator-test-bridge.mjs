/* KELO-INDEX
 * area: CREATORS / RUNTIME TEST BRIDGE
 * owner: temporary Definition Studio test sessions
 * owns: reversible ENVIRONMENT tests, server-backed apply-world approval, visual revision comparison/history and safe rollback
 * does-not-own: publish authorization, server storage, map versioning or gameplay authority
 */
import { createEnvironmentPreviewModel, renderEnvironmentLivePreview } from './environment-live-preview.mjs';
import { installEnvironmentRuntime } from '../../environment/environment-runtime.mjs';

const BRIDGE_VERSION='kelo-creator-test-bridge-v9';
const RESTORE_ID='kelo-environment-runtime-test-restore';
const HISTORY_ID='kelo-environment-runtime-world-history';
const APPLY_ID='kelo-environment-runtime-test-apply';
const UNDO_ID='kelo-environment-runtime-world-undo';
const PANEL_ID='kelo-environment-runtime-history-panel';
const STYLE_ID='kelo-environment-runtime-test-controls';
const HISTORY_CACHE_MS=15000;
const COMPARE_FIELDS=Object.freeze([
  ['biome','BIOME'],['weather','WEATHER'],['timeOfDay','TIME'],['ambientDensity','DENSITY'],['musicMood','MOOD'],['accent','ACCENT']
]);

export function createCreatorTestPlan(type,draft={}){
  const key=String(type||draft?.type||'').trim().toUpperCase();
  if(key!=='ENVIRONMENT')return Object.freeze({supported:false,type:key,mode:'event-only'});
  return Object.freeze({supported:true,type:key,mode:'native-environment-runtime',environment:createEnvironmentPreviewModel(draft)});
}

export function historyEntryToPreviewDraft(entry={}){
  const state=entry?.state&&typeof entry.state==='object'?entry.state:{};
  return Object.freeze({fields:Object.freeze({
    biome:state.biome||'plaza',weather:state.weather||'clear',timeOfDay:state.timeOfDay||'day',ambientDensity:state.ambientDensity??50,musicMood:state.musicMood||'calm',accent:state.accent||'#c9a55f',notes:''
  })});
}

export function createHistoryComparisonModel(currentState={},selectedEntry={}){
  const currentDraft=historyEntryToPreviewDraft({state:currentState}),selectedDraft=historyEntryToPreviewDraft(selectedEntry),current=currentDraft.fields,selected=selectedDraft.fields;
  const differences=Object.freeze(COMPARE_FIELDS.flatMap(([key,label])=>String(current[key])===String(selected[key])?[]:[Object.freeze({key,label,current:current[key],selected:selected[key]})]));
  return Object.freeze({currentDraft,selectedDraft,differences,changed:differences.length>0});
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
#${PANEL_ID}{position:fixed;z-index:2147483100;left:50%;bottom:max(136px,calc(env(safe-area-inset-bottom) + 124px));transform:translateX(-50%);width:min(94vw,560px);max-height:min(70vh,650px);overflow:auto;overscroll-behavior:contain;padding:12px;border:1px solid rgba(125,178,235,.28);border-radius:18px;background:rgba(7,11,17,.97);box-shadow:0 24px 70px rgba(0,0,0,.58);color:#e9eef5;font:700 10px/1.35 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;pointer-events:auto;-webkit-overflow-scrolling:touch}
#${PANEL_ID} .kewh-head{position:sticky;top:-12px;z-index:4;margin:-12px -12px 10px;padding:11px 12px;background:rgba(7,11,17,.985);border-bottom:1px solid rgba(255,255,255,.07);display:flex;align-items:center;gap:8px}
#${PANEL_ID} .kewh-head strong{font-size:11px;letter-spacing:.05em}#${PANEL_ID} .kewh-head small{margin-left:auto;color:#7f8b99;font-size:8px}#${PANEL_ID} .kewh-close{border:0;background:transparent;color:#c8d0da;font-size:19px;line-height:1;padding:5px}
#${PANEL_ID} .kewh-stage{margin-bottom:10px;padding:9px;border:1px solid rgba(125,178,235,.22);border-radius:14px;background:rgba(13,20,29,.82)}#${PANEL_ID} .kewh-stage-top{display:flex;align-items:center;gap:8px;margin-bottom:7px}#${PANEL_ID} .kewh-stage-top b{font-size:10px}#${PANEL_ID} .kewh-stage-top span{margin-left:auto;color:#8ea4b8;font-size:8px}#${PANEL_ID} .kewh-readonly{margin:7px 0 0;padding:6px 8px;border-radius:8px;background:rgba(75,135,190,.08);color:#a8d7ff;font-size:8px;text-align:center;letter-spacing:.05em}#${PANEL_ID} .kewh-big-preview{height:190px;border-radius:11px;overflow:hidden;border:1px solid rgba(255,255,255,.08)}#${PANEL_ID} .kewh-big-preview .kds-env-scene{min-height:190px}
#${PANEL_ID} .kewh-compare{--split:50%;position:relative;height:190px;overflow:hidden;border-radius:11px;border:1px solid rgba(255,255,255,.08);background:#05080c;touch-action:pan-y}#${PANEL_ID} .kewh-compare-layer{position:absolute;inset:0;overflow:hidden}#${PANEL_ID} .kewh-compare-layer .kds-env-scene{min-height:190px}#${PANEL_ID} .kewh-compare-old{clip-path:inset(0 0 0 var(--split))}#${PANEL_ID} .kewh-divider{position:absolute;z-index:3;top:0;bottom:0;left:var(--split);width:2px;transform:translateX(-1px);background:#fff;box-shadow:0 0 0 1px rgba(0,0,0,.25),0 0 12px rgba(255,255,255,.5);pointer-events:none}#${PANEL_ID} .kewh-divider:after{content:'↔';position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(7,11,17,.9);border:1px solid rgba(255,255,255,.45);font-size:13px}#${PANEL_ID} .kewh-side-label{position:absolute;z-index:4;top:7px;padding:4px 6px;border-radius:999px;background:rgba(5,8,12,.72);border:1px solid rgba(255,255,255,.12);font:850 7px/1 system-ui;letter-spacing:.06em;pointer-events:none}#${PANEL_ID} .kewh-side-label.current{left:7px;color:#9df0bd}#${PANEL_ID} .kewh-side-label.old{right:7px;color:#a9d6ff}#${PANEL_ID} .kewh-scrub{width:100%;margin:8px 0 0;accent-color:#a9d6ff}#${PANEL_ID} .kewh-diffs{display:flex;gap:5px;overflow-x:auto;padding:7px 0 1px;scrollbar-width:none}#${PANEL_ID} .kewh-diffs::-webkit-scrollbar{display:none}#${PANEL_ID} .kewh-diff{flex:0 0 auto;padding:5px 7px;border-radius:8px;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.075);color:#bac8d7;font-size:7px;white-space:nowrap}#${PANEL_ID} .kewh-diff b{color:#e5edf5;margin-right:3px}#${PANEL_ID} .kewh-diff.same{color:#82e2ad;border-color:rgba(111,232,164,.18);background:rgba(12,34,24,.35)}
#${PANEL_ID} .kewh-stage-actions{display:grid;grid-template-columns:1fr;gap:6px;margin-top:8px}#${PANEL_ID} .kewh-rollback{min-height:39px;border-radius:10px;border:1px solid rgba(232,201,111,.32);background:rgba(38,28,12,.78);color:#efd78f;font:850 9px/1 system-ui}#${PANEL_ID} .kewh-rollback.confirm{border-color:rgba(245,132,102,.5);background:rgba(56,20,14,.86);color:#ffb09c}#${PANEL_ID} .kewh-rollback[disabled]{opacity:.65}
#${PANEL_ID} .kewh-row{display:grid;grid-template-columns:92px minmax(0,1fr) auto;gap:8px;align-items:center;padding:9px 0;border-bottom:1px solid rgba(255,255,255,.055)}#${PANEL_ID} .kewh-row:last-child{border-bottom:0}#${PANEL_ID} .kewh-row.viewing{background:linear-gradient(90deg,rgba(77,142,198,.08),transparent);margin:0 -6px;padding-left:6px;padding-right:6px;border-radius:10px}
#${PANEL_ID} .kewh-thumb{height:58px;border-radius:8px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#05080c}#${PANEL_ID} .kewh-thumb .kds-env-scene{min-height:58px}#${PANEL_ID} .kewh-thumb .kds-env-meta{display:none}#${PANEL_ID} .kewh-thumb .kds-env-celestial{width:12px;height:12px}#${PANEL_ID} .kewh-thumb .kds-env-feature{opacity:.72}
#${PANEL_ID} .kewh-meta{min-width:0}#${PANEL_ID} .kewh-meta b{display:block;color:#dce8f3;font-size:10px}#${PANEL_ID} .kewh-meta small{display:block;margin-top:3px;color:#7f8b99;font-size:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}#${PANEL_ID} .kewh-meta time{display:block;margin-top:3px;color:#586575;font-size:7px}
#${PANEL_ID} .kewh-action{min-width:72px;min-height:34px;padding:0 8px;border-radius:10px;border:1px solid rgba(125,178,235,.26);background:rgba(12,25,40,.72);color:#a9d6ff;font:850 8px/1 system-ui}#${PANEL_ID} .kewh-current{color:#82e2ad;border-color:rgba(111,232,164,.25);background:rgba(12,34,24,.5)}#${PANEL_ID} .kewh-error{padding:10px;border-radius:10px;color:#ffb0b0;background:rgba(255,100,100,.07)}
@media(max-width:430px){#${RESTORE_ID},#${HISTORY_ID},#${APPLY_ID}{padding:0 8px;font-size:9px;min-height:40px}#${PANEL_ID}{width:96vw;max-height:72vh}#${PANEL_ID} .kewh-row{grid-template-columns:78px minmax(0,1fr) 66px}#${PANEL_ID} .kewh-thumb{height:52px}#${PANEL_ID} .kewh-big-preview,#${PANEL_ID} .kewh-compare{height:170px}#${PANEL_ID} .kewh-big-preview .kds-env-scene,#${PANEL_ID} .kewh-compare-layer .kds-env-scene{min-height:170px}}
`;doc.head.append(style);
}

function formatHistoryTime(value){
  if(!value)return 'time unknown';
  try{return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',hour:'numeric',minute:'2-digit'}).format(new Date(value));}catch{return String(value);}
}
function notify(root,message){if(typeof root.showToast==='function')root.showToast(message);else console.info('[Kelo Environment History]',message);}

export function installCreatorTestBridge(root=globalThis,{contentSession=null}={}){
  if(root?.KELO_CREATOR_TEST_BRIDGE?.version===BRIDGE_VERSION){root.KELO_CREATOR_TEST_BRIDGE.configure?.({contentSession});return root.KELO_CREATOR_TEST_BRIDGE;}
  const doc=root?.document,runtime=installEnvironmentRuntime(root);let active=null,session=contentSession,publishing=false,lastPublished=null,historyConfirmRevision=0,historyPreviewRevision=0,historyCache=[],historyCacheAt=0;

  function configure({contentSession:nextSession=null}={}){if(nextSession)session=nextSession;return api;}
  function token(){const value=String(session?.accessToken||'').trim();if(!value)throw new Error('AUTH_REQUIRED');return value;}
  function removePreviewControls(){doc?.getElementById?.(RESTORE_ID)?.remove?.();doc?.getElementById?.(HISTORY_ID)?.remove?.();doc?.getElementById?.(APPLY_ID)?.remove?.();removeHistoryPanel();}
  function removeUndoControl(){doc?.getElementById?.(UNDO_ID)?.remove?.();}
  function removeHistoryPanel({resetSelection=true}={}){doc?.getElementById?.(PANEL_ID)?.remove?.();if(resetSelection){historyConfirmRevision=0;historyPreviewRevision=0;}}
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
  async function loadHistory(force=false){
    if(!force&&historyCache.length&&Date.now()-historyCacheAt<HISTORY_CACHE_MS)return historyCache;
    historyCache=await history(10);historyCacheAt=Date.now();return historyCache;
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
      historyCache=[];historyCacheAt=0;removePreviewControls();active=null;lastPublished=Object.freeze({targetRevision:beforeRevision,publishedRevision:envelope.revision,state:result.state,publishedAt:Date.now(),kind:'rollback'});mountUndoControl();
      const detail=Object.freeze({type:'ENVIRONMENT',reason,mode:'native-runtime',state:result.state,revision:envelope.revision,restoredRevision:target,previousRevision:beforeRevision,persistent:true,synchronized:true,source:'kelo-creator-test-bridge'});
      try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-world-history-rollback',{detail}));}catch{}
      return Object.freeze({...result,rolledBack:true,revision:envelope.revision,restoredRevision:target,previousRevision:beforeRevision,synchronized:true,undoAvailable:true,message:`WORLD ROLLBACK · restored revision ${target} for all players`});
    }catch(error){
      const message=String(error?.message||error),conflict=message.includes('ENVIRONMENT_REVISION_CONFLICT');
      try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-world-history-rollback-failed',{detail:{type:'ENVIRONMENT',reason,error:message,conflict,source:'kelo-creator-test-bridge'}}));}catch{}
      return Object.freeze({ok:false,rolledBack:false,conflict,error:message,message:conflict?'Rollback blocked safely because the world changed while you were choosing a revision':message==='AUTH_REQUIRED'?'Sign in with an admin or official account before opening world history':`Could not rollback world environment · ${message}`});
    }finally{publishing=false;}
  }
  function renderComparison(doc,currentState,selected,currentRevision){
    const comparison=createHistoryComparisonModel(currentState,selected),wrap=doc.createElement('div');wrap.className='kewh-compare';wrap.style.setProperty('--split','50%');
    const currentLayer=doc.createElement('div');currentLayer.className='kewh-compare-layer kewh-compare-current';currentLayer.append(renderEnvironmentLivePreview({doc,draft:comparison.currentDraft}));
    const oldLayer=doc.createElement('div');oldLayer.className='kewh-compare-layer kewh-compare-old';oldLayer.append(renderEnvironmentLivePreview({doc,draft:comparison.selectedDraft}));
    const divider=doc.createElement('div');divider.className='kewh-divider';const currentLabel=doc.createElement('span');currentLabel.className='kewh-side-label current';currentLabel.textContent=`CURRENT r${currentRevision}`;const oldLabel=doc.createElement('span');oldLabel.className='kewh-side-label old';oldLabel.textContent=`r${selected.revision}`;wrap.append(currentLayer,oldLayer,divider,currentLabel,oldLabel);
    const scrub=doc.createElement('input');scrub.type='range';scrub.min='5';scrub.max='95';scrub.value='50';scrub.className='kewh-scrub';scrub.setAttribute('aria-label',`Compare current world revision ${currentRevision} with revision ${selected.revision}`);scrub.oninput=()=>wrap.style.setProperty('--split',`${scrub.value}%`);
    const diffs=doc.createElement('div');diffs.className='kewh-diffs';
    if(!comparison.differences.length){const same=doc.createElement('span');same.className='kewh-diff same';same.textContent='NO ENVIRONMENT FIELD CHANGES';diffs.append(same);}else for(const diff of comparison.differences){const chip=doc.createElement('span');chip.className='kewh-diff';const label=doc.createElement('b');label.textContent=diff.label;chip.append(label,doc.createTextNode(` ${diff.current} → ${diff.selected}`));diffs.append(chip);}
    return Object.freeze({wrap,scrub,diffs,comparison});
  }
  async function renderHistoryPanel({refresh=false}={}){
    if(!doc?.createElement)return null;installControls(doc);removeHistoryPanel({resetSelection:false});
    const panel=doc.createElement('section');panel.id=PANEL_ID;panel.setAttribute('role','dialog');panel.setAttribute('aria-label','World environment revision history');
    const head=doc.createElement('div');head.className='kewh-head';const title=doc.createElement('strong');title.textContent='WORLD HISTORY';const live=doc.createElement('small');live.textContent='LOADING…';const close=doc.createElement('button');close.type='button';close.className='kewh-close';close.textContent='×';close.setAttribute('aria-label','Close world history');close.onclick=()=>removeHistoryPanel();head.append(title,live,close);panel.append(head);doc.body.append(panel);
    try{
      const entries=await loadHistory(refresh),sync=root?.KELO_WORLD_ENVIRONMENT_SYNC,current=sync?.revision||runtime.revision||0,currentState=sync?.envelope?.state||runtime.approved;live.textContent=`WORLD r${current} · ${sync?.connected?'LIVE':'SYNCING'}`;
      if(!entries.length){const empty=doc.createElement('div');empty.className='kewh-error';empty.textContent='No environment revisions yet';panel.append(empty);return panel;}
      if(!historyPreviewRevision||!entries.some(entry=>entry.revision===historyPreviewRevision))historyPreviewRevision=(entries.find(entry=>entry.revision===current)||entries[0]).revision;
      const selected=entries.find(entry=>entry.revision===historyPreviewRevision)||entries[0];
      const stage=doc.createElement('section');stage.className='kewh-stage';const stageTop=doc.createElement('div');stageTop.className='kewh-stage-top';const stageTitle=doc.createElement('b');stageTitle.textContent=selected.revision===current?`CURRENT r${current}`:`COMPARE r${current} ↔ r${selected.revision}`;const stageMeta=doc.createElement('span');stageMeta.textContent=`${String(selected.action||'publish').toUpperCase()} · ${formatHistoryTime(selected.publishedAt)}`;stageTop.append(stageTitle,stageMeta);
      let visual,diffs=null;
      if(selected.revision===current){visual=doc.createElement('div');visual.className='kewh-big-preview';visual.append(renderEnvironmentLivePreview({doc,draft:historyEntryToPreviewDraft({state:currentState})}));}
      else{const comparison=renderComparison(doc,currentState,selected,current);visual=comparison.wrap;diffs=comparison.diffs;}
      const readonly=doc.createElement('div');readonly.className='kewh-readonly';readonly.textContent=selected.revision===current?'CURRENT WORLD · READ ONLY':'DRAG TO COMPARE · WORLD DOES NOT CHANGE UNTIL ROLLBACK';const stageActions=doc.createElement('div');stageActions.className='kewh-stage-actions';const rollback=doc.createElement('button');rollback.type='button';rollback.className='kewh-rollback';
      if(selected.revision===current){rollback.textContent='CURRENT WORLD';rollback.disabled=true;}else{const confirming=historyConfirmRevision===selected.revision;rollback.textContent=confirming?`CONFIRM ROLLBACK TO r${selected.revision}`:`ROLLBACK WORLD TO r${selected.revision}`;if(confirming)rollback.classList.add('confirm');rollback.onclick=async()=>{if(historyConfirmRevision!==selected.revision){historyConfirmRevision=selected.revision;await renderHistoryPanel();return;}rollback.disabled=true;rollback.textContent='ROLLING BACK WORLD…';const result=await rollbackRevision(selected.revision,'history-preview');notify(root,result.message);if(!result.ok){historyConfirmRevision=0;await renderHistoryPanel({refresh:true});}};}
      stageActions.append(rollback);stage.append(stageTop,visual);if(selected.revision!==current){const activeCompare=visual;const scrub=doc.createElement('input');scrub.type='range';scrub.min='5';scrub.max='95';scrub.value='50';scrub.className='kewh-scrub';scrub.setAttribute('aria-label',`Compare current world revision ${current} with revision ${selected.revision}`);scrub.oninput=()=>activeCompare.style.setProperty('--split',`${scrub.value}%`);stage.append(scrub);if(diffs)stage.append(diffs);}stage.append(readonly,stageActions);panel.append(stage);
      for(const entry of entries){
        const row=doc.createElement('div');row.className='kewh-row';if(entry.revision===selected.revision)row.classList.add('viewing');const thumb=doc.createElement('div');thumb.className='kewh-thumb';thumb.append(renderEnvironmentLivePreview({doc,draft:historyEntryToPreviewDraft(entry)}));const meta=doc.createElement('div');meta.className='kewh-meta';const b=doc.createElement('b');b.textContent=`r${entry.revision} · ${String(entry.action||'publish').toUpperCase()}`;const small=doc.createElement('small');small.textContent=`${entry.state.biome} · ${entry.state.weather} · ${entry.state.timeOfDay} · density ${entry.state.ambientDensity}`;const time=doc.createElement('time');time.textContent=formatHistoryTime(entry.publishedAt);meta.append(b,small,time);const action=doc.createElement('button');action.type='button';action.className='kewh-action';
        if(entry.revision===selected.revision){action.textContent=entry.revision===current?'CURRENT':'COMPARING';if(entry.revision===current)action.classList.add('kewh-current');action.disabled=true;}else{action.textContent=entry.revision===current?'CURRENT':'COMPARE';action.onclick=async()=>{historyPreviewRevision=entry.revision;historyConfirmRevision=0;await renderHistoryPanel();};if(entry.revision===current)action.classList.add('kewh-current');}
        thumb.setAttribute('role','button');thumb.tabIndex=0;thumb.setAttribute('aria-label',`Compare world environment revision ${entry.revision}`);thumb.onclick=()=>{if(entry.revision!==historyPreviewRevision){historyPreviewRevision=entry.revision;historyConfirmRevision=0;void renderHistoryPanel();}};thumb.onkeydown=event=>{if((event.key==='Enter'||event.key===' ')&&entry.revision!==historyPreviewRevision){event.preventDefault();historyPreviewRevision=entry.revision;historyConfirmRevision=0;void renderHistoryPanel();}};
        row.append(thumb,meta,action);panel.append(row);
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
      historyCache=[];historyCacheAt=0;removeUndoControl();lastPublished=null;
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
      historyCache=[];historyCacheAt=0;removePreviewControls();active=null;lastPublished=Object.freeze({targetRevision:beforeRevision,publishedRevision:envelope.revision,state:result.state,publishedAt:Date.now(),kind:'publish'});mountUndoControl();
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
    const historyBtn=doc.createElement('button');historyBtn.id=HISTORY_ID;historyBtn.type='button';historyBtn.textContent=`HISTORY r${root?.KELO_WORLD_ENVIRONMENT_SYNC?.revision||runtime.revision||'—'}`;historyBtn.setAttribute('aria-label','Open shared world environment revision history and compare revisions');historyBtn.addEventListener('click',()=>void renderHistoryPanel({refresh:true}));
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

  const api=Object.freeze({version:BRIDGE_VERSION,configure,run,restore,approve,history,rollbackRevision,rollbackLast,openHistory:()=>renderHistoryPanel({refresh:true}),get active(){return active?Object.freeze({type:'ENVIRONMENT',mode:active.mode,model:active.model,state:active.state,temporary:true,persistent:false,publishing}):null;},get lastPublished(){return lastPublished;},get worldRevision(){return root?.KELO_WORLD_ENVIRONMENT_SYNC?.revision||runtime.revision||0;},get worldConnected(){return root?.KELO_WORLD_ENVIRONMENT_SYNC?.connected===true;},get historyPreviewRevision(){return historyPreviewRevision;}});
  if(root)root.KELO_CREATOR_TEST_BRIDGE=api;removeControls();return api;
}

if(typeof window!=='undefined'&&window.document)installCreatorTestBridge(window);
