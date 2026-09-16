/* KELO-INDEX
 * area: CREATORS / LIFECYCLE
 * owner: Kelo Creators
 * keys: CREATOR EXCLUSIVE HIBERNATE RESUME INPUT MOVEMENT SIMULATION RENDER ATLAS MEMORY PIXELORAMA
 * purpose: pausa trabajo pesado del juego mediante owners Foundation mientras un editor creator exclusivo está activo
 * public-api: enterCreatorExclusiveMode/leaveCreatorExclusiveMode/getCreatorExclusiveSnapshot
 * consumes: KeloInputLocks, KeloMovement, KeloSimulation, KeloRender, KELO_ATLAS_CONTRACT, KeloEvents
 * state-owned: claims creator-exclusive efímeros + tokens/hook IDs adquiridos a owners existentes
 * extension-points: cualquier workspace pesado puede adquirir un claim y soltarlo al terminar
 * online: presentación/authoring local; no altera autoridad ni estado valioso
 * do-not: NO parar engine-b, NO monkey-patch loops, NO mutar gameplay directamente, NO crear timers de vigilancia
 */

const OWNER='kelo-creator-exclusive';
let sequence=1;
const claims=new Map();
let rootRef=null;
let inputLock=null;
let movementHook=null;
let renderHook=null;
let simulationToken=null;
let atlasEvictions=0;
let transitions=0;

function now(){return Date.now();}
function normalizeOwner(owner){const value=String(owner==null?'':owner).trim();return value||'creator';}
function active(){return claims.size>0;}

function emit(root,name,detail){
  try{root.KeloEvents?.emit?.(name,detail);}catch{}
  try{root.dispatchEvent?.(new root.CustomEvent(`kelo:${name.toLowerCase().replaceAll('_','-')}`,{detail}));}catch{}
}

function evictColdAtlases(root){
  const atlas=root.KELO_ATLAS_CONTRACT;
  if(!atlas?.runtimeSnapshot||!atlas?.evict)return 0;
  let evicted=0;
  for(const item of atlas.runtimeSnapshot()){
    if(item.role==='core'||Number(item.refs)>0)continue;
    try{if(atlas.evict(item.key,'creator-exclusive'))evicted++;}catch{}
  }
  atlasEvictions+=evicted;
  return evicted;
}

function installHibernate(root){
  if(rootRef&&rootRef!==root)throw new Error('CREATOR_EXCLUSIVE_ROOT_MISMATCH');
  rootRef=root;
  inputLock=root.KeloInputLocks?.acquire?.(OWNER,{surface:'creator-exclusive'})||null;
  movementHook=root.KeloMovement?.intercept?.(OWNER,()=>active(),-100000)||null;
  renderHook=root.KeloRender?.intercept?.(OWNER,()=>active(),-100000)||null;
  simulationToken=root.KeloSimulation?.suspend?.(OWNER,{surface:'creator-exclusive'})||null;
  const evicted=evictColdAtlases(root);
  transitions++;
  const detail=Object.freeze({active:true,claims:claims.size,evictedAtlases:evicted,at:now()});
  emit(root,'CREATOR_EXCLUSIVE_ENTER',detail);
  try{root.document?.documentElement?.setAttribute('data-kelo-creator-exclusive','true');}catch{}
}

function uninstallHibernate(root){
  if(movementHook){try{root.KeloMovement?.unregister?.(movementHook);}catch{}movementHook=null;}
  if(renderHook){try{root.KeloRender?.unregister?.(renderHook);}catch{}renderHook=null;}
  if(simulationToken){try{root.KeloSimulation?.resume?.(simulationToken);}catch{}simulationToken=null;}
  if(inputLock){try{root.KeloInputLocks?.release?.(inputLock);}catch{}inputLock=null;}
  transitions++;
  const detail=Object.freeze({active:false,claims:0,at:now()});
  emit(root,'CREATOR_EXCLUSIVE_LEAVE',detail);
  try{root.document?.documentElement?.removeAttribute('data-kelo-creator-exclusive');}catch{}
  rootRef=null;
}

export function enterCreatorExclusiveMode({root=globalThis,owner='creator',meta=null}={}){
  if(!root)throw new Error('CREATOR_EXCLUSIVE_ROOT_REQUIRED');
  const token=`creator-exclusive-${(sequence++).toString(36)}`;
  const first=!active();
  claims.set(token,Object.freeze({token,owner:normalizeOwner(owner),meta:meta&&typeof meta==='object'?Object.freeze({...meta}):null,createdAt:now()}));
  if(first)installHibernate(root);
  else emit(root,'CREATOR_EXCLUSIVE_CHANGED',Object.freeze({active:true,claims:claims.size,at:now()}));
  return token;
}

export function leaveCreatorExclusiveMode(token,{root=rootRef||globalThis}={}){
  const key=String(token||'');
  if(!key||!claims.delete(key))return false;
  if(!active())uninstallHibernate(root);
  else emit(root,'CREATOR_EXCLUSIVE_CHANGED',Object.freeze({active:true,claims:claims.size,at:now()}));
  return true;
}

export function releaseCreatorExclusiveOwner(owner,{root=rootRef||globalThis}={}){
  const target=normalizeOwner(owner);let removed=0;
  for(const [token,claim] of Array.from(claims.entries()))if(claim.owner===target){claims.delete(token);removed++;}
  if(removed&&!active())uninstallHibernate(root);
  return removed;
}

export function getCreatorExclusiveSnapshot(){
  return Object.freeze({
    active:active(),
    claims:Object.freeze(Array.from(claims.values())),
    owners:Object.freeze(Array.from(new Set(Array.from(claims.values()).map(v=>v.owner)))),
    inputLocked:!!inputLock,movementIntercepted:!!movementHook,renderIntercepted:!!renderHook,simulationSuspended:!!simulationToken,
    atlasEvictions,transitions
  });
}
