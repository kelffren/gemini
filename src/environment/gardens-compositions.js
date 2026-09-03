(function(){
'use strict';
const R=window.KELO_TILE_REGISTRY,G=window.KELO_GARDENS_ATLAS,J=window.KELO_GARDENS_JOINS;
if(!R||!G?.tiles||!J?.tiles){console.error('[Kelo gardens compositions] registry or gardens atlases missing');return;}
const C=Object.freeze([
  Object.freeze({id:'north-west-hedge-run',cells:Object.freeze([[6,4,'HEDGE_CAP_L'],[7,4,'HEDGE_H'],[8,4,'HEDGE_CAP_R']])}),
  Object.freeze({id:'north-east-hedge-run',cells:Object.freeze([[16,4,'HEDGE_CAP_L'],[17,4,'HEDGE_MID_ALT'],[18,4,'HEDGE_CAP_R']])}),
  Object.freeze({id:'south-west-hedge-run',cells:Object.freeze([[7,17,'HEDGE_CAP_L'],[8,17,'HEDGE_H'],[9,17,'HEDGE_CAP_R']])}),
  Object.freeze({id:'south-east-hedge-run',cells:Object.freeze([[15,17,'HEDGE_CAP_L'],[16,17,'HEDGE_H'],[17,17,'HEDGE_MID_ALT'],[18,17,'HEDGE_CAP_R']])}),
  Object.freeze({id:'west-hedge-run',cells:Object.freeze([[5,7,'HEDGE_CAP_T'],[5,8,'HEDGE_V'],[5,9,'HEDGE_CAP_B']])}),
  Object.freeze({id:'east-upper-hedge-run',cells:Object.freeze([[22,6,'HEDGE_CAP_T'],[22,7,'HEDGE_V'],[22,8,'HEDGE_CAP_B']])}),
  Object.freeze({id:'east-lower-hedge-run',cells:Object.freeze([[22,14,'HEDGE_CAP_T'],[22,15,'HEDGE_V'],[22,16,'HEDGE_CAP_B']])}),
  Object.freeze({id:'flowerbed-nw',cells:Object.freeze([[7,6,'FLOWER_CAP_L'],[8,6,'FLOWER_CAP_R']])}),
  Object.freeze({id:'flowerbed-ne',cells:Object.freeze([[18,7,'FLOWER_CAP_L'],[19,7,'FLOWER_CAP_R']])}),
  Object.freeze({id:'flowerbed-sw',cells:Object.freeze([[9,14,'FLOWER_CAP_L'],[10,14,'FLOWER_CAP_R']])}),
  Object.freeze({id:'flowerbed-se',cells:Object.freeze([[17,14,'FLOWER_CAP_L'],[18,14,'FLOWER_MID_ALT'],[19,14,'FLOWER_CAP_R']])})
]);
const styles=Object.freeze({
  ...R.styles,
  gardensCompositions:Object.freeze({
    mode:'registry-authored-garden-compositions-v3',
    sourceAtlas:G.id,
    joinAtlas:J.id,
    centerVariationMode:'authored-mid-variant-selection-v1',
    compositionCount:C.length,
    compositions:C,
    preservePathClearance:true,
    preserveLandmarkClearance:true
  })
});
window.KELO_TILE_REGISTRY=Object.freeze({...R,styles});
window.KELO_GARDENS_COMPOSITION_AUDIT=Object.freeze({
  version:'gardens-compositions-v3',
  ready:true,
  mode:styles.gardensCompositions.mode,
  centerVariationMode:styles.gardensCompositions.centerVariationMode,
  compositionCount:C.length,
  joinAtlas:J.id,
  joinMode:J.mode,
  altCenterTileCount:2
});
})();
