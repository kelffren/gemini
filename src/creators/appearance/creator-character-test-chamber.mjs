/* KELO-INDEX
 * area: CREATORS / CHARACTER TEST CHAMBER
 * owner: Appearance Creator test chamber
 * keys: CHARACTER TEST CHAMBER IDLE WALK RUN ATTACK HIT DEATH VISUAL MOTION PREVIEW SHARED CONTRACT
 * purpose: reproduce visual motion/frame states against the authoring preview using KeloCreatorCharacterVisualContract normalization without mutating gameplay/runtime authority
 * consumes: Appearance row.animationMapping + KeloCreatorCharacterVisualContract.resolveMotionSample/frameColumns + creator appearance preview render(frame,motion)
 * state-owned: ephemeral preview state + one requestAnimationFrame while playing
 * do-not: NO live actor mutation, NO HP/inventory/collision/network/persistence, NO second renderer, NO private face/frame state machine
 */
const STATE_DEFS=Object.freeze([
  Object.freeze({id:'idle',label:'IDLE',loop:true,frameMs:180}),
  Object.freeze({id:'walk',label:'WALK',loop:true,frameMs:140}),
  Object.freeze({id:'run',label:'RUN',loop:true,frameMs:90}),
  Object.freeze({id:'attack',label:'ATTACK',loop:false,frameMs:95}),
  Object.freeze({id:'hit',label:'HIT',loop:false,frameMs:115}),
  Object.freeze({id:'death',label:'DEATH',loop:false,frameMs:150})
]);
const STATE_BY_ID=new Map(STATE_DEFS.map(row=>[row.id,row]));
const finite=(v,fallback=0)=>Number.isFinite(Number(v))?Number(v):fallback;
function trackFrame(value,columns){const count=Math.max(1,Math.floor(finite(columns,4)));return Math.abs(Math.floor(finite(value,0)))%count;}
function frameList(value,columns){
  let raw=value;
  if(raw&&typeof raw==='object'&&!Array.isArray(raw))raw=raw.frames??raw.frame??[];
  if(typeof raw==='string')raw=raw.split(/[\s,|;]+/).filter(Boolean);
  if(!Array.isArray(raw))raw=raw==null?[]:[raw];
  return raw.filter(value=>Number.isFinite(Number(value))).map(value=>trackFrame(value,columns));
}
function mappedValue(row,state){const mapping=row?.animationMapping&&typeof row.animationMapping==='object'?row.animationMapping:{};if(Object.prototype.hasOwnProperty.call(mapping,state))return{value:mapping[state],source:'animationMapping.'+state};if(Object.prototype.hasOwnProperty.call(mapping,'default'))return{value:mapping.default,source:'animationMapping.default'};return null;}
export function resolveCharacterTestTrack({row,state='idle',columns=4}={}){
  const def=STATE_BY_ID.get(String(state))||STATE_BY_ID.get('idle'),cols=Math.max(1,Math.floor(finite(columns,4))),mapped=mappedValue(row,def.id);let frames=[],loop=def.loop,frameMs=def.frameMs,source=def.id+'-static-fallback',authored=false;
  if(mapped){const raw=mapped.value,obj=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:null;frames=frameList(raw,cols);loop=obj?.loop==null?def.loop:obj.loop===true;frameMs=Math.max(70,Math.min(2000,finite(obj?.frameMs??obj?.speedMs??obj?.ms,def.frameMs)));if(frames.length){source=mapped.source;authored=true;}}
  if(!frames.length&&def.id==='walk'){frames=Array.from({length:cols},(_,index)=>index);source='runtime-generic-stride';}
  if(!frames.length&&def.id==='run'){frames=Array.from({length:cols},(_,index)=>index);source='runtime-generic-stride-fast';}
  if(!frames.length)frames=[0];
  return Object.freeze({state:def.id,label:def.label,frames:Object.freeze(frames),frameMs,loop,authored,source,fallback:!authored,durationMs:frames.length*frameMs});
}
function now(root){return finite(root?.performance?.now?.(),Date.now());}
export function createCreatorCharacterTestChamber({root=globalThis,preview,onSnapshot=null}={}){
  if(!preview?.render)throw new Error('CHARACTER_TEST_CHAMBER_PREVIEW_REQUIRED');
  const visualContract=()=>root?.KeloCreatorCharacterVisualContract||null;
  let row=null,source='',asset={},face='down',state='idle',playing=false,startedAt=0,lastFrame=null,lastPreview=null,lastTrack=resolveCharacterTestTrack(),lastError=null,raf=0,disposed=false;
  const rafFn=typeof root.requestAnimationFrame==='function'?root.requestAnimationFrame.bind(root):null;
  const cancelFn=typeof root.cancelAnimationFrame==='function'?root.cancelAnimationFrame.bind(root):null;
  function columns(){const C=visualContract();if(C?.frameColumns)return C.frameColumns(row);const visual=row?.metadata?.characterVisual||{};return Math.max(1,Math.floor(finite(visual.columns,4)));}
  function sample(frame){const C=visualContract();const visual={face,frame,on:state==='walk'||state==='run',state};if(C?.resolveMotionSample)return C.resolveMotionSample({visual,columns:columns(),fallbackFace:'down',fallbackState:state});const cols=columns();return Object.freeze({face:['down','left','right','up'].includes(face)?face:'down',frame:trackFrame(frame,cols),moving:!!visual.on,state,dx:0,dy:0});}
  function track(){return resolveCharacterTestTrack({row,state,columns:columns()});}
  function emit(){const canonical=sample(lastFrame??0),snapshot=Object.freeze({version:'creator-character-test-chamber-v1.2',state:canonical.state,playing,face:canonical.face,frame:lastFrame==null?null:canonical.frame,track:lastTrack,preview:lastPreview,error:lastError,motionContract:visualContract()?.version||null});try{onSnapshot?.(snapshot);}catch{}return snapshot;}
  async function paint(frame,trackValue){if(disposed)return null;const canonical=sample(frame);lastFrame=canonical.frame??0;lastError=null;try{const rendered=await preview.render({row,source,asset,face:canonical.face,motion:canonical.state,frame:lastFrame});if(disposed)return null;lastPreview=rendered;lastTrack=trackValue;return emit();}catch(error){lastPreview=null;lastTrack=trackValue;lastError=String(error?.message||error);return emit();}}
  function stopRaf(){if(raf&&cancelFn)cancelFn(raf);raf=0;}
  function step(time){
    raf=0;if(disposed||!row)return;const t=track();lastTrack=t;const elapsed=Math.max(0,finite(time,now(root))-startedAt),rawIndex=Math.floor(elapsed/t.frameMs),index=t.loop?(rawIndex%t.frames.length):Math.min(t.frames.length-1,rawIndex),frame=t.frames[index]??0;if(frame!==lastFrame)void paint(frame,t);if(!t.loop&&rawIndex>=t.frames.length){playing=false;emit();return;}if(playing&&rafFn)raf=rafFn(step);
  }
  function restart(){stopRaf();startedAt=now(root);lastFrame=null;lastError=null;lastTrack=track();if(!row)return emit();playing=true;if(rafFn)raf=rafFn(step);else void paint(lastTrack.frames[0]??0,lastTrack);return emit();}
  function configure(next={}){row=next.row??row;source=next.source??source;asset=next.asset??asset;face=String(next.face||face||'down');state=STATE_BY_ID.has(String(next.state))?String(next.state):state;if(next.playing===false){stopRaf();playing=false;startedAt=now(root);lastFrame=null;lastError=null;lastTrack=track();if(row)void paint(lastTrack.frames[0]??0,lastTrack);return emit();}return restart();}
  function play(nextState=state){state=STATE_BY_ID.has(String(nextState))?String(nextState):'idle';return restart();}
  function pause(){playing=false;stopRaf();return emit();}
  function reset(){state='idle';return restart();}
  function setFace(nextFace){face=String(nextFace||'down');return restart();}
  function snapshot(){return emit();}
  function dispose(){disposed=true;playing=false;stopRaf();row=null;source='';asset={};lastPreview=null;lastError=null;}
  return Object.freeze({version:'creator-character-test-chamber-v1.2',states:STATE_DEFS,configure,play,pause,reset,setFace,snapshot,dispose});
}
export const CHARACTER_TEST_STATES=STATE_DEFS;
