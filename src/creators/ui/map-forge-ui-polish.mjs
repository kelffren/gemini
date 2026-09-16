/* KELO-INDEX
 * area: CREATORS / MAP FORGE / UI POLISH
 * owner: Map Forge presentation layer only
 * owns: responsive hierarchy, touch ergonomics, progressive disclosure and accessibility hints
 * does-not-own: generation, selection, worker state, map drafts, world handoff or persistence
 * public-api: installMapForgeUiPolish()
 * mobile: preview-first layout, 44px+ frequent touch targets, safe-area spacing, collapsible advanced direction controls
 */

const POLISH_KEY='__KELO_MAP_FORGE_UI_POLISH_V2__';
const STYLE_ID='kelo-map-forge-ui-polish-v2';

const CSS=`
#kelo-map-forge[data-kelo-ui-polish="2"]{
  --kmfp-bg:#070a0f;
  --kmfp-surface:#0d1219;
  --kmfp-surface-2:#121923;
  --kmfp-line:rgba(255,255,255,.09);
  --kmfp-gold:#e8c96e;
  --kmfp-text:#f7f2e5;
  --kmfp-muted:#9ba4b1;
  --kmfp-radius:16px;
  color:var(--kmfp-text);
  background:
    radial-gradient(circle at 50% -12%,rgba(232,201,110,.13),transparent 34%),
    linear-gradient(180deg,#080b10 0%,#06080c 100%);
}
#kelo-map-forge[data-kelo-ui-polish="2"] *{box-sizing:border-box}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-head{
  padding:max(10px,env(safe-area-inset-top)) max(12px,env(safe-area-inset-right)) 10px max(12px,env(safe-area-inset-left));
  min-height:62px;
  background:rgba(9,13,19,.98);
  border-bottom:1px solid rgba(232,201,110,.13);
  box-shadow:0 8px 28px rgba(0,0,0,.24);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-logo{
  width:40px;height:40px;border-radius:13px;
  background:linear-gradient(145deg,rgba(232,201,110,.18),rgba(232,201,110,.03));
  box-shadow:inset 0 1px 0 rgba(255,255,255,.06);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-brand b{font-size:13px;letter-spacing:.11em;color:#fff1bd}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-brand small{font-size:10px;color:var(--kmfp-muted)}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-btn,
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-input,
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-select{
  min-height:44px;
  border-radius:12px;
  font-size:12px;
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;
  touch-action:manipulation;
  transition:transform .12s ease,border-color .12s ease,background .12s ease,opacity .12s ease;
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-btn:not(:disabled):active,
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-card:not(:disabled):active{transform:scale(.975)}
#kelo-map-forge[data-kelo-ui-polish="2"] button:focus-visible,
#kelo-map-forge[data-kelo-ui-polish="2"] input:focus-visible,
#kelo-map-forge[data-kelo-ui-polish="2"] select:focus-visible{
  outline:2px solid var(--kmfp-gold);outline-offset:2px;
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-btn.primary{
  background:linear-gradient(180deg,rgba(91,76,37,.88),rgba(61,50,25,.9));
  border-color:rgba(232,201,110,.58);
  color:#fff2c1;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 8px 20px rgba(0,0,0,.18);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-btn.preview{
  background:linear-gradient(180deg,rgba(31,71,54,.9),rgba(21,49,38,.92));
  border-color:rgba(116,205,158,.38);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-side{scrollbar-width:thin;scrollbar-color:#ffffff18 transparent}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-section{
  padding:13px 0;
  border-bottom:1px solid var(--kmfp-line);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-section h3{
  display:flex;align-items:center;gap:8px;
  margin:0 0 10px;
  font-size:10px;letter-spacing:.16em;color:#d8bf78;
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-section-toggle{
  margin-left:auto;min-width:44px;min-height:32px;padding:0 9px;
  border:1px solid rgba(255,255,255,.1);border-radius:999px;
  background:#111720;color:#aeb7c3;font:800 9px/1 system-ui,-apple-system,sans-serif;
  letter-spacing:.04em;touch-action:manipulation;
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-label{font-size:12px;gap:7px;margin:10px 0;color:#c5cbd4}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-input,
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-select{
  padding:10px 12px;background:#090d13;border-color:rgba(255,255,255,.12);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-range{
  min-height:34px;touch-action:pan-y;accent-color:#d8bb65;
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-range::-webkit-slider-thumb{width:24px;height:24px}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-canvas-wrap{padding:14px}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-canvas{
  border-radius:18px;border-color:rgba(255,255,255,.11);
  box-shadow:0 20px 50px rgba(0,0,0,.28),inset 0 0 0 1px rgba(255,255,255,.025);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-candidates{
  gap:9px;padding:10px 14px 14px;scrollbar-width:none;scroll-snap-type:x proximity;
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-candidates::-webkit-scrollbar{display:none}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-card{
  min-width:164px;min-height:78px;padding:10px 11px;border-radius:13px;
  scroll-snap-align:start;touch-action:manipulation;
  background:linear-gradient(180deg,#121923,#0d1218);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-card.on{
  border-color:rgba(232,201,110,.82);
  background:linear-gradient(180deg,rgba(62,53,30,.86),rgba(27,25,19,.96));
  box-shadow:0 0 0 1px rgba(232,201,110,.1) inset,0 8px 22px rgba(0,0,0,.22);
}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-card b{font-size:17px}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-card small{font-size:10px;line-height:1.35}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-muted{font-size:12px;color:var(--kmfp-muted);line-height:1.5}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-metric{min-height:28px;align-items:center;font-size:12px}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-stat{padding:9px 6px;border-radius:11px;background:#090d13}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-stat small{font-size:9px}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-sprite-row,
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-scene-row{padding:9px 10px;border-radius:11px}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-sprite-row b,
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-scene-row b{font-size:11px}
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-sprite-row small,
#kelo-map-forge[data-kelo-ui-polish="2"] .kmf-scene-row small{font-size:9px}

@media(pointer:coarse){
  #kelo-map-forge[data-kelo-ui-polish="2"] button,
  #kelo-map-forge[data-kelo-ui-polish="2"] select,
  #kelo-map-forge[data-kelo-ui-polish="2"] input:not([type="range"]){min-height:44px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-return{min-height:48px}
}

@media(max-width:650px){
  #kelo-map-forge[data-kelo-ui-polish="2"]{height:100dvh;min-height:100svh}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-head{
    position:relative;z-index:20;gap:8px;padding-top:max(8px,env(safe-area-inset-top));
  }
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-head-actions{gap:6px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-head-actions .kmf-btn{min-height:44px;padding:0 11px;font-size:10px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-layout{
    display:flex;flex-direction:column;min-height:0;overflow:auto;
    overscroll-behavior:contain;-webkit-overflow-scrolling:touch;
    padding-bottom:max(12px,env(safe-area-inset-bottom));
  }
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-stage{order:0;min-height:0;background:transparent}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-side.left{order:1}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-side.right{order:2}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-side.left,
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-side.right{
    display:block;overflow:visible;padding:8px 10px;border:0;background:transparent;
  }
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-canvas-wrap{padding:9px 9px 6px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-canvas{
    width:100%;height:min(45dvh,430px);min-height:290px;max-height:430px;border-radius:17px;
  }
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-candidates{padding:7px 9px 11px;border-top:0}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-card{min-width:154px;min-height:74px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-section{
    margin:0 0 8px;padding:12px;border:1px solid rgba(255,255,255,.08);border-radius:15px;
    background:linear-gradient(180deg,rgba(15,21,29,.98),rgba(10,14,20,.98));
    box-shadow:0 10px 28px rgba(0,0,0,.16);
  }
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-section:last-child{margin-bottom:0}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-section[data-kmf-collapsible="1"][data-collapsed="1"]{padding-bottom:10px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-section[data-kmf-collapsible="1"][data-collapsed="1"] > :not(h3){display:none!important}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-actions-section{
    position:sticky;bottom:max(8px,env(safe-area-inset-bottom));z-index:12;
    border-color:rgba(232,201,110,.25);
    box-shadow:0 18px 44px rgba(0,0,0,.42),0 0 0 1px rgba(232,201,110,.04) inset;
  }
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-action-stack{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-action-stack .kmf-open-world{grid-column:1/-1;order:-1;min-height:50px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-action-help{font-size:10px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-mini-list{max-height:240px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-score{font-size:36px}
}

@media(max-width:430px){
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-logo{width:34px;height:34px;flex:0 0 34px;border-radius:11px;font-size:11px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-brand b{font-size:11px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-brand small{display:none}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-head-actions{margin-left:auto}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-head-actions .kmf-close{
    width:44px;min-width:44px;padding:0;font-size:0;border-radius:12px;
  }
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-head-actions .kmf-close::after{content:'×';font-size:22px;font-weight:700}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-head-actions .kmf-generate{padding:0 12px;font-size:10px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-canvas{height:min(42dvh,360px);min-height:260px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-side.left,
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-side.right{padding-left:8px;padding-right:8px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-section{padding:11px}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-action-stack{grid-template-columns:1fr}
  #kelo-map-forge[data-kelo-ui-polish="2"] .kmf-action-stack .kmf-open-world{grid-column:auto}
}

@media(prefers-reduced-motion:reduce){
  #kelo-map-forge[data-kelo-ui-polish="2"] *{scroll-behavior:auto!important;transition:none!important;animation:none!important}
}
`;

