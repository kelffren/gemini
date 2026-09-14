/* KELO-INDEX
 * area: STUDIO / WORLD BRIDGE
 * owns: paced World→Studio handoff only
 * does-not-own: Studio kernel, live shell internals, Hub, world authority
 * public-api: openKeloStudioLive(), closeKeloStudioLive(), getKeloStudioLive()
 * reuse: live-studio-controller remains the session owner; this file is the only first hop from World workspace
 * mobile: import the zero-static-import controller after one paint yield, then hand off to controller immediately; controller owns phased runtime loading after chrome exists. Strip provisional listeners before controller hydrate, release the loading viewport as soon as real chrome hydrates, and keep one Studio stylesheet after provisional→live handoff.
 * online: no; authority stays in KELO_WORLD_EDIT
 */
import { yieldStudioBoot, setWorldLaunchStatus } from './studio-boot-pace.mjs';

export const WORLD_STUDIO_BRIDGE_BUILD='world-bridge-20260914-15';
const bridgeUrl=new URL(import.meta.url);
const controllerBuild=bridgeUrl.searchParams.get('v')||WORLD_STUDIO_BRIDGE_BUILD;
const CONTROLLER=`./live-studio-controller.mjs?v=${encodeURIComponent(controllerBuild)}`;
let controllerMod=null;

async function loadController(root){
  if(controllerMod)return controllerMod;
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  setWorldLaunchStatus(root,'Cargando editor…');
  // Give Safari one paint before parsing the controller, but once the controller
  // has evaluated do not insert another frame/timer barrier before mount. The
  // controller's first responsibility is painting #kelo-studio-live; delaying the
  // handoff here only widens the imports-finished -> mount gap observed on iPhone.
  await yieldStudioBoot(root);
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  controllerMod=await import(CONTROLLER);
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  setWorldLaunchStatus(root,'Montando editor…');
  return controllerMod;
}

export function sanitizeWorldStudioProvisionalShell(root=globalThis){
  const shell=root?.document?.getElementById?.('kelo-studio-live');
  if(shell?.dataset?.keloWorldLoading!=='1')return shell||null;
  if(typeof shell.cloneNode!=='function'||typeof shell.replaceWith!=='function')return shell;
  try{
    const clean=shell.cloneNode(true);
    shell.replaceWith(clean);
    return clean;
  }catch{
    return shell;
  }
}

export function pruneWorldStudioStyles(root=globalThis){
  const doc=root?.document;
  const styles=Array.from(doc?.querySelectorAll?.('style[data-kelo-studio-ui="1"]')||[]);
  if(styles.length<=1)return styles.length;
  const keep=styles[styles.length-1];
  for(const style of styles){
    if(style===keep)continue;
    try{style.remove?.();}catch{}
  }
  return 1;
}

export function releaseWorldStudioViewport(root=globalThis){
  const shell=root?.document?.getElementById?.('kelo-studio-live');
  if(!shell?.dataset?.shellVersion||!shell?.querySelector?.('.ks-top'))return false;
  try{shell.removeAttribute?.('style');}catch{return false;}
  return true;
}

function releaseViewportDuringOpen(root,pending){
  const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
  const cancel=typeof root?.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
  let stopped=false,timer=null;
  const probe=()=>{
    if(stopped)return;
    if(releaseWorldStudioViewport(root)){stopped=true;return;}
    timer=wait(probe,32);
  };
  probe();
  return Promise.resolve(pending).finally(()=>{
    stopped=true;
    if(timer!=null)cancel(timer);
  });
}

export async function openKeloStudioLive(opts={}){
  const root=opts.root||globalThis;
  const ctrl=await loadController(root);
  sanitizeWorldStudioProvisionalShell(root);
  const session=await releaseViewportDuringOpen(root,ctrl.openKeloStudioLive(opts));
  releaseWorldStudioViewport(root);
  pruneWorldStudioStyles(root);
  return session;
}
export async function closeKeloStudioLive(opts={}){
  const root=opts.root||globalThis;
  const ctrl=controllerMod||await import(CONTROLLER);
  controllerMod=ctrl;
  return ctrl.closeKeloStudioLive(opts);
}
export function getKeloStudioLive(){
  return controllerMod?.getKeloStudioLive?.()||null;
}
