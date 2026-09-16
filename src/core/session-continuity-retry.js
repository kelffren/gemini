/* KELO-INDEX
 * area: CORE / SESSION CONTINUITY SUPPORT
 * owner: KeloSessionContinuityRetry
 * keys: UPDATE DEFER RETRY SAFE MOMENT MOBILE ZERO POLL
 * purpose: re-attempt a staged verified update at the next user/lifecycle idle edge without timers or polling
 * performance: event-driven only; NO interval, NO timeout, NO RAF, NO game loop
 * do-not: NO storage writes, NO updater downloads, NO gameplay state ownership
 */
(function(root){
  'use strict';
  if(root.KeloSessionContinuityRetry)return;

  const VERSION='kelo-session-continuity-retry-v1.0.0';
  let checks=0,attempts=0,lastTrigger='boot',lastResult=null,lastError=null;

  function updaterReady(){
    try{
      const u=root.KeloUpdater,c=root.KeloSessionContinuity;
      if(!u?.getState||!c?.tryAutoApply)return false;
      const s=u.getState();
      return s?.status==='ready'||s?.stage?.status==='ready';
    }catch(_){return false;}
  }

  function retry(trigger){
    checks++;lastTrigger=String(trigger||'event');
    if(!updaterReady())return false;
    attempts++;
    try{
      Promise.resolve(root.KeloSessionContinuity.tryAutoApply(lastTrigger)).then(result=>{lastResult=!!result;lastError=null;}).catch(error=>{lastResult=false;lastError=String(error&&error.message||error);});
      return true;
    }catch(error){lastResult=false;lastError=String(error&&error.message||error);return false;}
  }

  function settled(event){if(event&&event.isTrusted===false)return;retry('interaction-settled');}

  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')retry('visible');},{passive:true});
  root.addEventListener('online',()=>retry('online'),{passive:true});
  root.addEventListener('pointerup',settled,{passive:true});
  root.addEventListener('pointercancel',settled,{passive:true});
  root.addEventListener('touchend',settled,{passive:true});
  root.addEventListener('touchcancel',settled,{passive:true});
  root.addEventListener('keyup',settled,{passive:true});
  root.addEventListener('kelo:network-priority',event=>{
    const d=event&&event.detail||{},priority=String(d.priority||'').toLowerCase();
    if(d.busy===false||priority==='background'||priority==='idle')retry('network-idle');
  });
  root.addEventListener('kelo:update:staged',()=>retry('staged'));
  root.addEventListener('kelo:update:connected',()=>retry('connected'));

  function getState(){return Object.freeze({version:VERSION,checks,attempts,lastTrigger,lastResult,lastError,timers:0,intervals:0,raf:0,gameLoop:false,storageWrites:0});}

  root.KeloSessionContinuityRetry=Object.freeze({version:VERSION,retry,getState});
  root.KELO_SESSION_CONTINUITY_RETRY_AUDIT=Object.freeze({version:VERSION,installed:true,eventDriven:true,timers:0,intervals:0,raf:0,gameLoop:false,storageWrites:0});
})(typeof globalThis!=='undefined'?globalThis:window);
