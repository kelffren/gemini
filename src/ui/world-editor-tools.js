/* KELO-INDEX
 * area: UI
 * keys: MAP EDITOR BRUSH TERRAIN COLLISION PUBLISH DRAFT LAYER DOCK COMPACT
 * hace: pincel + panel compacto abajo para no tapar el mapa al pintar césped
 * online: solo KELO_WORLD_EDIT.request / WORLD_BUILDER.request
 */
(function(){
  'use strict';
  const TILE=Number(window.KELO_TILE_REGISTRY?.worldTileSize)||32;
  let tool='place';
  let material='grass';
  let brush=1;
  let layerGuides=true;

  function toast(msg){if(typeof showToast==='function')showToast(msg);else console.log(msg);}
  function actorId(){return String(window.keloNet?.playerKey||window.KELO_ADMIN_KEYS?.playerId?.()||window.localPlayer?.id||'local_pioneer');}
  function snap(v){return Math.floor(Number(v)/TILE)*TILE;}
  function toWorld(e){if(typeof screenToWorld==='function')return screenToWorld(e.clientX,e.clientY);const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;return{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};}
  function host(){return document.getElementById('kelo-property-editor');}
  function compact(on){
    const h=host();if(!h)return;
    h.classList.toggle('pe-compact',!!on);
    const b=document.getElementById('pe-expand');
    if(b)b.textContent=on?'CATÁLOGO':'MAPA';
  }

  window.KELO_WORLD_BUILDER_UI=Object.freeze({
    version:'world-editor-tools-v1.1.0',
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

  function injectStyle(){
    if(document.getElementById('pe-dock-style'))return;
    const st=document.createElement('style');st.id='pe-dock-style';
    st.textContent=`
      #kelo-property-editor.pe-compact{top:auto!important;bottom:max(8px,env(safe-area-inset-bottom))!important;left:max(8px,env(safe-area-inset-left))!important;right:max(8px,env(safe-area-inset-right))!important;width:auto!important;height:auto!important;max-height:132px!important;}
      #kelo-property-editor.pe-compact .pe-tabs,
      #kelo-property-editor.pe-compact .pe-info,
      #kelo-property-editor.pe-compact .pe-toolbar,
      #kelo-property-editor.pe-compact .pe-search,
      #kelo-property-editor.pe-compact .pe-placed,
      #kelo-property-editor.pe-compact .pe-list,
      #kelo-property-editor.pe-compact .pe-hint{display:none!important}
      #kelo-property-editor.pe-compact #pe-world-tools{max-height:54px;overflow:auto}
      #pe-expand{margin-left:4px}
    `;
    document.head.appendChild(st);
  }

  function bar(){
    const h=host();
    if(!h||document.getElementById('pe-world-tools')){
      if(h&&!document.getElementById('pe-expand')){
        const head=h.querySelector('.pe-head');
        if(head){const b=document.createElement('button');b.className='pe-icon';b.id='pe-expand';b.textContent='MAPA';b.onclick=()=>compact(!h.classList.contains('pe-compact'));head.insertBefore(b,document.getElementById('pe-close'));}
      }
      return !!document.getElementById('pe-world-tools');
    }
    injectStyle();
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
    else h.insertBefore(wrap,h.children[2]||null);
    const head=h.querySelector('.pe-head');
    if(head&&!document.getElementById('pe-expand')){
      const b=document.createElement('button');b.className='pe-icon';b.id='pe-expand';b.textContent='MAPA';
      b.onclick=()=>compact(!h.classList.contains('pe-compact'));
      head.insertBefore(b,document.getElementById('pe-close'));
    }
    wrap.addEventListener('click',e=>{
      const btn=e.target.closest('[data-tool]');
      if(btn){
        tool=btn.getAttribute('data-tool');
        wrap.querySelectorAll('[data-tool]').forEach(x=>x.classList.toggle('on',x===btn));
        compact(tool!=='place');
        toast(tool==='place'?'Catálogo':'Toca el mapa para pintar');
      }
    });
    wrap.querySelector('[data-tool="place"]').classList.add('on');
    document.getElementById('pe-mat').onchange=e=>{material=e.target.value;compact(true);};
    document.getElementById('pe-brush').onchange=e=>{brush=Math.max(1,Number(e.target.value)||1);};
    document.getElementById('pe-guides').onclick=()=>{layerGuides=!layerGuides;toast(layerGuides?'Guías on':'Guías off');};
    document.getElementById('pe-preview').onclick=()=>preview(true).catch(err=>toast(err.message));
    document.getElementById('pe-publish').onclick=()=>publish().catch(err=>toast(err.message==='ADMIN_KEY_PERMISSION_DENIED'?'Tu llave no puede publicar':err.message));
    document.getElementById('pe-list')?.addEventListener('click',e=>{if(e.target.closest('.pe-card'))compact(true);});
    return true;
  }

  window.addEventListener('pointerdown',async function(e){
    if(tool==='place')return;
    const h=host();
    if(!h||h.style.display==='none'||h.contains(e.target))return;
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

  const t=setInterval(()=>{if(bar()&&window.KELO_WORLD_BUILDER)clearInterval(t);},120);
  setTimeout(()=>clearInterval(t),20000);
  window.KELO_WORLD_EDITOR_TOOLS=Object.freeze({version:'world-editor-tools-v1.1.0',get tool(){return tool;},compact});
})();
