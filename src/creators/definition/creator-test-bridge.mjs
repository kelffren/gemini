/* KELO-INDEX
 * area: CREATORS / RUNTIME TEST BRIDGE
 * owner: temporary Definition Studio test sessions
 * owns: reversible ENVIRONMENT tests and explicit local apply-world approval through the native runtime
 * does-not-own: server replication, published multiplayer map data or gameplay authority
 */
import { createEnvironmentPreviewModel } from './environment-live-preview.mjs';
import { installEnvironmentRuntime } from '../../environment/environment-runtime.mjs';

const BRIDGE_VERSION='kelo-creator-test-bridge-v3';
const RESTORE_ID='kelo-environment-runtime-test-restore';
const APPLY_ID='kelo-environment-runtime-test-apply';
const STYLE_ID='kelo-environment-runtime-test-controls';

export function createCreatorTestPlan(type,draft={}){
  const key=String(type||draft?.type||'').trim().toUpperCase();
  if(key!=='ENVIRONMENT')return Object.freeze({supported:false,type:key,mode:'event-only'});
  return Object.freeze({supported:true,type:key,mode:'native-environment-runtime',environment:createEnvironmentPreviewModel(draft)});
}

function installControls(doc){
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
#${RESTORE_ID},#${APPLY_ID}{position:fixed;bottom:max(82px,calc(env(safe-area-inset-bottom) + 70px));z-index:2147483000;min-height:42px;padding:0 12px;border-radius:14px;box-shadow:0 10px 30px rgba(0,0,0,.36);font:850 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;pointer-events:auto;-webkit-tap-highlight-color:transparent}
#${RESTORE_ID}{left:max(10px,env(safe-area-inset-left));border:1px solid rgba(232,201,111,.48);background:rgba(14,16,20,.92);color:#efd78f}
#${APPLY_ID}{right:max(10px,env(safe-area-inset-right));border:1px solid rgba(111,232,164,.5);background:rgba(12,34,24,.95);color:#9df0bd}
`;doc.head.append(style);
}

export function installCreatorTestBridge(root=globalThis){
  if(root?.KELO_CREATOR_TEST_BRIDGE?.version===BRIDGE_VERSION)return root.KELO_CREATOR_TEST_BRIDGE;
  const doc=root?.document,runtime=installEnvironmentRuntime(root);let active=null;

  function removeControls(){doc?.getElementById?.(RESTORE_ID)?.remove?.();doc?.getElementById?.(APPLY_ID)?.remove?.();}
  function restore(reason='manual'){
    removeControls();const result=runtime.restoreTemporary(reason);active=null;
    try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-restored',{detail:{type:'ENVIRONMENT',reason,mode:'native-runtime',state:result.state,source:'kelo-creator-test-bridge'}}));}catch{}
    return Object.freeze({...result,message:result.message||'Native environment restored'});
  }
  function approve(reason='button'){
    if(!active)return Object.freeze({ok:false,persistent:false,message:'No active environment test to apply'});
    const model=active.model,result=runtime.publish(model,{source:'creator-approved'});removeControls();active=null;
    try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-approved',{detail:{type:'ENVIRONMENT',reason,mode:'native-runtime',state:result.state,persistent:true,source:'kelo-creator-test-bridge'}}));}catch{}
    return Object.freeze({...result,message:`${result.message} · saved on this device`});
  }
  function mountControls(){
    if(!doc?.createElement)return Object.freeze({restore:null,apply:null});installControls(doc);removeControls();
    const restoreBtn=doc.createElement('button');restoreBtn.id=RESTORE_ID;restoreBtn.type='button';restoreBtn.textContent='↶ RESTORE';restoreBtn.setAttribute('aria-label','Restore environment before test');restoreBtn.addEventListener('click',()=>restore('button'));
    const applyBtn=doc.createElement('button');applyBtn.id=APPLY_ID;applyBtn.type='button';applyBtn.textContent='✓ APPLY WORLD';applyBtn.setAttribute('aria-label','Approve and keep this environment on this device');applyBtn.addEventListener('click',()=>approve('button'));
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

  const api=Object.freeze({version:BRIDGE_VERSION,run,restore,approve,get active(){return active?Object.freeze({type:'ENVIRONMENT',mode:active.mode,model:active.model,state:active.state,temporary:true,persistent:false}):null;}});
  if(root)root.KELO_CREATOR_TEST_BRIDGE=api;removeControls();return api;
}

if(typeof window!=='undefined'&&window.document)installCreatorTestBridge(window);
