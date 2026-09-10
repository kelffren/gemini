/* KELO-INDEX
 * area: CREATORS / SPRITE ABILITY RUNTIME EXTENSION
 * owner: Sprite Ability runtime-preview composition only
 * keys: MINIMIZE TEST IN GAME RUNTIME PREVIEW GENERATED ANIMATION AVATAR VISUAL V13
 * purpose: decorate the current Sprite Ability UI without replacing it; add explicit minimize and live generated-animation playback on the local actor
 * does-not-own: Sprite Ability editing, combat authority, damage resolution, publishing, server state
 * reuse: current Sprite Ability Builder + visual UI + AnimationPreviewAdapter + KeloAnimation + KeloAvatar
 */
import {openSpriteAbilityBuilder as openCore,closeSpriteAbilityBuilder as closeCore,getSpriteAbilityBuilder as getCore} from './sprite-ability-live-controller.mjs';
import {createAnimationPreviewAdapter} from '../animation/animation-preview-adapter.mjs';

let active=null;
const localActor=root=>{try{return typeof localPlayer!=='undefined'?localPlayer:(root.localPlayer||null);}catch{return root.localPlayer||null;}};
const toast=(root,msg)=>typeof root.showToast==='function'?root.showToast(msg):console.info('[Sprite Ability Runtime]',msg);

async function ensureBridge(root){
  if(root.KeloSpritesheetAvatarBridge?.install?.())return true;
  await import('../../visuals/spritesheet-avatar-bridge.js');
  if(!root.KeloSpritesheetAvatarBridge?.install?.())throw new Error('SPRITESHEET_AVATAR_BRIDGE_NOT_READY');
  return true;
}

