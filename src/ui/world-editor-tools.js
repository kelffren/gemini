/* KELO-INDEX
 * area: UI
 * keys: MAP EDITOR BRUSH TERRAIN COLLISION PUBLISH DRAFT LAYER
 * hace: pincel de terreno, capas y publish/preview en el editor de mapa
 * online: solo KELO_WORLD_EDIT.request / WORLD_BUILDER.request; UI no guarda el mundo
 */
(function(){
  'use strict';
  const TILE=Number(window.KELO_TILE_REGISTRY?.worldTileSize)||32;
  let tool='place'; // place | paint | erase | collision | collision-erase
  let material='grass';
  let brush=1;
  let layerGuides=true;
  let ready=false;

  function toast(msg){if(typeof showToast==='function')showToast(msg);else console.log(msg);}
  function actorId(){return String(window.keloNet?.playerKey||window.KELO_ADMIN_KEYS?.playerId?.()||window.localPlayer?.id||'local_pioneer');}
  function snap(v){return Math.floor(Number(v)/TILE)*TILE;}
  function toWorld(e){if(typeof screenToWorld==='function')return screenToWorld(e.clientX,e.clientY);const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;return{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};}

  window.KELO_WORLD_BUILDER_UI=Object.freeze({
    version:'world-editor-tools-v1.0.0',
    guideState(){
      if(!layerGuides||tool==='place')return {open:false};
      return {open:true,layer:tool.indexOf('collision')>=0?'collision':'terrain',cursor:null};
    },
    get tool(){return tool;}
  });

  async function ensureDraft(){
    const E=window.KELO_WORLD_EDIT;if(!E?.request)throw new Error('WORLD_EDIT_AUTHORITY_NOT_READY');
    const cur=await E.request('world:draft:current',{actorId:actorId()});
    if(cur?.draft)return cur.draft;
    return (await E.request('world:draft:create',{actorId:actorId()})).draft;
  }
  async function paintAt(w,erase){
    await ensureDraft();
    const WB=window.KELO_WORLD_BUILDER;
    const op=erase?'world-builder:erase-terrain':'world-builder:paint';
    await WB.request(op,{actorId:actorId(),x:snap(w.x),y:snap(w.y),brushSize:brush,material,role:material==='marble'?'path':'terrain'});
  }
  async function collisionAt(w,erase){
    await ensureDraft();
    const WB=window.KELO_WORLD_BUILDER;
    if(erase){
      const hit=WB.collisionAt(w.x,w.y);if(!hit){toast('No hay colisión ahí');return;}
      await WB.request('world-builder:collision-remove',{actorId:actorId(),collisionId:hit.collisionId});
      toast('Colisión borrada');return;
    }
    await WB.request('world-builder:collision-create',{actorId:actorId(),x:snap(w.x),y:snap(w.y),w:TILE*brush,h:TILE*brush});
    toast('Colisión puesta');
  }
  async function publish(){
    await ensureDraft();
    const E=window.KELO_WORLD_EDIT;
    await E.request('world:draft:submit',{actorId:actorId()});
    try{await E.request('world:draft:approve',{actorId:actorId()});}catch(e){}
    await E.request('world:publish',{actorId:actorId()});
    toast('Mundo publicado');
  }
  async function preview(on){
    const E=window.KELO_WORLD_EDIT;
    if(on){await ensureDraft();await E.request('world:preview:enter',{actorId:actorId()});toast('Viendo draft');}
    else{await E.request('world:preview:exit',{actorId:actorId()});toast('Viendo publicado');}
  }

  function bar(){
    const host=document.getElementById('kelo-property-editor');
    if(!host||document.getElementById('pe-world-tools'))return !!document.getElementById('pe-world-tools');
    const wrap=document.createElement('div');wrap.id='pe-world-tools';
    wrap.innerHTML=`<style>
      #pe-world-tools{display:flex;flex-wrap:wrap;gap:5px;padding:0 10px 8px}
      #pe-world-tools button,#pe-world-tools select{border:1px solid rgba(231,197,106,.28);background:#111e20;color:#e7c56a;border-radius:8px;padding:6px 7px;font-size:8px;font-weight:800}
      #pe-world-tools button.on{border-color:#fff4d6;color:#fff4d6}
    </style>
    <button data-tool="place">PROPS</button>
    <button data-tool="paint">PINCEL</button>
    <button data-tool="erase">BORRAR SUELO</button>
    <button data-tool="collision">COLISIÓN</button>
    <button data-tool="collision-erase">QUITAR COL.</button>
    <select id="pe-mat"><option value="grass">Césped</option><option value="marble">Mármol</option></select>
    <select id="pe-brush"><option value="1">1 tile</option><option value="2">2 tiles</option><option value="3">3 tiles</option></select>
    <button id="pe-guides">GUÍAS</button>
    <button id="pe-preview">PREVIEW DRAFT</button>
    <button id="pe-publish">PUBLICAR</button>`;
    const info=document.getElementById('pe-info');
    if(info&&info.parentNode)info.parentNode.insertBefore(wrap,info.nextSibling);
    else host.insertBefore(wrap,host.children[2]||null);
    wrap.addEventListener('click',e=>{
      const b=e.target.closest('[data-tool]');
      if(b){tool=b.getAttribute('data-tool');wrap.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('on',x===b));toast(tool==='place'?'Modo props':tool);}
    });
    wrap.querySelector('[data-tool="place"]').classList.add('on');
    document.getElementById('pe-mat').onchange=e=>{material=e.target.value;};
    document.getElementById('pe-brush').onchange=e=>{brush=Math.max(1,Number(e.target.value)||1);};
    document.getElementById('pe-guides').onclick=()=>{layerGuides=!layerGuides;toast(layerGuides?'Guías on':'Guías off');};
    document.getElementById('pe-preview').onclick=()=>preview(true).catch(err=>toast(err.message));
    document.getElementById('pe-publish').onclick=()=>publish().catch(err=>toast(err.message==='ADMIN_KEY_PERMISSION_DENIED'?'Tu llave no puede publicar':err.message));
    return true;
  }

  window.addEventListener('pointerdown',async function(e){
    if(tool==='place')return;
    const host=document.getElementById('kelo-property-editor');
    if(!host||host.style.display==='none'||host.contains(e.target))return;
    if(!window.KELO_WORLD_BUILDER?.request){toast('World builder no listo');return;}
    e.preventDefault();e.stopImmediatePropagation();
    const w=toWorld(e);
    try{
      if(tool==='paint')await paintAt(w,false);
      else if(tool==='erase')await paintAt(w,true);
      else if(tool==='collision')await collisionAt(w,false);
      else if(tool==='collision-erase')await collisionAt(w,true);
    }catch(err){toast(err.message||String(err));}
  },true);

  const t=setInterval(()=>{if(bar()){ready=true;if(window.KELO_WORLD_BUILDER)clearInterval(t);}},120);
  setTimeout(()=>clearInterval(t),20000);
  window.KELO_WORLD_EDITOR_TOOLS=Object.freeze({version:'world-editor-tools-v1.0.0',get tool(){return tool;}});
})();
