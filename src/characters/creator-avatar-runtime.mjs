/* KELO-INDEX
 * area: CHARACTER / AVATAR RUNTIME
 * owner: KeloCreatorAvatars adapter over KeloAvatar
 * owns: creator-avatar manifest cache, 1D/4D/8D direction selection, local selection and spritesheet draw middleware
 * does-not-own: base renderer, gameplay, auth, upload, entitlement authority, modular Character state or character persistence
 * access: local/self use of revision-aware Creator avatars requires KeloCreatorEntitlements; remote published avatars/appearance envelopes remain renderable
 */
const STORAGE_KEY='kelo.creator.avatar.selection.v1';
const FACE_ROWS=Object.freeze({down:0,left:1,right:2,up:3});
const DIRECTION_KEYS=Object.freeze(['n','ne','e','se','s','sw','w','nw']);
const FACE_ALIASES=Object.freeze({up:'n',down:'s',left:'w',right:'e',north:'n',south:'s',west:'w',east:'e','up-right':'ne','down-right':'se','down-left':'sw','up-left':'nw'});
function directionKey(value){const key=String(value||'').toLowerCase();return FACE_ALIASES[key]||key;}
function safeManifest(raw){
  if(!raw||typeof raw!=='object')return null;const payload=raw.payload||raw,rt=payload.avatarRuntime||raw.avatarRuntime||null;if(!rt?.publicUrl||!raw.contentId)return null;
  const columns=Math.max(1,Number(rt.columns)||1),rows=Math.max(1,Number(rt.rows)||1),directionKeys=Array.isArray(rt.directionKeys)&&rt.directionKeys.length===rows?rt.directionKeys.map(directionKey):rows===8?[...DIRECTION_KEYS]:rows===4?['s','w','e','n']:['s'],rowMap={...FACE_ROWS,...(rt.rowMap||{})};directionKeys.forEach((key,row)=>{rowMap[key]=row;});if(Number.isInteger(rowMap.s))rowMap.down=rowMap.s;if(Number.isInteger(rowMap.n))rowMap.up=rowMap.n;if(Number.isInteger(rowMap.w))rowMap.left=rowMap.w;if(Number.isInteger(rowMap.e))rowMap.right=rowMap.e;const frameCounts=Array.isArray(rt.frameCounts)&&rt.frameCounts.length===rows?rt.frameCounts.map(value=>Math.max(1,Math.min(columns,Math.round(Number(value)||1)))):new Array(rows).fill(columns);
  return Object.freeze({contentId:String(raw.contentId),revisionId:String(raw.revisionId||raw.contentRevisionId||''),ownerUserId:String(raw.ownerUserId||''),source:String(raw.source||'creator-content'),displayName:String(raw.displayName||'Avatar'),publicUrl:String(rt.publicUrl),columns,rows,directions:Math.max(1,Number(payload.directions)||directionKeys.length),directionKeys:Object.freeze(directionKeys),frameCounts:Object.freeze(frameCounts),rowMap:Object.freeze(rowMap),frameMs:Math.max(70,Number(rt.frameMs)||140),renderHeight:Math.max(44,Number(rt.renderHeight)||82)});
}
export function installCreatorAvatarRuntime({root=globalThis}={}){
  if(root.KeloCreatorAvatars)return root.KeloCreatorAvatars;
  const records=new Map(),images=new Map();let selectedId=null,selectedManifest=null,middlewareId=null,appearanceWarmup=null;
  function access(manifest){
    if(!manifest?.revisionId)return true;
    return root.KeloCreatorEntitlements?.canUse?.({source:'creator-content',revisionId:manifest.revisionId,ownerUserId:manifest.ownerUserId,contentId:manifest.contentId})===true;
  }
  function load(manifest){if(!manifest||images.has(manifest.contentId))return;const img=new Image();images.set(manifest.contentId,{img,ready:false,error:false});img.onload=()=>{const row=images.get(manifest.contentId);if(row){row.ready=true;row.error=false;}};img.onerror=()=>{const row=images.get(manifest.contentId);if(row)row.error=true;};img.src=manifest.publicUrl;}
  function hasModularEnvelope(raw){return !!(raw?.creatorAppearance&&raw.creatorAppearance.source==='server-authoritative-published'&&Array.isArray(raw.creatorAppearance.loadout)&&raw.creatorAppearance.loadout.length);}
  function warmModularAppearance(raw){
    if(!hasModularEnvelope(raw)||root.KeloCreatorCharacterBridge?.ingestRemote||!root.KELO_MODULE_LOADER?.ensure)return;
    if(!appearanceWarmup)appearanceWarmup=Promise.resolve(root.KELO_MODULE_LOADER.ensure('appearance')).catch(error=>{console.warn('[Creator avatar] modular appearance warmup failed',error);return false;}).finally(()=>{appearanceWarmup=null;});
  }
  function register(raw){warmModularAppearance(raw);const manifest=safeManifest(raw);if(!manifest)return null;records.set(manifest.contentId,manifest);load(manifest);return manifest;}
  function persist(manifest){try{if(manifest)root.localStorage?.setItem(STORAGE_KEY,JSON.stringify(manifest));else root.localStorage?.removeItem(STORAGE_KEY);}catch{}}
  function select(contentId,{manifest=null,persistLocal=true}={}){const row=manifest?register(manifest):records.get(String(contentId))||null;if(!row)throw new Error('AVATAR_MANIFEST_NOT_REGISTERED');if(!access(row))throw new Error('CREATOR_AVATAR_ENTITLEMENT_REQUIRED');selectedId=row.contentId;selectedManifest=row;if(persistLocal)persist(row);try{if(typeof localPlayer!=='undefined')localPlayer.avatarContentId=row.contentId;}catch{}return row;}
  function current(){return selectedManifest&&access(selectedManifest)?selectedManifest:null;}
  function faceFor(actor,manifest){const vx=Number(actor?.vx)||0,vy=Number(actor?.vy)||0,moving=Math.hypot(vx,vy)>2;if(moving&&manifest.directions>=8){const octant=Math.round(Math.atan2(vy,vx)/(Math.PI/4)+8)%8;return ['e','se','s','sw','w','nw','n','ne'][octant];}if(moving){if(Math.abs(vx)>Math.abs(vy))return vx<0?'w':'e';return vy<0?'n':'s';}const face=directionKey(actor?._face||actor?.face||'s');return manifest.rowMap[face]!=null?face:'s';}
  function draw(actor,isSelf,next){let manifest=null;if(isSelf){manifest=selectedManifest;if(manifest&&!access(manifest))manifest=null;}else if(actor?.avatarManifest)manifest=register(actor.avatarManifest);if(!manifest)return next();const state=images.get(manifest.contentId);if(!state?.ready||!state.img?.naturalWidth)return next();
    const canvas=root.document?.getElementById('game-canvas'),ctx=canvas?.getContext?.('2d');if(!ctx)return next();const cols=manifest.columns,rows=manifest.rows,sw=state.img.naturalWidth/cols,sh=state.img.naturalHeight/rows,face=faceFor(actor,manifest),row=Math.max(0,Math.min(rows-1,Number(manifest.rowMap[face]??manifest.rowMap.s??0))),moving=Math.hypot(Number(actor?.vx)||0,Number(actor?.vy)||0)>4,frameCount=manifest.frameCounts[row]||cols,frame=moving?Math.floor((root.performance?.now?.()||Date.now())/manifest.frameMs)%frameCount:0,h=manifest.renderHeight,w=h*(sw/sh),x=(Number(actor?.x)||0)-w/2,y=(Number(actor?.y)||0)-h+Math.max(6,Number(actor?.radius)||20);
    ctx.save();ctx.globalAlpha=1;ctx.imageSmoothingEnabled=true;ctx.drawImage(state.img,frame*sw,row*sh,sw,sh,x,y,w,h);ctx.restore();return true;}
  const api=Object.freeze({version:'kelo-creator-avatar-runtime-v2.2.0-modular-envelope',register,select,current,get:id=>{const row=records.get(String(id))||null;return row&&access(row)?row:null;},getRaw:id=>records.get(String(id))||null,list:()=>[...records.values()].filter(access),clear(){selectedId=null;selectedManifest=null;persist(null);},get selectedId(){return selectedManifest&&access(selectedManifest)?selectedId:null;}});
  root.KeloCreatorAvatars=api;
  if(root.KeloAvatar?.use)middlewareId=root.KeloAvatar.use('creator-avatar-runtime',draw,900);
  try{const raw=root.localStorage?.getItem(STORAGE_KEY);if(raw){const manifest=register(JSON.parse(raw));if(manifest){selectedId=manifest.contentId;selectedManifest=manifest;}}}catch{}
  root.addEventListener?.('kelo:creator-entitlements-changed',()=>{if(selectedManifest&&!access(selectedManifest)){try{if(typeof localPlayer!=='undefined'&&localPlayer.avatarContentId===selectedManifest.contentId)localPlayer.avatarContentId=null;}catch{}}});
  root.KELO_CREATOR_AVATAR_AUDIT=Object.freeze({version:api.version,owner:'KeloAvatar middleware',priority:900,localRestore:true,localEntitlementCheck:true,remotePublishedRendering:true,remoteModularEnvelopeWarmup:true,middlewareId});
  return api;
}
