(function(){
'use strict';
const R=window.KELO_TILE_REGISTRY,G=window.KELO_GARDENS_ATLAS;
if(!R||!G?.tiles){console.error('[Kelo gardens compositions] registry or gardens atlas missing');return;}
const C=Object.freeze([
  Object.freeze({id:'north-west-hedge-run',cells:Object.freeze([[6,4,'HEDGE_H'],[7,4,'HEDGE_H'],[8,4,'HEDGE_H']])}),
  Object.freeze({id:'north-east-hedge-run',cells:Object.freeze([[16,4,'HEDGE_H'],[17,4,'HEDGE_H'],[18,4,'HEDGE_H']])}),
  Object.freeze({id:'south-west-hedge-run',cells:Object.freeze([[7,17,'HEDGE_H'],[8,17,'HEDGE_H'],[9,17,'HEDGE_H']])}),
  Object.freeze({id:'south-east-hedge-run',cells:Object.freeze([[15,17,'HEDGE_H'],[16,17,'HEDGE_H'],[17,17,'HEDGE_H'],[18,17,'HEDGE_H']])}),
  Object.freeze({id:'west-hedge-run',cells:Object.freeze([[5,7,'HEDGE_V'],[5,8,'HEDGE_V'],[5,9,'HEDGE_V']])}),
  Object.freeze({id:'east-upper-hedge-run',cells:Object.freeze([[22,6,'HEDGE_V'],[22,7,'HEDGE_V'],[22,8,'HEDGE_V']])}),
  Object.freeze({id:'east-lower-hedge-run',cells:Object.freeze([[22,14,'HEDGE_V'],[22,15,'HEDGE_V'],[22,16,'HEDGE_V']])}),
  Object.freeze({id:'flowerbed-nw',cells:Object.freeze([[7,6,'FLOWERBED'],[8,6,'FLOWERBED']])}),
  Object.freeze({id:'flowerbed-ne',cells:Object.freeze([[18,7,'FLOWERBED'],[19,7,'FLOWERBED']])}),
  Object.freeze({id:'flowerbed-sw',cells:Object.freeze([[9,14,'FLOWERBED'],[10,14,'FLOWERBED']])}),
  Object.freeze({id:'flowerbed-se',cells:Object.freeze([[17,14,'FLOWERBED'],[18,14,'FLOWERBED'],[19,14,'FLOWERBED']])})
]);
const styles=Object.freeze({
  ...R.styles,
  gardensCompositions:Object.freeze({
    mode:'registry-authored-garden-compositions-v1',
    sourceAtlas:G.id,
    compositionCount:C.length,
    compositions:C,
    preservePathClearance:true,
    preserveLandmarkClearance:true
  })
});
window.KELO_TILE_REGISTRY=Object.freeze({...R,styles});
window.KELO_GARDENS_COMPOSITION_AUDIT=Object.freeze({version:'gardens-compositions-v1',ready:true,mode:styles.gardensCompositions.mode,compositionCount:C.length});
})();
