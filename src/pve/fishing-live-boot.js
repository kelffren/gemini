/* KELO-INDEX
 * area: GATHERING / FISHING LIVE BOOT
 * owner: KeloFishingLiveBoot
 * purpose: mount KeloFishingLive after canonical live dependencies are ready
 */
(async function(root){
 if(root.__KELO_FISHING_LIVE__)return;
 const [{ensurePveLiveDependencies},{mount}]=await Promise.all([
  import('./pve-live-dependencies.mjs'),
  import('./fishing-live.mjs')
 ]);
 await ensurePveLiveDependencies();
 const fishing=mount();
 root.__KELO_FISHING_LIVE__=fishing;
 root.KeloEvents?.emit?.('kelo:fishing:live',{ready:true});
})(globalThis).catch(error=>console.error('[KeloFishingLiveBoot]',error));