function ensureStyle(doc){
  let style=doc.getElementById(STYLE_ID);
  if(style)return style;
  style=doc.createElement('style');
  style.id=STYLE_ID;
  style.dataset.keloMapForgePolish='2';
  style.textContent=CSS;
  doc.head.append(style);
  return style;
}

function findSection(shell,title){
  const target=String(title||'').trim().toUpperCase();
  return [...shell.querySelectorAll('.kmf-section')].find(section=>String(section.querySelector('h3')?.textContent||'').trim().toUpperCase()===target)||null;
}

function addCollapsible(section,{collapsed=true}={}){
  if(!section||section.dataset.kmfCollapsible==='1')return;
  const heading=section.querySelector('h3');
  if(!heading)return;
  const headingLabel=String(heading.textContent||'sección').trim();
  section.dataset.kmfCollapsible='1';
  section.dataset.collapsed=collapsed?'1':'0';
  const toggle=section.ownerDocument.createElement('button');
  toggle.type='button';
  toggle.className='kmf-section-toggle';
  const sync=()=>{
    const isCollapsed=section.dataset.collapsed==='1';
    toggle.textContent=isCollapsed?'MOSTRAR':'OCULTAR';
    toggle.setAttribute('aria-expanded',String(!isCollapsed));
    toggle.setAttribute('aria-label',`${isCollapsed?'Mostrar':'Ocultar'} ${headingLabel}`);
  };
  toggle.addEventListener('click',event=>{
    event.preventDefault();event.stopPropagation();
    section.dataset.collapsed=section.dataset.collapsed==='1'?'0':'1';
    sync();
  });
  heading.append(toggle);sync();
}

