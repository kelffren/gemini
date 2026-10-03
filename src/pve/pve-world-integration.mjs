/* KELO-INDEX
 * area: PVE / WORLD INTEGRATION
 * owner: Kelo PvE
 * purpose: register encounter updates/draw snapshots through canonical simulation/render extension owners
 */
const F=Object.freeze;
export function mountPveWorld({encounter,simulation=globalThis.KeloSimulation,render=globalThis.KeloRender,getTarget=()=>globalThis.localPlayer,drawEnemy=null}={}){
  if(!encounter)throw new Error('PVE_ENCOUNTER_REQUIRED');
  const hooks=[];
  if(simulation?.after)hooks.push(['simulation',simulation.after('KeloPvE',ctx=>encounter.update((Number(ctx.dt)||0)*1000,{target:getTarget?.()||null}),40)]);
  if(render?.afterFrame&&typeof drawEnemy==='function')hooks.push(['render',render.afterFrame('KeloPvE',ctx=>{for(const enemy of encounter.snapshot())if(!enemy.dead)drawEnemy(enemy,ctx)},40)]);
  return F({
    hooks:F(hooks.map(x=>F({kind:x[0],id:x[1]}))),
    snapshot:()=>encounter.snapshot(),
    unmount(){for(const [kind,id] of hooks){if(kind==='simulation')simulation.unregister?.(id);else render.unregister?.(id)}return true}
  });
}
