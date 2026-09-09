/* KELO-INDEX
 * area: CREATORS / MAP FORGE UI
 * owner: Kelo Map Forge Creator UI
 * owns: generation controls, preview, candidate selection, export and World Studio/exterior handoff actions
 * does-not-own: generator algorithms, draft import, World Studio, renderer, collision, properties or gameplay authority
 * public-api: openMapForgeWorkspace(), closeMapForgeWorkspace(), getMapForgeWorkspace()
 * consumes: KeloInputLocks + Map Forge worker client + recipes/core + injected onOpenWorld callback
 * mobile: full-screen responsive authoring UI; heavy generation runs in Worker when supported
 */
import {listMapForgeRecipes,getMapForgeRecipe} from '../../world/map-forge/map-forge-recipes.mjs';
import {serializeMapDefinition} from '../../world/map-forge/map-forge-core.mjs';
import {createMapForgeWorkerClient} from '../../world/map-forge/map-forge-worker-client.mjs';

let active=null;
const COLORS=['#2c486a','#59415c','#6c5834','#3e5943','#335c64','#4c4057','#65483b','#40516a'];
const TERRAIN_COLORS={grass:'#264a32',forest:'#183923',water:'#173e58',sand:'#806b42',stone:'#555966',royal_stone:'#6d6673',marble:'#767985',rock:'#444850',dark_terrain:'#252a31',farm:'#625536',snow:'#9aa7ae'};
const METRICS={playability:'Jugabilidad',connectivity:'Conectividad',navigation:'Navegación',visualComposition:'Composición',landmarkQuality:'Landmarks',districtVariety:'Distritos',roadQuality:'Carreteras',densityBalance:'Densidad',negativeSpace:'Espacio',assetVariety:'Assets',scenicVistas:'Vistas',technicalSafety:'Seguridad'};
const STYLE_KEYS=['monumentality','organicRoads','density','vegetation','exploration','decoration'];
const CSS=`
[data-kelo-map-forge-ui]{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,sans-serif;color:#f6f0df}#kelo-map-forge{position:fixed;inset:0;z-index:2147482400;background:radial-gradient(circle at 50% -20%,rgba(218,178,85,.14),transparent 38%),#07090d;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.kmf-head{display:flex;align-items:center;gap:10px;padding:10px 12px;border-bottom:1px solid #ffffff16;background:#0b0e13f2}.kmf-logo{width:36px;height:36px;border:1px solid #d9b65b99;border-radius:10px;display:grid;place-items:center;color:#e7c96f;font-weight:950}.kmf-brand{min-width:0}.kmf-brand b{display:block;letter-spacing:.09em}.kmf-brand small{color:#8d929d}.kmf-head-actions{margin-left:auto;display:flex;gap:7px}.kmf-btn{min-height:40px;border:1px solid #ffffff20;background:#141820;color:#fff;border-radius:11px;padding:8px 11px;font-weight:850;cursor:pointer}.kmf-btn.primary{border-color:#d7b35c88;background:#d7b35c20;color:#ffe8a8}.kmf-btn.preview{border-color:#8ac3a966;background:#183226;color:#d9ffe8}.kmf-btn:disabled{opacity:.42;cursor:default}.kmf-layout{display:grid;grid-template-columns:270px minmax(0,1fr) 270px;min-height:0}.kmf-side{overflow:auto;padding:13px;background:#0c0f14de}.kmf-side.left{border-right:1px solid #ffffff12}.kmf-side.right{border-left:1px solid #ffffff12}.kmf-section{padding:10px 0;border-bottom:1px solid #ffffff12}.kmf-section h3{margin:0 0 9px;font-size:10px;letter-spacing:.17em;color:#d0b772}.kmf-label{display:grid;gap:5px;margin:8px 0;color:#b8bdc6;font-size:11px;font-weight:750}.kmf-input,.kmf-select{width:100%;background:#080b10;border:1px solid #ffffff1f;border-radius:9px;color:#fff;padding:9px}.kmf-row{display:flex;gap:7px;align-items:center}.kmf-range{width:100%}.kmf-val{width:38px;text-align:right;color:#e4c872;font-size:11px}.kmf-stage{min-width:0;min-height:0;display:grid;grid-template-rows:minmax(0,1fr) auto;background:radial-gradient(circle,#162131,#080b10 70%)}.kmf-canvas-wrap{padding:13px;min-height:0}.kmf-canvas{display:block;width:100%;height:100%;min-height:390px;border:1px solid #ffffff16;border-radius:16px;background:#071018}.kmf-candidates{display:flex;gap:8px;overflow:auto;padding:10px 13px 13px;border-top:1px solid #ffffff12}.kmf-card{min-width:142px;border:1px solid #ffffff18;background:#10141b;color:#fff;border-radius:11px;padding:9px;text-align:left;cursor:pointer}.kmf-card.on{border-color:#dabc63;box-shadow:0 0 0 1px #dabc6328 inset}.kmf-card b{display:block;color:#f0d17c;font-size:16px}.kmf-card small{color:#9298a4}.kmf-score{font-size:32px;font-weight:950;color:#edcf78}.kmf-muted{font-size:11px;color:#9298a4;line-height:1.45}.kmf-metrics{display:grid;gap:5px}.kmf-metric{display:flex;justify-content:space-between;gap:8px;font-size:11px;color:#aeb4bd}.kmf-metric b{color:#efe2bb}.kmf-action-stack{display:grid;gap:8px}.kmf-action-help{margin-top:7px;color:#7f8c87;font-size:9px;line-height:1.4}
@media(max-width:900px){.kmf-layout{grid-template-columns:220px minmax(0,1fr)}.kmf-side.right{grid-column:1/-1;border-left:0;border-top:1px solid #ffffff12;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;max-height:260px}.kmf-action-stack{grid-template-columns:1fr 1fr}}
@media(max-width:650px){.kmf-brand small{display:none}.kmf-layout{grid-template-columns:1fr;grid-template-rows:auto minmax(500px,1fr) auto;overflow:auto}.kmf-side.left,.kmf-side.right{border:0;overflow:visible;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:9px;max-height:none}.kmf-stage{min-height:520px}.kmf-canvas-wrap{padding:9px}.kmf-canvas{min-height:390px}.kmf-head{padding:8px}.kmf-head-actions .kmf-btn{padding:7px 8px;font-size:10px}}
@media(max-width:430px){.kmf-side.left,.kmf-side.right{grid-template-columns:1fr}.kmf-logo{width:32px;height:32px}.kmf-brand b{font-size:12px}.kmf-head-actions .kmf-btn{min-height:36px}.kmf-canvas{min-height:360px}.kmf-action-stack{grid-template-columns:1fr}.kmf-side.right .kmf-section:nth-child(2){position:sticky;bottom:0;z-index:2;background:#0c0f14;padding:10px;border:1px solid #ffffff14;border-radius:12px}}
`;

