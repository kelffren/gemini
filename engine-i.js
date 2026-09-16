// Minimap is intentionally disabled. Plaza/tileset rendering remains owned by engine-l.js.
(function(root){
'use strict';
if(typeof document==='undefined')return;
root.KELO_HIDE_MINIMAP=true;
const known='#kw-live-minimap,#kelo-minimap,#minimap,.kelo-minimap,.lx-mark,[data-minimap],[id*="minimap" i],[class*="minimap" i],[id*="mini-map" i],[class*="mini-map" i]';
function removeNode(node){
  if(!(node instanceof HTMLElement))return false;
  const host=node.closest?.(known)||node;
  if(host&&host!==document.body&&host.id!=='game-canvas'){host.remove();return true;}
  return false;
}
function looksLikeLegacyBottomLeftMap(el){
  if(!(el instanceof HTMLElement)||el.id==='game-canvas')return false;
  const r=el.getBoundingClientRect();
  if(r.width<48||r.height<48||r.width>260||r.height>260)return false;
  if(r.left>Math.max(72,innerWidth*.30)||r.top<innerHeight*.48)return false;
  const ratio=r.width/r.height;
  if(ratio<.55||ratio>1.9)return false;
  return el.tagName==='CANVAS'||!!el.querySelector?.('canvas');
}
function purge(){
  document.querySelectorAll(known).forEach(removeNode);
  document.querySelectorAll('canvas,div,section,aside').forEach(el=>{
    if(looksLikeLegacyBottomLeftMap(el))removeNode(el);
  });
}
function schedule(){requestAnimationFrame(purge);}
purge();
new MutationObserver(schedule).observe(document.documentElement,{childList:true,subtree:true});
root.addEventListener?.('load',purge,{passive:true});
root.addEventListener?.('pageshow',purge,{passive:true});
root.addEventListener?.('orientationchange',schedule,{passive:true});
root.addEventListener?.('resize',schedule,{passive:true});
root.KELO_MINIMAP_DISABLED=Object.freeze({disabled:true,owner:'engine-i-hard-disable-v1'});
})(typeof globalThis!=='undefined'?globalThis:window);
