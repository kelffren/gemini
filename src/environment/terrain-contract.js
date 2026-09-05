(function(){
  const SIDES=Object.freeze({top:1,right:2,bottom:4,left:8});
  const FRAME_BY_MASK=Object.freeze({0:15,1:0,2:1,3:5,4:2,5:12,6:6,7:9,8:3,9:4,10:13,11:8,12:7,13:11,14:10,15:14});

  const materials=Object.freeze({
    grass:Object.freeze({
      id:'grass', role:'base', atlas:'grassVariation', family:'grassAuthored',
      sampling:'nearest', variationMode:'deterministic-family-v1'
    }),
    marble:Object.freeze({
      id:'marble', role:'path', atlas:'plaza', family:'marble',
      sampling:'nearest', variationMode:'deterministic-family-v1',
      detailAtlas:'marbleVariation', detailFamily:'marbleVariation'
    })
  });

  const transitions=Object.freeze({
    marble_to_grass:Object.freeze({
      id:'marble_to_grass', owner:'marble', neighbour:'grass', atlas:'transitions',
      topology:'edge-bitmask-4-v1', sideOrder:Object.freeze(['top','right','bottom','left']),
      sideBits:SIDES, frameByMask:FRAME_BY_MASK, overlay:true
    })
  });

  function transitionKey(owner,neighbour){return owner+'_to_'+neighbour;}
  function getTransition(owner,neighbour){return transitions[transitionKey(owner,neighbour)]||null;}
  function frameFor(owner,neighbour,mask){const set=getTransition(owner,neighbour);return set?.frameByMask?.[mask]??null;}

  window.KELO_TERRAIN_CONTRACT=Object.freeze({
    version:'1.0.0', tileSize:32, topology:'edge-bitmask-4-v1',
    sideBits:SIDES, materials, transitions, getTransition, frameFor
  });
})();
