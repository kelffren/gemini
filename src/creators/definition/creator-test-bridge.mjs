/* KELO-INDEX
 * area: CREATORS / RUNTIME TEST BRIDGE
 * owner: temporary Definition Studio test sessions
 * owns: reversible local-only ENVIRONMENT test overlay on the live game canvas
 * does-not-own: world persistence, server state, published map data or gameplay authority
 */
import { createEnvironmentPreviewModel } from './environment-live-preview.mjs';

const BRIDGE_VERSION='kelo-creator-test-bridge-v1';
const LAYER_ID='kelo-environment-runtime-test-layer';
const RESTORE_ID='kelo-environment-runtime-test-restore';
const STYLE_ID='kelo-environment-runtime-test-style';
const clamp=(value,min,max)=>Math.max(min,Math.min(max,Number(value)||0));

export function createCreatorTestPlan(type,draft={}){
  const key=String(type||draft?.type||'').trim().toUpperCase();
  if(key!=='ENVIRONMENT')return Object.freeze({supported:false,type:key,mode:'event-only'});
  const environment=createEnvironmentPreviewModel(draft);
  return Object.freeze({supported:true,type:key,mode:'temporary-local-overlay',environment});
}

function installStyle(doc){
  if(doc.getElementById(STYLE_ID))return;
  const style=doc.createElement('style');style.id=STYLE_ID;style.textContent=`
#${LAYER_ID}{position:fixed;overflow:hidden;pointer-events:none;z-index:6;isolation:isolate;contain:layout paint style;transform:translateZ(0)}
#${LAYER_ID} .kcrt-tint,#${LAYER_ID} .kcrt-accent,#${LAYER_ID} .kcrt-fog,#${LAYER_ID} .kcrt-weather,#${LAYER_ID} .kcrt-flash,#${LAYER_ID} .kcrt-vignette{position:absolute;inset:0;pointer-events:none}
#${LAYER_ID} .kcrt-tint{background:var(--kcrt-time-tint);transition:background .18s linear}
#${LAYER_ID} .kcrt-accent{background:linear-gradient(180deg,transparent 10%,var(--kcrt-accent) 100%);opacity:.7;mix-blend-mode:screen}
#${LAYER_ID} .kcrt-fog{display:none;opacity:var(--kcrt-density);background:radial-gradient(ellipse at 14% 68%,rgba(229,237,239,.42),transparent 44%),radial-gradient(ellipse at 73% 52%,rgba(225,234,237,.34),transparent 46%),linear-gradient(180deg,rgba(220,230,235,.05),rgba(220,230,235,.16));animation:kcrt-drift 7s ease-in-out infinite alternate;will-change:transform}
#${LAYER_ID}[data-weather="fog"] .kcrt-fog{display:block}
#${LAYER_ID} .kcrt-weather{overflow:hidden}
#${LAYER_ID} .kcrt-particle{position:absolute;left:var(--x);top:-28px;animation:kcrt-fall var(--speed) linear infinite;animation-delay:var(--delay);will-change:transform}
#${LAYER_ID}[data-weather="rain"] .kcrt-particle,#${LAYER_ID}[data-weather="storm"] .kcrt-particle{width:1px;height:24px;background:rgba(202,224,246,.7);box-shadow:0 0 1px rgba(255,255,255,.35);transform:rotate(12deg)}
#${LAYER_ID}[data-weather="snow"] .kcrt-particle{width:6px;height:6px;border-radius:50%;background:rgba(248,252,255,.92);box-shadow:0 0 4px rgba(255,255,255,.35)}
#${LAYER_ID} .kcrt-flash{display:none;background:#f4f8ff;opacity:0;animation:kcrt-flash 4.8s steps(1,end) infinite}
#${LAYER_ID}[data-weather="storm"] .kcrt-flash{display:block}
#${LAYER_ID} .kcrt-vignette{background:radial-gradient(circle at 50% 44%,transparent 30%,rgba(0,0,0,.34) 100%);opacity:var(--kcrt-vignette)}
#${LAYER_ID} .kcrt-badge{position:absolute;left:10px;top:max(10px,env(safe-area-inset-top));max-width:min(72%,320px);padding:6px 9px;border:1px solid rgba(255,220,135,.34);border-radius:999px;background:rgba(7,10,14,.64);backdrop-filter:blur(7px);color:#f1d78e;font:800 8px/1.1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.06em;text-transform:uppercase;text-shadow:0 1px 2px #000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#${RESTORE_ID}{position:fixed;right:max(10px,env(safe-area-inset-right));bottom:max(82px,calc(env(safe-area-inset-bottom) + 70px));z-index:2147483000;min-width:92px;min-height:42px;padding:0 12px;border:1px solid rgba(232,201,111,.48);border-radius:14px;background:rgba(14,16,20,.92);box-shadow:0 10px 30px rgba(0,0,0,.36);color:#efd78f;font:850 10px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.04em;pointer-events:auto;-webkit-tap-highlight-color:transparent}
@keyframes kcrt-fall{to{transform:translate3d(18px,115vh,0)}}
@keyframes kcrt-drift{from{transform:translate3d(-4%,0,0)}to{transform:translate3d(4%,0,0)}}
@keyframes kcrt-flash{0%,89%,92%,100%{opacity:0}90%,91%{opacity:.22}}
@media(prefers-reduced-motion:reduce){#${LAYER_ID} .kcrt-particle,#${LAYER_ID} .kcrt-fog,#${LAYER_ID} .kcrt-flash{animation:none!important}#${LAYER_ID} .kcrt-particle{display:none}}
`;doc.head.append(style);
}

