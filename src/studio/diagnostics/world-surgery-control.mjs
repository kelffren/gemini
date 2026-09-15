/* KELO-INDEX
 * area: STUDIO / DIAGNOSTICS / WORLD SURGERY
 * purpose: persistent kill switches, presets, flight recorder, heartbeat and manual module bisect for World Editor
 * safety: no production behavior changes unless a caller reads these flags; all writes stay in localStorage
 * public-api: getWorldSurgery(), openWorldSurgeryControl()
 */

const CONFIG_KEY='kelo.world-surgery.config.v1';
const FLIGHT_KEY='kelo.world-surgery.flight.v1';
const BISECT_KEY='kelo.world-surgery.bisect.v1';
const PANEL_ID='kelo-world-surgery-control';
const MAX_HISTORY=160;

export const WORLD_SURGERY_MODULES=Object.freeze([
  {id:'studioKernel',label:'Studio Kernel',group:'VITAL'},
  {id:'worldDocument',label:'World Document',group:'VITAL'},
  {id:'runtimeAdapter',label:'Runtime Adapter',group:'VITAL'},
  {id:'studioShell',label:'Studio Shell',group:'VITAL'},
  {id:'coreCommands',label:'Core Commands',group:'VITAL'},
  {id:'coreInput',label:'Core Input',group:'VITAL'},
  {id:'placement',label:'Placement',group:'VITAL'},

  {id:'currentWorldImporter',label:'Current World Importer',group:'ISOLATABLE'},
  {id:'storage',label:'IndexedDB / Store',group:'ISOLATABLE'},
  {id:'compiler',label:'Compiler',group:'ISOLATABLE'},
  {id:'worker',label:'Compiler Worker',group:'ISOLATABLE'},
  {id:'assetPreview',label:'Asset Preview',group:'ISOLATABLE'},
  {id:'prefabSeeder',label:'Prefab / Catalog Seeder',group:'ISOLATABLE'},
  {id:'assetCatalog',label:'Asset Catalog',group:'ISOLATABLE'},
  {id:'treeCatalog',label:'Tree Catalog / Registration',group:'ISOLATABLE'},
  {id:'placementTouch',label:'Placement Touch Controller',group:'ISOLATABLE'},
  {id:'explorerRange',label:'Explorer Range Controller',group:'ISOLATABLE'},
  {id:'overlay',label:'Studio Overlay',group:'ISOLATABLE'},
  {id:'authorityMirror',label:'Authority Mirror',group:'ISOLATABLE'},
  {id:'cameraController',label:'Camera Controller',group:'ISOLATABLE'},
  {id:'grid',label:'Creator Grid',group:'ISOLATABLE'},
  {id:'draftHydration',label:'Draft Hydration',group:'ISOLATABLE'},
  {id:'snapshotLoading',label:'Snapshot Loading',group:'ISOLATABLE'},

  {id:'paintCopies',label:'Paint Copies',group:'OPTIONAL',risk:'HISTORICAL REGRESSION · c13cceaf'},
  {id:'assetPalette',label:'Asset Palette',group:'OPTIONAL'},
  {id:'assetFavorites',label:'Asset Favorites',group:'OPTIONAL'},
  {id:'assetKeyboard',label:'Asset Keyboard',group:'OPTIONAL'},
  {id:'menuMinimizer',label:'Menu Minimizer',group:'OPTIONAL'},
  {id:'cleanWorkspace',label:'Clean Workspace',group:'OPTIONAL'},
  {id:'contextInspector',label:'Context Inspector',group:'OPTIONAL'},
  {id:'contextSnapChip',label:'Context Snap Chip',group:'OPTIONAL'},
  {id:'multiAlign',label:'Multi Align',group:'OPTIONAL'},
  {id:'historyHints',label:'History Hints',group:'OPTIONAL'},
  {id:'transformPresets',label:'Transform Presets',group:'OPTIONAL'},
  {id:'nudge',label:'Nudge',group:'OPTIONAL'},
  {id:'overlapCycle',label:'Overlap Cycle',group:'OPTIONAL'},
  {id:'precisionSnap',label:'Precision Snap',group:'OPTIONAL'},
  {id:'selectionHistory',label:'Selection History',group:'OPTIONAL'},
  {id:'focusShortcut',label:'Focus Shortcut',group:'OPTIONAL'},
  {id:'quickActions',label:'Quick Actions',group:'OPTIONAL'},
  {id:'keyboardDelete',label:'Keyboard Delete',group:'OPTIONAL'},
  {id:'keyboardDuplicate',label:'Keyboard Duplicate',group:'OPTIONAL'},
  {id:'keyboardHistory',label:'Keyboard History',group:'OPTIONAL'},
  {id:'keyboardClipboard',label:'Keyboard Clipboard',group:'OPTIONAL'},
  {id:'selectAll',label:'Select All',group:'OPTIONAL'},
  {id:'explorerReveal',label:'Explorer Reveal',group:'OPTIONAL'},
  {id:'propertyCommit',label:'Property Commit',group:'OPTIONAL'},
  {id:'snapCycle',label:'Snap Cycle',group:'OPTIONAL'},
  {id:'basicTools',label:'Basic Tools',group:'OPTIONAL'},
  {id:'productivityExtras',label:'Productivity Extras',group:'OPTIONAL'}
]);

