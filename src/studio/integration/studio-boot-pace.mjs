/* KELO-INDEX
 * area: STUDIO / BOOT PACE
 * owns: main-thread yields and World launch status text only
 * does-not-own: Studio kernel, Hub, tools, authority
 * public-api: yieldStudioBoot(), setWorldLaunchStatus()
 * mobile: lets iPhone Safari paint and run timers between Studio import waves without trusting requestAnimationFrame to fire forever
 * online: no
 */
const DEFAULT_RAF_FALLBACK_MS=48;

export function yieldStudioBoot(root=globalThis){
  return new Promise(resolve=>{
    const wait=typeof root?.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
    const cancel=typeof root?.clearTimeout==='function'?root.clearTimeout.bind(root):clearTimeout;
    const configured=Number(root?.KELO_STUDIO_BOOT_RAF_FALLBACK_MS);
    const fallbackMs=Number.isFinite(configured)?Math.max(0,configured):DEFAULT_RAF_FALLBACK_MS;
    let settled=false,timer=null;
    const finish=()=>{
      if(settled)return;
      settled=true;
      if(timer!=null)cancel(timer);
      resolve();
    };
    const raf=root?.requestAnimationFrame;
    if(typeof raf==='function'){
      // iOS Safari can temporarily stop servicing rAF while parsing/evaluating a
      // large ESM graph. Keep the paint opportunity, but never let a missed rAF
      // hold every phased Studio import behind the old 120ms barrier.
      timer=wait(finish,fallbackMs);
      try{raf.call(root,finish);return;}catch{}
      if(timer!=null){cancel(timer);timer=null;}
    }
    wait(finish,0);
  });
}
export function setWorldLaunchStatus(root,message){
  try{
    const doc=root?.document;
    const status=doc?.querySelector?.('[data-kelo-world-launch-status], #kelo-studio-live .ks-status');
    if(status)status.textContent=message;
    const curtain=doc?.getElementById?.('kelo-world-launch-curtain');
    if(curtain)curtain.textContent=message;
  }catch{}
}
