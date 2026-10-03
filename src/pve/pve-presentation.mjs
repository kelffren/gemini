/* KELO-INDEX
 * area: PVE / PRESENTATION
 * owner: Kelo PvE
 * purpose: enemy sprites resolved by External Asset Library + HP/telegraph fallback through canonical KeloRender
 * do-not: no gameplay decisions, damage, hit geometry or independent render loop
 */
import {preloadGreenwildEnemyAssets} from './pve-external-assets.mjs';
const F=Object.freeze;const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function loadImage(url){return new Promise(resolve=>{const I=globalThis.Image;if(!I||!url)return resolve(null);const img=new I();img.decoding='async';img.crossOrigin='anonymous';img.onload=()=>resolve(img);img.onerror=()=>resolve(null);img.src=url})}
export async function createGreenwildSpriteBank(){
  const selected=await preloadGreenwildEnemyAssets(),bank={};
  for(const family of ['beast','bandit']){const asset=selected?.[family]?.asset||null;bank[family]=F({asset,image:await loadImage(asset?.downloadUrl||asset?.previewUrl),frameSize:family==='beast'?32:16,frames:family==='beast'?8:1})}
  return F(bank);
}
export function createPvePresenter({ctx=globalThis.ctx,camera=globalThis.camera,spriteBank=null,now=()=>performance.now()}={}){
  function screenPoint(e){if(globalThis.KeloCamera?.worldToScreenPoint)return globalThis.KeloCamera.worldToScreenPoint(Number(e.x)||0,Number(e.y)||0);const c=camera||{x:0,y:0};const sw=globalThis.innerWidth||0,sh=globalThis.innerHeight||0;return{x:(Number(e.x)||0)-(Number(c.x)||0)+sw/2,y:(Number(e.y)||0)-(Number(c.y)||0)+sh/2}}
  function body(enemy,p,r){
    const row=spriteBank?.[enemy.family]||spriteBank?.beast,img=row?.image;
    if(img?.naturalWidth&&img?.naturalHeight){
      const fs=row.frameSize||32,frames=Math.max(1,Math.min(row.frames||1,Math.floor(img.naturalWidth/fs)||1)),frame=enemy.state==='chase'?Math.floor(now()/110)%frames:0;
      const dw=Math.max(32,r*2.5),dh=dw;ctx.imageSmoothingEnabled=false;ctx.drawImage(img,frame*fs,0,fs,Math.min(fs,img.naturalHeight),p.x-dw/2,p.y-dh*.72,dw,dh);return true;
    }
    ctx.beginPath();ctx.arc(p.x,p.y,r,0,Math.PI*2);ctx.fill();return false;
  }
  function draw(enemy){
    if(!ctx||!enemy||enemy.dead)return false;const p=screenPoint(enemy),r=Math.max(12,Number(enemy.radius)||18),hp=clamp((Number(enemy.hp)||0)/Math.max(1,Number(enemy.maxHp)||1),0,1);
    ctx.save();ctx.globalAlpha=.24;ctx.beginPath();ctx.ellipse(p.x,p.y+r*.65,r*.9,r*.35,0,0,Math.PI*2);ctx.fill();
    if(enemy.state==='telegraph'){ctx.globalAlpha=.82;ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,r+10,0,Math.PI*2);ctx.stroke()}
    ctx.globalAlpha=1;body(enemy,p,r);const w=r*2.4,h=4,x=p.x-w/2,y=p.y-r-15;ctx.globalAlpha=.45;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;ctx.fillRect(x,y,w*hp,h);ctx.restore();return true;
  }
  return F({draw,spriteBank});
}
export async function mountGreenwildPresentation({encounter,render=globalThis.KeloRender,ctx=globalThis.ctx,camera=globalThis.camera}={}){
  if(!encounter||!render?.afterFrame)throw new Error('PVE_PRESENTATION_FOUNDATION_UNAVAILABLE');
  const spriteBank=await createGreenwildSpriteBank(),presenter=createPvePresenter({ctx,camera,spriteBank});
  const hook=render.afterFrame('KeloPvE:Greenwild',()=>{for(const enemy of encounter.snapshot())presenter.draw(enemy)},45);
  return F({hook,spriteBank,presenter,unmount(){return render.unregister?.(hook)===true}});
}
