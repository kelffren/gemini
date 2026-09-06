/* KELO-INDEX
 * area: WORLD BUILDER
 * keys: ADMIN KEY WORLD EDIT TERRAIN PATH COLLISION DRAFT AUTHORITY OFFLINE ONLINE READY
 * hace: guarda overrides editables del mundo principal, los renderiza sobre el mapa base y mantiene colisiones de autor
 * online: request() e installRemoteAdapter() permiten sustituir LocalWorldBuilderAuthority por servidor sin cambiar editor/render
 */
(function(){
'use strict';
if(window.KELO_WORLD_BUILDER)return;

const VERSION='world-builder-v1.0.0';
const SCHEMA=1;
const STORAGE='kelo_world_builder_state_v1';
const TILE=Number(window.KELO_TILE_REGISTRY?.worldTileSize)||32;
const R=window.KELO_TILE_REGISTRY;
const TERRAIN=window.KELO_TERRAIN_CONTRACT;
const A=window.KELO_ATLAS_CONTRACT;
const MATERIALS=Object.freeze(Object.keys(TERRAIN?.materials||{}));
let remoteAdapter=null,seq=1,rendererInstalled=false;
const listeners=new Set();
const atlasImages=new Map();
const atlasPromises=new Map();
const clone=v=>JSON.parse(JSON.stringify(v));
const now=()=>Date.now();
const actorId=()=>String(window.KELO_ADMIN_KEYS?.playerId?.()||window.keloNet?.playerKey||window.localPlayer?.id||'local_pioneer');
const cellKey=(x,y)=>`${Math.floor(Number(x)||0)},${Math.floor(Number(y)||0)}`;
const snap=v=>Math.floor(Math.max(0,Number(v)||0)/TILE)*TILE;
const worldW=()=>Math.max(TILE,Number(window.CONFIG?.worldWidth)||3600);
const worldH=()=>Math.max(TILE,Number(window.CONFIG?.worldHeight)||3200);
function fresh(){return{schema:SCHEMA,revision:0,cells:{},collisions:{},history:[],updatedAt:0,lastPublishedRevision:null};}
function load(){try{const v=JSON.parse(localStorage.getItem(STORAGE)||'null');return v&&v.schema===SCHEMA&&v.cells&&v.collisions?v:fresh();}catch(e){return fresh();}}
let state=load();
function persist(){try{localStorage.setItem(STORAGE,JSON.stringify(state));}catch(e){};listeners.forEach(fn=>{try{fn(snapshot());}catch(e){}});}
function snapshot(){return clone(state);}
function event(type,payload,actor){state.history.push({eventId:`wbe:${Date.now().toString(36)}:${seq++}`,type,actorId:String(actor||actorId()),at:now(),payload:clone(payload||{})});if(state.history.length>160)state.history.splice(0,state.history.length-160);}
function bump(type,payload,actor){state.revision=(Number(state.revision)||0)+1;state.updatedAt=now();event(type,payload,actor);persist();}
function requireScope(scope,actor){const id=String(actor||actorId());if(!window.KELO_ADMIN_KEYS?.can?.(scope,id))throw new Error('ADMIN_KEY_PERMISSION_DENIED');return id;}
function validMaterial(id){return MATERIALS.includes(String(id||''));}
function inWorld(x,y,w=TILE,h=TILE){return x>=0&&y>=0&&x+w<=worldW()&&y+h<=worldH();}
function normalizedCell(x,y,material,role,actor){x=snap(x);y=snap(y);if(!inWorld(x,y))throw new Error('OUTSIDE_WORLD');if(!validMaterial(material))throw new Error('MATERIAL_NOT_FOUND');return{x,y,material:String(material),role:role==='path'?'path':'terrain',actorId:String(actor),updatedAt:now()};}
function brushCells(x,y,size){const n=Math.max(1,Math.min(9,Math.floor(Number(size)||1))),out=[];const start=-Math.floor(n/2);for(let oy=0;oy<n;oy++)for(let ox=0;ox<n;ox++){const px=snap(x)+(start+ox)*TILE,py=snap(y)+(start+oy)*TILE;if(inWorld(px,py))out.push([px,py]);}return out;}
function newCollisionId(){return`world-collision:${Date.now().toString(36)}:${seq++}`;}
function normalizeCollision(data,actor,id){const x=snap(data.x),y=snap(data.y),w=Math.max(TILE,Math.min(640,Math.ceil((Number(data.w)||TILE)/TILE)*TILE)),h=Math.max(TILE,Math.min(640,Math.ceil((Number(data.h)||TILE)/TILE)*TILE));if(!inWorld(x,y,w,h))throw new Error('OUTSIDE_WORLD');return{collisionId:String(id||newCollisionId()),x,y,w,h,label:String(data.label||'Bloqueo Admin'),actorId:String(actor),updatedAt:now()};}
async function localRequest(op,payload){
  const data=payload||{},actor=requireScope(op==='world-builder:export'?'world.export':op==='world-builder:import'?'world.import':'world.edit',data.actorId);
  if(op==='world-builder:snapshot'||op==='world-builder:export')return snapshot();
  if(op==='world-builder:paint'){
    const cells=brushCells(data.x,data.y,data.brushSize);for(const [x,y] of cells){const rec=normalizedCell(x,y,data.material,data.role,actor);state.cells[cellKey(x,y)]=rec;}bump('paint',{material:data.material,role:data.role||'terrain',brushSize:Number(data.brushSize)||1,count:cells.length,x:snap(data.x),y:snap(data.y)},actor);return{count:cells.length,revision:state.revision};
  }
  if(op==='world-builder:erase-terrain'){
    const cells=brushCells(data.x,data.y,data.brushSize),removed=[];for(const [x,y] of cells){const k=cellKey(x,y);if(state.cells[k]){removed.push(k);delete state.cells[k];}}if(removed.length)bump('erase-terrain',{cells:removed},actor);return{count:removed.length,revision:state.revision};
  }
  if(op==='world-builder:collision-create'){
    const rec=normalizeCollision(data,actor);state.collisions[rec.collisionId]=rec;bump('collision-create',rec,actor);return clone(rec);
  }
  if(op==='world-builder:collision-move'){
    const id=String(data.collisionId||''),old=state.collisions[id];if(!old)throw new Error('COLLISION_NOT_FOUND');const rec=normalizeCollision({...old,...data},actor,id);state.collisions[id]=rec;bump('collision-move',rec,actor);return clone(rec);
  }
  if(op==='world-builder:collision-remove'){
    const id=String(data.collisionId||''),old=state.collisions[id];if(!old)throw new Error('COLLISION_NOT_FOUND');delete state.collisions[id];bump('collision-remove',{collisionId:id},actor);return clone(old);
  }
  if(op==='world-builder:clear-draft'){
    state.cells={};state.collisions={};bump('clear-draft',{},actor);return snapshot();
  }
  if(op==='world-builder:import'){
    const next=data.snapshot;if(!next||next.schema!==SCHEMA||!next.cells||!next.collisions)throw new Error('INVALID_WORLD_BUILDER_SNAPSHOT');const cells={};for(const raw of Object.values(next.cells)){try{const rec=normalizedCell(raw.x,raw.y,raw.material,raw.role,actor);cells[cellKey(rec.x,rec.y)]=rec;}catch(e){}}const collisions={};for(const raw of Object.values(next.collisions)){try{const rec=normalizeCollision(raw,actor,raw.collisionId);collisions[rec.collisionId]=rec;}catch(e){}}state.cells=cells;state.collisions=collisions;bump('import',{cells:Object.keys(cells).length,collisions:Object.keys(collisions).length},actor);return snapshot();
  }
  throw new Error('UNKNOWN_WORLD_BUILDER_OPERATION');
}
async function request(op,payload){if(remoteAdapter&&typeof remoteAdapter.request==='function')return remoteAdapter.request(op,payload||{});return localRequest(op,payload||{});}
function installRemoteAdapter(adapter){if(adapter&&typeof adapter.request!=='function')throw new Error('INVALID_WORLD_BUILDER_ADAPTER');remoteAdapter=adapter||null;}
function isMainWorld(){const i=window.KELO_INSTANCES?.current?.();return !(i&&i.type&&i.type!=='world');}
function cells(){return Object.values(state.cells);}
function collisions(){return Object.values(state.collisions);}
function collisionAt(x,y){return collisions().slice().reverse().find(c=>x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h)||null;}
function materialColor(id){return id==='marble'?'#efe6cf':'#71bf54';}
function hash(x,y){return Math.abs(((Math.floor(x/TILE)+17)*73856093)^((Math.floor(y/TILE)+29)*19349663));}
function atlasMeta(key){return R?.atlases?.[key]||null;}
function atlasOrigin(meta,id){const tw=Number(meta?.tileWidth)||TILE,th=Number(meta?.tileHeight)||TILE,cols=Number(meta?.columns)||Math.max(1,Math.floor((Number(meta?.width)||tw)/tw));return{x:(id%cols)*tw,y:Math.floor(id/cols)*th,w:tw,h:th};}
function acquireAtlas(key){if(!key||atlasImages.has(key)||atlasPromises.has(key)||!A?.acquire)return;const p=Promise.resolve(A.acquire(key)).then(img=>{if(img)atlasImages.set(key,img);atlasPromises.delete(key);}).catch(()=>atlasPromises.delete(key));atlasPromises.set(key,p);}
function drawCell(g,rec){const def=TERRAIN?.materials?.[rec.material],meta=atlasMeta(def?.atlas),img=atlasImages.get(def?.atlas),pool=R?.families?.[def?.family]||[];if(def?.atlas&&!img)acquireAtlas(def.atlas);if(img&&meta&&pool.length){const id=pool[hash(rec.x,rec.y)%pool.length],s=atlasOrigin(meta,id);g.drawImage(img,s.x,s.y,s.w,s.h,rec.x,rec.y,TILE,TILE);}else{g.fillStyle=materialColor(rec.material);g.fillRect(rec.x,rec.y,TILE,TILE);}}
function drawTerrain(g){if(!isMainWorld())return;const list=cells();if(!list.length)return;g.save();g.imageSmoothingEnabled=false;for(const rec of list)drawCell(g,rec);g.restore();}
function syncColliders(){if(!isMainWorld()||typeof obstacles==='undefined'||!Array.isArray(obstacles))return;for(let i=obstacles.length-1;i>=0;i--)if(obstacles[i]?._worldBuilderCollisionId)obstacles.splice(i,1);for(const c of collisions())obstacles.push({id:`world-builder:${c.collisionId}`,x:c.x,y:c.y,w:c.w,h:c.h,noDraw:true,_worldBuilderCollisionId:c.collisionId});}
function drawGuides(g){const ui=window.KELO_WORLD_BUILDER_UI,guide=ui?.guideState?.();if(!guide?.open||!isMainWorld())return;g.save();g.lineWidth=2;if(guide.layer==='collision'){g.fillStyle='rgba(255,90,90,.16)';g.strokeStyle='rgba(255,120,120,.95)';for(const c of collisions()){g.fillRect(c.x,c.y,c.w,c.h);g.strokeRect(c.x,c.y,c.w,c.h);}}if(guide.cursor){g.strokeStyle='#fff0b0';g.setLineDash([6,4]);g.strokeRect(guide.cursor.x,guide.cursor.y,guide.cursor.w||TILE,guide.cursor.h||TILE);g.setLineDash([]);}g.restore();}
function installRenderer(){
  if(rendererInstalled)return;const base=window.KELO_WORLD_RENDERER;if(!base||typeof base.draw!=='function'){setTimeout(installRenderer,120);return;}
  rendererInstalled=true;
  window.KELO_WORLD_RENDERER=Object.freeze({
    draw(g){const ok=base.draw(g);drawTerrain(g);return ok!==false;},
    drawPreActors(g){const r=typeof base.drawPreActors==='function'?base.drawPreActors(g):true;syncColliders();drawGuides(g);return r;},
    drawPostActors(g){return typeof base.drawPostActors==='function'?base.drawPostActors(g):true;},
    districts:base.districts,chunkSize:base.chunkSize,get ready(){return base.ready!==false;},environmentLayerStack:base.environmentLayerStack,preActorLayerStack:true,postActorLayerStack:true,decorationReset:base.decorationReset,worldBuilderOverlay:true
  });
}
function boot(){for(const id of MATERIALS){const key=TERRAIN?.materials?.[id]?.atlas;if(key)acquireAtlas(key);}installRenderer();syncColliders();}
window.KELO_WORLD_BUILDER=Object.freeze({version:VERSION,schema:SCHEMA,tileSize:TILE,materials:Object.freeze(MATERIALS.slice()),request,installRemoteAdapter,snapshot,cells:()=>clone(cells()),collisions:()=>clone(collisions()),collisionAt:(x,y)=>clone(collisionAt(x,y)),onChange(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);},authoritySource:()=>remoteAdapter?'remote-adapter':'local-draft',isMainWorld});
window.KELO_WORLD_BUILDER_AUDIT={version:VERSION,authorityReplaceable:true,versionedDraft:true,terrainOverrides:true,pathOverrides:true,collisionLayer:true,propertyReuse:true,rendererOverlay:true,localOnly:true};
if(document.readyState==='complete')setTimeout(boot,0);else window.addEventListener('load',boot,{once:true});
})();
