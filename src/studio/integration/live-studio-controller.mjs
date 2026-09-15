/* KELO-INDEX
 * area: STUDIO / LIVE CONTROLLER / WORLD SURGERY WRAPPER
 * owns: phone catalog readiness gate, lightweight placement ghost and diagnostic counters
 * does-not-own: creator-session behavior; the proven controller is preserved byte-for-byte in live-studio-controller-base.mjs
 * public-api: openKeloStudioLive(), closeKeloStudioLive(), getKeloStudioLive()
 */

import {openKeloStudioLive as openBase,closeKeloStudioLive as closeBase,getKeloStudioLive as getBase} from './live-studio-controller-base.mjs';
import {createStudioMobilePlacementGhost} from '../render/studio-mobile-placement-ghost.mjs';

let ghost=null,commandUnsub=null,lifeTimer=0;
const MIN_REAL_CATALOG=5;
const isPhone=root=>/iPhone|iPad|iPod|Android/i.test(String(root?.navigator?.userAgent||''))||Math.min(Number(root?.innerWidth)||999,Number(root?.innerHeight)||999)<=500;
const sleep=(root,ms)=>new Promise(resolve=>(root.setTimeout||setTimeout)(resolve,ms));

async function waitForRealCatalog(root){
  if(!isPhone(root)||root.KELO_WORLD_SURGERY?.enabled?.('assetCatalog')===false)return 0;
  const started=Date.now();let last=-1,stableSince=0,best=0;
  while(Date.now()-started<10000){
    let count=0;
    try{count=Number(root.KELO_PROPERTY_CATALOG?.list?.()?.length||0);}catch{}
    best=Math.max(best,count);
    if(count>=MIN_REAL_CATALOG){
      if(count!==last){last=count;stableSince=Date.now();}
      else if(Date.now()-stableSince>=1800)return count;
    }else{
      last=count;stableSince=0;
    }
    await sleep(root,120);
  }
  return best;
}

function syncDiagnostics(root,session){
  const el=root.document?.getElementById('kelo-studio-live');if(!el)return;
  const entities=Number(session?.studio?.kernel?.document?.entities?.length||0);
  let catalog=0;try{catalog=Number(root.KELO_PROPERTY_CATALOG?.list?.()?.length||0);}catch{}
  el.dataset.keloEntityCount=String(entities);
  el.dataset.keloCatalogCount=String(catalog);
  el.dataset.keloCatalogReady=catalog>=MIN_REAL_CATALOG?'1':'0';
}

function clearWrapperRuntime(root=globalThis){
  ghost?.destroy?.();ghost=null;
  commandUnsub?.();commandUnsub=null;
  if(lifeTimer){try{(root.clearInterval||clearInterval)(lifeTimer);}catch{}lifeTimer=0;}
}

function installDiagnostics(root,session){
  commandUnsub?.();commandUnsub=null;
  if(lifeTimer){try{(root.clearInterval||clearInterval)(lifeTimer);}catch{}lifeTimer=0;}
  syncDiagnostics(root,session);
  try{commandUnsub=session?.studio?.kernel?.commands?.on?.(()=>syncDiagnostics(root,session))||null;}catch{}
  lifeTimer=(root.setInterval||setInterval)(()=>{
    if(!root.document?.getElementById('kelo-studio-live')||getBase()!==session)clearWrapperRuntime(root);
    else syncDiagnostics(root,session);
  },1000);
}

function installGhost(root,session){
  ghost?.destroy?.();ghost=null;
  const surgery=root.KELO_WORLD_SURGERY;
  if(!isPhone(root)||surgery?.enabled?.('overlay')===false||surgery?.enabled?.('assetPreview')===false){
    surgery?.markStatus?.('placementGhost','DISABLED',{phase:'wrapper'});return;
  }
  const token=surgery?.start?.('placementGhost','wrapper');
  try{
    ghost=createStudioMobilePlacementGhost({
      root,placement:session?.studio?.tools?.placement,assetPreview:session?.studio?.assetPreview,
      getCamera:()=>({x:Number(root.camera?.x)||0,y:Number(root.camera?.y)||0,zoom:Number(session?.cameraController?.effectiveZoom)||1})
    });
    surgery?.done?.(token);
  }catch(error){surgery?.fail?.(token,error);console.warn('[Kelo Studio] placement ghost unavailable',error);}
}

export async function openKeloStudioLive({root=globalThis}={}){
  const catalogCount=await waitForRealCatalog(root);
  const catalogReady=!isPhone(root)||root.KELO_WORLD_SURGERY?.enabled?.('assetCatalog')===false||catalogCount>=MIN_REAL_CATALOG;
  try{root.KELO_WORLD_SURGERY?.markStatus?.('assetCatalog',catalogReady?'ACTIVE':'FAILED',{phase:'pre-live',count:catalogCount,min:MIN_REAL_CATALOG});}catch{}
  if(!catalogReady)throw new Error(`WORLD_ASSET_CATALOG_NOT_READY:${catalogCount}`);
  const session=await openBase({root});
  installDiagnostics(root,session);
  installGhost(root,session);
  return session;
}

export async function closeKeloStudioLive({root=globalThis}={}){
  clearWrapperRuntime(root);
  return closeBase({root});
}

export function getKeloStudioLive(){return getBase();}
