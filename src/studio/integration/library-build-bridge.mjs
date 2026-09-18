/* KELO-INDEX
 * area: STUDIO / LIBRARY BUILD BRIDGE
 * owner: Kelo Universal Content → Studio
 * keys: LIBRARY BUILD FAST PLACE GHOST PERSONAL ASSET SCENE PAINTER MOBILE VAULT
 * owns: one-way handoff from integrated personal content into Studio's canonical placement tools
 * does-not-own: downloads, licensing, authority writes, world rendering or library navigation
 * public-api: startPersonalAssetPlacement(), listPersonalBuildTemplates(), ensureFastScenePainter()
 * online: all commits still flow through Studio placement/CommandBus/authority mirror
 */
import {seedCatalogPrefabs} from '../adapters/catalog-prefab-seeder.mjs';

const VISUAL_KINDS=new Set(['image','sprite','tileset','animation','vfx']);
const text=value=>String(value??'').trim();

function catalogFor(root,session){
  return session?.studio?.adapter?.assetCatalog||root?.KELO_PROPERTY_CATALOG||null;
}
function catalogRows(catalog){
  try{return Array.isArray(catalog?.list?.())?catalog.list():[];}catch{return[];}
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
  studio.tools.prefabStamp.start(definition.id);
  session.setMode?.('prefab');
  const point=screenCenter(root,session),snap=Math.max(1,Number(session.snapSize)||Number(studio.kernel?.document?.settings?.tileSize)||32);
  studio.tools.prefabStamp.move?.(point.x,point.y,{snap});
  return{mode:'prefab',prefabId:String(definition.id),template:definition,alternatives:[String(definition.id)],point,snap};
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
export const KELO_LIBRARY_BUILD_BRIDGE=Object.freeze({version:'kelo-library-build-bridge-v1',listPersonalBuildTemplates,choosePersonalBuildTemplate,ensureFastScenePainter,startPersonalAssetPlacement});