function make(doc,tag,props={},children=[]){
  const node=doc.createElement(tag);
  for(const[k,v]of Object.entries(props)){
    if(k==='class')node.className=v;
    else if(k==='text')node.textContent=v;
    else if(k.startsWith('data-')||k.startsWith('aria-'))node.setAttribute(k,v);
    else node[k]=v;
  }
  for(const child of [].concat(children||[]))if(child)node.append(child);
  return node;
}
function randomSeed(root){try{const a=new Uint32Array(1);root.crypto?.getRandomValues?.(a);if(a[0])return a[0];}catch{}return Date.now()>>>0;}
function drawPreview(canvas,map){
  const view=canvas.ownerDocument?.defaultView||globalThis;
  const rect=canvas.getBoundingClientRect();
  const dpr=Math.min(2,view.devicePixelRatio||1);
  const width=Math.max(1,Math.round(rect.width*dpr));
  const height=Math.max(1,Math.round(rect.height*dpr));
  if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  const ctx=canvas.getContext('2d');
  if(!ctx)return;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,rect.width,rect.height);
  ctx.fillStyle='#071018';ctx.fillRect(0,0,rect.width,rect.height);
  const b=map?.worldBounds;
  if(!b?.w||!b?.h||rect.width<2||rect.height<2)return;
  const pad=Math.min(28,Math.max(10,Math.min(rect.width,rect.height)*.05));
  const scale=Math.min((rect.width-pad*2)/b.w,(rect.height-pad*2)/b.h);
  if(!Number.isFinite(scale)||scale<=0)return;
  const ox=(rect.width-b.w*scale)/2-b.x*scale;
  const oy=(rect.height-b.h*scale)/2-b.y*scale;
  const X=x=>ox+x*scale,Y=y=>oy+y*scale;
  ctx.save();
  ctx.beginPath();ctx.rect(X(b.x),Y(b.y),b.w*scale,b.h*scale);ctx.clip();
  ctx.fillStyle='#142219';ctx.fillRect(X(b.x),Y(b.y),b.w*scale,b.h*scale);
  const terrain=map?.terrain;
  const terrainSize=Math.max(1,Number(terrain?.cellSize)||256);
  for(const cell of terrain?.cells||[]){
    ctx.fillStyle=TERRAIN_COLORS[String(cell.material||'grass')]||TERRAIN_COLORS.grass;
    ctx.fillRect(X(cell.x-terrainSize/2),Y(cell.y-terrainSize/2),terrainSize*scale+1,terrainSize*scale+1);
  }
  for(const [i,d] of (map.districts||[]).entries()){
    if(!d?.bounds)continue;
    ctx.fillStyle=COLORS[i%COLORS.length]+'38';
    ctx.strokeStyle=COLORS[i%COLORS.length]+'b8';
    ctx.lineWidth=1;
    ctx.fillRect(X(d.bounds.x),Y(d.bounds.y),d.bounds.w*scale,d.bounds.h*scale);
    ctx.strokeRect(X(d.bounds.x),Y(d.bounds.y),d.bounds.w*scale,d.bounds.h*scale);
  }
  ctx.lineJoin='round';ctx.lineCap='round';
  for(const road of map.roads||[]){
    const points=road?.polyline||[];if(points.length<2)continue;
    ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(X(p.x),Y(p.y)):ctx.moveTo(X(p.x),Y(p.y)));
    ctx.strokeStyle=road.class==='arterial'?'#ead28f':'#beb398';
    ctx.lineWidth=Math.max(2,Number(road.width||32)*scale);ctx.stroke();
    ctx.strokeStyle=road.class==='arterial'?'#7a673e':'#5f5a4d';ctx.lineWidth=Math.max(1,Number(road.width||32)*scale*.18);ctx.stroke();
  }
  for(const l of map.landmarks||[]){
    if(!l?.position)continue;
    ctx.beginPath();ctx.arc(X(l.position.x),Y(l.position.y),l.hero?7:5,0,Math.PI*2);ctx.fillStyle='#f0c65f';ctx.fill();ctx.strokeStyle='#fff0b5';ctx.lineWidth=1;ctx.stroke();
  }
  const spawn=map.spawnPoints?.[0];
  if(spawn){ctx.beginPath();ctx.arc(X(spawn.x),Y(spawn.y),5,0,Math.PI*2);ctx.fillStyle='#75e18b';ctx.fill();}
  for(const exit of map.exits||[]){ctx.fillStyle='#ed7979';ctx.fillRect(X(exit.x)-4,Y(exit.y)-4,8,8);}
  ctx.restore();
  ctx.strokeStyle='#d8bc6755';ctx.lineWidth=1;ctx.strokeRect(X(b.x),Y(b.y),b.w*scale,b.h*scale);
  ctx.font='700 10px system-ui';ctx.textAlign='center';ctx.textBaseline='middle';
  for(const d of map.districts||[]){if(!d?.center)continue;ctx.fillStyle='#080a0dcc';ctx.fillRect(X(d.center.x)-42,Y(d.center.y)-7,84,14);ctx.fillStyle='#f4f0e4';ctx.fillText(String(d.label||d.id||'').replaceAll('_',' ').toUpperCase().slice(0,18),X(d.center.x),Y(d.center.y));}
}
function exportJson(root,map){
  const blob=new root.Blob([serializeMapDefinition(map)],{type:'application/json'}),url=root.URL.createObjectURL(blob),a=root.document.createElement('a');
  a.href=url;a.download=`${map.metadata.recipeId}-${map.metadata.seed}-${map.metadata.layoutHash}.json`;root.document.body.append(a);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),500);
}

