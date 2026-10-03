/* KELO-INDEX
 * area: PVE / PRESENTATION
 * owner: Kelo PvE
 * purpose: lightweight enemy presentation through KeloRender; health, telegraph and fallback body while Asset Library sprite binding is pending
 * do-not: no gameplay decisions, damage, hit geometry or independent render loop
 */
const F=Object.freeze;
function clamp(n,a,b){return Math.max(a,Math.min(b,n))}
export function createPvePresenter({ctx=globalThis.ctx,camera=globalThis.camera}={}){
  function screenPoint(enemy){const c=camera||{x:0,y:0};return{x:(Number(enemy.x)||0)-(Number(c.x)||0),y:(Number(enemy.y)||0)-(Number(c.y)||0)}}
  function draw(enemy){
    if(!ctx||!enemy||enemy.dead)return false;const p=screenPoint(enemy),r=Math.max(12,Number(enemy.radius)||18),hp=clamp((Number(enemy.hp)||0)/Math.max(1,Number(enemy.maxHp)||1),0,1);
    ctx.save();
    ctx.globalAlpha=.24;ctx.beginPath();ctx.ellipse(p.x,p.y+r*.65,r*.9,r*.35,0,0,Math.PI*2);ctx.fill();
    if(enemy.state==='telegraph'){ctx.globalAlpha=.75;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r+9,0,Math.PI*2);ctx.stroke()}
    ctx.globalAlpha=1;ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();
    const w=r*2.4,h=4,x=p.x-w/2,y=p.y-r-11;ctx.globalAlpha=.45;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;ctx.fillRect(x,y,w*hp,h);
    ctx.restore();return true;
  }
  return F({draw});
}
export function mountGreenwildPresentation({encounter,presenter=createPvePresenter(),render=globalThis.KeloRender}={}){
  if(!encounter||!render?.afterFrame)throw new Error('PVE_PRESENTATION_FOUNDATION_UNAVAILABLE');
  const hook=render.afterFrame('KeloPvE:Greenwild',()=>{for(const enemy of encounter.snapshot())presenter.draw(enemy)},45);
  return F({hook,unmount(){return render.unregister?.(hook)===true}});
}
