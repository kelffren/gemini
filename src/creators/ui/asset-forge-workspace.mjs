/* KELO-INDEX
 * area: CREATORS / ASSET FORGE UI
 * owner: Kelo Asset Forge
 * owns: mobile-first pixel drawing, local asset QA/repair, metadata packaging, local library and marketplace preview
 * does-not-own: payment settlement, global moderation, CDN upload, remote AI credentials or gameplay rendering
 * performance: lazy workspace, max 64x64 working canvas, no render loop, IndexedDB cursor-limited lists
 */
import {createAssetId,createKeloAssetManifest,evaluateAsset,autoRepairPixelBuffer,getSeasonalBrief,suggestResidency,MAX_FORGE_EDGE} from '../assets/kelo-asset-contract.mjs';

const STYLE_ID='kelo-asset-forge-style';
const DB_NAME='kelo-asset-forge-v1';
const DB_VERSION=1;
const ASSET_STORE='assets';
const MARKET_STORE='market';
let active=null;

function make(document,tag,props={},children=[]){
  const node=document.createElement(tag);
  for(const [key,value] of Object.entries(props)){
    if(key==='class')node.className=value;
    else if(key==='text')node.textContent=value;
    else if(key==='style')Object.assign(node.style,value);
    else if(key.startsWith('aria-'))node.setAttribute(key,value);
    else node[key]=value;
  }
  for(const child of [].concat(children||[]))if(child)node.append(child);
  return node;
}
function css(){return `
#kelo-asset-forge{position:fixed;inset:0;z-index:2147482240;background:#07090b;color:#f7f3e8;font-family:Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;display:grid;grid-template-rows:auto auto minmax(0,1fr);overflow:hidden}
#kelo-asset-forge *{box-sizing:border-box}.kaf-head{display:flex;align-items:center;gap:10px;padding:calc(10px + env(safe-area-inset-top)) 12px 10px;border-bottom:1px solid rgba(255,255,255,.08);background:#0a0d0f}.kaf-mark{width:36px;height:36px;border:1px solid #d7b768;border-radius:10px;display:grid;place-items:center;color:#f3d58a;font-weight:950}.kaf-title{min-width:0}.kaf-title strong{display:block;font-size:14px;letter-spacing:.08em}.kaf-title small{display:block;color:#82938d;font-size:9px;margin-top:2px}.kaf-close{margin-left:auto;border:1px solid rgba(255,255,255,.14);background:#14191c;color:#fff;border-radius:10px;padding:9px 11px;font-weight:900}.kaf-tabs{display:flex;gap:6px;overflow:auto;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.07);background:#0d1113}.kaf-tab{white-space:nowrap;border:1px solid rgba(255,255,255,.09);background:#12181a;color:#9aa9a3;border-radius:10px;padding:8px 11px;font-size:9px;font-weight:900;letter-spacing:.08em}.kaf-tab[aria-selected="true"]{color:#fff4cf;border-color:rgba(218,183,102,.5);background:#242015}
.kaf-main{min-height:0;overflow:auto;padding:10px 10px calc(30px + env(safe-area-inset-bottom))}.kaf-create{display:grid;grid-template-columns:minmax(280px,1.15fr) minmax(260px,.85fr);gap:10px;max-width:1080px;margin:0 auto}.kaf-panel{border:1px solid rgba(255,255,255,.08);background:#0d1214;border-radius:15px;overflow:hidden}.kaf-panel-head{display:flex;align-items:center;gap:8px;padding:10px 11px;border-bottom:1px solid rgba(255,255,255,.07)}.kaf-panel-head strong{font-size:10px;letter-spacing:.1em;color:#e5c77c}.kaf-panel-head span{margin-left:auto;color:#84958f;font-size:8px}.kaf-toolbar{display:flex;flex-wrap:wrap;gap:6px;padding:9px;border-bottom:1px solid rgba(255,255,255,.07)}.kaf-btn,.kaf-file,.kaf-select,.kaf-input{min-height:38px;border:1px solid rgba(216,183,102,.28);border-radius:9px;background:#141c1e;color:#f6f2e8;padding:8px 10px;font-size:9px;font-weight:850}.kaf-btn{cursor:pointer}.kaf-btn.primary{background:linear-gradient(135deg,#d3ac57,#946f2a);color:#11100c;border-color:#e4c77f}.kaf-btn.active{outline:2px solid rgba(238,204,121,.45);background:#292318}.kaf-btn:disabled{opacity:.35}.kaf-file{display:inline-flex;align-items:center;justify-content:center;cursor:pointer}.kaf-file input{display:none}.kaf-color{width:42px;height:38px;border:1px solid rgba(255,255,255,.12);border-radius:9px;padding:2px;background:#121719}.kaf-stage-wrap{padding:12px;display:grid;place-items:center;min-height:370px;overflow:auto;background-color:#101617;background-image:linear-gradient(45deg,#171f20 25%,transparent 25%),linear-gradient(-45deg,#171f20 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#171f20 75%),linear-gradient(-45deg,transparent 75%,#171f20 75%);background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0}.kaf-canvas-shell{position:relative;border:1px solid rgba(239,207,132,.45);box-shadow:0 18px 45px rgba(0,0,0,.34);touch-action:none}.kaf-canvas-shell canvas{display:block;width:min(76vw,520px);height:auto;max-height:58vh;image-rendering:pixelated;background:transparent;touch-action:none}.kaf-grid-overlay{position:absolute;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.055) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.055) 1px,transparent 1px);background-size:calc(100% / var(--kaf-w)) calc(100% / var(--kaf-h));opacity:.55}.kaf-status{padding:8px 10px;color:#8fa199;font-size:9px;min-height:30px;border-top:1px solid rgba(255,255,255,.06)}.kaf-status.error{color:#ffad9c}.kaf-side{display:grid;gap:10px;align-content:start}.kaf-fields{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px}.kaf-fields .wide{grid-column:1/-1}.kaf-input,.kaf-select{width:100%;font-weight:700}.kaf-label{display:grid;gap:4px;color:#8ea098;font-size:8px;font-weight:900;letter-spacing:.06em}.kaf-score{display:grid;grid-template-columns:70px minmax(0,1fr);gap:10px;padding:11px}.kaf-grade{height:70px;border-radius:14px;background:#161d1f;display:grid;place-items:center;font-size:28px;font-weight:950;color:#f0cf7b}.kaf-score-copy strong{font-size:20px}.kaf-score-copy small{display:block;color:#8ea099;margin-top:3px}.kaf-issues{padding:0 10px 10px}.kaf-issue{font-size:9px;line-height:1.4;padding:7px 8px;border-radius:8px;background:#12191a;margin:5px 0;color:#a9b5b0}.kaf-issue.error{color:#ffb7aa}.kaf-issue.warn{color:#f0d28b}.kaf-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:10px;border-top:1px solid rgba(255,255,255,.07)}.kaf-ai{padding:10px;font-size:9px;line-height:1.5;color:#aab7b2}.kaf-ai b{color:#e9cd86}.kaf-season{display:flex;gap:5px;flex-wrap:wrap;margin-top:7px}.kaf-chip{border:1px solid rgba(216,183,102,.25);background:#171b18;color:#d8c38b;border-radius:999px;padding:5px 7px;font-size:8px}.kaf-list{max-width:980px;margin:0 auto;display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:9px}.kaf-card{border:1px solid rgba(255,255,255,.08);background:#0d1214;border-radius:14px;overflow:hidden}.kaf-thumb{aspect-ratio:1/1;background:#12191b;display:grid;place-items:center;overflow:hidden}.kaf-thumb img{width:100%;height:100%;object-fit:contain;image-rendering:pixelated}.kaf-card-body{padding:10px}.kaf-card-body strong{display:block;font-size:11px}.kaf-card-body small{display:block;color:#85958f;font-size:8px;margin-top:3px}.kaf-card-actions{display:flex;gap:5px;padding-top:8px}.kaf-card-actions .kaf-btn{flex:1;min-height:32px;padding:6px}.kaf-empty{max-width:780px;margin:30px auto;border:1px dashed rgba(255,255,255,.12);border-radius:14px;padding:25px;text-align:center;color:#82938d;font-size:10px}.kaf-market-head{max-width:980px;margin:0 auto 10px;display:flex;align-items:center;gap:8px}.kaf-market-head p{margin:0;color:#879892;font-size:9px}
@media(max-width:760px){.kaf-create{grid-template-columns:1fr}.kaf-stage-wrap{min-height:300px}.kaf-canvas-shell canvas{width:min(90vw,480px);max-height:48vh}.kaf-title small{display:none}.kaf-side{grid-template-columns:1fr}.kaf-main{padding-left:7px;padding-right:7px}.kaf-panel{border-radius:12px}.kaf-toolbar{position:sticky;top:0;z-index:3;background:#0d1214}.kaf-btn,.kaf-file{min-height:42px}.kaf-list{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:390px){.kaf-list{grid-template-columns:1fr}.kaf-actions{grid-template-columns:1fr 1fr}}
`;}

