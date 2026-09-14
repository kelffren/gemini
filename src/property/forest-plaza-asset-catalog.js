/* KELO-INDEX
 * area: PROPERTY / CONTENT
 * owner: KELO_PROPERTY_CATALOG content registration
 * keys: FOREST PLAZA ASSET SHEET PLACEABLE WORLD EDITOR IRREGULAR ATLAS LATE REGISTER
 * purpose: registra cada frame compilado Forest Plaza como plantilla colocable usando Atlas Contract + Property Catalog existentes
 * online: contenido inmutable; publicación/placements siguen bajo la autoridad existente de World/Property
 * do-not: no renderiza, no persiste placements, no crea catálogo paralelo
 */
(function(){
  'use strict';
  let installed=false;
  function install(){
    if(installed)return true;
    const M=window.KELO_FOREST_PLAZA_TILESET_V2;
    const A=window.KELO_ATLAS_CONTRACT;
    const C=window.KELO_PROPERTY_CATALOG;
    if(!M?.atlas||!Array.isArray(M.assets)||!A?.register||!C?.registerTemplate)return false;
    const ATLAS='forestPlazaV2';
    const SRC='assets/world/plaza/forest-plaza-tileset-v2.png?art=801';
    const clamp=(v,min,max)=>Math.max(min,Math.min(max,Number(v)||0));
    const semanticCategory=(r)=>{
      const cy=(Number(r.y)||0)+(Number(r.h)||0)/2;
      if(cy<125)return 'tileset';
      if(cy<390)return 'architecture';
      if(cy<520)return 'decor';
      if(cy<825)return 'terrain';
      return 'nature';
    };
    const atlasFrames=Object.fromEntries(M.assets.map(frame=>[String(frame.frameId||frame.assetId),{x:Number(frame.sourceRect?.x)||0,y:Number(frame.sourceRect?.y)||0,w:Math.max(1,Number(frame.sourceRect?.w)||1),h:Math.max(1,Number(frame.sourceRect?.h)||1)}]));
    try{A.register(ATLAS,{id:ATLAS,src:SRC,width:Number(M.atlas.width)||1448,height:Number(M.atlas.height)||1086,frameMode:'irregular',frames:atlasFrames},{role:'optional'});}catch(err){if(!A.describe?.(ATLAS))console.warn('[Kelo forest plaza catalog] atlas registration failed',err?.message||err);}
    const ids=[];
    for(const frame of M.assets){
      const r=frame.sourceRect;if(!r)continue;
      const target=clamp(frame.scale?.targetPixelWidth||frame.visualBounds?.w||r.w,24,256);
      const width=Math.max(24,Math.round(target)),height=Math.max(24,Math.round((Number(r.h)||1)/Math.max(1,Number(r.w)||1)*width));
      const sourceCollision=frame.collider?.passThrough?null:frame.collider?.solidBounds;
      const sx=width/Math.max(1,Number(r.w)||1),sy=height/Math.max(1,Number(r.h)||1);
      const collision=sourceCollision?{x:Math.round((Number(sourceCollision.x)||0)*sx),y:Math.round((Number(sourceCollision.y)||0)*sy),w:Math.max(1,Math.round((Number(sourceCollision.w)||0)*sx)),h:Math.max(1,Math.round((Number(sourceCollision.h)||0)*sy))}:null;
      const key=String(frame.frameId||frame.assetId);
      const id=`forest-plaza:${String(frame.assetId||key)}`;
      let template=C.getTemplate?.(id)||null;
      if(!template)template=C.registerTemplate({
        id,
        label:`Forest Plaza ${String(frame.assetId||key).replace(/^asset-/,'')}`,
        category:semanticCategory(r),family:String(frame.family||'forest-plaza'),districts:['*'],
        width,height,snap:32,collision,source:'kelo-asset-sheet-compiler-v1.1',sourceId:String(frame.assetId||key),placeable:true,
        parts:[{assetKey:ATLAS,source:{x:Number(r.x)||0,y:Number(r.y)||0,w:Math.max(1,Number(r.w)||1),h:Math.max(1,Number(r.h)||1)},offset:{x:0,y:0},size:{w:width,h:height},phase:frame.layer==='props_front'?'props_front':'props_back'}]
      });
      ids.push(template.id);
    }
    installed=true;
    window.KELO_FOREST_PLAZA_CATALOG_AUDIT=Object.freeze({version:'forest-plaza-catalog-v1.1',atlasKey:ATLAS,compiler:M.compiler||null,templateCount:ids.length,templateIds:Object.freeze(ids),placeable:true});
    try{window.dispatchEvent(new CustomEvent('kelo:forest-plaza-catalog-ready',{detail:{atlasKey:ATLAS,templateCount:ids.length}}));}catch{}
    return true;
  }
  if(!install()){
    window.addEventListener('load',()=>{if(!install())console.warn('[Kelo forest plaza catalog] owners unavailable after load');},{once:true});
  }
})();