export async function openSpriteAbilityBuilder(context={}){
  if(active?.workspaceRoot?.isConnected)return active;
  const root=context.root||globalThis,doc=root.document,projects=context.projects;
  if(!doc||!projects?.loadDraft)throw new Error('SPRITE_ABILITY_RUNTIME_EXTENSION_CONTEXT_REQUIRED');
  const core=await openCore(context),workspaceRoot=doc.getElementById('kelo-studio-workspace');
  if(!workspaceRoot)throw new Error('SPRITE_ABILITY_RUNTIME_EXTENSION_WORKSPACE_MISSING');

  let adapter=null,runtimeTest=null,observer=null,cleaning=false;
  const style=doc.createElement('style');style.dataset.keloSpriteAbilityRuntime='1';style.textContent=`
.sab-runtime-controls{display:none;position:fixed;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);z-index:2147483000;gap:7px;align-items:center;padding:8px;border:1px solid rgba(231,197,106,.55);border-radius:14px;background:rgba(8,13,15,.94);pointer-events:auto;box-shadow:0 12px 32px rgba(0,0,0,.45)}
.sab-runtime-controls.on{display:flex}.sab-runtime-controls strong{font:900 8px system-ui;letter-spacing:.12em;color:#f5df9c}.sab-runtime-controls button{min-height:34px;border:1px solid rgba(231,197,106,.35);border-radius:9px;background:#111b1d;color:#fff0b0;padding:0 10px;font:900 8px system-ui}
#kelo-studio-workspace.sab-runtime-test .ksw-main,#kelo-studio-workspace.sab-runtime-test .ksw-mobile-tabs,#kelo-studio-workspace.sab-runtime-test .ksw-timeline,#kelo-studio-workspace.sab-runtime-test .ksw-status,#kelo-studio-workspace.sab-runtime-test .sab-v-controls{display:none!important}
#kelo-studio-workspace.sab-runtime-test .ksw-top{left:50%;right:auto;width:min(360px,calc(100vw - 22px));transform:translateX(-50%);background:rgba(8,13,15,.88)}
#kelo-studio-workspace.sab-runtime-test .ksw-top [data-act="undo"],#kelo-studio-workspace.sab-runtime-test .ksw-top [data-act="redo"],#kelo-studio-workspace.sab-runtime-test .ksw-top [data-act="save"],#kelo-studio-workspace.sab-runtime-test .ksw-top [data-act="preview"]{display:none!important}
@media(max-width:760px){
  .sab-runtime-controls{width:calc(100vw - 28px);justify-content:center}.sab-runtime-controls strong{display:none}
  #kelo-studio-workspace.sab-visual-v13 [data-v-full][data-sab-minimize]{width:auto!important;min-width:78px!important;left:calc(50vw - 108px)!important;padding:0 9px!important;border-radius:9px!important;font-size:7px!important;font-weight:950!important;letter-spacing:.04em}
  #kelo-studio-workspace.sab-visual-v13.preview-focus [data-v-full][data-sab-minimize]{display:none!important}
}
`;doc.head.append(style);
  const controls=doc.createElement('div');controls.className='sab-runtime-controls';controls.innerHTML='<strong>LIVE ACTOR</strong><button type="button" data-sab-replay>▶ REPLAY</button><button type="button" data-sab-edit>EDIT BUILDER</button>';workspaceRoot.append(controls);

  function stopRuntimePreview(){try{adapter?.stop?.(runtimeTest?.animationDraft);}catch{}runtimeTest=null;workspaceRoot.classList.remove('sab-runtime-test');controls.classList.remove('on');}
  async function replayRuntime(){
    const ids=core.draft?.generated?.animationProjectId&&core.draft?.generated?.abilityProjectId?core.draft.generated:await core.generate();
    await ensureBridge(root);const animationDraft=await projects.loadDraft(ids.animationProjectId);if(!animationDraft)throw new Error('GENERATED_ANIMATION_DRAFT_MISSING');
    adapter=adapter||createAnimationPreviewAdapter(root);try{adapter.stop(animationDraft);}catch{}
    const actor=localActor(root);if(!actor)throw new Error('ANIMATION_PREVIEW_ACTOR_UNAVAILABLE');
    const animationId=await adapter.play(animationDraft,{direction:actor._face||'down',loop:false});if(!animationId)throw new Error('SPRITE_ABILITY_RUNTIME_PREVIEW_REJECTED');
    runtimeTest={animationId,animationProjectId:ids.animationProjectId,abilityProjectId:ids.abilityProjectId,animationDraft,startedAt:root.performance?.now?.()||Date.now()};
    workspaceRoot.classList.add('sab-runtime-test');controls.classList.add('on');toast(root,'LIVE: generated animation is playing on your character');return runtimeTest;
  }
  async function testInGame(){await core.generate();return replayRuntime();}
  function relabelMinimize(){
    for(const button of workspaceRoot.querySelectorAll('[data-act="preview"],[data-act="preview-mobile"]')){if(button.getAttribute('aria-pressed')!=='true'&&button.textContent.trim()!=='MINIMIZE')button.textContent='MINIMIZE';button.title=button.getAttribute('aria-pressed')==='true'?'Restore editor':'Minimize editor and focus preview';}
    const visual=workspaceRoot.querySelector('[data-v-full]');if(visual){visual.dataset.sabMinimize='1';visual.textContent='MINIMIZE';visual.title='Minimize editor and keep live preview visible';visual.setAttribute('aria-label','MINIMIZE');}
  }
  function injectRuntimeButton(){
    const canvas=workspaceRoot.querySelector('.ksw-viewport canvas');if(canvas)canvas.dataset.spriteAbilityPreview='1';
    const generate=[...workspaceRoot.querySelectorAll('.ksw-right button')].find(b=>/GENERATE/i.test(b.textContent||'')),host=generate?.parentElement;
    if(host&&!host.querySelector('[data-sab-runtime-test]')){const b=doc.createElement('button');b.type='button';b.dataset.sabRuntimeTest='1';b.textContent='▶ TEST IN GAME';b.onclick=()=>void testInGame().catch(error=>{console.error('[Sprite Ability Runtime]',error);toast(root,error?.message||String(error));});generate.insertAdjacentElement('afterend',b);}
  }
  function decorate(){if(!workspaceRoot.isConnected){cleanup(false);return;}relabelMinimize();injectRuntimeButton();}
  function cleanup(destroyCore=false){if(cleaning)return true;cleaning=true;stopRuntimePreview();observer?.disconnect();controls.remove();style.remove();if(active?.projectId===core.projectId)active=null;return destroyCore?core.destroy?.():true;}
  controls.querySelector('[data-sab-replay]').onclick=()=>void replayRuntime().catch(error=>{console.error('[Sprite Ability Runtime]',error);toast(root,error?.message||String(error));});
  controls.querySelector('[data-sab-edit]').onclick=()=>stopRuntimePreview();
  observer=new root.MutationObserver(()=>decorate());observer.observe(doc.body,{childList:true,subtree:true});decorate();

  active=Object.freeze({version:'sprite-ability-runtime-extension-v1.1.0-visual-v13',coreVersion:core.version,projectId:core.projectId,workspaceRoot,get draft(){return core.draft;},get runtimeTest(){return runtimeTest?{animationId:runtimeTest.animationId,animationProjectId:runtimeTest.animationProjectId,abilityProjectId:runtimeTest.abilityProjectId,startedAt:runtimeTest.startedAt}:null;},generate:()=>core.generate(),testInGame,replayRuntime,destroy:()=>cleanup(true),close:()=>cleanup(true)});
  try{root.KeloSpriteAbilityRuntimeExtension=Object.freeze({version:active.version,getActive:()=>active});}catch{}
  return active;
}

export async function closeSpriteAbilityBuilder(){if(active)return active.destroy();return closeCore();}
export function getSpriteAbilityBuilder(){return active||getCore();}
