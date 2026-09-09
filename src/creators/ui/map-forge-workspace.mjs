/* KELO-INDEX
 * area: CREATORS / MAP FORGE UI
 * owner: Kelo Map Forge Creator UI
 * owns: generator controls, candidate preview, candidate selection and JSON export
 * does-not-own: generator algorithms, world renderer, Studio document, collision, property or gameplay authority
 * public-api: openMapForgeWorkspace(), closeMapForgeWorkspace(), getMapForgeWorkspace()
 * consumes: KeloInputLocks + Map Forge worker client + recipes/core serialization
 * mobile: full-screen responsive authoring UI; generation runs in Worker when supported
 */
import { MAP_FORGE_RECIPES, listMapForgeRecipes } from '../../world/map-forge/map-forge-recipes.mjs';
import { serializeMapDefinition } from '../../world/map-forge/map-forge-core.mjs';
import { createMapForgeWorkerClient } from '../../world/map-forge/map-forge-worker-client.mjs';

let active = null;
const make = (tag, props = {}, children = []) => {
  const el = document.createElement(tag);
  for (const [k,v] of Object.entries(props)) {
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('data-')) el.setAttribute(k,v);
    else if (k.startsWith('aria-')) el.setAttribute(k,v);
    else el[k] = v;
  }
  for (const child of [].concat(children || [])) if (child) el.append(child);
  return el;
};
const css = () => `
[data-kelo-map-forge-ui]{box-sizing:border-box;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7f1df}
#kelo-map-forge{position:fixed;inset:0;z-index:2147482400;background:radial-gradient(circle at 15% 0%,rgba(214,174,82,.11),transparent 30%),linear-gradient(180deg,#090b0f,#07080b 65%,#050608);display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}
.kmf-head{display:flex;align-items:center;gap:12px;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.08);background:rgba(9,11,15,.94);backdrop-filter:blur(14px)}
.kmf-logo{width:36px;height:36px;border:1px solid rgba(223,185,96,.68);border-radius:10px;display:grid;place-items:center;color:#e9c979;font-size:11px;font-weight:950;letter-spacing:.12em}.kmf-title strong{display:block;letter-spacing:.08em}.kmf-title small{display:block;color:#8f939c;margin-top:1px}.kmf-head-actions{margin-left:auto;display:flex;gap:8px}.kmf-btn{border:1px solid rgba(255,255,255,.12);background:#13161d;color:#fff;border-radius:11px;padding:9px 12px;font-weight:850;cursor:pointer}.kmf-btn.primary{border-color:rgba(219,178,84,.56);background:linear-gradient(180deg,rgba(221,181,88,.2),rgba(166,125,45,.12));color:#ffe9ae}.kmf-btn:disabled{opacity:.42;cursor:default}
.kmf-layout{display:grid;grid-template-columns:minmax(250px,310px) minmax(0,1fr) minmax(220px,290px);min-height:0}.kmf-panel{overflow:auto;border-right:1px solid rgba(255,255,255,.07);background:rgba(11,13,18,.87);padding:14px}.kmf-right{border-right:0;border-left:1px solid rgba(255,255,255,.07)}
.kmf-section{padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07)}.kmf-section:last-child{border-bottom:0}.kmf-section h3{margin:0 0 10px;font-size:11px;letter-spacing:.16em;color:#c7ad70}.kmf-label{display:grid;gap:5px;margin:9px 0;color:#c6c8ce;font-size:12px;font-weight:700}.kmf-row{display:flex;gap:8px;align-items:center}.kmf-row>*{min-width:0}.kmf-input,.kmf-select{width:100%;background:#0b0e13;border:1px solid rgba(255,255,255,.11);border-radius:9px;color:#fff;padding:9px 10px;outline:none}.kmf-range{width:100%}.kmf-value{min-width:34px;text-align:right;color:#e1c57e;font-variant-numeric:tabular-nums}
.kmf-stage{position:relative;min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;background:radial-gradient(circle at center,rgba(28,35,48,.5),rgba(5,7,10,.88))}.kmf-canvas-wrap{position:relative;min-height:0;overflow:hidden;padding:16px}.kmf-canvas{width:100%;height:100%;min-height:360px;display:block;border:1px solid rgba(255,255,255,.08);border-radius:16px;background:#090d12;box-shadow:0 20px 60px rgba(0,0,0,.32)}
.kmf-overlay{position:absolute;left:28px;top:28px;display:flex;gap:7px;flex-wrap:wrap;pointer-events:none}.kmf-chip{font-size:11px;border:1px solid rgba(255,255,255,.12);background:rgba(6,8,12,.78);border-radius:999px;padding:6px 9px;color:#c8cbd2;backdrop-filter:blur(8px)}.kmf-chip.good{color:#bfe8b5;border-color:rgba(123,203,111,.3)}.kmf-chip.gold{color:#efd58c;border-color:rgba(222,181,87,.36)}
.kmf-candidates{display:flex;gap:8px;padding:10px 14px 14px;overflow-x:auto;border-top:1px solid rgba(255,255,255,.06);background:rgba(7,9,12,.84)}.kmf-candidate{min-width:146px;text-align:left;border:1px solid rgba(255,255,255,.09);background:#10131a;color:#fff;border-radius:11px;padding:9px;cursor:pointer}.kmf-candidate.on{border-color:rgba(227,188,91,.65);box-shadow:0 0 0 1px rgba(227,188,91,.18) inset}.kmf-candidate strong{display:block;font-size:15px}.kmf-candidate small{color:#8d939d}.kmf-score{font-size:27px;font-weight:950;color:#f0d17f;line-height:1}.kmf-score small{font-size:11px;color:#888f99;margin-left:4px}.kmf-metrics{display:grid;gap:7px}.kmf-metric{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;font-size:12px;color:#b8bdc6}.kmf-metric b{color:#efe2bf}.kmf-empty{color:#8f949e;font-size:13px;line-height:1.5}.kmf-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.kmf-status{font-size:12px;color:#9ca2ac;line-height:1.45}.kmf-status.error{color:#ff9f9f}
@media(max-width:980px){.kmf-layout{grid-template-columns:250px minmax(0,1fr)}.kmf-right{grid-column:1/-1;border-left:0;border-top:1px solid rgba(255,255,255,.07);display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-height:220px}.kmf-right .kmf-section{border-bottom:0;padding:4px}}
@media(max-width:720px){#kelo-map-forge{grid-template-rows:auto minmax(0,1fr)}.kmf-head{padding:9px 10px}.kmf-title small{display:none}.kmf-layout{display:grid;grid-template-columns:1fr;grid-template-rows:auto minmax(420px,1fr) auto;overflow:auto}.kmf-panel{border-right:0;border-bottom:1px solid rgba(255,255,255,.07);display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px;overflow:visible}.kmf-panel .kmf-section{padding:4px;border-bottom:0}.kmf-stage{min-height:520px}.kmf-canvas-wrap{padding:10px}.kmf-canvas{min-height:400px}.kmf-overlay{left:18px;top:18px}.kmf-right{display:grid;grid-template-columns:1fr 1fr;max-height:none;padding:10px}.kmf-head-actions .kmf-btn:not(.primary){display:none}}
@media(max-width:430px){.kmf-panel,.kmf-right{grid-template-columns:1fr}.kmf-head .kmf-btn{padding:8px 9px}.kmf-canvas{min-height:360px}.kmf-actions{grid-template-columns:1fr}.kmf-candidate{min-width:132px}}
`;