export async function openMapForgeWorkspace({root=globalThis,onOpenWorld=null}={}){
  if(active)return active;
  if(!root.document)throw new Error('MAP_FORGE_UI_DOM_REQUIRED');
  if(!root.KeloInputLocks?.acquire||!root.KeloInputLocks?.release)throw new Error('MAP_FORGE_INPUT_LOCKS_NOT_READY');
  const doc=root.document;
  const style=make(doc,'style',{'data-kelo-map-forge-ui':'',textContent:CSS});doc.head.append(style);
  const shell=make(doc,'section',{id:'kelo-map-forge'});shell.setAttribute('data-kelo-map-forge-ui','');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Kelo Map Forge');
  const logo=make(doc,'div',{class:'kmf-logo',text:'MF'});
  const brand=make(doc,'div',{class:'kmf-brand'},[make(doc,'b',{text:'KELO MAP FORGE'}),make(doc,'small',{text:'Ciudades automáticas · draft seguro'})]);
  const close=make(doc,'button',{class:'kmf-btn',text:'CERRAR'}),generateButton=make(doc,'button',{class:'kmf-btn primary',text:'GENERAR'});
  const head=make(doc,'header',{class:'kmf-head'},[logo,brand,make(doc,'div',{class:'kmf-head-actions'},[close,generateButton])]);
  const left=make(doc,'aside',{class:'kmf-side left'}),stage=make(doc,'main',{class:'kmf-stage'}),right=make(doc,'aside',{class:'kmf-side right'});
  shell.append(head,make(doc,'div',{class:'kmf-layout'},[left,stage,right]));doc.body.append(shell);
  const token=root.KeloInputLocks.acquire('kelo-map-forge',{kind:'creator-workspace'}),worker=createMapForgeWorkerClient({root});
  let result=null,selected=null,busy=false,raf=0;
  const recipeSelect=make(doc,'select',{class:'kmf-select'});for(const recipe of listMapForgeRecipes())recipeSelect.append(make(doc,'option',{value:recipe.id,text:recipe.label}));
  const seedInput=make(doc,'input',{class:'kmf-input',type:'number',value:String(randomSeed(root))}),reroll=make(doc,'button',{class:'kmf-btn',text:'↻','aria-label':'Nueva seed'}),countSelect=make(doc,'select',{class:'kmf-select'});
  for(const n of[4,8,16,32])countSelect.append(make(doc,'option',{value:String(n),text:`Best of ${n}`}));countSelect.value='8';
  left.append(make(doc,'section',{class:'kmf-section'},[make(doc,'h3',{text:'GENERACIÓN'}),make(doc,'label',{class:'kmf-label'},[make(doc,'span',{text:'Tipo de mapa'}),recipeSelect]),make(doc,'label',{class:'kmf-label'},[make(doc,'span',{text:'Seed'}),make(doc,'div',{class:'kmf-row'},[seedInput,reroll])]),make(doc,'label',{class:'kmf-label'},[make(doc,'span',{text:'Candidatos'}),countSelect])]));
  const sliders={},styleSection=make(doc,'section',{class:'kmf-section'},[make(doc,'h3',{text:'DIRECCIÓN'})]);
  for(const key of STYLE_KEYS){const range=make(doc,'input',{class:'kmf-range',type:'range',min:'0',max:'1',step:'.01'}),value=make(doc,'span',{class:'kmf-val'});range.oninput=()=>value.textContent=Number(range.value).toFixed(2);sliders[key]=range;styleSection.append(make(doc,'label',{class:'kmf-label'},[make(doc,'span',{text:key}),make(doc,'div',{class:'kmf-row'},[range,value])]))}
  left.append(styleSection);
  const canvas=make(doc,'canvas',{class:'kmf-canvas'}),candidateBar=make(doc,'div',{class:'kmf-candidates'});stage.append(make(doc,'div',{class:'kmf-canvas-wrap'},[canvas]),candidateBar);
  const scoreSection=make(doc,'section',{class:'kmf-section'}),actionsSection=make(doc,'section',{class:'kmf-section'}),metricsSection=make(doc,'section',{class:'kmf-section'}),status=make(doc,'div',{class:'kmf-muted',text:'Preparando primera ciudad…'});
  right.append(scoreSection,actionsSection,metricsSection,make(doc,'section',{class:'kmf-section'},[make(doc,'h3',{text:'ESTADO'}),status]));
  const loadRecipeStyle=()=>{const recipe=getMapForgeRecipe(recipeSelect.value);for(const key of STYLE_KEYS){sliders[key].value=String(recipe?.style?.[key]??.5);sliders[key].dispatchEvent(new root.Event('input'));}};
  const styleOverrides=()=>Object.fromEntries(STYLE_KEYS.map(key=>[key,Number(sliders[key].value)]));
  const schedule=()=>{root.cancelAnimationFrame?.(raf);raf=root.requestAnimationFrame?.(()=>{if(selected)try{drawPreview(canvas,selected);}catch(error){console.error('[Map Forge preview]',error);status.textContent=`Preview: ${error?.message||error}`;status.style.color='#ff9d9d';}})||0;};
  async function handoff(button,options,loadingText){
    if(busy||typeof onOpenWorld!=='function'||!selected?.validation?.valid)return;
    busy=true;button.disabled=true;button.textContent=loadingText;
    const map=selected;
    try{await onOpenWorld(map,options);destroy();}
    catch(error){busy=false;console.error('[Map Forge handoff]',error);status.textContent=error?.message||'No se pudo aplicar el mapa';status.style.color='#ff9d9d';root.showToast?.(error?.message||'No se pudo aplicar el mapa');renderSelected();}
  }
  function renderSelected(){
    if(!selected)return;
    scoreSection.replaceChildren(make(doc,'h3',{text:'SELECCIONADA'}),make(doc,'div',{class:'kmf-score',text:selected.quality.total.toFixed(2)}),make(doc,'div',{class:'kmf-muted',text:`Seed ${selected.metadata.seed} · ${selected.metadata.layoutHash}`}));
    const metrics=make(doc,'div',{class:'kmf-metrics'});for(const[k,v]of Object.entries(selected.quality.breakdown))metrics.append(make(doc,'div',{class:'kmf-metric'},[make(doc,'span',{text:METRICS[k]||k}),make(doc,'b',{text:Number(v).toFixed(1)})]));metricsSection.replaceChildren(make(doc,'h3',{text:'QUALITY'}),metrics);
    const exportButton=make(doc,'button',{class:'kmf-btn',text:'EXPORTAR JSON'}),exteriorButton=make(doc,'button',{class:'kmf-btn preview',text:'VER EN MAPA EXTERIOR'}),worldButton=make(doc,'button',{class:'kmf-btn primary',text:'ABRIR EN WORLD EDITOR'});
    const canHandoff=typeof onOpenWorld==='function'&&selected.validation.valid;exteriorButton.disabled=!canHandoff;worldButton.disabled=!canHandoff;
    exportButton.onclick=()=>exportJson(root,selected);
    exteriorButton.onclick=()=>void handoff(exteriorButton,{previewOnly:true},'CARGANDO EXTERIOR…');
    worldButton.onclick=()=>void handoff(worldButton,{previewOnly:false},'CREANDO DRAFT…');
    actionsSection.replaceChildren(make(doc,'h3',{text:'SALIDA'}),make(doc,'div',{class:'kmf-action-stack'},[exteriorButton,worldButton,exportButton]),make(doc,'div',{class:'kmf-action-help',text:'VER EN MAPA EXTERIOR carga este candidato como vista previa segura del borrador. No publica ni destruye el LIVE.'}));
    candidateBar.querySelectorAll('.kmf-card').forEach(card=>card.classList.toggle('on',card.dataset.hash===selected.metadata.layoutHash));schedule();
  }
  function renderCandidates(){
    candidateBar.replaceChildren();
    for(const[map,i]of(result?.candidates||[]).map((item,index)=>[item,index])){const card=make(doc,'button',{class:'kmf-card','data-hash':map.metadata.layoutHash},[make(doc,'small',{text:`#${i+1} · Seed ${map.metadata.seed}`}),make(doc,'b',{text:`${map.quality.total.toFixed(2)} / 100`}),make(doc,'small',{text:`${map.districts.length} distritos · ${map.roads.length} roads`})]);card.onclick=()=>{selected=map;renderSelected();};candidateBar.append(card);}renderSelected();
  }
  async function generate(){
    if(busy)return;busy=true;generateButton.disabled=true;generateButton.textContent='GENERANDO…';status.style.color='';status.textContent=`Generando ${countSelect.value} candidatos · ${worker.mode}`;
    try{result=await worker.generate(recipeSelect.value,{seed:Number(seedInput.value)||1,count:Number(countSelect.value)||8,assetCatalogVersion:'creator-ui-v2',style:styleOverrides()});selected=result.best;if(!selected)throw new Error('MAP_FORGE_NO_VALID_CANDIDATE');renderCandidates();status.textContent=`${result.validCount}/${result.requested} válidos · mejor ${selected.quality.total.toFixed(2)} · ${worker.mode}`;}
    catch(error){status.textContent=error?.message||String(error);status.style.color='#ff9d9d';}
    finally{busy=false;generateButton.disabled=false;generateButton.textContent='GENERAR';}
  }
  function destroy(){if(active?.shell!==shell)return;active=null;root.cancelAnimationFrame?.(raf);worker.close();try{root.KeloInputLocks.release(token);}catch{}root.removeEventListener?.('resize',schedule);doc.removeEventListener('keydown',onKey,true);shell.remove();style.remove();}
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();destroy();}};
  close.onclick=destroy;generateButton.onclick=()=>void generate();reroll.onclick=()=>{seedInput.value=String(randomSeed(root));};recipeSelect.onchange=()=>{loadRecipeStyle();void generate();};root.addEventListener?.('resize',schedule);doc.addEventListener('keydown',onKey,true);loadRecipeStyle();
  active=Object.freeze({version:'kelo-map-forge-ui-v1.2.0',shell,worker,generate,get selected(){return selected;},get result(){return result;},close:destroy});
  await generate();return active;
}
export function closeMapForgeWorkspace(){active?.close?.();}
export function getMapForgeWorkspace(){return active;}
