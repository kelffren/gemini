/* KELO-INDEX
 * area: PROPERTY
 * keys: PARCEL ASSET CATALOG TEMPLATE PREFAB PROP TILESET UNITS
 * hace: convierte props/prefabs/tilesets de assets en plantillas del editor
 * online: catálogo inmutable; no posee economía ni autoridad de compras
 */
(function(){
  'use strict';
  const TILE=window.KELO_TILE_REGISTRY?.worldTileSize||32;
  const P=window.KELO_PROP_CONTRACT;
  const F=window.KELO_PREFAB_CONTRACT;
  const R=window.KELO_TILE_REGISTRY;
  const A=window.KELO_ATLAS_CONTRACT;
  const templates=new Map();
  const listeners=new Set();

  function slug(value){return String(value||'asset').toLowerCase().replace(/[^a-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'')||'asset';}
  function label(value){return String(value||'Asset').replace(/[-_]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase());}
  function freezeRect(r){return r?Object.freeze({x:Number(r.x)||0,y:Number(r.y)||0,w:Math.max(0,Number(r.w)||0),h:Math.max(0,Number(r.h)||0)}):null;}
  function frameRect(a,frame){
    if(a?.frames&&typeof frame==='string'&&a.frames[frame]){const r=a.frames[frame];return freezeRect(r);}
    const i=Math.max(0,Math.floor(Number(frame)||0)),cols=Math.max(1,Number(a?.columns)||1),w=Number(a?.frameWidth)||Number(a?.tileWidth)||TILE,h=Number(a?.frameHeight)||Number(a?.tileHeight)||TILE;
    return Object.freeze({x:(i%cols)*w,y:Math.floor(i/cols)*h,w,h});
  }
  function normalizePart(part){return Object.freeze({assetKey:String(part.assetKey),source:freezeRect(part.source),offset:Object.freeze({x:Number(part.offset?.x)||0,y:Number(part.offset?.y)||0}),size:Object.freeze({w:Math.max(1,Number(part.size?.w)||TILE),h:Math.max(1,Number(part.size?.h)||TILE)}),phase:part.phase==='props_front'?'props_front':'props_back',opacity:Number.isFinite(part.opacity)?Math.max(0,Math.min(1,part.opacity)):1});}
  function register(raw){
    if(!raw||!raw.id||!Array.isArray(raw.parts)||!raw.parts.length)throw new Error('[Kelo property catalog] invalid template');
    const id=String(raw.id); if(templates.has(id))return templates.get(id);
    const t=Object.freeze({
      id,label:String(raw.label||label(id)),category:String(raw.category||'decor'),family:String(raw.family||'generic'),districts:Object.freeze((raw.districts||['*']).slice()),
      width:Math.max(1,Number(raw.width)||TILE),height:Math.max(1,Number(raw.height)||TILE),snap:Math.max(1,Number(raw.snap)||TILE),priceHint:Math.max(0,Math.floor(Number(raw.priceHint)||0)),
      collision:freezeRect(raw.collision),parts:Object.freeze(raw.parts.map(normalizePart)),source:String(raw.source||'registry'),sourceId:String(raw.sourceId||id),placeable:raw.placeable!==false
    });
    templates.set(id,t); listeners.forEach(fn=>{try{fn(t);}catch(e){}}); return t;
  }

  function registerPropTemplates(){
    if(!P?.assets)return;
    const seen=new Set();
    for(const p of P.props||[]){
      if(!p?.asset||!P.assets[p.asset])continue;
      const key=`${p.asset}:${String(p.frame??0)}`; if(seen.has(key))continue; seen.add(key);
      const a=P.assets[p.asset],s=frameRect(a,p.frame??0),w=Math.max(TILE,Number(p.size?.w)||s.w),h=Math.max(TILE,Number(p.size?.h)||s.h);
      const c=p.collider?.mode==='rect'?{x:p.collider.x-p.position.x,y:p.collider.y-p.position.y,w:p.collider.w,h:p.collider.h}:(p.footprint?{x:p.footprint.x-p.position.x,y:p.footprint.y-p.position.y,w:p.footprint.w,h:p.footprint.h}:null);
      register({id:`prop:${slug(p.asset)}:${slug(p.frame??0)}`,label:label(`${p.family||p.asset} ${p.frame??0}`),category:(p.family||'').includes('nature')?'nature':'decor',family:p.family||p.asset,districts:[p.district||'*'],width:w,height:h,collision:c,source:'prop-contract',sourceId:p.id,parts:[{assetKey:p.asset,source:s,offset:{x:0,y:0},size:{w,h},phase:p.layerRole==='front'?'props_front':'props_back'}]});
    }
    const rural=P.assets.ruralProps;
    if(rural?.src&&!String(rural.src).includes('data:')){
      const cols=Math.max(1,Number(rural.columns)||4),rows=Math.max(1,Math.ceil((Number(rural.height)||128)/(Number(rural.frameHeight)||TILE))),count=Math.min(cols*rows,48);
      for(let i=0;i<count;i++)register({id:`prop:rural:${i}`,label:`Rural Prop ${i+1}`,category:'rural',family:'rural-props',districts:['rural'],width:TILE,height:TILE,source:'prop-contract-grid',sourceId:`ruralProps:${i}`,parts:[{assetKey:'ruralProps',source:frameRect(rural,i),offset:{x:0,y:0},size:{w:TILE,h:TILE},phase:'props_back'}]});
    }
  }

  function registerPrefabTemplates(){
    if(!F?.assets)return;
    for(const p of F.prefabs||[]){
      const parts=(p.renderPlan?.parts||[]).map(part=>({assetKey:part.asset,source:part.source,offset:part.offset,size:part.size,phase:part.phase,opacity:part.opacity}));
      if(!parts.length)continue;
      const c=p.collider?{x:p.collider.x-p.position.x,y:p.collider.y-p.position.y,w:p.collider.w,h:p.collider.h}:null;
      register({id:`prefab:${slug(p.key||p.id)}`,label:label(p.key||p.id),category:'architecture',family:'architecture',districts:p.districts||['*'],width:p.size.w,height:p.size.h,collision:c,source:'prefab-contract',sourceId:p.id,parts});
    }
  }

  function sliceAtlas(key,atlas,category,maxTiles){
    const src=String(atlas?.src||'');
    if(!src||src.startsWith('data:')||atlas?.retiredVisual)return;
    const tw=Number(atlas.tileWidth)||TILE,th=Number(atlas.tileHeight)||TILE;
    const cols=Math.max(1,Number(atlas.columns)||Math.floor((Number(atlas.width)||tw)/tw));
    const rows=Math.max(1,Math.floor((Number(atlas.height)||th)/th));
    const count=Math.min(cols*rows,maxTiles||48);
    const fake={columns:cols,frameWidth:tw,frameHeight:th};
    for(let i=0;i<count;i++){
      register({
        id:`tile:${slug(key)}:${i}`,
        label:`${label(key)} ${i+1}`,
        category:category||'tileset',
        family:key,
        districts:['*'],
        width:tw,height:th,snap:tw,
        source:'tileset-sheet',sourceId:`${key}:${i}`,
        parts:[{assetKey:key,source:frameRect(fake,i),offset:{x:0,y:0},size:{w:tw,h:th},phase:'props_back'}]
      });
    }
  }

  function registerRegistryTilesets(){
    const atlases=R?.atlases||{};
    for(const [key,atlas] of Object.entries(atlases))sliceAtlas(key,atlas,'tileset',36);
  }

  const IMPERIAL_PLAZA_ASSETS=Object.freeze([
    {key:'imperialFountainJustice',id:'imperial:fuente-justicia',label:'Fuente de la Justicia',src:'assets/world/imperial-plaza/fuente-de-la-justicia.png?art=601',imageW:911,imageH:903,width:128,height:128,category:'architecture',collision:{x:0,y:64,w:128,h:64}},
    {key:'imperialCompassRose',id:'imperial:rosa-vientos',label:'Rosa de los Vientos',src:'assets/world/imperial-plaza/rosa-de-los-vientos.png?art=602',imageW:1527,imageH:1244,width:160,height:128,category:'decor',collision:null},
    {key:'imperialCeremonialPlatform',id:'imperial:plataforma-ceremonial',label:'Plataforma Ceremonial',src:'assets/world/imperial-plaza/plataforma-ceremonial.png?art=603',imageW:1254,imageH:1259,width:160,height:160,category:'architecture',collision:null},
    {key:'imperialCurvedPlanter',id:'imperial:jardinera-curva',label:'Jardinera Imperial Curva',src:'assets/world/imperial-plaza/jardinera-imperial-curva.png?art=604',imageW:1254,imageH:1259,width:160,height:160,category:'decor',collision:{x:0,y:96,w:160,h:64}},
    {key:'imperialBanner',id:'imperial:estandarte',label:'Estandarte Imperial',src:'assets/world/imperial-plaza/estandarte-imperial.png?art=605',imageW:1057,imageH:1064,width:64,height:96,category:'decor',collision:{x:16,y:64,w:32,h:32}},
    {key:'imperialLionFountain',id:'imperial:fuente-leones',label:'Fuente de los Leones',src:'assets/world/imperial-plaza/fuente-de-los-leones.png?art=606',imageW:758,imageH:744,width:128,height:128,category:'architecture',collision:{x:0,y:64,w:128,h:64}},
    {key:'imperialPodium',id:'imperial:podio',label:'Podio Imperial',src:'assets/world/imperial-plaza/podio-imperial.png?art=607',imageW:760,imageH:678,width:96,height:96,category:'architecture',collision:{x:0,y:48,w:96,h:48}},
    {key:'imperialKiosk',id:'imperial:kiosco',label:'Kiosco Imperial',src:'assets/world/imperial-plaza/kiosco-imperial.png?art=608',imageW:1254,imageH:1259,width:160,height:160,category:'architecture',collision:{x:0,y:64,w:160,h:96}},
    {key:'imperialObelisk',id:'imperial:obelisco',label:'Obelisco Imperial',src:'assets/world/imperial-plaza/obelisco-imperial.png?art=609',imageW:755,imageH:748,width:96,height:128,category:'architecture',collision:{x:0,y:80,w:96,h:48}},
    {key:'imperialStaircase',id:'imperial:escalinata',label:'Escalinata Imperial',src:'assets/world/imperial-plaza/escalinata-imperial.png?art=610',imageW:723,imageH:703,width:128,height:96,category:'architecture',collision:null},
    {key:'imperialLamp',id:'imperial:farola',label:'Farola Imperial',src:'assets/world/imperial-plaza/farola-imperial.png?art=611',imageW:469,imageH:687,width:64,height:96,category:'decor',collision:{x:16,y:64,w:32,h:32}},
    {key:'imperialTopiary',id:'imperial:topiario',label:'Topiario Imperial',src:'assets/world/imperial-plaza/topiario-imperial.png?art=612',imageW:759,imageH:757,width:96,height:96,category:'decor',collision:{x:16,y:64,w:64,h:32}}
  ]);

  function registerImperialPlazaAssets(){
    for(const item of IMPERIAL_PLAZA_ASSETS){
      const atlas={
        id:item.key,src:item.src,width:item.imageW,height:item.imageH,
        tileWidth:item.imageW,tileHeight:item.imageH,frameWidth:item.imageW,frameHeight:item.imageH,columns:1,
        meta:{family:'imperial-plaza',standalone:true}
      };
      try{A?.register?.(item.key,atlas,{role:'optional'});}catch(e){
        console.warn('[Kelo catalog] imperial atlas registration skipped',item.key,e?.message||e);
      }
      register({
        id:item.id,label:item.label,category:item.category,family:'imperial-plaza',districts:['*'],
        width:item.width,height:item.height,snap:TILE,collision:item.collision,
        source:'imperial-plaza-kit',sourceId:item.key,
        parts:[{assetKey:item.key,source:{x:0,y:0,w:item.imageW,h:item.imageH},offset:{x:0,y:0},size:{w:item.width,h:item.height},phase:'props_back'}]
      });
    }
  }

  // Only expose runtime-approved sheets here. Source sheets and superseded
  // archive rasters stay available for authoring/history but are not fetched by LIVE.
  const EXTRA_SHEETS=Object.freeze([
    {key:'cespedRuntimePng',src:'assets/cesped-runtime.PNG?art=501',tile:32},
    {key:'arbolesKelo1',src:'assets/Arboleskelo1.PNG?art=306',tile:32}
  ]);

  function registerExtraSheets(){
    EXTRA_SHEETS.forEach(sheet=>{
      const img=new Image();
      img.onload=function(){
        const w=img.naturalWidth,h=img.naturalHeight;
        if(!w||!h)return;
        const atlas={id:sheet.key,src:sheet.src,width:w,height:h,tileWidth:sheet.tile,tileHeight:sheet.tile,columns:Math.max(1,Math.floor(w/sheet.tile))};
        try{A?.register?.(sheet.key,atlas,{role:'optional'});}catch(e){}
        sliceAtlas(sheet.key,atlas,'tileset',48);
      };
      img.onerror=function(){console.warn('[Kelo catalog] tileset missing',sheet.src);};
      img.src=sheet.src;
    });
  }

  registerPropTemplates(); registerPrefabTemplates(); registerRegistryTilesets(); registerImperialPlazaAssets(); registerExtraSheets();
  window.KELO_PROPERTY_CATALOG=Object.freeze({
    version:'property-asset-catalog-v1.2.1',tileSize:TILE,registerTemplate:register,get(id){return templates.get(String(id))||null;},list(filter){let out=Array.from(templates.values()).filter(x=>x.placeable);if(filter?.category)out=out.filter(x=>x.category===filter.category);if(filter?.district)out=out.filter(x=>x.districts.includes('*')||x.districts.includes(filter.district));return out;},categories(){return Array.from(new Set(Array.from(templates.values()).map(x=>x.category))).sort();},onRegister(fn){if(typeof fn!=='function')return()=>{};listeners.add(fn);return()=>listeners.delete(fn);}
  });
  window.KELO_PROPERTY_CATALOG_AUDIT=Object.freeze({version:'property-asset-catalog-v1.2.1',templateCount:templates.size,propSource:!!P,prefabSource:!!F,tileSize:TILE,imperialPlazaAssets:IMPERIAL_PLAZA_ASSETS.map(s=>s.key),extraSheets:EXTRA_SHEETS.map(s=>s.key)});
})();