const byId=new Map(WORLD_SURGERY_MODULES.map(row=>[row.id,row]));
const safeParse=(text,fallback)=>{try{return JSON.parse(text);}catch{return fallback;}};
const clone=value=>value==null?value:JSON.parse(JSON.stringify(value));
const now=()=>Date.now();
const iso=ts=>new Date(ts||now()).toISOString();

function store(root){try{return root?.localStorage||globalThis.localStorage;}catch{return null;}}
function readJson(root,key,fallback){try{return safeParse(store(root)?.getItem(key)||'',fallback);}catch{return fallback;}}
function writeJson(root,key,value){try{store(root)?.setItem(key,JSON.stringify(value));return true;}catch{return false;}}

function defaultFlags(){return Object.fromEntries(WORLD_SURGERY_MODULES.map(row=>[row.id,true]));}
function loadConfig(root){
  const saved=readJson(root,CONFIG_KEY,null);
  const flags={...defaultFlags(),...(saved?.flags||{})};
  for(const row of WORLD_SURGERY_MODULES)if(row.group==='VITAL')flags[row.id]=true;
  return {version:1,preset:saved?.preset||'ALL_CURRENT',flags,updatedAt:saved?.updatedAt||0};
}
function saveConfig(root,config){config.updatedAt=now();writeJson(root,CONFIG_KEY,config);return config;}

function emptyFlight(){return {version:1,bootId:null,bootStartedAt:0,bootEndedAt:0,lastStarted:null,lastCompleted:null,lastHeartbeat:null,statuses:{},history:[]};}
function loadFlight(root){return {...emptyFlight(),...readJson(root,FLIGHT_KEY,{})};}
function saveFlight(root,flight){
  flight.history=(flight.history||[]).slice(-MAX_HISTORY);
  writeJson(root,FLIGHT_KEY,flight);
  return flight;
}

const runtime=new Map();
let heartbeatTimer=0;
let heartbeatMetaProvider=null;
let activeRoot=globalThis;

function pushEvent(root,event){
  const flight=loadFlight(root);
  flight.history.push(event);
  return saveFlight(root,flight);
}
function markStatus(root,id,status,extra={}){
  runtime.set(id,{status,at:now(),...extra});
  const flight=loadFlight(root);
  flight.statuses={...(flight.statuses||{}),[id]:{status,at:now(),...extra}};
  saveFlight(root,flight);
}

function startModule(root,id,phase='runtime',meta={}){
  const startedAt=now();
  const event={kind:'START',module:id,phase,at:startedAt,iso:iso(startedAt),meta};
  const flight=loadFlight(root);
  flight.lastStarted={module:id,phase,at:startedAt,iso:event.iso,meta};
  flight.history.push(event);
  saveFlight(root,flight);
  markStatus(root,id,'LOADING',{phase});
  return {id,phase,startedAt};
}
function doneModule(root,token,meta={}){
  if(!token)return;
  const endedAt=now(),duration=Math.max(0,endedAt-token.startedAt);
  const event={kind:'DONE',module:token.id,phase:token.phase,at:endedAt,iso:iso(endedAt),duration,meta};
  const flight=loadFlight(root);
  flight.lastCompleted={module:token.id,phase:token.phase,at:endedAt,iso:event.iso,duration,meta};
  flight.history.push(event);
  saveFlight(root,flight);
  markStatus(root,token.id,'DONE',{phase:token.phase,duration});
}
function failModule(root,token,error){
  if(!token)return;
  const endedAt=now(),duration=Math.max(0,endedAt-token.startedAt),message=String(error?.message||error||'UNKNOWN');
  pushEvent(root,{kind:'FAILED',module:token.id,phase:token.phase,at:endedAt,iso:iso(endedAt),duration,message});
  markStatus(root,token.id,'FAILED',{phase:token.phase,duration,message});
}

