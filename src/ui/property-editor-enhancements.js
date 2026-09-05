/* KELO-INDEX
 * area: UI
 * keys: MAP EDITOR PREVIEW MOVE THUMBNAIL PARCEL
 * hace: añade miniaturas reales del catálogo y mover placements sin consumir otra unidad
 * online: mover sigue entrando por KELO_PROPERTY_SYSTEM.request(); no muta balances
 */
(function(){
  'use strict';
  const S=window.KELO_PROPERTY_SYSTEM,C=window.KELO_PROPERTY_CATALOG,A=window.KELO_ATLAS_CONTRACT;
  if(!S||!C||!A){console.error('[Kelo property editor extras] property dependencies missing');return;}
  const images=new Map(),pending=new Map();let movePlacementId=null,moveMode=false,paintQueued=false;
  function acquire(key){
    if(images.has(key))return Promise.resolve(images.get(key));
    if(pending.has(key))return pending.get(key);
    const p=A.acquire(key).then(img=>{images.set(key,img);pending.delete(key);queuePaint();return img;}).catch(()=>{pending.delete(key);return null;});pending.set(key,p);return p;
  }
  function drawPreview(canvas,t){
    if(!canvas||!t)return;const g=canvas.getContext('2d');if(!g)return;const W=canvas.width,H=canvas.height;g.clearRect(0,0,W,H);g.imageSmoothingEnabled=false;
    const scale=Math.min((W-8)/Math.max(1,t.width),(H-8)/Math.max(1,t.height),2),ox=(W-t.width*scale)/2,oy=(H-t.height*scale)/2;g.save();g.translate(ox,oy);g.scale(scale,scale);
    for(const part of t.parts){const img=images.get(part.assetKey);if(!img){acquire(part.assetKey);continue;}const old=g.globalAlpha;g.globalAlpha=old*(Number.isFinite(part.opacity)?part.opacity:1);g.drawImage(img,part.source.x,part.source.y,part.source.w,part.source.h,part.offset.x,part.offset.y,part.size.w,part.size.h);g.globalAlpha=old;}g.restore();
  }
  function filteredCatalog(){
    const q=(document.getElementById('pe-q')?.value||'').trim().toLowerCase(),cat=document.getElementById('pe-cat')?.value||'';let list=C.list({category:cat||undefined});if(q)list=list.filter(t=>`${t.label} ${t.id} ${t.family}`.toLowerCase().includes(q));return list;
  }
  function paintCards(){
    paintQueued=false;const list=document.getElementById('pe-list');if(!list)return;const templates=filteredCatalog(),cards=Array.from(list.querySelectorAll('.pe-card'));
    cards.forEach((card,i)=>{const t=templates[i];if(!t)return;card.dataset.asset=t.id;let c=card.querySelector('.pe-thumb');if(!c){c=document.createElement('canvas');c.className='pe-thumb';c.width=120;c.height=64;c.setAttribute('aria-hidden','true');card.prepend(c);}drawPreview(c,t);});
  }
  function queuePaint(){if(paintQueued)return;paintQueued=true;requestAnimationFrame(paintCards);}
  function worldPoint(e){if(typeof screenToWorld==='function')return screenToWorld(e.clientX,e.clientY);const z=(typeof CONFIG!=='undefined'&&CONFIG.zoom)||1;return{x:camera.x+(e.clientX-screenW/2)/z,y:camera.y+(e.clientY-screenH/2)/z};}
  function activeParcelId(){return window.KELO_PROPERTY_EDITOR?.parcelId||null;}
  function ownerForParcel(pid){return S.parcel(pid)?.kind==='world_editor'?'developer':S.playerId();}
  function rememberSelectionAt(e){
    const pid=activeParcelId();if(!pid)return;const w=worldPoint(e);setTimeout(()=>{const hit=S.placementForPoint(w.x,w.y,pid);movePlacementId=hit?.placementId||null;syncMoveButton();},0);
  }
  function syncMoveButton(){const b=document.getElementById('pe-move');if(!b)return;b.disabled=!movePlacementId;b.textContent=moveMode?'TOCA DESTINO':'MOVER';b.classList.toggle('on',moveMode);}
  function installUi(){
    const root=document.getElementById('kelo-property-editor'),actions=root?.querySelector('.pe-actions'),list=document.getElementById('pe-list');if(!root||!actions||!list)return false;
    if(!document.getElementById('pe-move')){const b=document.createElement('button');b.id='pe-move';b.textContent='MOVER';actions.insertBefore(b,actions.firstChild);b.onclick=()=>{if(!movePlacementId)return;moveMode=!moveMode;if(typeof showToast==='function')showToast(moveMode?'Toca el nuevo lugar del objeto':'Movimiento cancelado');syncMoveButton();};}
    if(!document.getElementById('kelo-property-editor-extras-style')){const st=document.createElement('style');st.id='kelo-property-editor-extras-style';st.textContent='.pe-card{min-height:112px!important}.pe-thumb{display:block;width:100%;height:54px;margin:0 0 5px;border-radius:8px;background:rgba(255,255,255,.025);image-rendering:pixelated}#pe-move.on{border-color:#fff4d6!important;color:#fff4d6!important}@media(max-width:600px){.pe-card{min-height:105px!important}}';document.head.appendChild(st);}
    if(!list._keloPreviewObserver){const o=new MutationObserver(queuePaint);o.observe(list,{childList:true,subtree:true});list._keloPreviewObserver=o;}
    ['pe-q','pe-cat'].forEach(id=>document.getElementById(id)?.addEventListener('input',queuePaint));queuePaint();syncMoveButton();return true;
  }
  window.addEventListener('pointerdown',function(e){
    const root=document.getElementById('kelo-property-editor');if(!root||root.style.display==='none'||root.contains(e.target))return;
    const pid=activeParcelId();if(!pid)return;
    if(moveMode&&movePlacementId){e.preventDefault();e.stopImmediatePropagation();const rec=S.getPlacements(pid).find(x=>x.placementId===movePlacementId);const t=rec&&C.get(rec.assetId);if(!rec||!t){moveMode=false;movePlacementId=null;syncMoveButton();return;}const w=worldPoint(e),snap=t.snap||C.tileSize,x=Math.round(w.x/snap)*snap,y=Math.round(w.y/snap)*snap;S.request('move',{ownerId:ownerForParcel(pid),placementId:movePlacementId,x,y}).then(()=>{moveMode=false;syncMoveButton();if(typeof showToast==='function')showToast('Objeto movido');}).catch(err=>{if(typeof showToast==='function')showToast(err.message==='OUTSIDE_PARCEL'?'Ese asset no cabe ahí':err.message);});return;
    }
    rememberSelectionAt(e);
  },true);
  const timer=setInterval(()=>{if(installUi())clearInterval(timer);},80);setTimeout(()=>clearInterval(timer),5000);
  window.KELO_PROPERTY_EDITOR_EXTRAS=Object.freeze({version:'property-editor-extras-v1.0.0',thumbnails:true,moveWithoutConsumingUnits:true});
})();