/* KELO-INDEX
 * area: LIVEOPS / NPC WORLD RUNTIME
 * owner: KeloLiveOpsNpcWorld
 * keys: NPC WORLD PLACEMENT PROXIMITY SPATIAL GRID PROMPT MOBILE RENDER
 * purpose: coloca NPCs LiveOps en el mundo, los pasea en un óvalo scripted, renderiza solo celdas visibles y resuelve proximidad sin escanear el catálogo completo por frame
 * public-api: KeloLiveOpsNpcWorld.getState/getPlacement/getNearest/rebuild/probe
 * consumes: KeloLiveOpsWorldContent, KeloLiveOpsInteraction, KeloPlayerPosition, KeloSimulation, KeloRender, KeloCamera, KeloEvents
 * state-owned: placement registry + scripted stroll pose + spatial grid + nearest interactable presentation state only
 * performance: no second loop; stroll advances once per existing render frame; proximity query after player movement or meaningful stroll drift
 * do-not: NO player x/y writes, NO collision authority, NO decision AI, NO timers/intervals/RAF, NO persistence/economy/reward mutation
 */
(function(root){
'use strict';
if(root.KeloLiveOpsNpcWorld)return;
const VERSION='kelo-liveops-npc-world-v3';
const OWNER='liveops-npc-world';
const CELL_SIZE=256;
const PROBE_STEP=18;
const EXIT_HYSTERESIS=28;
const DRAW_MARGIN=96;
const CAST_DRAW_W=64,CAST_DRAW_H=128,LABEL_RANGE=240;
const OMEGA=0.62,STROLL_DT_CAP=0.05,DRIFT_PROBE=8;
const STROLL=Object.freeze({
  plaza_guide:Object.freeze({rx:78,ry:46,phase:0.4}),
  dona_sol:Object.freeze({rx:56,ry:32,phase:1.7}),
  marco:Object.freeze({rx:32,ry:28,phase:2.4}),
  valentina:Object.freeze({rx:60,ry:32,phase:3.1}),
  izan:Object.freeze({rx:52,ry:28,phase:4.2}),
  leandro:Object.freeze({rx:40,ry:36,phase:5.0}),
  naim:Object.freeze({rx:36,ry:48,phase:0.9})
});
const PLACEMENTS=Object.freeze([
  Object.freeze({id:'plaza_guide',surface:'world',x:1440,y:1688,interactionRadius:108,visual:Object.freeze({frame:0,robe:'#1a2744',trim:'#d7b85f',skin:'#d7a47c',accent:'#f0d48a'})}),
  Object.freeze({id:'dona_sol',surface:'world',x:1168,y:1608,interactionRadius:92,visual:Object.freeze({frame:1,robe:'#3a2418',trim:'#e7c56a',skin:'#e0b08a',accent:'#f3df9b'})}),
  Object.freeze({id:'marco',surface:'world',x:1568,y:1624,interactionRadius:92,visual:Object.freeze({frame:2,robe:'#1c2430',trim:'#d7b85f',skin:'#c9956b',accent:'#79d0c8'})}),
  Object.freeze({id:'valentina',surface:'world',x:1248,y:1784,interactionRadius:92,visual:Object.freeze({frame:3,robe:'#3a1830',trim:'#f0d48a',skin:'#e8c0a0',accent:'#e7c56a'})}),
  Object.freeze({id:'izan',surface:'world',x:1568,y:1800,interactionRadius:92,visual:Object.freeze({frame:4,robe:'#142028',trim:'#c9a227',skin:'#c9956b',accent:'#d7b85f'})}),
  Object.freeze({id:'leandro',surface:'world',x:1088,y:1720,interactionRadius:84,visual:Object.freeze({frame:5,robe:'#241c14',trim:'#d7b85f',skin:'#d7a47c',accent:'#79d0c8'})}),
  Object.freeze({id:'naim',surface:'world',x:1784,y:1744,interactionRadius:84,visual:Object.freeze({frame:6,robe:'#2a2218',trim:'#e7c56a',skin:'#c9956b',accent:'#f3df9b'})})
]);
const placementById=new Map(PLACEMENTS.map(row=>[row.id,row]));
const poses=new Map(),clocks=new Map();
let grid=new Map(),activePlacements=Object.freeze([]),maxInteractionRadius=0;
let nearestId=null,lastProbeX=NaN,lastProbeY=NaN,lastSurface='world',prompt=null;
let rebuilds=0,probes=0,spatialCandidates=0,nearestChanges=0,renderFrames=0,renderedNpcs=0,lastError=null;
let simulationHookId=null,renderHookId=null,castImage=null,castState='idle',steppedAt=0,driftSinceProbe=0;
function content(){return root.KeloLiveOpsWorldContent||null;}
function interaction(){return root.KeloLiveOpsInteraction||null;}
function position(){try{return root.KeloPlayerPosition?.capture?.()||null;}catch(_){return null;}}
function surface(){
  try{
    const pvp=root.KeloPvPWorld&&root.KeloPvPWorld.state&&root.KeloPvPWorld.state.mode;
    if(pvp&&pvp!=='social')return 'pvp';
    const instance=root.KELO_INSTANCES&&typeof root.KELO_INSTANCES.current==='function'&&root.KELO_INSTANCES.current();
    if(instance&&instance.type)return 'instance';
    const body=root.document&&root.document.body;
    if(body?.classList?.contains('kelo-property-editing'))return 'editor';
    if(body?.classList?.contains('kelo-house-instance')||body?.classList?.contains('kelo-market-instance'))return 'instance';
  }catch(_){}
  return 'world';
}
function cell(value){return Math.floor(Number(value||0)/CELL_SIZE);}
function key(cx,cy){return cx+':'+cy;}
function insert(row){const k=key(cell(row.x),cell(row.y));if(!grid.has(k))grid.set(k,[]);grid.get(k).push(row);}
function talkingTo(){try{const s=interaction()?.getState?.();return s&&s.dialogueOpen?s.currentNpcId:null;}catch(_){return null;}}
function poseFor(row){
  let pose=poses.get(row.id);
  if(pose)return pose;
  const stroll=STROLL[row.id],ang=stroll?stroll.phase:0;
  pose={id:row.id,surface:row.surface,x:row.x+(stroll?Math.cos(ang)*stroll.rx:0),y:row.y+(stroll?Math.sin(ang)*stroll.ry:0),interactionRadius:row.interactionRadius,visual:row.visual,face:1,bob:0};
  poses.set(row.id,pose);return pose;
}
function stepStroll(now){
  const dt=steppedAt?Math.min(STROLL_DT_CAP,(now-steppedAt)/1000):0;
  steppedAt=now;
  if(!activePlacements.length)return;
  const hold=talkingTo();
  grid=new Map();
  let drift=0;
  for(let i=0;i<activePlacements.length;i++){
    const row=activePlacements[i],pose=poseFor(row),stroll=STROLL[row.id];
    let clock=clocks.get(row.id);
    if(!clock){clock={t:0};clocks.set(row.id,clock);}
    if(hold!==row.id)clock.t+=dt;
    if(stroll){
      const ang=clock.t*OMEGA+stroll.phase,x=row.x+Math.cos(ang)*stroll.rx,y=row.y+Math.sin(ang)*stroll.ry;
      drift=Math.max(drift,Math.hypot(x-pose.x,y-pose.y));
      pose.x=x;pose.y=y;pose.face=Math.sin(ang)>0?-1:1;pose.bob=hold===row.id?0:Math.abs(Math.sin(ang*4))*4;
    }
    insert(pose);
  }
  driftSinceProbe+=drift;
}
function rebuild(){
  try{
    const api=content();const next=[];grid=new Map();maxInteractionRadius=0;
    for(const row of PLACEMENTS){
      const npc=api?.getNpc?.(row.id);
      if(!npc||npc.enabled===false){poses.delete(row.id);clocks.delete(row.id);continue;}
      next.push(row);insert(poseFor(row));maxInteractionRadius=Math.max(maxInteractionRadius,Number(row.interactionRadius)||0);
    }
    activePlacements=Object.freeze(next.slice());rebuilds++;lastError=null;probe(true);return activePlacements;
  }catch(error){lastError=String(error&&error.message||error);return activePlacements;}
}
function queryRect(left,top,right,bottom){
  const out=[];const minX=cell(left),maxX=cell(right),minY=cell(top),maxY=cell(bottom);
  for(let cy=minY;cy<=maxY;cy++)for(let cx=minX;cx<=maxX;cx++){
    const bucket=grid.get(key(cx,cy));if(bucket)for(let i=0;i<bucket.length;i++)out.push(bucket[i]);
  }
  return out;
}
function queryAround(x,y,radius){return queryRect(x-radius,y-radius,x+radius,y+radius);}
function ensurePrompt(){
  if(prompt?.button?.isConnected)return prompt;
  const style=document.createElement('style');style.dataset.keloNpcPrompt='1';style.textContent='\n#kelo-npc-talk-prompt{position:fixed;left:50%;bottom:max(92px,calc(env(safe-area-inset-bottom) + 78px));transform:translateX(-50%);z-index:2147482400;min-width:164px;max-width:min(82vw,360px);min-height:52px;padding:11px 18px;border:1px solid rgba(238,205,113,.58);border-radius:18px;background:linear-gradient(180deg,rgba(21,27,32,.97),rgba(7,10,13,.98));box-shadow:0 12px 34px rgba(0,0,0,.44);color:#f5e6b1;font:800 14px/1.15 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;letter-spacing:.01em;text-align:center;touch-action:manipulation;-webkit-tap-highlight-color:transparent}#kelo-npc-talk-prompt[hidden]{display:none!important}#kelo-npc-talk-prompt .kelo-npc-talk-action{display:block;color:#fff;font-size:11px;letter-spacing:.08em;text-transform:uppercase;margin-bottom:3px}\n';document.head.appendChild(style);
  const button=document.createElement('button');button.id='kelo-npc-talk-prompt';button.type='button';button.hidden=true;button.setAttribute('aria-label','Hablar con NPC');
  button.addEventListener('pointerdown',event=>event.stopPropagation());
  button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();triggerNearest();});
  document.body.appendChild(button);prompt={button};return prompt;
}
function syncPrompt(){
  const ui=ensurePrompt(),id=nearestId,npc=id?content()?.getNpc?.(id):null,dialogueOpen=!!interaction()?.getState?.().dialogueOpen;
  ui.button.hidden=!id||!npc||dialogueOpen;
  if(!ui.button.hidden){ui.button.replaceChildren();const action=document.createElement('span');action.className='kelo-npc-talk-action';action.textContent='Hablar';ui.button.append(action,document.createTextNode(npc.name));ui.button.setAttribute('aria-label','Hablar con '+npc.name);}
}
function setNearest(id){const next=id?String(id):null;if(next===nearestId){syncPrompt();return false;}nearestId=next;nearestChanges++;syncPrompt();try{root.KeloEvents?.emit?.('liveops:nearest-npc-changed',Object.freeze({npcId:nearestId,version:VERSION}));}catch(_){}return true;}
function probe(force){
  const p=position();const nextSurface=surface();
  if(!p||nextSurface!=='world'){lastSurface=nextSurface;setNearest(null);return null;}
  const x=Number(p.x)||0,y=Number(p.y)||0;
  const playerShift=Number.isFinite(lastProbeX)?Math.hypot(x-lastProbeX,y-lastProbeY):Infinity;
  if(!force&&nextSurface===lastSurface&&playerShift<PROBE_STEP&&driftSinceProbe<DRIFT_PROBE)return nearestId;
  driftSinceProbe=0;
  lastProbeX=x;lastProbeY=y;lastSurface=nextSurface;probes++;
  const candidates=queryAround(x,y,Math.max(maxInteractionRadius+EXIT_HYSTERESIS,1));spatialCandidates+=candidates.length;
  let best=null,bestDistance=Infinity;
  for(const row of candidates){
    if(row.surface!=='world')continue;const distance=Math.hypot(x-row.x,y-row.y);const isCurrent=row.id===nearestId;const limit=(Number(row.interactionRadius)||0)+(isCurrent?EXIT_HYSTERESIS:0);
    if(distance<=limit&&distance<bestDistance){best=row;bestDistance=distance;}
  }
  setNearest(best&&best.id);return nearestId;
}
function triggerNearest(){const id=nearestId;if(!id)return false;const api=interaction();if(!api?.openNpc)return false;return api.openNpc(id)===true;}
function castGrid(){const atlas=root.KELO_TILE_REGISTRY?.atlases?.plazaNpcs;return {w:Number(atlas?.spriteWidth)||128,h:Number(atlas?.spriteHeight)||256,cols:Math.max(1,Number(atlas?.columns)||4)};}
function ensureCast(){
  if(castState!=='idle')return;
  const atlas=root.KELO_ATLAS_CONTRACT;
  if(!atlas||typeof atlas.acquire!=='function'){castState='failed';return;}
  castState='pending';
  atlas.acquire('plazaNpcs').then(function(image){castImage=image;castState='ready';}).catch(function(){castState='failed';});
}
function drawFallback(c,row){
  c.fillStyle=row.visual.robe;c.beginPath();c.moveTo(-16,16);c.lineTo(-11,-13);c.quadraticCurveTo(0,-22,11,-13);c.lineTo(16,16);c.closePath();c.fill();
  c.strokeStyle=row.visual.trim;c.lineWidth=2;c.beginPath();c.moveTo(-13,12);c.lineTo(13,12);c.stroke();
  c.fillStyle=row.visual.skin;c.beginPath();c.arc(0,-25,10,0,Math.PI*2);c.fill();
  c.strokeStyle=row.visual.accent;c.lineWidth=3;c.beginPath();c.arc(0,-25,13,-Math.PI*.88,-Math.PI*.12);c.stroke();
}
function drawNpc(context,row){
  const api=root.KeloCamera;if(!api?.worldToScreen||!context?.ctx)return false;const npc=content()?.getNpc?.(row.id);if(!npc||npc.enabled===false)return false;
  const point=api.worldToScreen(row.x,row.y),view=api.worldView?.(),zoom=Math.max(.65,Math.min(1.2,Number(view?.zoom)||1)),c=context.ctx,dpr=api.activeDpr?.()||1;
  if(point.x<-DRAW_MARGIN||point.y<-DRAW_MARGIN||point.x>(Number(view?.screenW)||innerWidth)+DRAW_MARGIN||point.y>(Number(view?.screenH)||innerHeight)+DRAW_MARGIN)return false;
  ensureCast();
  c.save();c.setTransform(dpr,0,0,dpr,0,0);c.translate(point.x,point.y);c.scale(zoom,zoom);
  c.globalAlpha=.22;c.fillStyle='#000';c.beginPath();c.ellipse(0,17,22,8,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
  if(row.id===nearestId){c.strokeStyle='rgba(230,196,99,.85)';c.lineWidth=2;c.beginPath();c.ellipse(0,16,26,10,0,0,Math.PI*2);c.stroke();}
  c.translate(0,-(row.bob||0));c.scale(row.face||1,1);
  const frame=Number(row.visual&&row.visual.frame),gridSpec=castGrid();
  if(castImage&&Number.isInteger(frame)&&frame>=0){
    const sx=(frame%gridSpec.cols)*gridSpec.w,sy=Math.floor(frame/gridSpec.cols)*gridSpec.h;
    c.imageSmoothingEnabled=true;
    c.drawImage(castImage,sx,sy,gridSpec.w,gridSpec.h,-CAST_DRAW_W/2,18-CAST_DRAW_H,CAST_DRAW_W,CAST_DRAW_H);
  }else drawFallback(c,row);
  c.restore();
  const player=position();
  const labeled=row.id===nearestId||(!!player&&Math.hypot((Number(player.x)||0)-row.x,(Number(player.y)||0)-row.y)<LABEL_RANGE);
  if(!labeled)return true;
  c.save();c.setTransform(dpr,0,0,dpr,0,0);c.font='800 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';c.textAlign='center';c.textBaseline='bottom';c.lineWidth=4;c.strokeStyle='rgba(0,0,0,.72)';c.strokeText(npc.name,point.x,point.y-(CAST_DRAW_H-10)*zoom);c.fillStyle='#f3df9b';c.fillText(npc.name,point.x,point.y-(CAST_DRAW_H-10)*zoom);c.restore();return true;
}
function render(context){
  stepStroll(root.performance?.now?.()||Date.now());
  if(driftSinceProbe>=DRIFT_PROBE)probe(false);
  renderFrames++;const api=root.KeloCamera,view=api?.worldView?.();if(!view||surface()!=='world')return;
  const visible=queryRect(view.left-DRAW_MARGIN,view.top-DRAW_MARGIN,view.right+DRAW_MARGIN,view.bottom+DRAW_MARGIN);for(const row of visible)if(drawNpc(context,row))renderedNpcs++;
}
function onKeyDown(event){if(event.defaultPrevented||event.repeat)return;if(String(event.key||'').toLowerCase()!=='e')return;if(!nearestId||interaction()?.getState?.().dialogueOpen)return;event.preventDefault();triggerNearest();}
function getPlacement(id){return placementById.get(String(id||''))||null;}
function getNearest(){if(!nearestId)return null;const row=getPlacement(nearestId),npc=content()?.getNpc?.(nearestId),pose=poses.get(nearestId);if(!row||!npc)return null;const placement=pose?Object.freeze({id:row.id,surface:row.surface,x:pose.x,y:pose.y,interactionRadius:row.interactionRadius,visual:row.visual}):row;return Object.freeze({id:nearestId,npc,placement});}
function strollSnapshot(){const out={};poses.forEach((pose,id)=>{out[id]=Object.freeze({x:Math.round(pose.x),y:Math.round(pose.y)});});return Object.freeze(out);}
function getState(){return Object.freeze({version:VERSION,cellSize:CELL_SIZE,probeStep:PROBE_STEP,exitHysteresis:EXIT_HYSTERESIS,placements:PLACEMENTS.length,activePlacements:activePlacements.length,gridCells:grid.size,maxInteractionRadius,nearestId,rebuilds,probes,spatialCandidates,nearestChanges,renderFrames,renderedNpcs,simulationHookId,renderHookId,lastError,stroll:true,poses:strollSnapshot(),timers:0,intervals:0,raf:0,secondLoop:false,positionWrites:0,collisionWrites:0,persistenceWrites:0});}
function install(){
  ensurePrompt();ensureCast();rebuild();
  if(root.KeloSimulation?.after)simulationHookId=root.KeloSimulation.after(OWNER,()=>probe(false),9300);
  if(root.KeloRender?.afterFrame)renderHookId=root.KeloRender.afterFrame(OWNER,render,9300);
  root.addEventListener('kelo:liveops-world-content:changed',()=>rebuild(),{passive:true});
  root.KeloEvents?.on?.('PLAYER_POSITION_TRANSITION',()=>probe(true));
  root.KeloEvents?.on?.('liveops:npc-opened',()=>syncPrompt());
  root.KeloEvents?.on?.('liveops:npc-closed',()=>{probe(true);syncPrompt();});
  root.addEventListener('keydown',onKeyDown);
}
root.KeloLiveOpsNpcWorld=Object.freeze({version:VERSION,getState,getPlacement,getNearest,rebuild,probe,triggerNearest});
root.KELO_LIVEOPS_NPC_WORLD_AUDIT=Object.freeze({version:VERSION,spatialGrid:true,fullNpcScanPerFrame:false,probeOnMeaningfulMovement:true,scriptedStroll:true,npcAi:false,visibleCellRender:true,centralPrompt:true,touchPrompt:true,keyboardFallback:true,playerPositionWrites:0,collisionAuthority:false,timers:0,intervals:0,raf:0,secondLoop:false,persistenceWrites:0});
try{install();}catch(error){lastError=String(error&&error.message||error);try{console.error('[KeloLiveOpsNpcWorld]',error);}catch(_){} }
})(typeof globalThis!=='undefined'?globalThis:window);