function heartbeat(root,meta={}){
  const flight=loadFlight(root);
  const payload={at:now(),iso:iso(),elapsed:flight.bootStartedAt?now()-flight.bootStartedAt:0,module:flight.lastStarted?.module||null,phase:flight.lastStarted?.phase||null,...meta};
  flight.lastHeartbeat=payload;
  saveFlight(root,flight);
  return payload;
}

function beginBoot(root,metaProvider=null){
  stopHeartbeat(root);
  const flight=loadFlight(root),startedAt=now();
  flight.bootId=`world:${startedAt.toString(36)}:${Math.random().toString(36).slice(2,8)}`;
  flight.bootStartedAt=startedAt;
  flight.bootEndedAt=0;
  flight.lastHeartbeat={at:startedAt,iso:iso(startedAt),elapsed:0};
  flight.history.push({kind:'BOOT_START',at:startedAt,iso:iso(startedAt),bootId:flight.bootId});
  saveFlight(root,flight);
  heartbeatMetaProvider=typeof metaProvider==='function'?metaProvider:null;
  heartbeatTimer=(root.setInterval||setInterval)(()=>{
    let meta={};
    try{meta=heartbeatMetaProvider?.()||{};}catch{}
    heartbeat(root,meta);
  },400);
  return flight.bootId;
}
function stopHeartbeat(root,{ok=null}={}){
  if(heartbeatTimer){try{(root.clearInterval||clearInterval)(heartbeatTimer);}catch{}heartbeatTimer=0;}
  heartbeatMetaProvider=null;
  if(ok!==null){
    const flight=loadFlight(root),endedAt=now();
    flight.bootEndedAt=endedAt;
    flight.history.push({kind:ok?'BOOT_DONE':'BOOT_ABORT',at:endedAt,iso:iso(endedAt),bootId:flight.bootId});
    saveFlight(root,flight);
  }
}

function applyPresetToFlags(name,flags){
  const next={...flags};
  const set=(ids,value)=>ids.forEach(id=>{if(byId.has(id)&&byId.get(id).group!=='VITAL')next[id]=value;});
  const optional=WORLD_SURGERY_MODULES.filter(r=>r.group==='OPTIONAL').map(r=>r.id);
  const isolatable=WORLD_SURGERY_MODULES.filter(r=>r.group==='ISOLATABLE').map(r=>r.id);
  if(name==='ALL_CURRENT')set([...optional,...isolatable],true);
  else if(name==='SAFE_CORE')set([...optional,...isolatable],false);
  else if(name==='NO_OPTIONAL')set(optional,false);
  else if(name==='NO_ASSETS')set(['assetPreview','prefabSeeder','assetCatalog','treeCatalog','assetPalette','assetFavorites'],false);
  else if(name==='NO_STORAGE')set(['storage'],false);
  else if(name==='NO_IMPORT_CURRENT')set(['currentWorldImporter','draftHydration','snapshotLoading'],false);
  else if(name==='NO_PRODUCTIVITY')set(['productivityExtras','assetFavorites','assetKeyboard','menuMinimizer','cleanWorkspace','contextInspector','contextSnapChip','multiAlign','historyHints','transformPresets','nudge','overlapCycle','precisionSnap','selectionHistory','focusShortcut','quickActions','keyboardDelete','keyboardDuplicate','keyboardHistory','keyboardClipboard','selectAll','explorerReveal','propertyCommit','snapCycle'],false);
  else if(name==='NO_PAINT_COPIES')set(['paintCopies'],false);
  for(const row of WORLD_SURGERY_MODULES)if(row.group==='VITAL')next[row.id]=true;
  return next;
}

