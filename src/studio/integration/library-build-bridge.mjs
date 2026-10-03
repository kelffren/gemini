/* KELO-INDEX
 * area: STUDIO / LIBRARY BUILD BRIDGE
 * owner: Kelo Universal Content → Studio
 * keys: LIBRARY BUILD FAST PLACE GHOST PERSONAL ASSET SCENE PAINTER MOBILE VAULT
 * owns: one-way handoff from integrated personal content into Studio's canonical placement tools
 * does-not-own: downloads, licensing, authority writes, world rendering or library navigation
 * public-api: startPersonalAssetPlacement(), startPersonalAssetPalette(), listPersonalBuildTemplates(), ensureFastScenePainter(), ensureLibraryPaletteBrush()
 * online: all commits still flow through Studio placement/CommandBus/authority mirror
 */
import {seedCatalogPrefabs} from '../adapters/catalog-prefab-seeder.mjs';
import {buildSemanticPalette,semanticRoleCounts} from '../tools/semantic-brush-profile.mjs';
import {prepareSceneImport,sceneHealth} from './scene-fabric.mjs';
import {getAsset,getManifest,rememberAsset,downloadAsset,integrateContent} from '../../creators/assets/personal-asset-vault.mjs';

// KELO-INDEX TILESET SELECT: UI requests ordinary placement; it never commits a whole sheet.
export async function startTilesetLibraryPlacement({root=globalThis,session,asset}={}){
  if(!asset?.id||!session?.studio?.kernel)throw new Error('LIBRARY_TILESET_SESSION_REQUIRED');
  root.__KELO_TILESET_PICKER__?.destroy?.();
  session.setMode?.('select');
  const doc=root.document,panel=doc.createElement('section');
  panel.id='kelo-tileset-picker';panel.dataset.keloStudioUi='1';
  panel.style.cssText='position:fixed;pointer-events:auto;z-index:2147483310;right:8px;top:max(120px,calc(var(--kcad-header-bottom,112px) + 8px));width:min(340px,calc(100vw - 16px));max-height:calc(100vh - max(120px,calc(var(--kcad-header-bottom,112px) + 8px)) - max(90px,calc(env(safe-area-inset-bottom) + 78px)));overflow:auto;padding:10px;border:1px solid #927b42;border-radius:14px;background:#101820;color:#fff;font:12px system-ui;box-sizing:border-box';
  panel.innerHTML='<div style="display:flex;gap:8px;align-items:center"><b style="flex:1">Elegir tile</b><button type="button" data-tileset-toggle>Cambiar tile</button><button type="button" data-tileset-close aria-label="Cerrar tileset">×</button></div><div data-tileset-body><p data-tileset-name></p><div style="display:flex;gap:6px;flex-wrap:wrap"><label>Ancho <input data-grid="tileWidth" type="number" min="1" max="512" style="width:58px"></label><label>Alto <input data-grid="tileHeight" type="number" min="1" max="512" style="width:58px"></label><label>Margen <input data-grid="margin" type="number" min="0" max="128" style="width:48px"></label><label>Separación <input data-grid="spacing" type="number" min="0" max="128" style="width:48px"></label></div><button type="button" data-tileset-prepare>Usar tileset</button><p data-tileset-status role="status">Define el tamaño en píxeles y elige una pieza para colocarla en el mapa.</p><div data-tileset-tiles style="display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:4px"></div><div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button type="button" data-tileset-prev>Anterior</button><span data-tileset-page></span><button type="button" data-tileset-next>Siguiente</button></div></div>';
  panel.querySelectorAll('button').forEach(b=>b.style.cssText='min-height:44px;min-width:44px;border:1px solid #665c40;border-radius:8px;background:#20302c;color:white;cursor:pointer');
  const host=doc.getElementById('kelo-studio-live')||doc.body;host.append(panel);
  let destroyed=false,busy=false,page=0,templates=[],observer=null,layoutObserver=null;
  const toolbar=host.querySelector?.('.ks-top');
  const layout=()=>{
    const height=Number(root.visualViewport?.height||root.innerHeight)||844;
    const headerBottom=Number(toolbar?.getBoundingClientRect?.().bottom)||112;
    const top=Math.min(Math.max(12,headerBottom+8),Math.max(12,height-280));
    panel.style.top=`${top}px`;
    panel.style.maxHeight=`${Math.max(96,height-top-90)}px`;
  };
  layout();root.addEventListener?.('resize',layout);
  if(toolbar&&root.ResizeObserver){layoutObserver=new root.ResizeObserver(layout);layoutObserver.observe(toolbar);}
  const controller={mode:'tileset',assetId:asset.id,panel,destroy};root.__KELO_TILESET_PICKER__=controller;
  observer=root.MutationObserver?new root.MutationObserver(()=>{if(!panel.isConnected)destroy();}):null;
  observer?.observe(doc.body,{childList:true,subtree:true});
  const body=panel.querySelector('[data-tileset-body]'),status=panel.querySelector('[data-tileset-status]'),prepare=panel.querySelector('[data-tileset-prepare]');
  panel.querySelector('[data-tileset-name]').textContent=asset.name||asset.id;
  const existing=await getAsset(asset.id);
  if(destroyed||!panel.isConnected){destroy();return controller;}
  const manifest=await getManifest(asset.id);
  if(destroyed||!panel.isConnected){destroy();return controller;}
  const grid=manifest?.grid||existing?.tileGrid||asset.tileGrid||{};
  for(const input of panel.querySelectorAll('[data-grid]'))input.value=grid[input.dataset.grid]??(input.dataset.grid==='tileWidth'||input.dataset.grid==='tileHeight'?32:0);
  function destroy(){if(destroyed)return;destroyed=true;observer?.disconnect();layoutObserver?.disconnect();root.removeEventListener?.('resize',layout);panel.remove();if(root.__KELO_TILESET_PICKER__===controller)root.__KELO_TILESET_PICKER__=null;}
  function render(){
    const list=panel.querySelector('[data-tileset-tiles]');list.replaceChildren();
    const pages=Math.max(1,Math.ceil(templates.length/48));page=Math.min(page,pages-1);
    for(const template of templates.slice(page*48,(page+1)*48)){
      const button=doc.createElement('button');button.type='button';button.dataset.tileTemplate=template.id;button.title=template.label;button.setAttribute('aria-label',template.label);
      button.style.cssText='min-height:44px;min-width:0;padding:3px;border:1px solid #536658;border-radius:6px;background:#20302c;color:white';
      const canvas=doc.createElement('canvas');canvas.width=40;canvas.height=40;canvas.style.cssText='width:100%;height:40px;object-fit:contain;image-rendering:pixelated';button.append(canvas);list.append(button);
      void session.studio.assetPreview.renderThumbnail(canvas,template,{cssSize:40}).catch(()=>{});
      button.onclick=()=>{session.setSnapSize?.(template.snap);session.beginPlacement(template.id);status.textContent=`${template.label} · toca el mapa para colocar. Cambiar tile abre estas piezas.`;body.hidden=true;};
    }
    panel.querySelector('[data-tileset-page]').textContent=templates.length?`${page+1}/${pages} · ${templates.length} tiles`:'';
    panel.querySelector('[data-tileset-prev]').disabled=page===0;
    panel.querySelector('[data-tileset-next]').disabled=page>=pages-1;
  }
  async function showCompiled(compiled){
    await ensurePersonalVisualRegistered(root,asset.id);
    if(destroyed)return;
    seedCatalogPrefabs({prefabRegistry:session.studio.kernel.prefabs,assetCatalog:catalogFor(root,session)});
    const ids=new Set(compiled.assets.filter(f=>f.gridSignature===compiled.grid?.signature).map(f=>`personal:${asset.id}:${f.frameId}`));
    session.refreshAssets?.();
    templates=listPersonalBuildTemplates({root,session,assetId:asset.id}).filter(row=>ids.has(row.id));page=0;render();
    status.textContent=templates.length?'Toca una pieza y después el mapa. Puedes repetirla o cambiar de tile.':'No hay piezas en esta cuadrícula.';
    prepare.textContent='Actualizar cuadrícula';
  }
  prepare.onclick=async()=>{
    if(busy||destroyed)return;busy=true;prepare.disabled=true;status.textContent='Preparando tileset…';
    try{
      const tileGrid=Object.fromEntries([...panel.querySelectorAll('[data-grid]')].map(input=>[input.dataset.grid,Number(input.value)]));
      let local=await getAsset(asset.id);if(!local?.downloaded)local=await downloadAsset({...asset,tileGrid});
      await rememberAsset({...local,tileGrid});
      const result=await integrateContent(asset.id);if(!destroyed)await showCompiled(result.manifest);
    }catch(error){if(!destroyed)status.textContent=`No se pudo preparar: ${String(error?.message||error).replaceAll('_',' ')}`;}
    finally{busy=false;if(!destroyed)prepare.disabled=false;}
  };
  panel.querySelector('[data-tileset-toggle]').onclick=()=>{body.hidden=!body.hidden;};
  panel.querySelector('[data-tileset-close]').onclick=destroy;
  panel.querySelector('[data-tileset-prev]').onclick=()=>{page=Math.max(0,page-1);render();};
  panel.querySelector('[data-tileset-next]').onclick=()=>{page++;render();};
  if(manifest?.grid)await showCompiled(manifest);
  return controller;
}

