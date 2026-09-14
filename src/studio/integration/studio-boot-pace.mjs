/* KELO-INDEX
 * area: STUDIO / BOOT PACE
 * owns: main-thread yields and World launch status text only
 * does-not-own: Studio kernel, Hub, tools, authority
 * public-api: yieldStudioBoot(), setWorldLaunchStatus()
 * mobile: lets iPhone Safari paint and run timers between Studio import waves
 * online: no
 */
export function yieldStudioBoot(root=globalThis){
  return new Promise(resolve=>{
    const raf=root.requestAnimationFrame;
    if(typeof raf==='function'){
      raf.call(root,()=>resolve());
      return;
    }
    const wait=typeof root.setTimeout==='function'?root.setTimeout.bind(root):setTimeout;
    wait(()=>resolve(),0);
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
