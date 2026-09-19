/* KELO-INDEX
 * area: STUDIO / ASSET PREVIEW
 * owns: editor-only rendering of catalog assets and creator prefab thumbnails/ghosts
 * does-not-own: runtime world rendering, asset registration or authority
 * public-api: createStudioAssetPreviewService()
 * online: no; reuses KELO_ATLAS_CONTRACT images through composition
 * mobile: library rows use a 1x single-part cached icon; selected assets may use the full composite thumbnail
 */

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const copy=value=>value==null?value:(typeof structuredClone==='function'?structuredClone(value):JSON.parse(JSON.stringify(value)));

export function createStudioAssetPreviewService({assetCatalog,atlasContract,devicePixelRatio=globalThis.devicePixelRatio||1}={}){
  if(!assetCatalog)throw new Error('STUDIO_ASSET_PREVIEW_CATALOG_REQUIRED');
  const images=new Map(),ownedKeys=new Set();
  const resolveAsset=value=>typeof value==='string'?assetCatalog.get(value):(value?.parts?value:assetCatalog.get(value?.id)||value);

  function requestImage(key){
    key=String(key||'');if(!key||!atlasContract?.acquire)return Promise.resolve(null);
    if(images.has(key))return images.get(key).promise;
    const state={image:null,error:null,promise:null};
    state.promise=Promise.resolve().then(()=>atlasContract.acquire(key)).then(img=>{state.image=img;ownedKeys.add(key);return img;}).catch(error=>{state.error=error;return null;});
    images.set(key,state);return state.promise;
  }
  function readyImage(key){const state=images.get(String(key||''));if(state?.image)return state.image;requestImage(key);return null;}
  async function warmAsset(asset){const row=resolveAsset(asset);if(!row)return false;await Promise.all((row.parts||[]).map(p=>requestImage(p.assetKey)));return true;}

  function drawAsset(ctx,asset,x,y,{rotation=0,alpha=.72,placeholder=true,scale=1}={}){
    const row=resolveAsset(asset);if(!ctx||!row)return false;
    const w=Math.max(1,Number(row.width||row.bounds?.w)||32),h=Math.max(1,Number(row.height||row.bounds?.h)||32),rad=(Number(rotation)||0)*Math.PI/180,s=clamp(Number(scale)||1,.1,8);
    let drew=false;ctx.save();ctx.globalAlpha*=clamp(Number(alpha)||0,0,1);ctx.translate((Number(x)||0)+w*s/2,(Number(y)||0)+h*s/2);if(rad)ctx.rotate(rad);ctx.scale(s,s);ctx.translate(-w/2,-h/2);
    for(const part of row.parts||[]){const img=readyImage(part.assetKey);if(!img)continue;const s=part.source||{},o=part.offset||{},z=part.size||{};const sw=Math.max(1,Number(s.w)||w),sh=Math.max(1,Number(s.h)||h),dw=Math.max(1,Number(z.w)||sw),dh=Math.max(1,Number(z.h)||sh);ctx.save();ctx.globalAlpha*=Number.isFinite(Number(part.opacity))?clamp(Number(part.opacity),0,1):1;ctx.imageSmoothingEnabled=false;ctx.drawImage(img,Number(s.x)||0,Number(s.y)||0,sw,sh,Number(o.x)||0,Number(o.y)||0,dw,dh);ctx.restore();drew=true;}
    if(!drew&&placeholder){ctx.globalAlpha=.16;ctx.fillRect(0,0,w,h);}ctx.restore();return drew;
  }

  function creatorBounds(asset){const children=Array.isArray(asset?.previewChildren)?asset.previewChildren:[];return{w:Math.max(1,Number(asset?.width||asset?.bounds?.w)||32),h:Math.max(1,Number(asset?.height||asset?.bounds?.h)||32),children};}
  async function warmCreatorPrefab(asset){const {children}=creatorBounds(asset);await Promise.all(children.map(child=>warmAsset(child.prefabId)));}
  function drawCreatorPrefab(ctx,asset,x,y,{alpha=.72}={}){const {children}=creatorBounds(asset);let drew=false;for(const child of children)drew=drawAsset(ctx,child.prefabId,(Number(x)||0)+(Number(child.dx)||0),(Number(y)||0)+(Number(child.dy)||0),{rotation:Number(child.rotation)||0,alpha,placeholder:true})||drew;return drew;}

  function iconFallback(ctx,size,asset){
    if(!ctx)return;
    const label=String(asset?.label||asset?.id||'?'),category=String(asset?.category||'').toLowerCase();
    let glyph=(label.trim().slice(0,2)||'?').toUpperCase();
    if(/tree|arbol|forest|nature|plant/.test(`${category} ${label.toLowerCase()}`))glyph='Tr';
    else if(/flower|flor/.test(`${category} ${label.toLowerCase()}`))glyph='Fl';
    else if(/rock|stone|roca/.test(`${category} ${label.toLowerCase()}`))glyph='Ro';
    else if(/house|home|building|casa/.test(`${category} ${label.toLowerCase()}`))glyph='Ho';
    else if(/road|path|camino/.test(`${category} ${label.toLowerCase()}`))glyph='Pa';
    ctx.clearRect(0,0,size,size);ctx.fillStyle='#132722';ctx.fillRect(0,0,size,size);ctx.strokeStyle='rgba(231,197,106,.24)';ctx.strokeRect(.5,.5,size-1,size-1);ctx.fillStyle='#e6efdb';ctx.font=`800 ${Math.max(10,Math.round(size*.28))}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(glyph,size/2,size/2);
  }
  function partArea(part){const s=part?.size||part?.source||{};return Math.max(1,Number(s.w)||1)*Math.max(1,Number(s.h)||1);}
  function representativePart(asset){
    const parts=(asset?.parts||[]).filter(p=>p?.assetKey);
    if(!parts.length)return null;
    return parts.reduce((best,p)=>!best||partArea(p)>partArea(best)?p:best,null);
  }
  function creatorRepresentative(asset){
    const child=Array.isArray(asset?.previewChildren)?asset.previewChildren[0]:null;
    return child?.prefabId?resolveAsset(child.prefabId):null;
  }

  async function renderIcon(canvas,asset,{cssSize=48,padding=4}={}){
    if(!canvas?.getContext)return false;
    let row=resolveAsset(asset)||asset;if(row?.creatorPrefab)row=creatorRepresentative(row)||row;
    const size=Math.max(28,Math.min(56,Number(cssSize)||48));
    // Deliberately 1x: dozens of library icons stay cheap on iPhone even on high-DPR screens.
    canvas.width=Math.round(size);canvas.height=Math.round(size);canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;
    const ctx=canvas.getContext('2d');ctx.setTransform(1,0,0,1,0,0);iconFallback(ctx,size,row||asset);
    const part=representativePart(row);if(!part)return true;
    const img=await requestImage(part.assetKey);if(!img)return true;
    const s=part.source||{},z=part.size||{},sw=Math.max(1,Number(s.w)||Number(z.w)||32),sh=Math.max(1,Number(s.h)||Number(z.h)||32);
    const fit=Math.max(.01,Math.min((size-padding*2)/sw,(size-padding*2)/sh)),dw=Math.max(1,sw*fit),dh=Math.max(1,sh*fit),dx=(size-dw)/2,dy=(size-dh)/2;
    ctx.clearRect(0,0,size,size);ctx.fillStyle='#0d1719';ctx.fillRect(0,0,size,size);ctx.imageSmoothingEnabled=false;
    try{ctx.drawImage(img,Number(s.x)||0,Number(s.y)||0,sw,sh,dx,dy,dw,dh);return true;}catch{iconFallback(ctx,size,row||asset);return true;}
  }

  async function renderThumbnail(canvas,asset,{cssSize=54,padding=5}={}){
    // Library cards are 48px and can be numerous: one atlas part is enough for recognition.
    // The selected/compact 54px preview keeps the full composite rendering below.
    if((Number(cssSize)||54)<=48)return renderIcon(canvas,asset,{cssSize,padding:Math.min(4,padding)});
    if(!canvas?.getContext)return false;const dpr=clamp(Number(devicePixelRatio)||1,1,3),size=Math.max(32,Number(cssSize)||54);canvas.width=Math.round(size*dpr);canvas.height=Math.round(size*dpr);canvas.style.width=`${size}px`;canvas.style.height=`${size}px`;const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,size,size);
    const creator=!!asset?.creatorPrefab;if(creator)await warmCreatorPrefab(asset);else await warmAsset(asset);
    const w=Math.max(1,Number(asset?.width||asset?.bounds?.w)||32),h=Math.max(1,Number(asset?.height||asset?.bounds?.h)||32),scale=Math.min((size-padding*2)/w,(size-padding*2)/h),ox=(size-w*scale)/2,oy=(size-h*scale)/2;
    ctx.save();ctx.translate(ox,oy);ctx.scale(scale,scale);if(creator)drawCreatorPrefab(ctx,asset,0,0,{alpha:1});else drawAsset(ctx,asset,0,0,{alpha:1});ctx.restore();return true;
  }

  function describeAsset(id){const row=assetCatalog.get(String(id));return row?copy(row):null;}
  function close(){for(const key of ownedKeys)try{atlasContract?.release?.(key);}catch{}ownedKeys.clear();images.clear();}
  return Object.freeze({drawAsset,drawCreatorPrefab,renderIcon,renderThumbnail,warmAsset,warmCreatorPrefab,describeAsset,close});
}