const metricLabels = Object.freeze({playability:'Jugabilidad',connectivity:'Conectividad',navigation:'Navegación',visualComposition:'Composición',landmarkQuality:'Landmarks',districtVariety:'Variedad',roadQuality:'Carreteras',densityBalance:'Densidad',negativeSpace:'Espacio visual',assetVariety:'Variedad assets',scenicVistas:'Vistas',technicalSafety:'Seguridad'});
const districtPalette = ['#273d5d','#4f3d59','#6a5631','#384e3c','#31535a','#443b52','#5a4334','#37475e','#534b35'];

function drawPreview(canvas, map) {
  const rect = canvas.getBoundingClientRect(), dpr = Math.min(2, globalThis.devicePixelRatio || 1), w = Math.max(1,Math.round(rect.width*dpr)), h = Math.max(1,Math.round(rect.height*dpr));
  if (canvas.width !== w || canvas.height !== h) { canvas.width=w; canvas.height=h; }
  const ctx=canvas.getContext('2d'), b=map?.worldBounds; ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,rect.width,rect.height); ctx.fillStyle='#081017';ctx.fillRect(0,0,rect.width,rect.height); if(!b)return;
  const pad=34, scale=Math.min((rect.width-pad*2)/b.w,(rect.height-pad*2)/b.h), ox=(rect.width-b.w*scale)/2-b.x*scale, oy=(rect.height-b.h*scale)/2-b.y*scale;
  const X=x=>ox+x*scale,Y=y=>oy+y*scale;
  ctx.save();ctx.beginPath();ctx.rect(X(b.x),Y(b.y),b.w*scale,b.h*scale);ctx.clip();
  map.districts.forEach((d,i)=>{const r=d.bounds;ctx.fillStyle=districtPalette[i%districtPalette.length]+'b8';ctx.fillRect(X(r.x),Y(r.y),r.w*scale,r.h*scale);ctx.strokeStyle='rgba(255,255,255,.12)';ctx.lineWidth=1;ctx.strokeRect(X(r.x),Y(r.y),r.w*scale,r.h*scale);});
  ctx.lineCap='round';ctx.lineJoin='round';for(const r of map.roads){ctx.beginPath();r.polyline.forEach((p,i)=>i?ctx.lineTo(X(p.x),Y(p.y)):ctx.moveTo(X(p.x),Y(p.y)));ctx.strokeStyle=r.class==='arterial'?'rgba(235,205,139,.92)':'rgba(203,187,154,.7)';ctx.lineWidth=Math.max(2,r.width*scale);ctx.stroke();ctx.strokeStyle='rgba(55,43,28,.7)';ctx.lineWidth=Math.max(1,r.width*scale*.18);ctx.stroke();}
  for(const p of map.parcels){const r=p.buildableArea;ctx.fillStyle='rgba(255,255,255,.035)';ctx.fillRect(X(r.x),Y(r.y),Math.max(1,r.w*scale),Math.max(1,r.h*scale));}
  for(const l of map.landmarks){const x=X(l.position.x),y=Y(l.position.y),rad=l.hero?7:5;ctx.beginPath();ctx.arc(x,y,rad,0,Math.PI*2);ctx.fillStyle=l.hero?'#f2c865':'#d9dde5';ctx.fill();ctx.strokeStyle='#20180a';ctx.lineWidth=2;ctx.stroke();}
  const s=map.spawnPoints?.[0];if(s){ctx.beginPath();ctx.arc(X(s.x),Y(s.y),5,0,Math.PI*2);ctx.fillStyle='#7dde8a';ctx.fill();}
  for(const e of map.exits||[]){ctx.fillStyle='#f28585';ctx.fillRect(X(e.x)-4,Y(e.y)-4,8,8);}
  ctx.restore();
  ctx.font='700 11px Inter,system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle='rgba(244,240,226,.92)';
  map.districts.forEach(d=>{ctx.fillText(d.id.replaceAll('_',' ').toUpperCase(),X(d.center.x),Y(d.center.y));});
  ctx.textAlign='left';ctx.font='800 10px Inter,system-ui,sans-serif';for(const l of map.landmarks){ctx.fillStyle='#f1d17c';ctx.fillText(l.id.replaceAll('_',' '),X(l.position.x)+9,Y(l.position.y)-8);}
}

