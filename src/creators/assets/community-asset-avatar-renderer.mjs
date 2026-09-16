/* KELO-INDEX
 * area: CREATORS / COMMUNITY AVATAR RENDER
 * owner: Kelo Community Asset Runtime
 * keys: AVATAR LAYERS SOCKETS SPRITESHEET RENDERPROFILE STREAMING FALLBACK
 * purpose: compose downloaded community cosmetics around the existing avatar renderer without owning gameplay or base-avatar drawing
 * performance: installed only after community runtime is lazy-loaded; images decode once and draws reuse cached Image objects
 */

const FACE_ALIASES=Object.freeze({south:'down',s:'down',north:'up',n:'up',west:'left',w:'left',east:'right',e:'right','south-east':'down-right',se:'down-right','south-west':'down-left',sw:'down-left','north-east':'up-right',ne:'up-right','north-west':'up-left',nw:'up-left'});
const CARDINAL_ROW_FACE=Object.freeze({'down-right':'down','down-left':'down','up-right':'up','up-left':'up'});
const SOCKETS=new Set(['center','foot','head','handR','handL']);
const MAX_IMAGE_CACHE=128;

function clamp(value,min,max,fallback){const n=Number(value);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):fallback;}
function normalizeFace(value){const raw=String(value||'down').trim().toLowerCase().replace(/_/g,'-');return FACE_ALIASES[raw]||raw||'down';}
function faceOf(actor){
  const vx=Number(actor?.vx)||0,vy=Number(actor?.vy)||0;
  if(Math.hypot(vx,vy)>3){const oct=Math.round(Math.atan2(vy,vx)/(Math.PI/4)+8)%8;return ['right','down-right','down','down-left','left','up-left','up','up-right'][oct];}
  return normalizeFace(actor?._face||actor?.face||'down');
}
function manifestOf(entry){return entry?.manifest&&typeof entry.manifest==='object'?entry.manifest:{};}
function profileOf(entry){const manifest=manifestOf(entry),raw=manifest.renderProfile&&typeof manifest.renderProfile==='object'?manifest.renderProfile:{};return raw;}
function layerFor(profile,face){
  const byFace=profile.layerByFace&&typeof profile.layerByFace==='object'?profile.layerByFace:null;
  const requested=byFace?.[face]||byFace?.[CARDINAL_ROW_FACE[face]]||profile.layer;
  return requested==='back'?'back':'front';
}
function offsetFor(profile,face){
  const offsets=profile.offsets&&typeof profile.offsets==='object'?profile.offsets:{};
  const raw=offsets[face]||offsets[CARDINAL_ROW_FACE[face]]||offsets.default||{};
  return {x:clamp(raw.x,-160,160,0),y:clamp(raw.y,-160,160,0),scale:clamp(raw.scale,.2,4,1),rotation:clamp(raw.rotation,-360,360,0)};
}
function presentation(root,actor,face){
  try{const value=root.KeloAnchors?.presentation?.(actor,face);if(value&&Number.isFinite(Number(value.footRootX))&&Number.isFinite(Number(value.footRootY)))return value;}catch{}
  let h=0;
  try{if(root.keloNet?.id&&actor===root.localPlayer)h=Number(root.KeloCreatorAvatars?.current?.()?.renderHeight)||0;}catch{}
  if(!h)h=Number(actor?.avatarManifest?.payload?.avatarRuntime?.renderHeight)||0;
  if(!h)h=Math.max(72,(Number(actor?.radius)||20)*4.5);
  const radius=Math.max(1,Number(actor?.radius)||20),footY=(Number(actor?.y)||0)+Math.max(6,radius*.85);
  return {footRootX:Number(actor?.x)||0,footRootY:footY,visualWidth:h*.62,visualHeight:h};
}
function fallbackSocket(layout,name,face){
  const x=Number(layout.footRootX)||0,y=Number(layout.footRootY)||0,h=Number(layout.visualHeight)||90,w=Number(layout.visualWidth)||h*.62;
  if(name==='foot')return{x,y};
  if(name==='head')return{x,y:y-h*.79};
  if(name==='center')return{x,y:y-h*.48};
  const leftFacing=face==='left'||face==='up-left'||face==='down-left';
  const handSign=name==='handL'?-1:1;
  const directional=leftFacing?-handSign:handSign;
  return{x:x+directional*w*.36,y:y-h*.46};
}
function socketFor(root,actor,layout,name,face){
  const socket=SOCKETS.has(String(name))?String(name):'center';
  try{const value=root.KeloAnchors?.get?.(actor,socket);if(value&&Number.isFinite(Number(value.x))&&Number.isFinite(Number(value.y)))return{x:Number(value.x),y:Number(value.y)};}catch{}
  return fallbackSocket(layout,socket,face);
}
function frameRow(profile,face){
  const rows=Math.max(1,Math.floor(Number(profile.rows)||1)),map=profile.faceRows&&typeof profile.faceRows==='object'?profile.faceRows:{};
  const cardinal=CARDINAL_ROW_FACE[face]||face;
  const defaults={down:0,left:Math.min(1,rows-1),right:Math.min(2,rows-1),up:Math.min(3,rows-1)};
  return Math.max(0,Math.min(rows-1,Math.floor(Number(map[face]??map[cardinal]??defaults[cardinal]??0))));
}
function frameColumn(profile,actor){
  const columns=Math.max(1,Math.floor(Number(profile.columns)||1));
  if(columns<=1)return 0;
  const moving=Math.hypot(Number(actor?.vx)||0,Number(actor?.vy)||0)>4;
  if(!moving)return Math.max(0,Math.min(columns-1,Math.floor(Number(profile.idleFrame)||0)));
  const frameMs=clamp(profile.frameMs,50,2000,140),now=globalThis.performance?.now?.()||Date.now();
  return Math.floor(now/frameMs)%columns;
}

