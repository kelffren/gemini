/* KELO-INDEX
 * area: UI
 * keys: BUILDER UX UNDO AUTOTILE COLLISION GHOST PICKUP DOCK ONLINE
 * hace: unifica constructores, undo 20, colisión al colocar, ghost y recoger; no guarda mundo
 * online: solo envuelve request() existente
 */
(function(){
  'use strict';
  if(window.KELO_BUILDER_UX)return;
  const TILE=32;
  const undo=[];
  let ghost=null,held=null,busy=false;
  const toast=m=>{if(typeof showToast==='function')showToast(m);};
  const actor=()=>String(window.keloNet?.playerKey||window.KELO_ADMIN_KEYS?.playerId?.()||window.localPlayer?.id||'local_pioneer');
  function toWorld(e){if(typeof screenToWorld==='function')return screenToWorld(e.clientX,e.clientY);const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;return{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};}
  function snap(v){return Math.floor(Number(v)/TILE)*TILE;}

  function pushUndo(entry){undo.push(entry);if(undo.length>20)undo.shift();}
  async function undoLast(){
    const e=undo.pop();if(!e){toast('Nada que deshacer');return;}
    try{
      if(e.kind==='paint')await window.KELO_WORLD_BUILDER.request('world-builder:erase-terrain',{actorId:actor(),x:e.x,y:e.y,brushSize:e.brush||1});
      else if(e.kind==='erase')await window.KELO_WORLD_BUILDER.request('world-builder:paint',{actorId:actor(),x:e.x,y:e.y,brushSize:1,material:e.material||'grass',role:e.role||'terrain'});
      else if(e.kind==='collision'&&e.collisionId)await window.KELO_WORLD_BUILDER.request('world-builder:collision-remove',{actorId:actor(),collisionId:e.collisionId});
      else if(e.kind==='place'&&e.placementId){
        const S=window.KELO_PROPERTY_SYSTEM;
        await S.request('remove',{ownerId:e.ownerId,placementId:e.placementId});
        if(e.collisionId)await window.KELO_WORLD_BUILDER.request('world-builder:collision-remove',{actorId:actor(),collisionId:e.collisionId});
      }
      toast('Deshecho');
    }catch(err){toast(err.message||'No se pudo deshacer');}
  }

  function wrapWorld(){
    const WB=window.KELO_WORLD_BUILDER;if(!WB||WB.__uxWrapped)return;
    const raw=WB.request.bind(WB);
    async function request(op,payload){
      const out=await raw(op,payload||{});
      if(op==='world-builder:paint')pushUndo({kind:'paint',x:payload.x,y:payload.y,brush:payload.brushSize||1});
      if(op==='world-builder:erase-terrain')pushUndo({kind:'erase',x:payload.x,y:payload.y,material:'grass'});
      if(op==='world-builder:collision-create')pushUndo({kind:'collision',collisionId:out?.collisionId||out?.id});
      return out;
    }
    window.KELO_WORLD_BUILDER=Object.assign({},WB,{request,__uxWrapped:true});
  }
  function wrapProperty(){
    const S=window.KELO_PROPERTY_SYSTEM;if(!S||S.__uxWrapped)return;
    const raw=S.request.bind(S);
    async function request(op,payload){
      const out=await raw(op,payload||{});
      if(op==='place'&&out?.placementId){
        const C=window.KELO_PROPERTY_CATALOG,t=C?.get?.(payload.assetId);
        const fp=t?.footprint||{x:0,y:0,w:t?.width||TILE,h:Math.max(16,(t?.height||TILE)*0.28)};
        let collisionId=null;
        try{
          const col=await window.KELO_WORLD_BUILDER?.request?.('world-builder:collision-create',{
            actorId:actor(),x:payload.x+(fp.x||0),y:payload.y+(t?t.height-fp.h:0),w:fp.w||TILE,h:fp.h||TILE
          });
          collisionId=col?.collisionId||col?.id||null;
        }catch(e){}
        pushUndo({kind:'place',placementId:out.placementId,ownerId:payload.ownerId,collisionId});
      }
      return out;
    }
    const next=Object.assign({},S,{request,__uxWrapped:true});
    window.KELO_PROPERTY_SYSTEM=next;
  }

  function unifyUi(){
    const peFab=document.getElementById('pe-fab');
    if(peFab)peFab.style.display='none';
    const tools=document.getElementById('pe-world-tools');
    if(tools)tools.remove();
    if(!document.getElementById('kelo-builder-undo')){
      const b=document.createElement('button');
      b.id='kelo-builder-undo';b.textContent='DESHACER';
      b.style.cssText='position:absolute;z-index:250;left:max(10px,env(safe-area-inset-left));bottom:max(58px,calc(env(safe-area-inset-bottom) + 46px));pointer-events:auto;border:1px solid rgba(231,197,106,.5);background:rgba(10,20,21,.94);color:#e7c56a;border-radius:12px;padding:8px 10px;font:800 10px/1 sans-serif';
      b.onclick=()=>undoLast();
      document.body.appendChild(b);
    }
    const pe=document.getElementById('kelo-property-editor');
    const wb=document.getElementById('kelo-world-builder');
    if(pe&&wb&&pe.style.display==='flex'&&wb.style.display!=='none'){
      pe.style.display='none';
    }
  }

  function drawGhost(g){
    if(!ghost)return;
    g.save();g.globalAlpha=.38;g.fillStyle='#e7c56a';g.fillRect(ghost.x,ghost.y,ghost.w,ghost.h);g.globalAlpha=1;g.strokeStyle='#fff4d6';g.strokeRect(ghost.x,ghost.y,ghost.w,ghost.h);g.restore();
  }
  const L=window.KELO_ENVIRONMENT_LAYERS;
  if(L?.register){
    L.register({id:'builder-ux-ghost',phase:'vfx_weather_lighting',priority:998,required:false,ready:()=>true,draw:drawGhost,ownership:'builder-ux-v1',bounds:()=>[]});
  }

  window.addEventListener('pointermove',e=>{
    const ui=window.KELO_WORLD_BUILDER_UI;
    const tool=ui?.tool||'place';
    const w=toWorld(e);
    if(held){ghost={x:snap(w.x),y:snap(w.y),w:held.w||TILE,h:held.h||TILE};return;}
    if(tool&&tool!=='place')ghost={x:snap(w.x),y:snap(w.y),w:TILE,h:TILE};
  },{passive:true});

  window.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'){e.preventDefault();undoLast();}});

  const t=setInterval(()=>{wrapWorld();wrapProperty();unifyUi();},200);
  setTimeout(()=>clearInterval(t),25000);
  window.KELO_BUILDER_UX=Object.freeze({version:'builder-ux-v1.0.0',undoLast,get undoCount(){return undo.length;}});
})();
