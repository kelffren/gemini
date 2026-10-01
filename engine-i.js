/* KELO-INDEX
 * area: UI / MINIMAP
 * keys: MINIMAP DISABLE MUTATION LAYOUT
 * hace: quita minimapas legacy sin medir layout en cada mutación del DOM
 * online: N/A
 */
// Minimap is intentionally disabled. Plaza/tileset rendering remains owned by engine-l.js.
(function(root){
'use strict';
if(typeof document==='undefined')return;
root.KELO_HIDE_MINIMAP=true;
const known='#kw-live-minimap,#kelo-minimap,#minimap,.kelo-minimap,.lx-mark,[data-minimap],[id*="minimap" i],[class*="minimap" i],[id*="mini-map" i],[class*="mini-map" i]';
function studioOpen(){
  return !!(document.getElementById('kelo-studio-live')||document.body?.classList?.contains('kelo-studio-active'));
}
function inStudio(node){
  return !!(node?.id==='kelo-studio-live'||node?.closest?.('#kelo-studio-live,[data-kelo-studio-ui]'));
}
function removeNode(node){
  if(!(node instanceof HTMLElement)||inStudio(node))return false;
  const host=node.matches?.(known)?node:(node.closest?.(known)||null);
  if(host&&host!==document.body&&host.id!=='game-canvas'){host.remove();return true;}
  return false;
}
function looksLikeLegacyBottomLeftMap(el){
  if(!(el instanceof HTMLElement)||el.id==='game-canvas'||inStudio(el)||studioOpen())return false;
  const r=el.getBoundingClientRect();
  if(r.width<48||r.height<48||r.width>260||r.height>260)return false;
  if(r.left>Math.max(72,innerWidth*.30)||r.top<innerHeight*.48)return false;
  const ratio=r.width/r.height;
  if(ratio<.55||ratio>1.9)return false;
  return el.tagName==='CANVAS'||!!el.querySelector?.('canvas');
}
function purgeKnownFrom(node){
  if(!(node instanceof Element)||inStudio(node))return;
  if(node.matches?.(known))removeNode(node);
  const hits=node.querySelectorAll?.(known);
  if(!hits)return;
  for(let i=0;i<hits.length;i++)if(!inStudio(hits[i]))removeNode(hits[i]);
}
function purgeGeometry(){
  if(studioOpen())return;
  const nodes=document.querySelectorAll('canvas,div,section,aside');
  for(let i=0;i<nodes.length;i++)if(looksLikeLegacyBottomLeftMap(nodes[i]))removeNode(nodes[i]);
}
let geomTimer=0;
function scheduleGeometry(){
  if(geomTimer||studioOpen())return;
  geomTimer=setTimeout(function(){geomTimer=0;purgeGeometry();},700);
}
function onMutations(records){
  for(let i=0;i<records.length;i++){
    const added=records[i].addedNodes;
    for(let j=0;j<added.length;j++){
      const node=added[j];
      if(node&&node.nodeType===1)purgeKnownFrom(node);
    }
  }
}
function purgeNow(){purgeKnownFrom(document.documentElement);purgeGeometry();}
purgeKnownFrom(document.documentElement);
scheduleGeometry();
new MutationObserver(onMutations).observe(document.documentElement,{childList:true,subtree:true});
root.addEventListener?.('load',purgeNow,{passive:true});
root.addEventListener?.('pageshow',purgeNow,{passive:true});
root.addEventListener?.('orientationchange',scheduleGeometry,{passive:true});
root.addEventListener?.('resize',scheduleGeometry,{passive:true});
root.__KELO_MINIMAP_PURGE__=purgeNow;
root.KELO_MINIMAP_DISABLED=Object.freeze({disabled:true,owner:'engine-i-hard-disable-v2',layoutOnMutation:false});
})(typeof globalThis!=='undefined'?globalThis:window);
