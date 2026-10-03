/* KELO-INDEX
 * area: PVE / WORLD INTEGRATION
 * owner: Kelo PvE
 * purpose: register encounter updates/draw snapshots through canonical simulation/render extension owners
 */
import {createBridge} from './pve-canonical-runtime-bridge.mjs';
const F=Object.freeze;
export function mountPveWorld({encounter,simulation=globalThis.KeloSimulation,render=globalThis.KeloRender,getTarget=()=>globalThis.localPlayer,drawEnemy=null,canonical=true}={}){
  if(!encounter)throw new Error('PVE_ENCOUNTER_REQUIRED');
  const hooks=[],bridge=canonical?createBridge({encounter,getPlayer:getTarget}):null;
  if(simulation?.after)hooks.push(['simulation',simulation.after('KeloPvE',ctx=>{const ms=(Number(ctx.dt)||0)*1000;if(bridge)bridge.update(ms);else encounter.update(ms,{target:getTarget?.()||null})},40)]);
  if(render?.afterFrame&&typeof drawEnemy==='function')hooks.push(['render',render.afterFrame('KeloPvE',ctx=>{for(const enemy of encounter.snapshot())if(!enemy.dead)drawEnemy(enemy,ctx)},40)]);
  return F({
    hooks:F(hooks.map(x=>F({kind:x[0],id:x[1]}))),bridge,
    snapshot:()=>encounter.snapshot(),
    playerHit:(enemyId,amount,meta={})=>bridge?bridge.playerHit(enemyId,amount,meta):encounter.damage(enemyId,amount,meta),
    unmount(){for(const [kind,id] of hooks){if(kind==='simulation')simulation.unregister?.(id);else render.unregister?.(id)}return true}
  });
}