const text=value=>String(value??'').trim();

function catalogFor(root,session){
  return session?.studio?.adapter?.assetCatalog||root?.KELO_PROPERTY_CATALOG||null;
}
function catalogRows(catalog){
  try{const rows=catalog?.list?.();return Array.isArray(rows)?rows:[];}catch{return[];}
}
export function listPersonalBuildTemplates({root=globalThis,session=null,assetId}={}){
  const id=text(assetId);if(!id)return[];
  const catalog=catalogFor(root,session);
  return catalogRows(catalog).filter(row=>{
    if(!row?.id||row.placeable===false)return false;
    return String(row.sourceId||'')===id||String(row.id).startsWith(`personal:${id}:`);
  });
}
export function choosePersonalBuildTemplate(rows=[],templateId=null){
  const list=(Array.isArray(rows)?rows:[]).filter(Boolean);
  if(!list.length)return null;
  const wanted=text(templateId);
  if(wanted){const exact=list.find(row=>String(row.id)===wanted);if(exact)return exact;}
  return list.find(row=>row.placeable!==false)||list[0]||null;
}
async function ensurePersonalVisualRegistered(root,assetId){
  let bridge=root?.KELO_PERSONAL_ASSET_RUNTIME_BRIDGE;
  if(typeof bridge?.registerPersonalAsset!=='function'){
    try{
      const mod=await import('../../creators/assets/personal-asset-runtime-bridge.mjs?v=external-studio-handoff-1');
      if(typeof mod?.registerPersonalAsset==='function')return mod.registerPersonalAsset(root,String(assetId));
    }catch(error){console.warn('[Kelo library build] personal runtime bridge unavailable',error);}
    bridge=root?.KELO_PERSONAL_ASSET_RUNTIME_BRIDGE;
  }
  if(typeof bridge?.registerPersonalAsset!=='function')return false;
  return bridge.registerPersonalAsset(root,String(assetId));
}
function screenCenter(root,session){
  const w=Math.max(1,Number(root?.innerWidth)||1),h=Math.max(1,Number(root?.innerHeight)||1);
  try{const point=session?.cameraController?.toWorld?.(w/2,h/2);if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))return point;}catch{}
  try{const point=session?.studio?.adapter?.screenToWorld?.(w/2,h/2);if(Number.isFinite(point?.x)&&Number.isFinite(point?.y))return point;}catch{}
  try{const snap=root?.KeloCamera?.snapshot?.();if(Number.isFinite(snap?.x)&&Number.isFinite(snap?.y))return{x:Number(snap.x),y:Number(snap.y)};}catch{}
  return{x:0,y:0};
}
export async function ensureLibraryPaletteBrush(session,{root=globalThis}={}){
  const studio=session?.studio,kernel=studio?.kernel,tools=studio?.tools;
  if(!kernel||!tools)throw new Error('LIBRARY_PALETTE_STUDIO_NOT_READY');
  if(tools.libraryPaletteBrush)return tools.libraryPaletteBrush;
  const existing=kernel.tools?.get?.('libraryPaletteBrush');
  if(existing){try{tools.libraryPaletteBrush=existing;}catch{}return existing;}
  const mod=await import('../tools/library-palette-brush-tool.mjs?v=3-context');
  const tool=mod.createLibraryPaletteBrushTool(kernel,{root});
  kernel.tools.register(tool);
  try{tools.libraryPaletteBrush=tool;}catch{}
  return tool;
}
export async function ensureFastScenePainter(session){
  const studio=session?.studio,kernel=studio?.kernel,tools=studio?.tools;
  if(!kernel||!tools)return null;
  if(tools.paintCopies)return tools.paintCopies;
  const existing=kernel.tools?.get?.('paintCopies');
  if(existing){try{tools.paintCopies=existing;}catch{}return existing;}
  const mod=await import('../tools/paint-copies-tool.mjs');
  const tool=mod.createPaintCopiesTool(kernel);
  kernel.tools.register(tool);
  try{tools.paintCopies=tool;}catch{}
  return tool;
}
async function startVisual({root,session,assetId,templateId}){
  await ensurePersonalVisualRegistered(root,assetId).catch(()=>false);
  const studio=session?.studio,kernel=studio?.kernel,catalog=catalogFor(root,session);
  if(!studio||!kernel||!catalog)throw new Error('LIBRARY_BUILD_STUDIO_NOT_READY');
  seedCatalogPrefabs({prefabRegistry:kernel.prefabs,assetCatalog:catalog});
  session.refreshAssets?.();
  const rows=listPersonalBuildTemplates({root,session,assetId});
  const template=choosePersonalBuildTemplate(rows,templateId);
  if(!template)throw new Error('LIBRARY_BUILD_TEMPLATE_NOT_READY');
  session.beginPlacement?.(template.id);
  const active=studio.tools?.placement?.getPreview?.();if(String(active?.prefabId||'')!==String(template.id))throw new Error('LIBRARY_BUILD_GHOST_NOT_READY');
  const point=screenCenter(root,session),snap=Math.max(1,Number(session.snapSize)||Number(kernel.document?.settings?.tileSize)||32);
  studio.tools?.placement?.move?.(point.x,point.y,{snap});
  return{mode:'placement',prefabId:String(template.id),template,alternatives:rows.map(row=>String(row.id)),point,snap};
}
async function startScene({root,session,assetId}){
  const api=root?.KELO_PERSONAL_SCENES,studio=session?.studio;
  if(!api||!studio?.tools?.prefabStamp)return null;
  try{api.installIntoStudio?.(studio);}catch{}
  const row=api.get?.(String(assetId)),definition=row?.manifest?.prefabDefinition;
  if(!definition?.id)return null;
  const manifest=row?.manifest?.sceneManifest||{
    sceneId:String(row?.manifest?.sceneId||definition.id),
    version:Number(row?.manifest?.version)||1,
    label:definition.label||definition.id,
    dependencies:[...new Set((definition.children||[]).map(child=>String(child?.prefabId||'')).filter(Boolean))],
    instances:(definition.children||[]).map((child,index)=>({instanceId:String(child?.id||`${definition.id}:child:${index}`),assetId:String(child?.prefabId||''),transform:{x:Number(child?.dx)||0,y:Number(child?.dy)||0,rotation:Number(child?.rotation)||0,scale:Number(child?.scale)||1},layer:String(child?.layer||'world')}))
  };
  const hasAsset=id=>!!studio.kernel?.prefabs?.resolve?.(String(id));
  const ensureAsset=async id=>{try{api.installIntoStudio?.(studio);}catch{}return hasAsset(id);};
  const staged=await prepareSceneImport(manifest,{hasAsset,ensureAsset,maxInstances:2500});
  studio.tools.prefabStamp.start(definition.id);
  session.setMode?.('prefab');
  const point=screenCenter(root,session),snap=Math.max(1,Number(session.snapSize)||Number(studio.kernel?.document?.settings?.tileSize)||32);
  studio.tools.prefabStamp.move?.(point.x,point.y,{snap});
  return{mode:'prefab',prefabId:String(definition.id),template:definition,alternatives:[String(definition.id)],point,snap,sceneStage:staged,sceneHealth:sceneHealth(staged)};
}
export async function startPersonalAssetPalette({root=globalThis,session,assetIds=[],maxTemplates=24}={}){
  const ids=[...new Set((Array.isArray(assetIds)?assetIds:[]).map(text).filter(Boolean))].slice(0,16);
  if(ids.length<2)throw new Error('LIBRARY_PALETTE_NEEDS_TWO_ASSETS');
  const studio=session?.studio,kernel=studio?.kernel,catalog=catalogFor(root,session);
  if(!studio||!kernel||!catalog)throw new Error('LIBRARY_PALETTE_STUDIO_NOT_READY');
  for(const id of ids)await ensurePersonalVisualRegistered(root,id).catch(()=>false);
  seedCatalogPrefabs({prefabRegistry:kernel.prefabs,assetCatalog:catalog});
  const templates=[];const perAsset=Math.max(1,Math.min(4,Math.floor(Math.max(2,Number(maxTemplates)||24)/ids.length)||1));
  for(const id of ids){
    const rows=listPersonalBuildTemplates({root,session,assetId:id}).slice(0,perAsset);
    for(const row of rows){if(templates.length>=maxTemplates)break;templates.push(row);}
    if(templates.length>=maxTemplates)break;
  }
  const semanticPalette=buildSemanticPalette(templates),prefabIds=semanticPalette.map(row=>String(row.id));
  if(prefabIds.length<2)throw new Error('LIBRARY_PALETTE_TEMPLATES_NOT_READY');
  session.setMode?.('select');
  const tool=await ensureLibraryPaletteBrush(session,{root});
  const snap=Math.max(1,Math.min(32,Number(session.snapSize)||Number(kernel.document?.settings?.tileSize)||16));
  tool.configurePalette(semanticPalette,{activate:true,snap,spacing:72,density:1,radius:96,minSpacing:18,avoidOverlap:true,avoidCollisions:true,collisionClearance:8,maxPreview:120,semanticPreset:'balanced'});
  const roles=semanticRoleCounts(semanticPalette);
  const detail=Object.freeze({assetIds:ids.slice(),prefabIds:prefabIds.slice(),variants:prefabIds.length,roles,mode:'semantic-brush'});
  try{root.dispatchEvent?.(new CustomEvent('kelo:library-palette-ready',{detail}));root.dispatchEvent?.(new CustomEvent('kelo:semantic-brush-ready',{detail}));}catch{}
  return Object.freeze({mode:'semantic-brush',assetIds:ids,prefabIds,variants:prefabIds.length,roles,semanticPalette,tool});
}
export async function refreshPersonalAssetPalette({root=globalThis,session,assetIds=[],maxTemplates=24}={}){const tool=await ensureLibraryPaletteBrush(session,{root});const ids=[...new Set((assetIds||[]).map(text).filter(Boolean))].slice(0,16);for(const id of ids)await ensurePersonalVisualRegistered(root,id).catch(()=>false);const catalog=catalogFor(root,session);seedCatalogPrefabs({prefabRegistry:session.studio.kernel.prefabs,assetCatalog:catalog});const templates=[];for(const id of ids){for(const row of listPersonalBuildTemplates({root,session,assetId:id}).slice(0,3)){templates.push(row);if(templates.length>=maxTemplates)break;}if(templates.length>=maxTemplates)break;}const semanticPalette=buildSemanticPalette(templates);tool.setPalette(semanticPalette);return{tool,variants:semanticPalette.length,prefabIds:semanticPalette.map(x=>String(x.id))};}

