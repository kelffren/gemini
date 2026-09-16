/* KELO-INDEX
 * area: LIVEOPS / NPC WORLD RUNTIME
 * owner: KeloLiveOpsNpcWorld
 * keys: NPC WORLD PLACEMENT PROXIMITY SPATIAL GRID PROMPT MOBILE RENDER
 * purpose: coloca NPCs LiveOps en el mundo, renderiza solo celdas visibles y resuelve proximidad sin escanear el catálogo completo por frame
 * public-api: KeloLiveOpsNpcWorld.getState/getPlacement/getNearest/rebuild/probe
 * consumes: KeloLiveOpsWorldContent, KeloLiveOpsInteraction, KeloPlayerPosition, KeloSimulation, KeloRender, KeloCamera, KeloEvents
 * state-owned: placement registry + spatial grid + nearest interactable presentation state only
 * performance: no second loop; proximity query only after meaningful movement/transition/content change; render culls by visible grid cells
 * do-not: NO player x/y writes, NO collision authority, NO NPC AI, NO timers/intervals/RAF, NO persistence/economy/reward mutation
 */
(function(root){
'use strict';
if(root.KeloLiveOpsNpcWorld)return;
const VERSION='kelo-liveops-npc-world-v1';
const OWNER='liveops-npc-world';
const CELL_SIZE=256;
const PROBE_STEP=18;
const EXIT_HYSTERESIS=28;
const DRAW_MARGIN=96;
const PLACEMENTS=Object.freeze([
  Object.freeze({id:'plaza_guide',surface:'world',x:1400,y:1480,interactionRadius:132,visual:Object.freeze({robe:'#123e43',trim:'#d7b85f',skin:'#d7a47c',accent:'#79d0c8'})})
]);
const placementById=new Map(PLACEMENTS.map(row=>[row.id,row]));
let grid=new Map(),activePlacements=Object.freeze([]),maxInteractionRadius=0;
let nearestId=null,lastProbeX=NaN,lastProbeY=NaN,lastSurface='world',prompt=null;
let rebuilds=0,probes=0,spatialCandidates=0,nearestChanges=0,renderFrames=0,renderedNpcs=0,lastError=null;
let simulationHookId=null,renderHookId=null;
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
function rebuild(){
  try{
    const api=content();const next=[];grid=new Map();maxInteractionRadius=0;
    for(const row of PLACEMENTS){
      const npc=api?.getNpc?.(row.id);
      if(!npc||npc.enabled===false)continue;
      next.push(row);insert(row);maxInteractionRadius=Math.max(maxInteractionRadius,Number(row.interactionRadius)||0);
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
  if(!force&&nextSurface===lastSurface&&Number.isFinite(lastProbeX)&&Math.hypot(x-lastProbeX,y-lastProbeY)<PROBE_STEP)return nearestId;
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
function drawNpc(context,row){
  const api=root.KeloCamera;if(!api?.worldToScreen||!context?.ctx)return false;const npc=content()?.getNpc?.(row.id);if(!npc||npc.enabled===false)return false;
  const point=api.worldToScreen(row.x,row.y),view=api.worldView?.(),zoom=Math.max(.65,Math.min(1.2,Number(view?.zoom)||1)),c=context.ctx,dpr=api.activeDpr?.()||1;
  if(point.x<-DRAW_MARGIN||point.y<-DRAW_MARGIN||point.x>(Number(view?.screenW)||innerWidth)+DRAW_MARGIN||point.y>(Number(view?.screenH)||innerHeight)+DRAW_MARGIN)return false;
  c.save();c.setTransform(dpr,0,0,dpr,0,0);c.translate(point.x,point.y);c.scale(zoom,zoom);
  c.globalAlpha=.22;c.fillStyle='#000';c.beginPath();c.ellipse(0,17,22,8,0,0,Math.PI*2);c.fill();c.globalAlpha=1;
  c.fillStyle=row.visual.robe;c.beginPath();c.moveTo(-16,16);c.lineTo(-11,-13);c.quadraticCurveTo(0,-22,11,-13);c.lineTo(16,16);c.closePath();c.fill();
  c.strokeStyle=row.visual.trim;c.lineWidth=2;c.beginPath();c.moveTo(-13,12);c.lineTo(13,12);c.stroke();
  c.fillStyle=row.visual.skin;c.beginPath();c.arc(0,-25,10,0,Math.PI*2);c.fill();
  c.strokeStyle=row.visual.accent;c.lineWidth=3;c.beginPath();c.arc(0,-25,13,-Math.PI*.88,-Math.PI*.12);c.stroke();
  if(row.id===nearestId){c.strokeStyle='rgba(230,196,99,.85)';c.lineWidth=2;c.beginPath();c.arc(0,2,25,0,Math.PI*2);c.stroke();}
  c.restore();
  c.save();c.setTransform(dpr,0,0,dpr,0,0);c.font='800 11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';c.textAlign='center';c.textBaseline='bottom';c.lineWidth=4;c.strokeStyle='rgba(0,0,0,.72)';c.strokeText(npc.name,point.x,point.y-42*zoom);c.fillStyle='#f3df9b';c.fillText(npc.name,point.x,point.y-42*zoom);c.restore();return true;
}
function render(context){
  renderFrames++;const api=root.KeloCamera,view=api?.worldView?.();if(!view||surface()!=='world')return;
  const visible=queryRect(view.left-DRAW_MARGIN,view.top-DRAW_MARGIN,view.right+DRAW_MARGIN,view.bottom+DRAW_MARGIN);for(const row of visible)if(drawNpc(context,row))renderedNpcs++;
}
function onKeyDown(event){if(event.defaultPrevented||event.repeat)return;if(String(event.key||'').toLowerCase()!=='e')return;if(!nearestId||interaction()?.getState?.().dialogueOpen)return;event.preventDefault();triggerNearest();}
function getPlacement(id){return placementById.get(String(id||''))||null;}
function getNearest(){if(!nearestId)return null;const row=getPlacement(nearestId),npc=content()?.getNpc?.(nearestId);return row&&npc?Object.freeze({id:nearestId,npc,placement:row}):null;}
function getState(){return Object.freeze({version:VERSION,cellSize:CELL_SIZE,probeStep:PROBE_STEP,exitHysteresis:EXIT_HYSTERESIS,placements:PLACEMENTS.length,activePlacements:activePlacements.length,gridCells:grid.size,maxInteractionRadius,nearestId,rebuilds,probes,spatialCandidates,nearestChanges,renderFrames,renderedNpcs,simulationHookId,renderHookId,lastError,timers:0,intervals:0,raf:0,secondLoop:false,positionWrites:0,collisionWrites:0,persistenceWrites:0});}
function install(){
  ensurePrompt();rebuild();
  if(root.KeloSimulation?.after)simulationHookId=root.KeloSimulation.after(OWNER,()=>probe(false),9300);
  if(root.KeloRender?.afterFrame)renderHookId=root.KeloRender.afterFrame(OWNER,render,9300);
  root.addEventListener('kelo:liveops-world-content:changed',()=>rebuild(),{passive:true});
  root.KeloEvents?.on?.('PLAYER_POSITION_TRANSITION',()=>probe(true));
  root.KeloEvents?.on?.('liveops:npc-opened',()=>syncPrompt());
  root.KeloEvents?.on?.('liveops:npc-closed',()=>{probe(true);syncPrompt();});
  root.addEventListener('keydown',onKeyDown);
}
root.KeloLiveOpsNpcWorld=Object.freeze({version:VERSION,getState,getPlacement,getNearest,rebuild,probe,triggerNearest});
root.KELO_LIVEOPS_NPC_WORLD_AUDIT=Object.freeze({version:VERSION,spatialGrid:true,fullNpcScanPerFrame:false,probeOnMeaningfulMovement:true,visibleCellRender:true,centralPrompt:true,touchPrompt:true,keyboardFallback:true,playerPositionWrites:0,collisionAuthority:false,npcAi:false,timers:0,intervals:0,raf:0,secondLoop:false,persistenceWrites:0});
try{install();}catch(error){lastError=String(error&&error.message||error);try{console.error('[KeloLiveOpsNpcWorld]',error);}catch(_){} }
})(typeof globalThis!=='undefined'?globalThis:window);
