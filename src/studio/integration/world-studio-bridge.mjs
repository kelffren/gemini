/* KELO-INDEX
 * area: STUDIO / WORLD BRIDGE
 * owns: paced World→Studio handoff only
 * does-not-own: Studio kernel, live shell internals, Hub, world authority
 * public-api: openKeloStudioLive(), closeKeloStudioLive(), getKeloStudioLive()
 * reuse: live-studio-controller remains the session owner; this file is the only first hop from World workspace
 * mobile: import Studio in waves with main-thread yields; strip provisional listeners before controller hydrate, then release the loading viewport as soon as real chrome hydrates
 * online: no; authority stays in KELO_WORLD_EDIT
 */
import { yieldStudioBoot, setWorldLaunchStatus } from './studio-boot-pace.mjs';

export const WORLD_STUDIO_BRIDGE_BUILD='world-bridge-20260914-9';
const CONTROLLER=`./live-studio-controller.mjs?v=${WORLD_STUDIO_BRIDGE_BUILD}`;
let controllerMod=null;

async function loadController(root){
  if(controllerMod)return controllerMod;
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  setWorldLaunchStatus(root,'Cargando editor…');
  await yieldStudioBoot(root);
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
  controllerMod=await import(CONTROLLER);
  await yieldStudioBoot(root);
  if(root?.KELO_WORLD_LAUNCH_ABORTED)throw new Error('WORLD_EDITOR_OPEN_TIMEOUT');
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
  // Drop handlers belonging to the temporary chrome before the real controller
  // can capture/reference that node. Never replace the DOM node once hydrate starts.
  sanitizeWorldStudioProvisionalShell(root);
  const session=await releaseViewportDuringOpen(root,ctrl.openKeloStudioLive(opts));
  releaseWorldStudioViewport(root);
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