function findGameCanvas(doc){
  const owned=doc.getElementById('game-canvas');if(owned)return owned;
  const candidates=Array.from(doc.querySelectorAll?.('canvas')||[]).filter(node=>!node.closest?.('.kds-card,[data-kelo-definition-studio]'));
  return candidates.sort((a,b)=>(b.clientWidth*b.clientHeight)-(a.clientWidth*a.clientHeight))[0]||null;
}

function timeTint(timeOfDay,density){
  const strength=.7+.3*(clamp(density,0,100)/100);
  const alpha=value=>Math.min(.58,value*strength).toFixed(3);
  if(timeOfDay==='night')return `rgba(2,9,28,${alpha(.48)})`;
  if(timeOfDay==='sunset')return `rgba(166,61,45,${alpha(.22)})`;
  if(timeOfDay==='dawn')return `rgba(90,70,135,${alpha(.18)})`;
  return `rgba(72,142,205,${alpha(.07)})`;
}

export function installCreatorTestBridge(root=globalThis){
  if(root?.KELO_CREATOR_TEST_BRIDGE?.version===BRIDGE_VERSION)return root.KELO_CREATOR_TEST_BRIDGE;
  const doc=root?.document;let active=null;

  function cleanupOrphans(){
    doc?.getElementById?.(LAYER_ID)?.remove?.();doc?.getElementById?.(RESTORE_ID)?.remove?.();
  }

  function restore(reason='manual'){
    if(active){
      try{active.resizeObserver?.disconnect?.();}catch{}
      for(const [target,event,handler] of active.listeners||[])try{target.removeEventListener(event,handler);}catch{}
      try{active.layer?.remove?.();}catch{}try{active.button?.remove?.();}catch{}
      active=null;
    }else cleanupOrphans();
    try{root?.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-restored',{detail:{type:'ENVIRONMENT',reason,source:'kelo-creator-test-bridge'}}));}catch{}
    return Object.freeze({ok:true,restored:true,message:'Environment test restored'});
  }

  function mountEnvironment(draft){
    if(!doc?.createElement)return Object.freeze({ok:false,supported:true,message:'Environment runtime test requires the game DOM'});
    restore('replace');installStyle(doc);
    const canvas=findGameCanvas(doc);if(!canvas)return Object.freeze({ok:false,supported:true,message:'Game canvas is not ready yet'});
    const model=createEnvironmentPreviewModel(draft),layer=doc.createElement('div');layer.id=LAYER_ID;layer.dataset.weather=model.weather;layer.dataset.time=model.timeOfDay;layer.dataset.biome=model.biome;layer.setAttribute('aria-hidden','true');
    const density=clamp(model.ambientDensity,0,100);layer.style.setProperty('--kcrt-time-tint',timeTint(model.timeOfDay,density));layer.style.setProperty('--kcrt-accent',model.accent);layer.style.setProperty('--kcrt-density',String(.2+(density/100)*.48));layer.style.setProperty('--kcrt-vignette',String(.3+(density/100)*.4));
    for(const cls of ['kcrt-tint','kcrt-accent','kcrt-fog','kcrt-weather','kcrt-flash','kcrt-vignette']){const node=doc.createElement('div');node.className=cls;layer.append(node);}
    const weather=layer.querySelector('.kcrt-weather'),count=model.weather==='clear'||model.weather==='fog'?0:Math.min(42,Math.max(10,model.particleCount*2));
    for(let i=0;i<count;i++){const p=doc.createElement('i');p.className='kcrt-particle';p.style.setProperty('--x',`${(i*43+17)%101}%`);p.style.setProperty('--delay',`${-(i%11)*.27}s`);p.style.setProperty('--speed',`${1.05+(i%7)*.19}s`);weather.append(p);}
    const badge=doc.createElement('div');badge.className='kcrt-badge';badge.textContent=`TEST · ${model.biome} · ${model.weather} · ${model.timeOfDay} · ${Math.round(density)}%`;layer.append(badge);
    const button=doc.createElement('button');button.id=RESTORE_ID;button.type='button';button.textContent='↶ RESTORE';button.setAttribute('aria-label','Restore environment before test');button.addEventListener('click',()=>restore('button'));
    doc.body.append(layer,button);
    const sync=()=>{const r=canvas.getBoundingClientRect();layer.style.left=`${Math.round(r.left)}px`;layer.style.top=`${Math.round(r.top)}px`;layer.style.width=`${Math.max(0,Math.round(r.width))}px`;layer.style.height=`${Math.max(0,Math.round(r.height))}px`;layer.hidden=r.width<2||r.height<2;};sync();
    const listeners=[];for(const [target,event] of [[root,'resize'],[root,'orientationchange'],[root,'scroll'],[root.visualViewport,'resize'],[root.visualViewport,'scroll']]){if(!target?.addEventListener)continue;target.addEventListener(event,sync,{passive:true});listeners.push([target,event,sync]);}
    let resizeObserver=null;if(typeof root.ResizeObserver==='function'){resizeObserver=new root.ResizeObserver(sync);resizeObserver.observe(canvas);}
    active={layer,button,canvas,listeners,resizeObserver,model};
    const detail=Object.freeze({type:'ENVIRONMENT',draft,model,temporary:true,persistent:false,source:'kelo-creator-test-bridge'});try{root.dispatchEvent?.(new root.CustomEvent('kelo:creator-runtime-test-applied',{detail}));}catch{}
    return Object.freeze({ok:true,supported:true,temporary:true,persistent:false,message:`TEST ACTIVE · ${model.biome} / ${model.weather} / ${model.timeOfDay} · RESTORE available`,model});
  }

  async function run(type,draft={}){
    const plan=createCreatorTestPlan(type,draft);
    if(!plan.supported)return Object.freeze({ok:true,supported:false,temporary:false,message:`${plan.type||'Definition'} test draft emitted`});
    return mountEnvironment(draft);
  }

  const api=Object.freeze({version:BRIDGE_VERSION,run,restore,get active(){return active?Object.freeze({type:'ENVIRONMENT',model:active.model,temporary:true,persistent:false}):null;}});
  if(root)root.KELO_CREATOR_TEST_BRIDGE=api;cleanupOrphans();return api;
}

if(typeof window!=='undefined'&&window.document)installCreatorTestBridge(window);
