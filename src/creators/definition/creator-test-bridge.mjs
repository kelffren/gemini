/* KELO-INDEX
 * area: CREATORS / RUNTIME TEST BRIDGE
 * owner: temporary Definition Studio test sessions
 * owns: reversible ENVIRONMENT tests through the native world environment runtime
 * does-not-own: server replication, published map data or gameplay authority
 */
import { createEnvironmentPreviewModel } from './environment-live-preview.mjs';
import { installEnvironmentRuntime } from '../../environment/environment-runtime.mjs';

const BRIDGE_VERSION='kelo-creator-test-bridge-v2';
const RESTORE_ID='kelo-environment-runtime-test-restore';
const STYLE_ID='kelo-environment-runtime-test-controls';

export function createCreatorTestPlan(type,draft={}){
  const key=String(type||draft?.type||'').trim().toUpperCase();
  if(key!=='ENVIRONMENT')return Object.freeze({supported:false,type:key,mode:'event-only'});
  return Object.freeze({supported:true,type:key,mode:'native-environment-runtime',environment:createEnvironmentPreviewModel(draft)});
}

function installControls(doc){
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
#${RESTORE_ID}{position:fixed;right:max(10px,env(safe-area-inset-right));bottom:max(82px,calc(env(safe-area-inset-bottom) + 70px));z-index:2147483000;min-width:104px;min-height:42px;padding:0 12px;border:1px solid rgba(232,201,111,.48);border-radius:14px;background:rgba(14,16,20,.92);box-shadow:0 10px 30px rgba(0,0,0,.36);color:#efd78f;font:850 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;pointer-events:auto;-webkit-tap-highlight-color:transparent}
`;doc.head.append(style);
}

export function installCreatorTestBridge(root=globalThis){
  if(root?.KELO_CREATOR_TEST_BRIDGE?.version===BRIDGE_VERSION)return root.KELO_CREATOR_TEST_BRIDGE;
  const doc=root?.document,runtime=installEnvironmentRuntime(root);let active=null;

  function removeRestore(){doc?.getElementById?.(RESTORE_ID)?.remove?.();}
  function restore(reason='manual'){
    removeRestore();const result=runtime.restoreTemporary(reason);active=null;
    try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-restored',{detail:{type:'ENVIRONMENT',reason,mode:'native-runtime',state:result.state,source:'kelo-creator-test-bridge'}}));}catch{}
    return Object.freeze({...result,message:result.message||'Native environment restored'});
  }
  function restoreButton(){
    if(!doc?.createElement)return null;installControls(doc);removeRestore();
    const button=doc.createElement('button');button.id=RESTORE_ID;button.type='button';button.textContent='↶ RESTORE';button.setAttribute('aria-label','Restore environment before test');button.addEventListener('click',()=>restore('button'));doc.body.append(button);return button;
  }
  function mountEnvironment(draft){
    const model=createEnvironmentPreviewModel(draft),result=runtime.applyTemporary(model,{source:'kelo-creator-test-bridge'}),button=restoreButton();active={mode:'native-runtime',model,state:result.state,button};
    const detail=Object.freeze({type:'ENVIRONMENT',draft,model,state:result.state,temporary:true,persistent:false,mode:'native-runtime',source:'kelo-creator-test-bridge'});
    try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-applied',{detail}));}catch{}
    return Object.freeze({...result,supported:true,temporary:true,persistent:false,message:`${result.message} · RESTORE available`,model});
  }
  async function run(type,draft={}){
    const plan=createCreatorTestPlan(type,draft);if(!plan.supported)return Object.freeze({ok:true,supported:false,temporary:false,message:`${plan.type||'Definition'} test draft emitted`});return mountEnvironment(draft);
  }

  const api=Object.freeze({version:BRIDGE_VERSION,run,restore,get active(){return active?Object.freeze({type:'ENVIRONMENT',mode:active.mode,model:active.model,state:active.state,temporary:true,persistent:false}):null;}});
  if(root)root.KELO_CREATOR_TEST_BRIDGE=api;removeRestore();return api;
}

if(typeof window!=='undefined'&&window.document)installCreatorTestBridge(window);