function loadBisect(root){return readJson(root,BISECT_KEY,null);}
function saveBisect(root,state){writeJson(root,BISECT_KEY,state);return state;}
function startBisect(root){
  const candidates=WORLD_SURGERY_MODULES.filter(r=>r.group!=='VITAL').map(r=>r.id);
  const state={version:1,active:true,candidates,fixedOn:[],fixedOff:[],rounds:[],plan:null,primarySuspect:null,startedAt:now()};
  return nextBisectPlan(root,state);
}
function nextBisectPlan(root,state){
  if(state.candidates.length<=1){
    state.active=false;
    state.primarySuspect=state.candidates[0]||null;
    state.plan=null;
    saveBisect(root,state);
    return state;
  }
  const cut=Math.ceil(state.candidates.length/2);
  const on=state.candidates.slice(0,cut),off=state.candidates.slice(cut);
  state.plan={round:state.rounds.length+1,on,off,createdAt:now()};
  const config=loadConfig(root);
  for(const id of state.fixedOn)config.flags[id]=true;
  for(const id of state.fixedOff)config.flags[id]=false;
  for(const id of on)config.flags[id]=true;
  for(const id of off)config.flags[id]=false;
  config.preset='CUSTOM';
  saveConfig(root,config);
  saveBisect(root,state);
  return state;
}
function recordBisect(root,result){
  const state=loadBisect(root);
  if(!state?.active||!state.plan)throw new Error('WORLD_SURGERY_BISECT_NOT_ACTIVE');
  const normalized=String(result||'').toUpperCase();
  if(!['FREEZE','WORKS'].includes(normalized))throw new Error('WORLD_SURGERY_BISECT_RESULT_INVALID');
  state.rounds.push({...state.plan,result:normalized,recordedAt:now()});
  if(normalized==='FREEZE'){
    state.candidates=[...state.plan.on];
    state.fixedOff=[...new Set([...state.fixedOff,...state.plan.off])];
  }else{
    state.candidates=[...state.plan.off];
    state.fixedOn=[...new Set([...state.fixedOn,...state.plan.on])];
  }
  return nextBisectPlan(root,state);
}

function evidence(root){
  const flight=loadFlight(root);
  const started=flight.lastStarted,done=flight.lastCompleted;
  const incomplete=started&&(!done||started.at>done.at);
  return {lastStarted:started,lastCompleted:done,lastHeartbeat:flight.lastHeartbeat,suspect:incomplete?started.module:null,bootId:flight.bootId};
}

function installApi(root=globalThis){
  activeRoot=root;
  if(root.KELO_WORLD_SURGERY?.version)return root.KELO_WORLD_SURGERY;
  const api=Object.freeze({
    version:'world-surgery-v1.0.0',modules:WORLD_SURGERY_MODULES,
    enabled(id){return loadConfig(root).flags[id]!==false;},
    setEnabled(id,value){
      const row=byId.get(id);if(!row)throw new Error(`WORLD_SURGERY_UNKNOWN_MODULE:${id}`);
      const config=loadConfig(root);config.flags[id]=row.group==='VITAL'?true:!!value;config.preset='CUSTOM';saveConfig(root,config);
      markStatus(root,id,config.flags[id]?'NOT LOADED':'DISABLED');return config.flags[id];
    },
    getConfig(){return clone(loadConfig(root));},
    applyPreset(name){const config=loadConfig(root);config.flags=applyPresetToFlags(name,config.flags);config.preset=name;saveConfig(root,config);return clone(config);},
    status(id){return runtime.get(id)||loadFlight(root).statuses?.[id]||{status:this.enabled(id)?'NOT LOADED':'DISABLED'};},
    markStatus(id,status,extra={}){markStatus(root,id,status,extra);},
    start(id,phase='runtime',meta={}){if(!this.enabled(id)){markStatus(root,id,'DISABLED',{phase});return null;}return startModule(root,id,phase,meta);},
    done(token,meta={}){doneModule(root,token,meta);},
    fail(token,error){failModule(root,token,error);},
    async run(id,phase,fn,{disabledValue=null}={}){
      if(!this.enabled(id)){markStatus(root,id,'DISABLED',{phase});return disabledValue;}
      const token=startModule(root,id,phase);
      try{const value=await fn();doneModule(root,token);return value;}catch(error){failModule(root,token,error);throw error;}
    },
    beginBoot(metaProvider){return beginBoot(root,metaProvider);},
    heartbeat(meta={}){return heartbeat(root,meta);},
    endBoot(ok=true){stopHeartbeat(root,{ok});},
    evidence(){return evidence(root);},
    getFlight(){return clone(loadFlight(root));},
    clearFlight(){writeJson(root,FLIGHT_KEY,emptyFlight());runtime.clear();},
    startBisect(){return clone(startBisect(root));},
    recordBisect(result){return clone(recordBisect(root,result));},
    getBisect(){return clone(loadBisect(root));},
    resetBisect(){try{store(root)?.removeItem(BISECT_KEY);}catch{}},
    open(){return openWorldSurgeryControl({root});}
  });
  root.KELO_WORLD_SURGERY=api;
  return api;
}

