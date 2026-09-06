/* KELO-INDEX
 * area: WORLD BUILDER
 * keys: ADMIN KEY WORLD EDIT TERRAIN PATH COLLISION PROPERTY RUNTIME VIEW AUTHORITY OFFLINE ONLINE READY
 * hace: renderer/runtime efímero de overrides del mundo; NO persiste ni decide Draft/Publish
 * online: toda mutación se delega a KELO_WORLD_EDIT.request(); el runtime solo ingiere la vista autorizada
 */
(function(){
'use strict';
if(window.KELO_WORLD_BUILDER)return;

const VERSION='world-builder-v2.0.0';
const SCHEMA=2;
const TILE=Number(window.KELO_TILE_REGISTRY?.worldTileSize)||32;
const R=window.KELO_TILE_REGISTRY;
const TERRAIN=window.KELO_TERRAIN_CONTRACT;
const A=window.KELO_ATLAS_CONTRACT;
const MATERIALS=Object.freeze(Object.keys(TERRAIN?.materials||{}));
let rendererInstalled=false;
const listeners=new Set();
const atlasImages=new Map();
const atlasPromises=new Map();
const clone=v=>v==null?v:JSON.parse(JSON.stringify(v));
const cellKey=(x,y)=>`${Math.floor(Number(x)||0)},${Math.floor(Number(y)||0)}`;

let state={
  schema:SCHEMA,
  revision:0,
  cells:{},
  collisions:{},
  updatedAt:0,
  view:{kind:'boot',id:null,worldId:'world:kelo-main',publishedRevisionId:null}
};

function snapshot(){return clone(state);}
function cells(){return Object.values(state.cells||{});}
function collisions(){return Object.values(state.collisions||{});}
function notify(){for(const fn of listeners){try{fn(snapshot());}catch(e){}}}
function ingestViewSnapshot(next,meta={}){
  const src=next||{};
  state={
    schema:SCHEMA,
    revision:Number(meta.revisionVersion??src.revisionVersion??state.revision??0),
    cells:clone(src.cells&&typeof src.cells==='object'?src.cells:{}),
    collisions:clone(src.collisions&&typeof src.collisions==='object'?src.collisions:{}),
    updatedAt:Date.now(),
    view:Object.assign({kind:'published',id:null,worldId:'world:kelo-main',publishedRevisionId:null},clone(meta||{}))
  };
  syncColliders();notify();return snapshot();
}
function collisionAt(x,y){return collisions().slice().reverse().find(c=>x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h)||null;}
function validMaterial(id){return MATERIALS.includes(String(id||''));}

async function request(op,payload={}){
  const E=window.KELO_WORLD_EDIT;
  if(op==='world-builder:snapshot'||op==='world-builder:export')return snapshot();
  if(!E?.request)throw new Error('WORLD_EDIT_AUTHORITY_NOT_READY');
  if(op==='world-builder:paint')return E.request('world:tile:paint',{
    actorId:payload.actorId,x:payload.x,y:payload.y,brushSize:payload.brushSize,
    material:payload.material,role:payload.role
  });
  if(op==='world-builder:erase-terrain')return E.request('world:tile:clear',{
    actorId:payload.actorId,x:payload.x,y:payload.y,brushSize:payload.brushSize
  });
  if(op==='world-builder:collision-create')return E.request('world:collision:create',payload);
  if(op==='world-builder:collision-move')return E.request('world:collision:update',payload);
  if(op==='world-builder:collision-remove')return E.request('world:collision:remove',payload);
  if(op==='world-builder:clear-draft')return E.request('world:draft:clear-overrides',payload);
  if(op==='world-builder:import'){
    return E.request('world:draft:import',{
      actorId:payload.actorId,
      snapshot:{
        worldId:'world:kelo-main',
        cells:payload.snapshot?.cells||{},
        collisions:payload.snapshot?.collisions||{},
        placements:window.KELO_PROPERTY_SYSTEM?.getPlacements?.('parcel:world:editor')||[]
      }
    });
  }
  throw new Error('UNKNOWN_WORLD_BUILDER_OPERATION');
}


function loadScriptOnce(id,src){
  if(document.getElementById(id))return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const s=document.createElement('script');s.id=id;s.src=src;
    s.onload=()=>resolve();s.onerror=()=>reject(new Error(`WORLD_EDIT_SCRIPT_LOAD_FAILED:${src}`));
    document.head.appendChild(s);
  });
}
async function loadAuthorityStack(){
  if(window.KELO_WORLD_EDIT)return true;
  await loadScriptOnce('kelo-world-draft-store-loader','src/world/world-draft-store.js?v=1');
  await loadScriptOnce('kelo-world-revision-system-loader','src/world/world-revision-system.js?v=1');
  await loadScriptOnce('kelo-local-world-edit-authority-loader','src/world/authorities/local-world-edit-authority.js?v=1');
  await loadScriptOnce('kelo-remote-world-edit-authority-loader','src/world/authorities/remote-world-edit-authority.js?v=1');
  await loadScriptOnce('kelo-world-edit-authority-loader','src/world/world-edit-authority.js?v=1');
  return true;
}

