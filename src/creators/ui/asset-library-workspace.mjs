/* KELO-INDEX
 * area: CREATORS / ASSET LIBRARY UI
 * owner: Creator Asset Library presentation
 * purpose: manual image import, metadata editing, private/review/global browsing and approval actions
 * public-api: openAssetLibraryWorkspace(), closeAssetLibraryWorkspace(), getAssetLibraryWorkspace()
 * consumes: injected Creator Asset Library service + KeloInputLocks
 * state-owned: transient UI selection/filter/preview only
 * does-not-own: asset records, permissions, runtime catalog, placements or publish authority
 * mobile: responsive full-screen workspace; list is paged to avoid unbounded DOM for large libraries
 */
let active=null;
const PAGE_SIZE=80;
const CSS=`
[data-kelo-asset-library-ui]{box-sizing:border-box;font-family:Inter,system-ui,-apple-system,sans-serif;color:#f5f0e1}#kelo-asset-library{position:fixed;inset:0;z-index:2147482450;background:radial-gradient(circle at 18% -8%,rgba(216,179,88,.16),transparent 34%),#080a0e;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.kal-head{display:flex;align-items:center;gap:11px;padding:11px 13px;border-bottom:1px solid #ffffff14;background:#0b0e13f2}.kal-mark{width:38px;height:38px;border:1px solid #d8b75b88;border-radius:11px;display:grid;place-items:center;color:#f0cf72;font-weight:950}.kal-brand b{display:block;letter-spacing:.08em}.kal-brand small{color:#8d939d}.kal-head .kal-close{margin-left:auto}.kal-btn{min-height:38px;border:1px solid #ffffff1c;background:#151920;color:#fff;border-radius:10px;padding:8px 11px;font-weight:850;cursor:pointer}.kal-btn.primary{border-color:#dbb95f88;background:#dbb95f20;color:#ffe9a5}.kal-btn.good{border-color:#77c79b66;background:#173425;color:#d8ffe7}.kal-btn.warn{border-color:#de9b5366;background:#322116;color:#ffd9ae}.kal-btn.danger{border-color:#e7747466;background:#31191b;color:#ffc5c5}.kal-btn:disabled{opacity:.4;cursor:default}.kal-layout{display:grid;grid-template-columns:310px minmax(0,1fr);min-height:0}.kal-import{padding:14px;border-right:1px solid #ffffff12;overflow:auto;background:#0c0f14dc}.kal-main{min-width:0;display:grid;grid-template-rows:auto minmax(0,1fr);overflow:hidden}.kal-tabs{display:flex;gap:7px;padding:12px 14px;border-bottom:1px solid #ffffff10;overflow:auto}.kal-tab{white-space:nowrap;border:1px solid #ffffff16;background:#11151b;color:#969ca5;border-radius:999px;padding:8px 11px;font-size:10px;font-weight:900}.kal-tab.on{border-color:#dbbc6699;color:#f1d482;background:#241f13}.kal-tools{display:flex;gap:8px;padding:0 14px 12px}.kal-input,.kal-select{width:100%;min-width:0;background:#080b10;color:#fff;border:1px solid #ffffff1b;border-radius:9px;padding:9px}.kal-tools .kal-input{max-width:420px}.kal-scroll{overflow:auto;padding:0 14px 28px}.kal-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;align-content:start}.kal-card{border:1px solid #ffffff12;border-radius:14px;background:linear-gradient(145deg,#12171e,#0d1117);overflow:hidden;min-width:0}.kal-thumb{height:132px;background:repeating-conic-gradient(#151b22 0 25%,#11161c 0 50%) 50%/18px 18px;display:grid;place-items:center;overflow:hidden}.kal-thumb img{width:100%;height:100%;object-fit:contain;image-rendering:auto}.kal-thumb span{font-size:26px;color:#4e5968}.kal-card-body{padding:10px}.kal-card strong{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.kal-meta{font-size:9px;color:#8d949e;margin-top:4px;line-height:1.45}.kal-id{font:8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#737c88;word-break:break-all;margin-top:5px}.kal-actions{display:flex;gap:5px;flex-wrap:wrap;margin-top:9px}.kal-actions .kal-btn{min-height:30px;padding:5px 7px;font-size:8px}.kal-pill{display:inline-flex;margin-top:7px;border-radius:999px;padding:4px 6px;font-size:8px;font-weight:950;letter-spacing:.08em;background:#ffffff0d;color:#b6bdc7}.kal-pill.global{background:#153124;color:#aef1c7}.kal-pill.review{background:#352a13;color:#f1d27d}.kal-section{padding-bottom:13px;margin-bottom:13px;border-bottom:1px solid #ffffff12}.kal-section h3{font-size:10px;letter-spacing:.15em;color:#d0b66e;margin:0 0 9px}.kal-label{display:grid;gap:5px;margin:8px 0;font-size:10px;color:#abb1ba;font-weight:750}.kal-file{border:1px dashed #d0b36155;border-radius:13px;padding:13px;text-align:center;background:#d0b3610a}.kal-preview{height:170px;border-radius:11px;overflow:hidden;background:#0a0d11;display:grid;place-items:center;margin-bottom:9px}.kal-preview img{width:100%;height:100%;object-fit:contain}.kal-preview span{color:#6f7883;font-size:11px}.kal-row{display:grid;grid-template-columns:1fr 1fr;gap:7px}.kal-note,.kal-status{font-size:10px;color:#8f969f;line-height:1.5}.kal-status{padding:9px 0;min-height:28px}.kal-more{display:block;margin:14px auto 0}.kal-empty{border:1px dashed #ffffff18;border-radius:14px;padding:28px;text-align:center;color:#8c949e}.kal-official .kal-thumb{height:90px}.kal-kpis{display:flex;gap:8px;flex-wrap:wrap;padding:0 14px 11px}.kal-kpi{font-size:9px;color:#9ca3ad;background:#ffffff08;border-radius:8px;padding:6px 8px}.kal-kpi b{color:#ead17f}
@media(max-width:760px){.kal-layout{grid-template-columns:1fr;overflow:auto}.kal-import{border-right:0;border-bottom:1px solid #ffffff12;max-height:none}.kal-main{overflow:visible;min-height:520px}.kal-scroll{overflow:visible}.kal-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.kal-brand small{display:none}}
@media(max-width:430px){.kal-grid{grid-template-columns:1fr 1fr;gap:7px}.kal-card-body{padding:8px}.kal-thumb{height:105px}.kal-head{padding:8px}.kal-mark{width:33px;height:33px}.kal-import{padding:10px}.kal-tabs,.kal-tools,.kal-kpis,.kal-scroll{padding-left:10px;padding-right:10px}.kal-row{grid-template-columns:1fr}.kal-card strong{font-size:11px}}
`;
function make(doc,tag,props={},children=[]){const el=doc.createElement(tag);for(const[k,v]of Object.entries(props)){if(k==='class')el.className=v;else if(k==='text')el.textContent=v;else if(k.startsWith('data-')||k.startsWith('aria-'))el.setAttribute(k,v);else el[k]=v;}for(const child of [].concat(children||[]))if(child)el.append(child);return el;}
function humanBytes(value){const n=Number(value)||0;if(n<1024)return`${n} B`;if(n<1024*1024)return`${(n/1024).toFixed(1)} KB`;return`${(n/1024/1024).toFixed(1)} MB`;}
function previewUrl(root,blob){try{return blob&&root.URL?.createObjectURL?.(blob)||null;}catch{return null;}}