function openDb(root){
  return new Promise((resolve,reject)=>{
    if(!root.indexedDB)return reject(new Error('INDEXEDDB_UNAVAILABLE'));
    const req=root.indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains(ASSET_STORE))db.createObjectStore(ASSET_STORE,{keyPath:'assetId'});
      if(!db.objectStoreNames.contains(MARKET_STORE))db.createObjectStore(MARKET_STORE,{keyPath:'listingId'});
    };
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('INDEXEDDB_OPEN_FAILED'));
  });
}
function idbPut(db,store,value){return new Promise((resolve,reject)=>{const tx=db.transaction(store,'readwrite');tx.objectStore(store).put(value);tx.oncomplete=()=>resolve(value);tx.onerror=()=>reject(tx.error||new Error('INDEXEDDB_WRITE_FAILED'));});}
function idbGet(db,store,key){return new Promise((resolve,reject)=>{const req=db.transaction(store,'readonly').objectStore(store).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error||new Error('INDEXEDDB_READ_FAILED'));});}
function idbList(db,store,limit=60){return new Promise((resolve,reject)=>{const rows=[];const req=db.transaction(store,'readonly').objectStore(store).openCursor(null,'prev');req.onsuccess=()=>{const c=req.result;if(!c||rows.length>=limit)return resolve(rows);rows.push(c.value);c.continue();};req.onerror=()=>reject(req.error||new Error('INDEXEDDB_CURSOR_FAILED'));});}