export function installCommunityAssetAvatarRenderer({root=globalThis}={}){
  if(root.__KELO_COMMUNITY_ASSET_RENDERER__)return root.__KELO_COMMUNITY_ASSET_RENDERER__;
  const cache=new Map();
  const audit={version:'community-avatar-render-v1',installed:false,middlewareId:null,draws:0,misses:0,errors:0,cacheSize:0,priority:950};

  function imageFor(entry){
    const url=entry?.objectUrl;if(!url)return null;
    let row=cache.get(url);
    if(row){row.usedAt=Date.now();return row.ready?row.image:null;}
    const ImageCtor=root.Image||globalThis.Image;if(!ImageCtor)return null;
    const image=new ImageCtor();row={image,ready:false,error:false,usedAt:Date.now()};cache.set(url,row);audit.cacheSize=cache.size;
    image.decoding='async';
    image.onload=()=>{row.ready=Boolean(image.naturalWidth&&image.naturalHeight);row.error=!row.ready;};
    image.onerror=()=>{row.error=true;row.ready=false;audit.errors++;};
    image.src=url;
    if(cache.size>MAX_IMAGE_CACHE){const stale=[...cache.entries()].sort((a,b)=>a[1].usedAt-b[1].usedAt).slice(0,cache.size-MAX_IMAGE_CACHE);stale.forEach(([key])=>cache.delete(key));audit.cacheSize=cache.size;}
    return null;
  }

  function drawEntry(g,actor,entry,face){
    const image=imageFor(entry);if(!image){audit.misses++;return false;}
    const profile=profileOf(entry),layout=presentation(root,actor,face),off=offsetFor(profile,face),scale=clamp(profile.scale,.1,4,1)*off.scale;
    const mode=profile.mode==='sheet'?'sheet':'socket',rotation=(clamp(profile.rotation,-360,360,0)+off.rotation)*Math.PI/180;
    g.save();
    const previousSmoothing=g.imageSmoothingEnabled;g.imageSmoothingEnabled=profile.pixelated===true?false:true;
    if(mode==='sheet'){
      const columns=Math.max(1,Math.floor(Number(profile.columns)||1)),rows=Math.max(1,Math.floor(Number(profile.rows)||1)),sw=image.naturalWidth/columns,sh=image.naturalHeight/rows,row=frameRow(profile,face),col=frameColumn(profile,actor);
      const heightScale=clamp(profile.heightScale,.1,4,1),dh=(Number(layout.visualHeight)||90)*heightScale*scale,dw=dh*(sw/sh)*clamp(profile.widthScale,.1,4,1);
      const anchor=profile.anchor&&typeof profile.anchor==='object'?profile.anchor:{x:.5,y:1},ax=clamp(anchor.x,0,1,.5),ay=clamp(anchor.y,0,1,1),dx=(Number(layout.footRootX)||0)-dw*ax+off.x,dy=(Number(layout.footRootY)||0)-dh*ay+off.y;
      g.translate(dx+dw*.5,dy+dh*.5);g.rotate(rotation);g.drawImage(image,col*sw,row*sh,sw,sh,-dw*.5,-dh*.5,dw,dh);
    }else{
      const socket=socketFor(root,actor,layout,profile.socket,face),ratio=image.naturalWidth/Math.max(1,image.naturalHeight),heightScale=clamp(profile.heightScale,.08,4,.5),widthScale=clamp(profile.widthScale,.08,4,heightScale),h=(Number(layout.visualHeight)||90)*heightScale*scale,w=h*ratio*(widthScale/heightScale),anchor=profile.anchor&&typeof profile.anchor==='object'?profile.anchor:{x:.5,y:.5},ax=clamp(anchor.x,0,1,.5),ay=clamp(anchor.y,0,1,.5);
      g.translate(socket.x+off.x,socket.y+off.y);g.rotate(rotation);g.drawImage(image,-w*ax,-h*ay,w,h);
    }
    g.imageSmoothingEnabled=previousSmoothing;g.restore();audit.draws++;return true;
  }
  function drawSection(g,actor,section){
    const entries=Array.isArray(actor?.communityAssetEntries)?actor.communityAssetEntries:[];if(!entries.length)return;
    const face=faceOf(actor);
    entries.forEach(entry=>{try{if(layerFor(profileOf(entry),face)===section)drawEntry(g,actor,entry,face);}catch{audit.errors++;}});
  }
  function middleware(actor,isSelf,next){
    const canvas=root.document?.getElementById?.('game-canvas'),g=canvas?.getContext?.('2d');
    if(!g||!actor)return next();
    drawSection(g,actor,'back');const out=next();drawSection(g,actor,'front');return out;
  }
  function install(){
    if(audit.installed)return true;
    if(!root.KeloAvatar?.use)return false;
    audit.middlewareId=root.KeloAvatar.use('community-assets:streamed-layers',middleware,audit.priority);audit.installed=true;return true;
  }
  install();
  if(!audit.installed){let attempts=0;const timer=root.setInterval?.(()=>{attempts++;if(install()||attempts>=20)root.clearInterval?.(timer);},100);}
  root.addEventListener?.('kelo:community-player-left',()=>{audit.cacheSize=cache.size;});
  const api=Object.freeze({version:audit.version,install,audit:()=>Object.freeze({...audit,cacheSize:cache.size})});
  root.__KELO_COMMUNITY_ASSET_RENDERER__=api;root.KELO_COMMUNITY_ASSET_RENDER_AUDIT=audit;return api;
}
