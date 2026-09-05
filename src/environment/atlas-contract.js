(function(){
  const R=window.KELO_TILE_REGISTRY;
  if(!R?.atlases){console.error('[Kelo atlas] TileRegistry missing');return;}

  const POLICY=Object.freeze({
    id:'kelo-atlas-contract-v1',
    version:'1.0.0',
    sampling:'nearest',
    maxDimension:2048,
    preferredDimensions:Object.freeze([128,256,512,1024]),
    tiers:Object.freeze({
      small:Object.freeze({maxDimension:256,use:'small tile/prop families'}),
      medium:Object.freeze({maxDimension:1024,use:'district/environment families'}),
      large:Object.freeze({maxDimension:2048,use:'rare large prefabs only'})
    }),
    packing:Object.freeze({
      grid:Object.freeze({paddingMin:0,spacingMin:0,requiresExactCellGrid:true}),
      packedSprites:Object.freeze({paddingMin:1,spacingMin:1,extrudeRecommended:true})
    }),
    cache:Object.freeze({strategy:'versioned-url',required:true,acceptedQueryKeys:Object.freeze(['art','v'])}),
    loading:Object.freeze({
      core:'eager',
      district:'lazy-when-district-needed',
      optional:'lazy-on-first-use',
      unload:'retain-core; district/optional may unload after district eviction when no live owners remain'
    }),
    missingAsset:Object.freeze({mode:'fail-visible-and-report',allowSilentMissing:false})
  });

  const ROLE_BY_KEY=Object.freeze({
    plaza:'core',plazaGround:'core',transitions:'core',grassVariation:'core',marbleVariation:'core',
    plazaNature:'core',trainingDummy:'optional',plazaNpcs:'optional',
    ruralSoil:'district',ruralProps:'district',ruralLandmarks:'district',ruralNature:'district'
  });

  function tierFor(atlas){
    const d=Math.max(Number(atlas?.width)||0,Number(atlas?.height)||0);
    if(d<=POLICY.tiers.small.maxDimension)return 'small';
    if(d<=POLICY.tiers.medium.maxDimension)return 'medium';
    return 'large';
  }
  function cacheToken(src){
    try{
      const u=new URL(src,location.href),pairs=[...u.searchParams.entries()];
      return pairs.find(([k])=>POLICY.cache.acceptedQueryKeys.includes(k))||null;
    }catch{return null;}
  }
  function describe(key,atlas){
    return Object.freeze({
      key,id:atlas.id||key,src:atlas.src,width:atlas.width,height:atlas.height,
      role:ROLE_BY_KEY[key]||'optional',tier:tierFor(atlas),cacheToken:cacheToken(atlas.src),
      grid:Boolean(atlas.tileWidth&&atlas.tileHeight&&atlas.columns),
      sampling:POLICY.sampling
    });
  }
  const catalog=Object.freeze(Object.fromEntries(Object.entries(R.atlases).map(([key,a])=>[key,describe(key,a)])));
  const violations=[];
  for(const entry of Object.values(catalog)){
    if(!entry.src)violations.push(`${entry.key}: missing src`);
    if(!(entry.width>0&&entry.height>0))violations.push(`${entry.key}: invalid dimensions`);
    if(Math.max(entry.width,entry.height)>POLICY.maxDimension)violations.push(`${entry.key}: exceeds ${POLICY.maxDimension}px`);
    if(POLICY.cache.required&&!entry.cacheToken)violations.push(`${entry.key}: missing versioned URL cache token`);
  }
  const audit=Object.freeze({version:POLICY.version,policyId:POLICY.id,atlasCount:Object.keys(catalog).length,violations:Object.freeze(violations.slice()),roles:Object.freeze(Object.fromEntries(Object.entries(catalog).map(([k,v])=>[k,v.role])))});
  if(violations.length)console.error('[Kelo atlas] contract violations',violations);
  window.KELO_ATLAS_CONTRACT=Object.freeze({policy:POLICY,catalog,roleFor:key=>catalog[key]?.role||null,tierFor:key=>catalog[key]?.tier||null,describe:key=>catalog[key]||null});
  window.KELO_ATLAS_AUDIT=audit;
})();