function enhanceShell(shell){
  if(!shell)return null;
  shell.dataset.keloUiPolish='2';

  const headButtons=[...shell.querySelectorAll('.kmf-head-actions .kmf-btn')];
  for(const button of headButtons){
    const text=String(button.textContent||'').trim().toUpperCase();
    if(text.includes('CERRAR')){button.classList.add('kmf-close');button.setAttribute('aria-label','Cerrar Map Forge');}
    if(text.includes('GENERAR')){button.classList.add('kmf-generate');button.setAttribute('aria-label','Generar candidatos de mapa');}
  }

  const actions=findSection(shell,'SALIDA');
  if(actions){
    actions.classList.add('kmf-actions-section');
    for(const button of actions.querySelectorAll('.kmf-btn')){
      const text=String(button.textContent||'').trim().toUpperCase();
      if(text.includes('WORLD EDITOR'))button.classList.add('kmf-open-world');
      if(text.includes('MAPA EXTERIOR'))button.classList.add('kmf-preview-map');
      if(text.includes('EXPORTAR'))button.classList.add('kmf-export');
    }
  }

  const direction=findSection(shell,'DIRECCIÓN');
  if(direction)addCollapsible(direction,{collapsed:true});

  const status=findSection(shell,'ESTADO')?.querySelector('.kmf-muted');
  if(status){status.setAttribute('role','status');status.setAttribute('aria-live','polite');}

  const candidates=shell.querySelector('.kmf-candidates');
  if(candidates)candidates.setAttribute('aria-label','Candidatos generados');
  return shell;
}

export function installMapForgeUiPolish({root=globalThis}={}){
  const doc=root?.document;
  if(!doc)return Object.freeze({version:'map-forge-ui-polish-v2',refresh:()=>null,destroy:()=>{}});
  const existing=root[POLISH_KEY];
  if(existing?.refresh){existing.refresh();return existing;}

  const style=ensureStyle(doc);
  let destroyed=false;
  const refresh=()=>destroyed?null:enhanceShell(doc.getElementById('kelo-map-forge'));
  refresh();

  const observer=new root.MutationObserver(()=>refresh());
  observer.observe(doc.body||doc.documentElement,{childList:true,subtree:true});

  const api=Object.freeze({
    version:'map-forge-ui-polish-v2.0.0',
    refresh,
    destroy(){
      if(destroyed)return;destroyed=true;
      observer.disconnect();
      style.remove();
      try{if(root[POLISH_KEY]===api)delete root[POLISH_KEY];}catch{}
    }
  });
  try{root[POLISH_KEY]=api;}catch{}
  return api;
}