export async function openAssetLibraryWorkspace({root=globalThis,assetLibrary,permission=null}={}){
  if(active)return active;
  if(!root.document)throw new Error('CREATOR_ASSET_LIBRARY_DOM_REQUIRED');
  if(!assetLibrary?.importFile)throw new Error('CREATOR_ASSET_LIBRARY_SERVICE_REQUIRED');
  if(!root.KeloInputLocks?.acquire||!root.KeloInputLocks?.release)throw new Error('CREATOR_ASSET_LIBRARY_INPUT_LOCKS_NOT_READY');
  await assetLibrary.hydrateRuntimeCatalog?.();
  const doc=root.document,urls=new Set();let scope='mine',query='',limit=PAGE_SIZE,file=null,busy=false;
  const style=make(doc,'style',{'data-kelo-asset-library-ui':'',textContent:CSS});doc.head.append(style);
  const shell=make(doc,'section',{id:'kelo-asset-library'});shell.setAttribute('data-kelo-asset-library-ui','');shell.setAttribute('role','dialog');shell.setAttribute('aria-modal','true');shell.setAttribute('aria-label','Kelo Asset Library');
  const close=make(doc,'button',{class:'kal-btn kal-close',text:'CERRAR'}),head=make(doc,'header',{class:'kal-head'},[make(doc,'div',{class:'kal-mark',text:'AL'}),make(doc,'div',{class:'kal-brand'},[make(doc,'b',{text:'KELO ASSET LIBRARY'}),make(doc,'small',{text:'Sube manualmente · reutiliza · publica por revisión'})]),close]);
  const importPane=make(doc,'aside',{class:'kal-import'}),main=make(doc,'main',{class:'kal-main'}),layout=make(doc,'div',{class:'kal-layout'},[importPane,main]);shell.append(head,layout);doc.body.append(shell);
  const token=root.KeloInputLocks.acquire('kelo-asset-library',{kind:'creator-workspace'});

  const fileInput=make(doc,'input',{type:'file',accept:'image/png,image/webp,image/jpeg',hidden:true}),pick=make(doc,'button',{class:'kal-btn',text:'ELEGIR IMAGEN'}),preview=make(doc,'div',{class:'kal-preview'},[make(doc,'span',{text:'PNG · WebP · JPEG'})]);
  const name=make(doc,'input',{class:'kal-input',placeholder:'Nombre del asset'}),category=make(doc,'select',{class:'kal-select'}),family=make(doc,'input',{class:'kal-input',placeholder:'Ej. tree, lamp, imperial-plaza'}),tags=make(doc,'input',{class:'kal-input',placeholder:'tree, white, royal…'}),districts=make(doc,'input',{class:'kal-input',placeholder:'* o forest,central'}),width=make(doc,'input',{class:'kal-input',type:'number',min:'8',max:'1024',step:'8',value:'128'}),height=make(doc,'input',{class:'kal-input',type:'number',min:'8',max:'1024',step:'8',value:'128'}),collision=make(doc,'select',{class:'kal-select'}),phase=make(doc,'select',{class:'kal-select'}),importButton=make(doc,'button',{class:'kal-btn primary',text:'IMPORTAR A MI BIBLIOTECA'}),formStatus=make(doc,'div',{class:'kal-status'});
  for(const c of assetLibrary.limits.categories)category.append(make(doc,'option',{value:c,text:c.toUpperCase()}));
  for(const[v,label]of[['bottom','COLISIÓN BASE AUTOMÁTICA'],['none','SIN COLISIÓN']])collision.append(make(doc,'option',{value:v,text:label}));
  for(const[v,label]of[['props_back','DETRÁS DEL JUGADOR'],['props_front','DELANTE DEL JUGADOR']])phase.append(make(doc,'option',{value:v,text:label}));
  districts.value='*';
  importPane.append(make(doc,'section',{class:'kal-section'},[make(doc,'h3',{text:'IMPORTAR ASSET'}),make(doc,'div',{class:'kal-file'},[preview,pick,fileInput]),make(doc,'div',{class:'kal-note',text:'El archivo se guarda como una revisión inmutable. Cambiar la imagen crea otra revisión; los mapas conservan el ID anterior.'})]),make(doc,'section',{class:'kal-section'},[make(doc,'h3',{text:'METADATA'}),make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Nombre'}),name]),make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Categoría'}),category]),make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Familia semántica'}),family]),make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Tags'}),tags]),make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Distritos'}),districts]),make(doc,'div',{class:'kal-row'},[make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Ancho mundo'}),width]),make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Alto mundo'}),height])]),make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Colisión'}),collision]),make(doc,'label',{class:'kal-label'},[make(doc,'span',{text:'Capa'}),phase]),importButton,formStatus]),make(doc,'div',{class:'kal-note',text:`Límite actual: ${humanBytes(assetLibrary.limits.maxFileBytes)} · máximo ${assetLibrary.limits.maxDimension}×${assetLibrary.limits.maxDimension}px. Map Forge y World Editor consumen el mismo ID registrado.`}));

  const tabs=make(doc,'div',{class:'kal-tabs'}),search=make(doc,'input',{class:'kal-input',placeholder:'Buscar nombre, ID, categoría o familia…'}),tools=make(doc,'div',{class:'kal-tools'},[search]),kpis=make(doc,'div',{class:'kal-kpis'}),scroll=make(doc,'div',{class:'kal-scroll'}),grid=make(doc,'div',{class:'kal-grid'});scroll.append(grid);main.append(tabs,tools,kpis,scroll);
  const tabDefs=[['mine','MIS ASSETS'],['global','GLOBAL'],['official','KELO OFFICIAL']];if(assetLibrary.capabilities.publish)tabDefs.splice(2,0,['review','REVISIÓN']);
  for(const[id,label]of tabDefs){const b=make(doc,'button',{class:'kal-tab',text:label,'data-scope':id});b.onclick=()=>{scope=id;limit=PAGE_SIZE;void render();};tabs.append(b);}

  function clearUrls(){for(const url of urls)try{root.URL?.revokeObjectURL?.(url);}catch{}urls.clear();}
  function setFile(next){file=next||null;preview.replaceChildren();if(!file){preview.append(make(doc,'span',{text:'PNG · WebP · JPEG'}));return;}const url=previewUrl(root,file);if(url){urls.add(url);preview.append(make(doc,'img',{src:url,alt:''}));}else preview.append(make(doc,'span',{text:file.name||'Imagen'}));if(!name.value)name.value=String(file.name||'Asset').replace(/\.[^.]+$/,'');}
  pick.onclick=()=>fileInput.click();fileInput.onchange=()=>setFile(fileInput.files?.[0]||null);

  async function doImport(){
    if(busy||!file)return;busy=true;importButton.disabled=true;formStatus.style.color='';formStatus.textContent='Validando e importando…';
    try{
      const rec=await assetLibrary.importFile({file,name:name.value||null,category:category.value,family:family.value||null,tags:tags.value,districts:districts.value.split(',').map(x=>x.trim()).filter(Boolean),worldWidth:Number(width.value)||null,worldHeight:Number(height.value)||null,collisionMode:collision.value,phase:phase.value});
      formStatus.textContent=`Importado: ${rec.assetId}`;formStatus.style.color='#b7f1ca';setFile(null);fileInput.value='';name.value='';family.value='';tags.value='';scope='mine';limit=PAGE_SIZE;await render();root.showToast?.('Asset añadido a tu biblioteca');
    }catch(error){formStatus.textContent=error?.message||String(error);formStatus.style.color='#ffaaa8';}
    finally{busy=false;importButton.disabled=false;}
  }
  importButton.onclick=()=>void doImport();

  function matches(row){if(!query)return true;const h=`${row.name||row.label||''} ${row.assetId||row.id||''} ${row.category||''} ${row.family||''} ${(row.tags||[]).join(' ')}`.toLowerCase();return h.includes(query);}
  function statusPill(row){return make(doc,'span',{class:`kal-pill ${row.status||''}`,text:String(row.status||'official').toUpperCase()});}
  function cardFor(row,{official=false}={}){
    const card=make(doc,'article',{class:`kal-card${official?' kal-official':''}`}),thumb=make(doc,'div',{class:'kal-thumb'}),body=make(doc,'div',{class:'kal-card-body'});
    const url=!official&&row.blob?previewUrl(root,row.blob):null;if(url){urls.add(url);thumb.append(make(doc,'img',{src:url,alt:''}));}else thumb.append(make(doc,'span',{text:official?'◆':'IMG'}));
    body.append(make(doc,'strong',{text:row.name||row.label||row.assetId||row.id}),make(doc,'div',{class:'kal-meta',text:official?`${row.category} · ${row.family}`:`${row.category} · ${row.family} · r${row.revision} · ${row.image.width}×${row.image.height} · mundo ${row.worldSize.w}×${row.worldSize.h}`}),statusPill(row),make(doc,'div',{class:'kal-id',text:row.assetId||row.id}));
    if(!official){const actions=make(doc,'div',{class:'kal-actions'});if(row.status==='private'){const submit=make(doc,'button',{class:'kal-btn good',text:'ENVIAR A REVISIÓN'});submit.onclick=async()=>{try{await assetLibrary.submit(row.assetId);await render();}catch(e){root.showToast?.(e.message);}};actions.append(submit);}if(row.status==='review'&&assetLibrary.capabilities.publish){const publish=make(doc,'button',{class:'kal-btn primary',text:'PUBLICAR GLOBAL'});publish.onclick=async()=>{try{await assetLibrary.publish(row.assetId);await render();root.showToast?.('Asset publicado en Global Library');}catch(e){root.showToast?.(e.message);}};actions.append(publish);}if(row.status!=='global'&&String(row.ownerId)===String(permission?.actorId?.()||'')){const del=make(doc,'button',{class:'kal-btn danger',text:'BORRAR BORRADOR'});del.onclick=async()=>{try{await assetLibrary.remove(row.assetId);await render();}catch(e){root.showToast?.(e.message);}};actions.append(del);}if(actions.childElementCount)body.append(actions);}
    card.append(thumb,body);return card;
  }
  async function render(){
    clearUrls();tabs.querySelectorAll('.kal-tab').forEach(b=>b.classList.toggle('on',b.dataset.scope===scope));grid.replaceChildren();kpis.replaceChildren();
    let rows=[],official=false;
    if(scope==='official'){official=true;rows=(root.KELO_PROPERTY_CATALOG?.list?.()||[]).filter(x=>x.source!=='creator-library').map(x=>({id:x.id,label:x.label,category:x.category,family:x.family,status:'official'}));}
    else rows=await assetLibrary.list({scope});
    rows=rows.filter(matches);const shown=rows.slice(0,limit);
    kpis.append(make(doc,'span',{class:'kal-kpi'},[make(doc,'b',{text:String(rows.length)}),doc.createTextNode(' resultados')]),make(doc,'span',{class:'kal-kpi'},[make(doc,'b',{text:String(assetLibrary.catalogSnapshot().length)}),doc.createTextNode(' assets disponibles para editores/Map Forge')]));
    if(!shown.length)grid.append(make(doc,'div',{class:'kal-empty',text:scope==='mine'?'Todavía no has importado assets. Usa el panel de la izquierda.':'No hay assets en esta vista.'}));
    else for(const row of shown)grid.append(cardFor(row,{official}));
    const old=scroll.querySelector('.kal-more');old?.remove?.();if(rows.length>shown.length){const more=make(doc,'button',{class:'kal-btn kal-more',text:`MOSTRAR ${Math.min(PAGE_SIZE,rows.length-shown.length)} MÁS`});more.onclick=()=>{limit+=PAGE_SIZE;void render();};scroll.append(more);}
  }
  search.oninput=()=>{query=search.value.trim().toLowerCase();limit=PAGE_SIZE;void render();};

  function destroy(){if(active?.shell!==shell)return;active=null;clearUrls();try{root.KeloInputLocks.release(token);}catch{}doc.removeEventListener('keydown',onKey,true);shell.remove();style.remove();}
  const onKey=e=>{if(e.key==='Escape'){e.preventDefault();destroy();}};close.onclick=destroy;doc.addEventListener('keydown',onKey,true);
  active=Object.freeze({version:'creator-asset-library-ui-v1.0.0',shell,assetLibrary,get scope(){return scope;},show(next){scope=String(next||'mine');limit=PAGE_SIZE;return render();},close:destroy});
  await render();return active;
}
export function closeAssetLibraryWorkspace(){active?.close?.();}
export function getAssetLibraryWorkspace(){return active;}