function hexToRgba(hex){const raw=String(hex||'#ffffff').replace('#','');const full=raw.length===3?raw.split('').map(c=>c+c).join(''):raw.padEnd(6,'f').slice(0,6);return [parseInt(full.slice(0,2),16),parseInt(full.slice(2,4),16),parseInt(full.slice(4,6),16),255];}
function rgbaToHex(r,g,b){return '#'+[r,g,b].map(v=>Math.max(0,Math.min(255,v)).toString(16).padStart(2,'0')).join('');}
function floodFill(ctx,w,h,x,y,rgba){
  const image=ctx.getImageData(0,0,w,h),d=image.data,start=(y*w+x)*4,target=[d[start],d[start+1],d[start+2],d[start+3]];
  if(target.every((v,i)=>v===rgba[i]))return false;
  const same=i=>d[i]===target[0]&&d[i+1]===target[1]&&d[i+2]===target[2]&&d[i+3]===target[3];
  const q=[[x,y]],seen=new Uint8Array(w*h);let changed=false;
  while(q.length){const [cx,cy]=q.pop(),idx=cy*w+cx;if(seen[idx])continue;seen[idx]=1;const i=idx*4;if(!same(i))continue;d[i]=rgba[0];d[i+1]=rgba[1];d[i+2]=rgba[2];d[i+3]=rgba[3];changed=true;if(cx>0)q.push([cx-1,cy]);if(cx<w-1)q.push([cx+1,cy]);if(cy>0)q.push([cx,cy-1]);if(cy<h-1)q.push([cx,cy+1]);}
  if(changed)ctx.putImageData(image,0,0);return changed;
}
function thumbnailFromCanvas(document,canvas,size=128){const c=document.createElement('canvas');c.width=size;c.height=size;const x=c.getContext('2d');x.imageSmoothingEnabled=false;x.clearRect(0,0,size,size);const scale=Math.min(size/canvas.width,size/canvas.height),w=Math.max(1,Math.floor(canvas.width*scale)),h=Math.max(1,Math.floor(canvas.height*scale));x.drawImage(canvas,Math.floor((size-w)/2),Math.floor((size-h)/2),w,h);return c.toDataURL('image/png');}
function loadDataUrl(root,url){return new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('ASSET_IMAGE_LOAD_FAILED'));img.src=url;});}

