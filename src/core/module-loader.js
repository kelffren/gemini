/* KELO-INDEX
 * area: CORE / BOOT
 * owner: KeloModuleLoader
 * keys: DYNAMIC LOAD IDLE FIRST-USE CACHE BUILD SHA MOBILE SAFARI RECOVERY QUARANTINE TRACE STYLE ASSET-LIBRARY FEATURE-REGISTRY PVP
 * purpose: one sequential optional loader; every first-use URL is normalized to the installed build SHA before download
 * public-api: KELO_MODULE_LOADER.start/ensure/needs/isReady/diagnostics
 * consumes: KELO_FEATURE_REGISTRY + KELO_ASSET_REGISTRY + KeloRuntimeVersion + KeloRuntimeBootstrap
 * do-not: NO studio at boot, NO supabase, NO second gameLoop, NO SW dependency, NO random nonces
 */
(function(root){
'use strict';
if(root.KELO_MODULE_LOADER)return;
const VERSION='kelo-module-loader-v12-runtime-build';
const VERSIONER_SRC='src/core/runtime-version.js?v=runtime-version-1';
const PVP_FALLBACK=Object.freeze([
  {src:'src/abilities/abilityData.js?v=20260916-pvp-first-use-1',name:'datos habilidades PvP'},
  {src:'src/abilities/stone-system.js?v=20260916-pvp-first-use-1',name:'piedras PvP'},
  {src:'src/abilities/kelo-ability-boot.js?v=20260916-pvp-first-use-1',name:'runtime habilidades PvP'},
  {src:'engine-net.js?v=20260916-pvp-first-use-1',name:'online PvP'},
  {src:'src/systems/pvp-world.js?v=20260916-pvp-first-use-1',name:'mundo PvP'},
  {src:'src/systems/pvp-combat-runtime-loader.js?v=20260916-pvp-first-use-1',name:'lifecycle combate PvP'}
]);
const LEGACY_FALLBACK=Object.freeze({
  social:Object.freeze([{src:'src/ui/player-nameplate.js?v=2',name:'placas'},{src:'src/systems/nobility.js?v=4',name:'títulos'},{src:'src/environment/plaza-depth.js?v=219',name:'plaza'},{src:'src/ui/profile-panel-close.js?v=2',name:'perfil'},{src:'src/ui/self-interaction-ui.js?v=1',name:'perfil'}]),
  world:Object.freeze([{src:'engine-m.js?v=94',name:'mundo'},{src:'engine-n.js?v=230',name:'mundo'},{src:'engine-o.js?v=96',name:'mundo'},{src:'engine-p.js?v=96',name:'mundo'},{src:'engine-q.js?v=94',name:'mundo'},{src:'engine-s.js?v=96',name:'mundo'},{src:'engine-ah.js?v=95',name:'mundo'},{src:'engine-ai.js?v=95',name:'mundo'},{src:'src/systems/illumination.js?v=2',name:'luz'}]),
  pvp:PVP_FALLBACK,
  bag:Object.freeze([{src:'src/ui/backpack-fantasy-v1.css?v=1',name:'estilo mochila',type:'style'},{src:'src/systems/backpack-system.js?v=2',name:'mochila'},{src:'src/ui/backpack-ui.js?v=4',name:'mochila'}]),
  mounts:Object.freeze([{src:'src/mounts/mount-catalog.js?v=2',name:'monturas'},{src:'src/mounts/mount-system.js?v=2',name:'monturas'},{src:'src/ui/mount-panel.js?v=2',name:'monturas'}]),
  market:Object.freeze([{src:'src/systems/market-escrow-system.js?v=1',name:'mercado'},{src:'src/ui/market-ui.js?v=2',name:'mercado'}]),
  titles:Object.freeze([{src:'src/systems/title-catalog.js?v=1',name:'títulos'},{src:'src/systems/player-stats.js?v=1',name:'títulos'},{src:'src/systems/title-system.js?v=1',name:'títulos'}]),
  appearance:Object.freeze([{src:'src/characters/character-customization.js?v=1',name:'apariencia'},{src:'src/ui/character-customizer-ui.js?v=1',name:'apariencia'}]),
  properties:Object.freeze([{src:'src/property/property-system.js?v=4',name:'propiedades'},{src:'src/ui/house-instance-ui.js?v=1',name:'propiedades'}])
});
const loaded=Object.create(null),inflight=Object.create(null),failures=Object.create(null);
let build='V6.69',shown=false,versionerLoading=null;
function registry(){return root.KELO_FEATURE_REGISTRY||null;}
function resolveName(name){const raw=String(name||''),r=registry();if(r&&typeof r.resolve==='function')return r.resolve(raw);if(raw==='nobility'||raw==='emotes')return'social';return raw;}
function featureIds(){const r=registry();return r&&Array.isArray(r.ids)?r.ids.slice():Object.keys(LEGACY_FALLBACK);}
function featureSpec(name){const r=registry();return r&&typeof r.get==='function'?r.get(name):null;}
function filesFor(name){const spec=featureSpec(name);return spec?.files||LEGACY_FALLBACK[name]||null;}
function dependenciesFor(name){const spec=featureSpec(name);return Array.isArray(spec?.dependencies)?spec.dependencies:[];}
function emit(type,detail){try{root.dispatchEvent(new CustomEvent(type,{detail:Object.freeze({...detail})}));}catch(_){}try{root.KELO_RECOVERY_MESH?.mark?.(String(type).replace(/^kelo:/,'').replace(/-/g,'_').toUpperCase(),detail);}catch(_){}}
function recoveryQuery(){try{return new URLSearchParams(root.location?.search||'');}catch(_){return null;}}
function recoveryEnabled(){const q=recoveryQuery();return !!q&&(q.get('recoveryLab')==='1'||q.get('debugRecovery')==='1'||q.get('freezeLab')==='1');}
function quarantined(name){if(!recoveryEnabled())return false;try{if(root.KELO_RECOVERY_MESH?.shouldSkip?.(name))return true;}catch(_){}const q=recoveryQuery();return String(q?.get('recoverySkip')||'').split(',').map(v=>v.trim()).filter(Boolean).includes(String(name));}
function assetAllowed(name){try{if(!root.KELO_ASSET_REGISTRY||typeof root.KELO_ASSET_REGISTRY.isEnabled!=='function')return true;return root.KELO_ASSET_REGISTRY.isEnabled(name)!==false;}catch(_){return true;}}
function busy(){try{if(typeof input!=='undefined'&&input&&(Math.abs(input.normX)>0.02||Math.abs(input.normY)>0.02||input.active))return true;}catch(_){}return false;}
function box(){return document.getElementById('kelo-module-loader');}function textEl(){return document.getElementById('kelo-ml-text');}function barEl(){return document.getElementById('kelo-ml-bar');}
function show(msg,pct){const el=box();if(!el)return;el.hidden=false;shown=true;const t=textEl();if(t)t.textContent=msg;const b=barEl();if(b)b.style.width=Math.max(0,Math.min(100,pct||0))+'%';}
function hideChip(msg){const el=box();if(!el)return;if(shown){show(msg||'Listo',100);setTimeout(()=>{el.hidden=true;},800);}else el.hidden=true;}
function base(src){return String(src||'').split('?')[0];}
function hasAsset(item){const target=base(item.src);if(item.type==='style')return Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link=>base(link.getAttribute('href'))===target);return Array.from(document.scripts).some(script=>base(script.getAttribute('src'))===target);}
function ensureVersioner(){
  if(root.KeloRuntimeVersion)return Promise.resolve(root.KeloRuntimeVersion);if(versionerLoading)return versionerLoading;
  versionerLoading=new Promise((resolve,reject)=>{const existing=document.querySelector('script[data-kelo-runtime-version="1"]');if(existing){existing.addEventListener('load',()=>resolve(root.KeloRuntimeVersion),{once:true});existing.addEventListener('error',()=>reject(new Error('RUNTIME_VERSION_LOAD_FAILED')),{once:true});return;}const s=document.createElement('script');s.src=VERSIONER_SRC;s.async=false;s.dataset.keloRuntimeVersion='1';s.onload=()=>root.KeloRuntimeVersion?resolve(root.KeloRuntimeVersion):reject(new Error('RUNTIME_VERSION_MISSING'));s.onerror=()=>reject(new Error('RUNTIME_VERSION_LOAD_FAILED'));document.head.appendChild(s);}).finally(()=>{versionerLoading=null;});return versionerLoading;
}
async function resolveSrc(src){try{const r=await ensureVersioner();await r.ready();return await r.url(src);}catch(error){console.warn('[Kelo Module Loader] runtime version unavailable; using source URL',error);return src;}}
async function loadOne(item,feature){
  if(hasAsset(item)){emit('kelo:module-load-end',{feature,src:item.src,type:item.type||'script',ok:true,ms:0,cached:true});return {ms:0,ok:true,cached:true};}
  const resolved=await resolveSrc(item.src),t0=performance.now(),type=item.type==='style'?'style':'script';emit('kelo:module-load-start',{feature,src:item.src,resolvedSrc:resolved,name:item.name,type});
  return new Promise(resolve=>{const node=type==='style'?document.createElement('link'):document.createElement('script');if(type==='style'){node.rel='stylesheet';node.href=resolved;}else{node.src=resolved;node.async=false;}node.onload=()=>{const ms=performance.now()-t0;emit('kelo:module-load-end',{feature,src:item.src,resolvedSrc:resolved,type,ok:true,ms:Math.round(ms),cached:false});resolve({ms,ok:true,cached:false});};node.onerror=()=>{const ms=performance.now()-t0;failures[item.src]=(failures[item.src]||0)+1;emit('kelo:module-load-error',{feature,src:item.src,resolvedSrc:resolved,type,ok:false,ms:Math.round(ms),error:type==='style'?'STYLE_LOAD_ERROR':'SCRIPT_LOAD_ERROR',count:failures[item.src]});resolve({ms,ok:false,cached:false});};document.head.appendChild(node);});
}
function loadFeature(name,opts){
  name=resolveName(name);const files=filesFor(name);if(!files)return Promise.resolve(true);if(!assetAllowed(name)){emit('kelo:module-blocked',{feature:name,src:'',ok:false,error:'ASSET_LIBRARY_DISABLED'});return Promise.resolve(false);}if(quarantined(name)){emit('kelo:module-quarantined',{feature:name,src:'',ok:false,error:'RECOVERY_QUARANTINE'});return Promise.resolve(false);}if(loaded[name])return Promise.resolve(true);if(inflight[name])return inflight[name];const interactive=!!opts?.interactive;
  inflight[name]=new Promise(resolve=>{let i=0,errors=0;function step(){if(!assetAllowed(name)){delete inflight[name];emit('kelo:module-blocked',{feature:name,src:'',ok:false,error:'ASSET_LIBRARY_DISABLED_DURING_LOAD'});resolve(false);return;}if(i>=files.length){loaded[name]=errors===0;delete inflight[name];try{if(errors===0)localStorage.setItem('kelo_modpack_'+name,build);}catch(_){}emit('kelo:module-feature-complete',{feature:name,ok:errors===0,files:files.length,errors,runtimeBuild:root.KeloRuntimeVersion?.build||null});resolve(errors===0);return;}if(!interactive&&busy()){if(shown)show('En pausa · caminando',(i/files.length)*100);setTimeout(step,450);return;}const item=files[i];loadOne(item,name).then(result=>{const dt=Number(result?.ms)||0;if(!result?.ok)errors++;if(dt>=50)show('Descargando '+item.name+'  '+(i+1)+'/'+files.length,((i+1)/files.length)*100);i+=1;setTimeout(step,dt<50?80:360);});}step();});return inflight[name];
}
function ensureDependencies(name){const deps=dependenciesFor(name);let chain=Promise.resolve(true);for(const dep of deps)chain=chain.then(ok=>ok===false?false:loadFeature(resolveName(dep),{interactive:true}));return chain;}
function pvpDomainReady(){return !!(root.KeloPvPWorld&&typeof root.enterPvPWorld==='function'&&root.KELO_PVP_COMBAT_LOADER_AUDIT?.ready===true);}
function ensurePvp(){if(pvpDomainReady())return Promise.resolve(true);if(!filesFor('pvp'))return Promise.resolve(false);if(!assetAllowed('pvp')){emit('kelo:module-blocked',{feature:'pvp',src:'',ok:false,error:'ASSET_LIBRARY_DISABLED'});hideChip('PvP desactivado en Assets');return Promise.resolve(false);}if(quarantined('pvp')){emit('kelo:module-quarantined',{feature:'pvp',src:'',ok:false,error:'RECOVERY_QUARANTINE'});return Promise.resolve(false);}show('Cargando PvP…',8);const foundations=root.KeloRuntimeBootstrap&&typeof root.KeloRuntimeBootstrap.ensure==='function'?root.KeloRuntimeBootstrap.ensure():Promise.reject(new Error('KELO_RUNTIME_BOOTSTRAP_UNAVAILABLE'));return foundations.then(()=>loadFeature('pvp',{interactive:true})).then(ok=>{const ready=ok!==false&&pvpDomainReady();if(!ready){loaded.pvp=false;emit('kelo:module-load-error',{feature:'pvp',src:'',type:'runtime',ok:false,error:'PVP_RUNTIME_INCOMPLETE'});}hideChip(ready?'PvP listo':'Fallo al cargar PvP');return ready;}).catch(error=>{loaded.pvp=false;emit('kelo:module-load-error',{feature:'pvp',src:'',type:'runtime',ok:false,error:String(error?.message||error)});hideChip('Fallo al cargar PvP');throw error;});}
function ensure(name){if(name==='chat'||name==='profile')return Promise.resolve(true);if(name==='pvp')return ensurePvp();name=resolveName(name);if(!filesFor(name))return Promise.resolve(true);if(!assetAllowed(name)){emit('kelo:module-blocked',{feature:name,src:'',ok:false,error:'ASSET_LIBRARY_DISABLED'});hideChip('Desactivado en Assets');return Promise.resolve(false);}if(quarantined(name)){emit('kelo:module-quarantined',{feature:name,src:'',ok:false,error:'RECOVERY_QUARANTINE'});return Promise.resolve(false);}show('Cargando '+name+'…',8);return ensureDependencies(name).then(ok=>ok===false?false:loadFeature(name,{interactive:true})).then(ok=>{hideChip(ok?'Listo':'Fallo al cargar');return ok;});}
function needs(name){if(name==='chat'||name==='profile')return false;if(name==='pvp')return !pvpDomainReady();name=resolveName(name);if(!filesFor(name))return false;if(!assetAllowed(name))return true;return !loaded[name];}
function start(opts){if(opts?.build)build=String(opts.build);const el=box();if(el)el.hidden=true;emit('kelo:module-loader-start',{build,version:VERSION,registryVersion:registry()?.version||'legacy-fallback',assetSelection:root.KELO_ASSET_REGISTRY?.getState?.().features||null});}
function diagnostics(){const ids=featureIds();return Object.freeze({version:VERSION,registryVersion:registry()?.version||'legacy-fallback',build,runtimeBuild:root.KeloRuntimeVersion?.build||null,runtimeVersioner:root.KeloRuntimeVersion?.diagnostics?.()||null,features:ids,enabled:ids.filter(assetAllowed),disabled:ids.filter(k=>!assetAllowed(k)),loaded:Object.keys(loaded).filter(k=>loaded[k]),inflight:Object.keys(inflight),failures:{...failures},quarantined:ids.filter(quarantined),pvpReady:pvpDomainReady()});}
root.KELO_MODULE_LOADER=Object.freeze({version:VERSION,start,ensure,needs,isReady(n){const name=resolveName(n);return name==='pvp'?pvpDomainReady():!!loaded[name];},canLoad:assetAllowed,features:featureIds(),diagnostics});
})(typeof globalThis!=='undefined'?globalThis:window);