export async function startPersonalAssetPlacement({root=globalThis,session,assetId,templateId=null,prepareScenePainter=true}={}){
  const id=text(assetId);if(!id)throw new Error('LIBRARY_BUILD_ASSET_ID_REQUIRED');
  if(!session?.studio?.kernel)throw new Error('LIBRARY_BUILD_SESSION_REQUIRED');
  const asset=globalThis.indexedDB?await getAsset(id):null;
  if(asset?.contentKind==='tileset'&&!templateId)return startTilesetLibraryPlacement({root,session,asset});
  root.__KELO_TILESET_PICKER__?.destroy?.();
  let result=await startScene({root,session,assetId:id}).catch(()=>null);
  if(!result)result=await startVisual({root,session,assetId:id,templateId});
  let painterReady=false;
  if(prepareScenePainter){
    try{painterReady=!!(await ensureFastScenePainter(session));}catch(error){console.warn('[Kelo library build] Scene Painter deferred',error);}
  }
  const detail=Object.freeze({assetId:id,prefabId:result.prefabId,mode:result.mode,painterReady,alternatives:result.alternatives.length});
  try{root.dispatchEvent?.(new CustomEvent('kelo:library-build-ready',{detail}));}catch{}
  return Object.freeze({...result,assetId:id,painterReady});
}
export const KELO_LIBRARY_BUILD_BRIDGE=Object.freeze({version:'kelo-library-build-bridge-v6-infinite-palette',listPersonalBuildTemplates,choosePersonalBuildTemplate,ensureLibraryPaletteBrush,ensureFastScenePainter,startPersonalAssetPalette,refreshPersonalAssetPalette,startPersonalAssetPlacement});