export async function openAssetForgeWorkspace({root=globalThis,permission=null}={}){
  if(active)return active;
  const document=root.document;if(!document?.body)throw new Error('ASSET_FORGE_DOM_REQUIRED');
  document.getElementById(STYLE_ID)?.remove();const style=make(document,'style',{id:STYLE_ID,textContent:css()});document.head.append(style);
  const inputLock=root.KeloInputLocks?.acquire?.('asset-forge',{surface:'creator'})||null;
  const db=await openDb(root).catch(error=>{console.warn('[Asset Forge] persistence unavailable',error);return null;});
  let size=32,tool='pencil',drawing=false,history=[],future=[],evaluation=null,currentAssetId=null,lastSavedAt=null;
  const shell=make(document,'section',{id:'kelo-asset-forge'});shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Kelo Asset Forge');
  const close=make(document,'button',{class:'kaf-close',text:'CLOSE','aria-label':'Cerrar Asset Forge'});
  shell.append(make(document,'header',{class:'kaf-head'},[
    make(document,'div',{class:'kaf-mark',text:'AF'}),
    make(document,'div',{class:'kaf-title'},[make(document,'strong',{text:'ASSET FORGE'}),make(document,'small',{text:'Draw · repair · evaluate · library · market'})]),close
  ]));
  const tabs=make(document,'nav',{class:'kaf-tabs','aria-label':'Asset Forge sections'}),main=make(document,'main',{class:'kaf-main'});shell.append(tabs,main);document.body.append(shell);
  const tabDefs=[['create','CREATE'],['library','LIBRARY'],['market','MARKET'],['health','HEALTH']];const tabButtons=new Map();
  for(const [id,label] of tabDefs){const b=make(document,'button',{class:'kaf-tab',text:label,'aria-selected':'false'});b.onclick=()=>void renderTab(id);tabButtons.set(id,b);tabs.append(b);}

  const canvas=make(document,'canvas',{width:size,height:size});const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=false;
  const grid=make(document,'div',{class:'kaf-grid-overlay'});const canvasShell=make(document,'div',{class:'kaf-canvas-shell'},[canvas,grid]);
  const color=make(document,'input',{class:'kaf-color',type:'color',value:'#d6b45f','aria-label':'Color'});
  const sizeSelect=make(document,'select',{class:'kaf-select','aria-label':'Tamaño del asset'});for(const n of [16,24,32,48,64])sizeSelect.append(make(document,'option',{value:String(n),text:`${n} × ${n}`,selected:n===32}));
  const nameInput=make(document,'input',{class:'kaf-input',value:'New Asset',maxLength:80});
  const categoryInput=make(document,'select',{class:'kaf-select'});for(const c of ['prop','nature','structure','floor','decoration','wearable','vfx'])categoryInput.append(make(document,'option',{value:c,text:c.toUpperCase()}));
  const tagsInput=make(document,'input',{class:'kaf-input',placeholder:'tags: luxury, lamp, winter'});
  const priceInput=make(document,'input',{class:'kaf-input',type:'number',min:'0',step:'1',value:'25',inputMode:'numeric'});
  const status=make(document,'div',{class:'kaf-status',text:'Listo. Dibuja con el dedo; nada de este editor entra al boot normal del juego.'});
  const scoreGrade=make(document,'div',{class:'kaf-grade',text:'—'}),scoreCopy=make(document,'div',{class:'kaf-score-copy'},[make(document,'strong',{text:'Sin evaluar'}),make(document,'small',{text:'SELF CHECK calcula calidad y peso.'})]);
  const issueList=make(document,'div',{class:'kaf-issues'});const aiBox=make(document,'div',{class:'kaf-ai'});const seasonBox=make(document,'div',{class:'kaf-season'});
  const toolButtons=new Map();

  function setStatus(text,error=false){status.textContent=text;status.className=`kaf-status${error?' error':''}`;}
  function pointFromEvent(event){const r=canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(size-1,Math.floor((event.clientX-r.left)/r.width*size))),y:Math.max(0,Math.min(size-1,Math.floor((event.clientY-r.top)/r.height*size)))};}
  function snapshot(){return ctx.getImageData(0,0,size,size);}
  function pushHistory(){history.push(snapshot());if(history.length>40)history.shift();future=[];}
  function putPixel(x,y,erase=false){if(erase){ctx.clearRect(x,y,1,1);return;}const [r,g,b,a]=hexToRgba(color.value);const d=ctx.createImageData(1,1);d.data.set([r,g,b,a]);ctx.putImageData(d,x,y);}
  function applyTool(x,y){
    if(tool==='pencil')putPixel(x,y,false);else if(tool==='eraser')putPixel(x,y,true);else if(tool==='fill')floodFill(ctx,size,size,x,y,hexToRgba(color.value));else if(tool==='eyedropper'){const d=ctx.getImageData(x,y,1,1).data;if(d[3]>0)color.value=rgbaToHex(d[0],d[1],d[2]);setTool('pencil');}
    evaluation=null;paintEvaluation();
  }
  function setTool(next){tool=next;for(const [id,b] of toolButtons)b.classList.toggle('active',id===tool);}
  function undo(){if(!history.length)return;future.push(snapshot());const prev=history.pop();ctx.putImageData(prev,0,0);evaluation=null;paintEvaluation();}
  function redo(){if(!future.length)return;history.push(snapshot());const next=future.pop();ctx.putImageData(next,0,0);evaluation=null;paintEvaluation();}
  function clearCanvas(){pushHistory();ctx.clearRect(0,0,size,size);currentAssetId=null;evaluation=null;paintEvaluation();setStatus('Canvas limpio.');}
  function resizeCanvas(next){next=Math.max(1,Math.min(MAX_FORGE_EDGE,Number(next)||32));const old=document.createElement('canvas');old.width=size;old.height=size;old.getContext('2d').drawImage(canvas,0,0);size=next;canvas.width=size;canvas.height=size;ctx.imageSmoothingEnabled=false;ctx.clearRect(0,0,size,size);ctx.drawImage(old,0,0,old.width,old.height,0,0,size,size);history=[];future=[];grid.style.setProperty('--kaf-w',size);grid.style.setProperty('--kaf-h',size);evaluation=null;paintEvaluation();setStatus(`Canvas cambiado a ${size}×${size}.`);}
  function manifestFor(statusValue='draft'){
    const actor=permission?.actorId?.()||root.KELO_ADMIN_KEYS?.playerId?.()||root.keloNet?.playerKey||'local_pioneer';
    const tags=tagsInput.value.split(',').map(v=>v.trim()).filter(Boolean);const season=getSeasonalBrief(new Date());
    return createKeloAssetManifest({id:currentAssetId||createAssetId(nameInput.value),name:nameInput.value,creatorId:actor,category:categoryInput.value,tags,width:size,height:size,season:tags.includes('seasonal')?season.id:null,priceKC:Number(priceInput.value)||0,status:statusValue,createdAt:lastSavedAt||new Date().toISOString(),updatedAt:new Date().toISOString()});
  }
  function runEvaluation(){const image=snapshot(),manifest=manifestFor();evaluation=evaluateAsset({width:size,height:size,data:image.data,manifest});paintEvaluation();return evaluation;}
  function paintEvaluation(){issueList.replaceChildren();if(!evaluation){scoreGrade.textContent='—';scoreCopy.replaceChildren(make(document,'strong',{text:'Sin evaluar'}),make(document,'small',{text:'SELF CHECK calcula calidad y peso.'}));return;}scoreGrade.textContent=evaluation.grade;scoreCopy.replaceChildren(make(document,'strong',{text:`${evaluation.score}/100`}),make(document,'small',{text:`${evaluation.metrics.visiblePixels} px visibles · ${evaluation.metrics.paletteBuckets} grupos de color · ~${evaluation.metrics.estimatedRgbaBytes} B crudos`}));if(!evaluation.issues.length)issueList.append(make(document,'div',{class:'kaf-issue',text:'Sin problemas detectados por las reglas locales.'}));for(const issue of evaluation.issues)issueList.append(make(document,'div',{class:`kaf-issue ${issue.severity}`,text:`${issue.code}: ${issue.message}`}));}
  function repair(){pushHistory();const image=snapshot(),result=autoRepairPixelBuffer({width:size,height:size,data:image.data});image.data.set(result.data);ctx.putImageData(image,0,0);runEvaluation();setStatus(result.changes.total?`Auto-repair aplicó ${result.changes.total} correcciones seguras.`:'Auto-repair no encontró nada que cambiar.');}
  async function aiCoach(){const report=runEvaluation(),manifest=manifestFor();aiBox.replaceChildren(make(document,'b',{text:'AI COACH · '}),document.createTextNode('Evaluando…'));
    try{const provider=root.KELO_ASSET_AI||root.KeloAssetAI;if(provider&&typeof provider.review==='function'){const reply=await provider.review({manifest,evaluation:report,thumbnail:thumbnailFromCanvas(document,canvas,96)});aiBox.textContent=String(reply?.message||reply||'AI provider returned no message.');return;}}
    catch(error){console.warn('[Asset Forge AI adapter]',error);}
    const first=report.issues[0]?.message||'El asset está técnicamente limpio.';aiBox.replaceChildren(make(document,'b',{text:'LOCAL COACH · '}),document.createTextNode(`${first} Próximo objetivo: mantener score ≥ 70 antes de listar. El adaptador KELO_ASSET_AI queda listo para conectar ChatGPT/otro proveedor sin meter credenciales en el cliente.`));}
  function seasonSeed(){const brief=getSeasonalBrief(new Date());tagsInput.value=[...new Set([...tagsInput.value.split(',').map(v=>v.trim()).filter(Boolean),...brief.tags])].join(', ');color.value=brief.palette[0];seasonBox.replaceChildren(...brief.ideas.map(v=>make(document,'span',{class:'kaf-chip',text:v})));setStatus(`Tema estacional activo: ${brief.label}.`);}
  async function saveAsset(){const report=runEvaluation();if(report.metrics.visiblePixels===0)return setStatus('No puedo guardar un asset vacío.',true);const manifest=manifestFor('draft');currentAssetId=manifest.id;lastSavedAt=manifest.lifecycle.createdAt;const record={assetId:manifest.id,manifest,png:canvas.toDataURL('image/png'),thumb:thumbnailFromCanvas(document,canvas,128),evaluation:report,savedAt:new Date().toISOString(),residency:suggestResidency({owned:true,sizeBytes:report.metrics.estimatedRgbaBytes,lastUsedAt:new Date().toISOString()})};if(db)await idbPut(db,ASSET_STORE,record);else root.localStorage?.setItem(`kelo.asset.${record.assetId}`,JSON.stringify(record));setStatus(`Guardado: ${manifest.name} · ${manifest.id}`);return record;}
  async function publishMarket(){const record=await saveAsset();if(!record)return;const report=record.evaluation;if(report.score<70)return setStatus(`QA bloqueó el listado: score ${report.score}. Repara antes de publicar.`,true);const listing={listingId:`listing-${record.assetId}`,assetId:record.assetId,name:record.manifest.name,creatorId:record.manifest.creatorId,category:record.manifest.category,tags:record.manifest.tags,thumb:record.thumb,priceKC:Math.max(0,Math.round(Number(priceInput.value)||0)),score:report.score,dimensions:record.manifest.dimensions,publishedAt:new Date().toISOString(),status:'listed'};if(db)await idbPut(db,MARKET_STORE,listing);setStatus(`Listado local creado por ${listing.priceKC} KC. Backend de pagos/moderación se conecta encima de este contrato.`);}
  async function exportAsset(){const report=runEvaluation(),manifest=manifestFor();const packet={kind:'kelo-asset-package',version:1,manifest,evaluation:report,imagePngDataUrl:canvas.toDataURL('image/png')};const blob=new Blob([JSON.stringify(packet,null,2)],{type:'application/json'}),url=root.URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`${manifest.id}.keloasset.json`;a.hidden=true;document.body.append(a);a.click();a.remove();root.setTimeout(()=>root.URL.revokeObjectURL(url),1000);setStatus('Paquete .keloasset.json exportado.');}
  async function importImage(file){if(!file)return;const url=root.URL.createObjectURL(file);try{const img=await loadDataUrl(root,url);pushHistory();ctx.clearRect(0,0,size,size);ctx.imageSmoothingEnabled=false;const scale=Math.min(size/img.width,size/img.height),w=Math.max(1,Math.round(img.width*scale)),h=Math.max(1,Math.round(img.height*scale));ctx.drawImage(img,Math.floor((size-w)/2),Math.floor((size-h)/2),w,h);evaluation=null;paintEvaluation();nameInput.value=file.name.replace(/\.[^.]+$/,'').slice(0,80)||nameInput.value;setStatus(`Importado ${file.name}; normalizado a ${size}×${size}.`);}finally{root.URL.revokeObjectURL(url);}}
  async function loadRecord(record){const img=await loadDataUrl(root,record.png);const w=Number(record.manifest?.dimensions?.width)||32;if(w!==size){sizeSelect.value=String(w);resizeCanvas(w);}pushHistory();ctx.clearRect(0,0,size,size);ctx.drawImage(img,0,0,size,size);currentAssetId=record.assetId;nameInput.value=record.manifest?.name||'Asset';categoryInput.value=record.manifest?.category||'prop';tagsInput.value=(record.manifest?.tags||[]).join(', ');priceInput.value=String(record.manifest?.commerce?.priceKC||25);evaluation=record.evaluation||null;paintEvaluation();await renderTab('create');setStatus(`Abierto ${record.manifest?.name||record.assetId}.`);}

  canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.setPointerCapture?.(e.pointerId);drawing=true;pushHistory();const p=pointFromEvent(e);applyTool(p.x,p.y);});
  canvas.addEventListener('pointermove',e=>{if(!drawing||!['pencil','eraser'].includes(tool))return;e.preventDefault();const p=pointFromEvent(e);applyTool(p.x,p.y);});
  const stop=e=>{if(drawing){drawing=false;try{canvas.releasePointerCapture?.(e.pointerId);}catch{}}};canvas.addEventListener('pointerup',stop);canvas.addEventListener('pointercancel',stop);

  function toolButton(id,label){const b=make(document,'button',{class:'kaf-btn',text:label});b.onclick=()=>setTool(id);toolButtons.set(id,b);return b;}
  const imageInput=make(document,'input',{type:'file',accept:'image/png,image/webp,image/jpeg'});imageInput.onchange=()=>void importImage(imageInput.files?.[0]);
  const undoBtn=make(document,'button',{class:'kaf-btn',text:'UNDO'});undoBtn.onclick=undo;const redoBtn=make(document,'button',{class:'kaf-btn',text:'REDO'});redoBtn.onclick=redo;
  const toolbar=make(document,'div',{class:'kaf-toolbar'},[toolButton('pencil','PENCIL'),toolButton('eraser','ERASE'),toolButton('fill','FILL'),toolButton('eyedropper','PICK'),color,undoBtn,redoBtn,make(document,'label',{class:'kaf-file',text:'IMPORT'},imageInput),sizeSelect]);
  sizeSelect.onchange=()=>resizeCanvas(sizeSelect.value);setTool('pencil');grid.style.setProperty('--kaf-w',size);grid.style.setProperty('--kaf-h',size);

  const selfBtn=make(document,'button',{class:'kaf-btn primary',text:'SELF CHECK'});selfBtn.onclick=()=>{runEvaluation();setStatus(`Evaluación terminada: ${evaluation.score}/100.`);};
  const repairBtn=make(document,'button',{class:'kaf-btn',text:'AUTO REPAIR'});repairBtn.onclick=repair;
  const aiBtn=make(document,'button',{class:'kaf-btn',text:'AI COACH'});aiBtn.onclick=()=>void aiCoach();
  const seasonBtn=make(document,'button',{class:'kaf-btn',text:'SEASONAL'});seasonBtn.onclick=seasonSeed;
  const saveBtn=make(document,'button',{class:'kaf-btn primary',text:'SAVE'});saveBtn.onclick=()=>void saveAsset().catch(e=>setStatus(e.message,true));
  const listBtn=make(document,'button',{class:'kaf-btn primary',text:'LIST MARKET'});listBtn.onclick=()=>void publishMarket().catch(e=>setStatus(e.message,true));
  const exportBtn=make(document,'button',{class:'kaf-btn',text:'EXPORT'});exportBtn.onclick=()=>void exportAsset();
  const clearBtn=make(document,'button',{class:'kaf-btn',text:'NEW'});clearBtn.onclick=clearCanvas;

  const createView=make(document,'div',{class:'kaf-create'},[
    make(document,'section',{class:'kaf-panel'},[make(document,'div',{class:'kaf-panel-head'},[make(document,'strong',{text:'PIXEL CANVAS'}),make(document,'span',{text:'ON-DEVICE'})]),toolbar,make(document,'div',{class:'kaf-stage-wrap'},canvasShell),status]),
    make(document,'aside',{class:'kaf-side'},[
      make(document,'section',{class:'kaf-panel'},[make(document,'div',{class:'kaf-panel-head'},[make(document,'strong',{text:'ASSET CONTRACT'}),make(document,'span',{text:'kelo.asset.v1'})]),make(document,'div',{class:'kaf-fields'},[
        make(document,'label',{class:'kaf-label wide',text:'NAME'},nameInput),make(document,'label',{class:'kaf-label',text:'CATEGORY'},categoryInput),make(document,'label',{class:'kaf-label',text:'PRICE KC'},priceInput),make(document,'label',{class:'kaf-label wide',text:'TAGS'},tagsInput)
      ]),make(document,'div',{class:'kaf-actions'},[saveBtn,listBtn,exportBtn,clearBtn])]),
      make(document,'section',{class:'kaf-panel'},[make(document,'div',{class:'kaf-panel-head'},[make(document,'strong',{text:'SELF QA + REPAIR'}),make(document,'span',{text:'SAFE HEURISTICS'})]),make(document,'div',{class:'kaf-score'},[scoreGrade,scoreCopy]),issueList,make(document,'div',{class:'kaf-actions'},[selfBtn,repairBtn,aiBtn,seasonBtn]),aiBox,seasonBox])
    ])
  ]);

  async function renderLibrary(){main.replaceChildren();const rows=db?await idbList(db,ASSET_STORE,60):[];if(!rows.length){main.append(make(document,'div',{class:'kaf-empty',text:'Todavía no hay assets guardados. Crea uno y pulsa SAVE.'}));return;}const list=make(document,'div',{class:'kaf-list'});for(const row of rows){const edit=make(document,'button',{class:'kaf-btn primary',text:'EDIT'});edit.onclick=()=>void loadRecord(row);const card=make(document,'article',{class:'kaf-card'},[make(document,'div',{class:'kaf-thumb'},make(document,'img',{src:row.thumb,alt:''})),make(document,'div',{class:'kaf-card-body'},[make(document,'strong',{text:row.manifest?.name||row.assetId}),make(document,'small',{text:`${row.manifest?.category||'asset'} · QA ${row.evaluation?.score??'—'} · ${row.residency?.tier||'hot'}`}),make(document,'div',{class:'kaf-card-actions'},edit)])]);list.append(card);}main.append(list);}
  async function renderMarket(){main.replaceChildren();main.append(make(document,'div',{class:'kaf-market-head'},[make(document,'p',{text:'Marketplace V1 usa metadata + thumbnails; el asset completo queda en la biblioteca y se carga solo cuando hace falta.'})]));const rows=db?await idbList(db,MARKET_STORE,60):[];if(!rows.length){main.append(make(document,'div',{class:'kaf-empty',text:'No hay listings locales todavía. Un asset necesita QA ≥ 70 para LIST MARKET.'}));return;}const list=make(document,'div',{class:'kaf-list'});for(const row of rows){const use=make(document,'button',{class:'kaf-btn primary',text:'USE COPY'});use.onclick=async()=>{const original=db?await idbGet(db,ASSET_STORE,row.assetId):null;if(!original)return setStatus('El listing no tiene el asset local completo.',true);const copyId=createAssetId(`${original.manifest.name}-copy`);const copyManifest=createKeloAssetManifest({...original.manifest,id:copyId,name:`${original.manifest.name} Copy`,status:'draft',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});const copy={...original,assetId:copyId,manifest:copyManifest,savedAt:new Date().toISOString()};await idbPut(db,ASSET_STORE,copy);await loadRecord(copy);};const card=make(document,'article',{class:'kaf-card'},[make(document,'div',{class:'kaf-thumb'},make(document,'img',{src:row.thumb,alt:''})),make(document,'div',{class:'kaf-card-body'},[make(document,'strong',{text:row.name}),make(document,'small',{text:`${row.priceKC} KC · QA ${row.score} · ${row.dimensions?.width}×${row.dimensions?.height}`}),make(document,'div',{class:'kaf-card-actions'},use)])]);list.append(card);}main.append(list);}
  async function renderHealth(){main.replaceChildren();const assets=db?await idbList(db,ASSET_STORE,200):[],market=db?await idbList(db,MARKET_STORE,200):[];const scores=assets.map(v=>Number(v.evaluation?.score)||0),avg=scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length):0;const tiers=assets.reduce((m,v)=>{const k=v.residency?.tier||'unknown';m[k]=(m[k]||0)+1;return m;},{});const season=getSeasonalBrief(new Date());main.append(make(document,'div',{class:'kaf-empty'},[make(document,'strong',{text:`${assets.length} assets · ${market.length} listings · QA medio ${avg}`}),document.createElement('br'),document.createTextNode(`Residency: ${Object.entries(tiers).map(([k,v])=>`${k} ${v}`).join(' · ')||'sin datos'}`),document.createElement('br'),document.createTextNode(`Temporada sugerida ahora: ${season.label}. Catálogos grandes deben permanecer cold/archive y descargarse bajo demanda.`)]));}
  async function renderTab(id){for(const [key,b] of tabButtons)b.setAttribute('aria-selected',String(key===id));if(id==='create')main.replaceChildren(createView);else if(id==='library')await renderLibrary();else if(id==='market')await renderMarket();else await renderHealth();}

  function onKey(e){if(e.key==='Escape'){e.preventDefault();destroy();return;}if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();if(e.shiftKey)redo();else undo();}}
  function destroy(){if(active?.shell!==shell)return;active=null;document.removeEventListener('keydown',onKey,true);try{db?.close?.();}catch{}try{if(inputLock)root.KeloInputLocks?.release?.(inputLock);}catch{}shell.remove();style.remove();}
  close.onclick=destroy;document.addEventListener('keydown',onKey,true);
  active=Object.freeze({version:'kelo-asset-forge-v1',shell,canvas,close:destroy,selfCheck:runEvaluation,autoRepair:repair,save:saveAsset,get assetId(){return currentAssetId;}});
  await renderTab('create');seasonSeed();return active;
}
export function getAssetForgeWorkspace(){return active;}
export function closeAssetForgeWorkspace(){active?.close?.();}
