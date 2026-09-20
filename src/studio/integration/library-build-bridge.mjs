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
  const bridge=root?.KELO_PERSONAL_ASSET_RUNTIME_BRIDGE;
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
export async function startPersonalAssetPlacement({root=globalThis,session,assetId,templateId=null,prepareScenePainter=true}={}){
  const id=text(assetId);if(!id)throw new Error('LIBRARY_BUILD_ASSET_ID_REQUIRED');
  if(!session?.studio?.kernel)throw new Error('LIBRARY_BUILD_SESSION_REQUIRED');
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
export const KELO_LIBRARY_BUILD_BRIDGE=Object.freeze({version:'kelo-library-build-bridge-v5-scene-fabric',listPersonalBuildTemplates,choosePersonalBuildTemplate,ensureLibraryPaletteBrush,ensureFastScenePainter,startPersonalAssetPalette,startPersonalAssetPlacement});