function randomSeed(root){try{const a=new Uint32Array(1);root.crypto?.getRandomValues?.(a);if(a[0])return a[0];}catch{}return Date.now()>>>0;}
function downloadJson(root,map){const text=serializeMapDefinition(map),blob=new Blob([text],{type:'application/json'}),url=URL.createObjectURL(blob),a=root.document.createElement('a');a.href=url;a.download=`${map.metadata.recipeId}-${map.metadata.seed}-${map.metadata.layoutHash}.json`;root.document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500);}

export async function openMapForgeWorkspace({ root = globalThis } = {}) {
  if (active) return active;
  if (!root.document) throw new Error('MAP_FORGE_UI_DOM_REQUIRED');
  if (!root.KeloInputLocks?.acquire || !root.KeloInputLocks?.release) throw new Error('MAP_FORGE_INPUT_LOCKS_NOT_READY');
  const doc=root.document, style=make('style',{'data-kelo-map-forge-ui':'',textContent:css()});doc.head.append(style);
  const shell=make('section',{id:'kelo-map-forge'});shell.setAttribute('data-kelo-map-forge-ui','');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Kelo Map Forge');
  const closeBtn=make('button',{class:'kmf-btn',text:'CERRAR'}),generateBtn=make('button',{class:'kmf-btn primary',text:'GENERAR CIUDAD'}),head=make('header',{class:'kmf-head'},[make('div',{class:'kmf-logo',text:'MF'}),make('div',{class:'kmf-title'},[make('strong',{text:'KELO MAP FORGE'}),make('small',{text:'Generador automático de ciudades y mundos'})]),make('div',{class:'kmf-head-actions'},[closeBtn,generateBtn])]);
  const left=make('aside',{class:'kmf-panel'}),stage=make('main',{class:'kmf-stage'}),right=make('aside',{class:'kmf-panel kmf-right'}),layout=make('div',{class:'kmf-layout'},[left,stage,right]);shell.append(head,layout);doc.body.append(shell);
  const lock=root.KeloInputLocks.acquire('kelo-map-forge',{kind:'creator-workspace'}),worker=createMapForgeWorkerClient({root});
  let result=null,selected=null,busy=false,raf=0;

  const recipeSelect=make('select',{class:'kmf-select'});for(const r of listMapForgeRecipes())recipeSelect.append(make('option',{value:r.id,text:r.label}));
  const seedInput=make('input',{class:'kmf-input',type:'number',value:String(randomSeed(root)),min:'0',step:'1'}),randomBtn=make('button',{class:'kmf-btn',text:'↻'}),countSelect=make('select',{class:'kmf-select'});for(const n of [4,8,16,32])countSelect.append(make('option',{value:String(n),text:`Best of ${n}`}));countSelect.value='8';
  const generation=make('section',{class:'kmf-section'},[make('h3',{text:'GENERACIÓN'}),make('label',{class:'kmf-label'},[make('span',{text:'Tipo de mapa'}),recipeSelect]),make('label',{class:'kmf-label'},[make('span',{text:'Seed'}),make('div',{class:'kmf-row'},[seedInput,randomBtn])]),make('label',{class:'kmf-label'},[make('span',{text:'Candidatos'}),countSelect])]);left.append(generation);
  const styleControls={};
  const sliders=[['monumentality','Monumentalidad'],['organicRoads','Caminos orgánicos'],['density','Densidad urbana'],['vegetation','Vegetación'],['exploration','Exploración'],['decoration','Decoración']];
  const styleSec=make('section',{class:'kmf-section'},[make('h3',{text:'DIRECCIÓN ARTÍSTICA'})]);
  function loadRecipeStyle(){const r=MAP_FORGE_RECIPES[recipeSelect.value];for(const [key] of sliders){const row=styleControls[key],v=Number(r?.style?.[key]??.5);row.input.value=String(v);row.value.textContent=v.toFixed(2);}}
  for(const [key,label] of sliders){const input=make('input',{class:'kmf-range',type:'range',min:'0',max:'1',step:'0.01'}),value=make('span',{class:'kmf-value',text:'0.50'});input.oninput=()=>value.textContent=Number(input.value).toFixed(2);styleControls[key]={input,value};styleSec.append(make('label',{class:'kmf-label'},[make('span',{text:label}),make('div',{class:'kmf-row'},[input,value])]));}left.append(styleSec);loadRecipeStyle();
  const generateActions=make('section',{class:'kmf-section'},[make('h3',{text:'ACCIONES'}),make('div',{class:'kmf-actions'},[make('button',{class:'kmf-btn primary',text:'GENERAR',onclick:()=>void generate()}),make('button',{class:'kmf-btn',text:'NUEVA SEED',onclick:()=>{seedInput.value=String(randomSeed(root));void generate();}})])]);left.append(generateActions);

  const canvas=make('canvas',{class:'kmf-canvas'}),canvasWrap=make('div',{class:'kmf-canvas-wrap'},[canvas]),overlay=make('div',{class:'kmf-overlay'}),candidateBar=make('div',{class:'kmf-candidates'});canvasWrap.append(overlay);stage.append(canvasWrap,candidateBar);
  const scoreBox=make('section',{class:'kmf-section'}),metricsBox=make('section',{class:'kmf-section'}),exportBox=make('section',{class:'kmf-section'}),statusBox=make('section',{class:'kmf-section'});right.append(scoreBox,metricsBox,exportBox,statusBox);

  function styleOverrides(){return Object.fromEntries(Object.entries(styleControls).map(([k,row])=>[k,Number(row.input.value)]));}
  function paintStatus(text,error=false){statusBox.replaceChildren(make('h3',{text:'ESTADO'}),make('div',{class:`kmf-status${error?' error':''}`,text}));}
  function scheduleDraw(){cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{if(selected)drawPreview(canvas,selected);});}
  function renderSelected(){if(!selected)return;scoreBox.replaceChildren(make('h3',{text:'MAPA SELECCIONADO'}),make('div',{class:'kmf-score',html:`${selected.quality.total.toFixed(2)}<small>/100</small>`}),make('div',{class:'kmf-status',text:`Seed ${selected.metadata.seed} · ${selected.metadata.layoutHash}`}));metricsBox.replaceChildren(make('h3',{text:'QUALITY SCORE'}));const metrics=make('div',{class:'kmf-metrics'});for(const [k,v] of Object.entries(selected.quality.breakdown))metrics.append(make('div',{class:'kmf-metric'},[make('span',{text:metricLabels[k]||k}),make('b',{text:Number(v).toFixed(1)})]));metricsBox.append(metrics);exportBox.replaceChildren(make('h3',{text:'SALIDA'}),make('div',{class:'kmf-actions'},[make('button',{class:'kmf-btn primary',text:'EXPORTAR JSON',onclick:()=>downloadJson(root,selected)}),make('button',{class:'kmf-btn',text:'COPIAR SEED',onclick:async()=>{try{await root.navigator?.clipboard?.writeText?.(String(selected.metadata.seed));paintStatus('Seed copiada.');}catch{paintStatus(`Seed: ${selected.metadata.seed}`);}}})]));overlay.replaceChildren(make('span',{class:'kmf-chip gold',text:selected.metadata.recipeId}),make('span',{class:`kmf-chip ${selected.validation.valid?'good':''}`,text:selected.validation.valid?'✓ VÁLIDO':'✕ INVÁLIDO'}),make('span',{class:'kmf-chip',text:`${selected.districts.length} distritos`}),make('span',{class:'kmf-chip',text:`${selected.roads.length} carreteras`}),make('span',{class:'kmf-chip',text:`${selected.parcels.length} parcelas`}));candidateBar.querySelectorAll('.kmf-candidate').forEach(b=>b.classList.toggle('on',b.dataset.hash===selected.metadata.layoutHash));scheduleDraw();}
  function renderCandidates(){candidateBar.replaceChildren();for(const [i,map] of (result?.candidates||[]).entries()){const b=make('button',{class:'kmf-candidate','data-hash':map.metadata.layoutHash},[make('small',{text:`#${i+1} · Seed ${map.metadata.seed}`}),make('strong',{text:`${map.quality.total.toFixed(2)} / 100`}),make('small',{text:`${map.generationStats.roadCount} roads · ${map.generationStats.parcelCount} parcels`})]);b.onclick=()=>{selected=map;renderSelected();};candidateBar.append(b);}renderSelected();}
  async function generate(){if(busy)return;busy=true;generateBtn.disabled=true;generateBtn.textContent='GENERANDO…';paintStatus(`Generando ${countSelect.value} candidatos usando ${worker.mode}…`);const started=performance.now();try{result=await worker.generate(recipeSelect.value,{seed:Number(seedInput.value)||1,count:Number(countSelect.value)||8,assetCatalogVersion:'creator-ui-v1',style:styleOverrides()});selected=result.best;if(!selected)throw new Error('MAP_FORGE_NO_VALID_CANDIDATE');renderCandidates();paintStatus(`${result.validCount}/${result.requested} válidos · mejor ${selected.quality.total.toFixed(2)} · ${(performance.now()-started).toFixed(0)} ms · ${worker.mode}`);}catch(error){paintStatus(error?.message||String(error),true);}finally{busy=false;generateBtn.disabled=false;generateBtn.textContent='GENERAR CIUDAD';}}
  function destroy(){if(active?.shell!==shell)return;active=null;cancelAnimationFrame(raf);worker.close();try{root.KeloInputLocks.release(lock);}catch{}root.removeEventListener?.('resize',scheduleDraw);doc.removeEventListener('keydown',onKey,true);shell.remove();style.remove();}
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();destroy();}};closeBtn.onclick=destroy;generateBtn.onclick=()=>void generate();randomBtn.onclick=()=>{seedInput.value=String(randomSeed(root));};recipeSelect.onchange=()=>{loadRecipeStyle();void generate();};root.addEventListener?.('resize',scheduleDraw);doc.addEventListener('keydown',onKey,true);
  active=Object.freeze({version:'kelo-map-forge-ui-v1.0.0',shell,worker,generate,get selected(){return selected;},get result(){return result;},close:destroy});paintStatus('Preparando primera ciudad…');await generate();return active;
}
export function closeMapForgeWorkspace(){active?.close?.();}
export function getMapForgeWorkspace(){return active;}