function isMainWorld(){const i=window.KELO_INSTANCES?.current?.();return !(i&&i.type&&i.type!=='world');}
function materialColor(id){return id==='marble'?'#efe6cf':'#71bf54';}
function hash(x,y){return Math.abs(((Math.floor(x/TILE)+17)*73856093)^((Math.floor(y/TILE)+29)*19349663));}
function atlasMeta(key){return R?.atlases?.[key]||null;}
function atlasOrigin(meta,id){const tw=Number(meta?.tileWidth)||TILE,th=Number(meta?.tileHeight)||TILE,cols=Number(meta?.columns)||Math.max(1,Math.floor((Number(meta?.width)||tw)/tw));return{x:(id%cols)*tw,y:Math.floor(id/cols)*th,w:tw,h:th};}
function acquireAtlas(key){
  if(!key||atlasImages.has(key)||atlasPromises.has(key)||!A?.acquire)return;
  const p=Promise.resolve(A.acquire(key)).then(img=>{if(img)atlasImages.set(key,img);atlasPromises.delete(key);}).catch(()=>atlasPromises.delete(key));
  atlasPromises.set(key,p);
}
function drawCell(g,rec){
  if(!validMaterial(rec.material))return;
  const def=TERRAIN?.materials?.[rec.material],meta=atlasMeta(def?.atlas),img=atlasImages.get(def?.atlas),pool=R?.families?.[def?.family]||[];
  if(def?.atlas&&!img)acquireAtlas(def.atlas);
  if(img&&meta&&pool.length){
    const id=pool[hash(rec.x,rec.y)%pool.length],s=atlasOrigin(meta,id);
    g.drawImage(img,s.x,s.y,s.w,s.h,rec.x,rec.y,TILE,TILE);
  }else{
    g.fillStyle=materialColor(rec.material);g.fillRect(rec.x,rec.y,TILE,TILE);
  }
}
function drawTerrain(g){
  if(!isMainWorld())return;
  const list=cells();if(!list.length)return;
  g.save();g.imageSmoothingEnabled=false;for(const rec of list)drawCell(g,rec);g.restore();
}
function syncColliders(){
  if(!isMainWorld()||typeof obstacles==='undefined'||!Array.isArray(obstacles))return;
  for(let i=obstacles.length-1;i>=0;i--)if(obstacles[i]?._worldBuilderCollisionId)obstacles.splice(i,1);
  for(const c of collisions())obstacles.push({id:`world-builder:${c.collisionId}`,x:c.x,y:c.y,w:c.w,h:c.h,noDraw:true,_worldBuilderCollisionId:c.collisionId});
  try{window.KELO_PROPERTY_SYSTEM?.refreshSceneColliders?.();}catch(e){}
}
function drawRegisteredLayer(id,g){
  const layer=window.KELO_ENVIRONMENT_LAYERS?.layers?.find?.(x=>x.id===id);
  if(!layer||typeof layer.draw!=='function')return false;
  try{if(layer.ready&&!layer.ready())return false;layer.draw(g);return true;}catch(e){return false;}
}
function drawPropertyFallback(g,phase,base){
  if(!isMainWorld()||base?.decorationReset!==true)return;
  drawRegisteredLayer(phase==='back'?'property-placements-back':'property-placements-front',g);
}
function drawGuides(g){
  const ui=window.KELO_WORLD_BUILDER_UI,guide=ui?.guideState?.();
  if(!guide?.open||!isMainWorld())return;
  g.save();g.lineWidth=2;
  if(guide.layer==='collision'){
    g.fillStyle='rgba(255,90,90,.16)';g.strokeStyle='rgba(255,120,120,.95)';
    for(const c of collisions()){g.fillRect(c.x,c.y,c.w,c.h);g.strokeRect(c.x,c.y,c.w,c.h);}
  }
  if(guide.cursor){
    g.strokeStyle='#fff0b0';g.setLineDash([6,4]);g.strokeRect(guide.cursor.x,guide.cursor.y,guide.cursor.w||TILE,guide.cursor.h||TILE);g.setLineDash([]);
  }
  g.restore();
}
function installRenderer(){
  if(rendererInstalled)return;
  const base=window.KELO_WORLD_RENDERER;
  if(!base||typeof base.draw!=='function'){setTimeout(installRenderer,120);return;}
  rendererInstalled=true;
  window.KELO_WORLD_RENDERER=Object.freeze({
    draw(g){const ok=base.draw(g);drawTerrain(g);return ok!==false;},
    drawPreActors(g){const r=typeof base.drawPreActors==='function'?base.drawPreActors(g):true;drawPropertyFallback(g,'back',base);syncColliders();drawGuides(g);return r;},
    drawPostActors(g){const r=typeof base.drawPostActors==='function'?base.drawPostActors(g):true;drawPropertyFallback(g,'front',base);return r;},
    districts:base.districts,
    chunkSize:base.chunkSize,
    get ready(){return base.ready!==false;},
    environmentLayerStack:base.environmentLayerStack,
    preActorLayerStack:true,
    postActorLayerStack:true,
    decorationReset:base.decorationReset,
    worldBuilderOverlay:true
  });
}
function boot(){
  loadAuthorityStack().catch(err=>console.error('[Kelo world edit] authority stack failed',err));
  for(const id of MATERIALS){const key=TERRAIN?.materials?.[id]?.atlas;if(key)acquireAtlas(key);}
  installRenderer();syncColliders();
}

window.KELO_WORLD_BUILDER=Object.freeze({
  version:VERSION,
  schema:SCHEMA,
  tileSize:TILE,
  materials:Object.freeze(MATERIALS.slice()),
  request,
  ingestViewSnapshot,
  snapshot,
  cells:()=>clone(cells()),
  collisions:()=>clone(collisions()),
  collisionAt:(x,y)=>clone(collisionAt(x,y)),
  onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},
  authoritySource:()=>{
    const src=window.KELO_WORLD_EDIT?.authoritySource?.();
    return src==='remote'?'remote-adapter':src==='local'?'local-draft':'runtime-only';
  },
  isMainWorld
});
window.KELO_WORLD_BUILDER_AUDIT=Object.freeze({
  version:VERSION,
  authorityReplaceable:true,
  versionedDraft:true,
  terrainOverrides:true,
  pathOverrides:true,
  collisionLayer:true,
  propertyReuse:true,
  propertyResetFallback:true,
  rendererOverlay:true,
  persistentStorage:false,
  mutationsViaWorldEdit:true,
  runtimeOnly:true
});
if(document.readyState==='complete')setTimeout(boot,0);else window.addEventListener('load',boot,{once:true});
})();