function panelCss(){return `
#${PANEL_ID}{position:fixed;inset:0;z-index:2147483600;background:rgba(5,7,9,.985);color:#f5f3ea;font:14px/1.35 Inter,system-ui,-apple-system,sans-serif;overflow:auto;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
#${PANEL_ID} *{box-sizing:border-box}#${PANEL_ID} .ws-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;padding:14px;background:#0b0e12;border-bottom:1px solid #252a31}#${PANEL_ID} .ws-head strong{font-size:16px;letter-spacing:.06em}#${PANEL_ID} .ws-close{margin-left:auto;background:#171b21;color:#fff;border:1px solid #343a45;border-radius:10px;padding:9px 12px;font-weight:800}#${PANEL_ID} .ws-wrap{padding:14px;max-width:900px;margin:auto}#${PANEL_ID} .ws-banner{border:1px solid #674f20;background:#211b0d;color:#f5d98d;border-radius:12px;padding:11px;margin-bottom:12px}#${PANEL_ID} .ws-evidence{background:#10151b;border:1px solid #28313c;border-radius:12px;padding:11px;margin-bottom:12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;white-space:pre-wrap}#${PANEL_ID} .ws-presets{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0}#${PANEL_ID} button{touch-action:manipulation}#${PANEL_ID} .ws-presets button,#${PANEL_ID} .ws-bisect button{border:1px solid #394250;background:#151a21;color:#fff;border-radius:10px;padding:9px 10px;font-weight:750}#${PANEL_ID} h2{font-size:12px;letter-spacing:.16em;color:#d4b96f;margin:20px 0 8px}#${PANEL_ID} .ws-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px 2px;border-bottom:1px solid #1c222a}#${PANEL_ID} .ws-copy strong{display:block}#${PANEL_ID} .ws-copy small{display:block;color:#8f99a7;margin-top:2px}#${PANEL_ID} .ws-risk{color:#ffbc7b!important}#${PANEL_ID} .ws-switch{min-width:76px;border:1px solid #3b4655;background:#151b22;color:#fff;border-radius:999px;padding:8px 10px;font-weight:900}#${PANEL_ID} .ws-switch[data-on="true"]{background:#173d2a;border-color:#2a7650}#${PANEL_ID} .ws-switch:disabled{opacity:.45}#${PANEL_ID} .ws-bisect{margin:18px 0;padding:12px;border:1px solid #28313c;border-radius:12px;background:#0e1318}#${PANEL_ID} .ws-bisect-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}#${PANEL_ID} .freeze{border-color:#7c3131!important;background:#2c1212!important}.works{border-color:#2f704b!important;background:#102a1d!important}
`;}

function make(root,tag,props={},children=[]){const el=root.document.createElement(tag);for(const [k,v] of Object.entries(props)){if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('data-'))el.setAttribute(k,v);else el[k]=v;}for(const child of [].concat(children||[]))if(child)el.append(child);return el;}

