/* KELO-INDEX
 * area: PVE / GREENWILD LIVE BOOT
 * purpose: mount first visible Wolf Pack into the live world after canonical boot
 */
(async function(root){
  if(root.__KELO_GREENWILD_LIVE__)return;
  const [{createGreenwildRun},{mountPveWorld},{mountGreenwildPresentation}]=await Promise.all([
    import('./greenwild-vertical-slice.mjs'),import('./pve-world-integration.mjs'),import('./pve-presentation.mjs')
  ]);
  const run=createGreenwildRun({seed:'greenwild-live-v1',partySize:1});
  const encounter=run.startEncounter('wolf-pack');
  const player=(typeof localPlayer!=='undefined'?localPlayer:null);
  if(player){
    const rows=encounter.snapshot();rows.forEach((row,i)=>encounter.actor(row.id)?.setPosition(player.x+150+(i%2)*58,player.y-70+Math.floor(i/2)*68));
  }
  const world=mountPveWorld({encounter,getTarget:()=>typeof localPlayer!=='undefined'?localPlayer:null});
  const presentation=await mountGreenwildPresentation({encounter,ctx:typeof ctx!=='undefined'?ctx:null,camera:typeof camera!=='undefined'?camera:null});
  root.__KELO_GREENWILD_LIVE__=Object.freeze({run,encounter,world,presentation});
  root.KeloEvents?.emit?.('kelo:pve:greenwild-live',{encounterId:'wolf-pack',count:encounter.snapshot().length});
})(globalThis).catch(error=>console.error('[KeloPvE] Greenwild live mount failed',error));
