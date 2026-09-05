(function(){
  'use strict';
  function load(src){return new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});}
  async function boot(){
    try{
      if(!window.KELO_PROP_CONTRACT)await load('src/environment/prop-contract.js?v=1');
      if(!window.KELO_GENERIC_PROP_AUDIT)await load('src/environment/generic-props.js?v=1');
      const R=window.KELO_TILE_REGISTRY,C=window.KELO_PROP_CONTRACT,G=window.KELO_GENERIC_PROP_AUDIT;
      if(!R||!C||!G)throw new Error('generic prop contract missing after bootstrap');
      const plazaProps=C.props.filter(p=>p.ownership==='plaza-nature-props-v1');
      const audit=window.KELO_PLAZA_NATURE_AUDIT={
        version:'plaza-nature-v4',ready:G.ready,assetLoaded:G.ready&&!G.failed,failed:G.failed,
        propCount:plazaProps.length,depthMode:'generic-prop-contract-v1',visualOnly:true,
        registryVersion:R.version,environmentLayerStack:true,backLayer:'props_back',frontLayer:'props_front',
        frontClipOcclusion:true,fullActorRedraw:false,rendererWrapper:false,
        backLayerId:'generic-props-back',frontLayerId:'generic-props-front',spatialOwnership:'plaza-nature-props-v1',
        boundsCount:plazaProps.length,layerPriority:10,precedencePolicy:'generic-prop-priority-v1',
        genericPropContract:true,contractVersion:C.version
      };
      function sync(){
        audit.ready=G.ready;audit.assetLoaded=G.ready&&!G.failed;audit.failed=G.failed;
        if(!G.ready&&!G.failed)requestAnimationFrame(sync);
      }
      sync();
    }catch(err){
      console.error('[Kelo plaza nature] generic prop bootstrap failed',err);
      window.KELO_PLAZA_NATURE_AUDIT={version:'plaza-nature-v4',ready:false,assetLoaded:false,failed:true,genericPropContract:true};
    }
  }
  boot();
})();