export function openWorldSurgeryControl({root=globalThis}={}){
  const api=installApi(root),doc=root.document;if(!doc)throw new Error('WORLD_SURGERY_DOM_REQUIRED');
  doc.getElementById(PANEL_ID)?.remove();doc.querySelector('style[data-world-surgery-style]')?.remove();
  const style=make(root,'style',{textContent:panelCss()});style.setAttribute('data-world-surgery-style','1');doc.head.append(style);
  const panel=make(root,'section',{id:PANEL_ID});
  const head=make(root,'div',{class:'ws-head'},[make(root,'strong',{text:'🩺 WORLD SURGERY CONTROL'}),make(root,'button',{class:'ws-close',text:'CERRAR'})]);
  const wrap=make(root,'div',{class:'ws-wrap'});panel.append(head,wrap);doc.body.append(panel);
  const close=()=>{panel.remove();style.remove();};head.querySelector('.ws-close').onclick=close;

  function render(){
    const config=api.getConfig(),ev=api.evidence(),bisect=api.getBisect();
    wrap.replaceChildren();
    wrap.append(make(root,'div',{class:'ws-banner',text:'Diagnóstico local. Los cambios se guardan en este iPhone y se aplican en el próximo arranque de World. Los módulos VITAL no se pueden apagar aquí.'}));
    wrap.append(make(root,'div',{class:'ws-evidence',text:`PRESET: ${config.preset}\nLAST COMPLETED: ${ev.lastCompleted?.module||'—'}\nLAST STARTED: ${ev.lastStarted?.module||'—'}\nSUSPECT: ${ev.suspect||'—'}\nHEARTBEAT: ${ev.lastHeartbeat?.iso||'—'}`}));
    const presets=make(root,'div',{class:'ws-presets'});
    for(const name of ['SAFE_CORE','NO_OPTIONAL','NO_ASSETS','NO_STORAGE','NO_IMPORT_CURRENT','NO_PRODUCTIVITY','NO_PAINT_COPIES','ALL_CURRENT']){
      const b=make(root,'button',{text:name});b.onclick=()=>{api.applyPreset(name);render();};presets.append(b);
    }
    wrap.append(presets);

    const bis=make(root,'div',{class:'ws-bisect'});
    if(!bisect?.active&&!bisect?.primarySuspect){
      const start=make(root,'button',{text:'AUTO BISECT · INICIAR'});start.onclick=()=>{api.startBisect();render();};bis.append(start);
    }else if(bisect?.primarySuspect){
      bis.append(make(root,'strong',{text:`PRIMARY SUSPECT: ${bisect.primarySuspect}`}));
      const reset=make(root,'button',{text:'REINICIAR'});reset.onclick=()=>{api.resetBisect();render();};bis.append(make(root,'div',{class:'ws-bisect-actions'},[reset]));
    }else{
      bis.append(make(root,'strong',{text:`AUTO BISECT · ROUND ${bisect.plan?.round||'?'} · ${bisect.candidates?.length||0} candidatos`}));
      bis.append(make(root,'div',{class:'ws-evidence',text:`ON: ${(bisect.plan?.on||[]).join(', ')}\nOFF: ${(bisect.plan?.off||[]).join(', ')}`}));
      const works=make(root,'button',{class:'works',text:'✅ FUNCIONA'}),freeze=make(root,'button',{class:'freeze',text:'💀 FREEZE'});
      works.onclick=()=>{api.recordBisect('WORKS');render();};freeze.onclick=()=>{api.recordBisect('FREEZE');render();};
      bis.append(make(root,'div',{class:'ws-bisect-actions'},[works,freeze]));
    }
    wrap.append(bis);

    for(const group of ['VITAL','ISOLATABLE','OPTIONAL']){
      wrap.append(make(root,'h2',{text:group}));
      for(const row of WORLD_SURGERY_MODULES.filter(r=>r.group===group)){
        const status=api.status(row.id),on=api.enabled(row.id);
        const copy=make(root,'div',{class:'ws-copy'},[make(root,'strong',{text:row.label}),make(root,'small',{class:row.risk?'ws-risk':'',text:`${status.status||'NOT LOADED'}${row.risk?` · ⚠️ ${row.risk}`:''}`})]);
        const toggle=make(root,'button',{class:'ws-switch',text:on?'ON':'OFF',disabled:group==='VITAL'});toggle.setAttribute('data-on',String(on));toggle.onclick=()=>{api.setEnabled(row.id,!api.enabled(row.id));render();};
        wrap.append(make(root,'div',{class:'ws-row'},[copy,toggle]));
      }
    }
  }
  render();
  return Object.freeze({panel,close,refresh:render,api});
}

export function getWorldSurgery({root=globalThis}={}){return installApi(root);}
if(typeof window!=='undefined')installApi(window);
