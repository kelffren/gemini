/* KELO-INDEX
 * area: VISUAL / AVATAR
 * owner: KeloAnimation spritesheet avatar bridge
 * keys: ANIMATION SPRITESHEET FRAMEOVERRIDE AVATAR RUNTIME PREVIEW CREATOR
 * purpose: consume KeloAnimation.frameOverride and render the active spritesheet frame on the real actor through KeloAvatar
 * online: presentation-only; never mutates actor position, combat state, damage, cooldown or server authority
 * reuse: KeloAvatar + KeloAnimation + KeloAssetRegistry + KeloAnchors
 */
(function(root){
  'use strict';
  const VERSION='spritesheet-avatar-bridge-v1.0.0';
  if(root.KeloSpritesheetAvatarBridge)return;
  let hookId=null;
  const audit={version:VERSION,installed:false,renders:0,last:null};

  function worldContext(){
    try{return typeof ctx!=='undefined'?ctx:null;}catch(_){return null;}
  }
  function draw(actor,override){
    const g=worldContext();
    const registry=root.KeloAssetRegistry;
    const image=registry?.resource?.(override?.assetId);
    if(!g||!image||!override)return false;
    const fw=Math.max(1,Math.round(Number(override.frameWidth)||1));
    const fh=Math.max(1,Math.round(Number(override.frameHeight)||1));
    const iw=Math.max(fw,Number(image.naturalWidth||image.width)||fw);
    const ih=Math.max(fh,Number(image.naturalHeight||image.height)||fh);
    const cols=Math.max(1,Math.floor(iw/fw));
    const rows=Math.max(1,Math.floor(ih/fh));
    const maxFrame=Math.max(0,cols*rows-1);
    const frame=Math.max(0,Math.min(maxFrame,Math.round(Number(override.frame)||0)));
    const sx=(frame%cols)*fw,sy=Math.floor(frame/cols)*fh;
    const layout=root.KeloAnchors?.presentation?.(actor,actor?._face||'down')||null;
    const footX=Number(layout?.footRootX??actor?.x??0);
    const footY=Number(layout?.footRootY??((actor?.y||0)+10));
    const targetH=Math.max(28,Number(layout?.visualHeight)||90);
    const scale=targetH/fh;
    const dw=fw*scale,dh=fh*scale;
    const ax=Math.max(0,Math.min(1,Number(override.anchor?.x??.5)));
    const ay=Math.max(0,Math.min(1,Number(override.anchor?.y??1)));
    const mirror=override.mirrorLeftFromRight===true&&String(override.direction||actor?._face)==='left';
    g.save();
    g.imageSmoothingEnabled=false;
    if(mirror){
      g.translate(footX,0);g.scale(-1,1);g.translate(-footX,0);
    }
    g.drawImage(image,sx,sy,fw,fh,footX-dw*ax,footY-dh*ay,dw,dh);
    g.restore();
    audit.renders+=1;
    audit.last={actorId:String(actor?.id||''),assetId:String(override.assetId||''),frame,frameSlot:Number(override.frameSlot)||0,columns:cols,rows,drawWidth:dw,drawHeight:dh};
    return true;
  }
  function install(){
    if(hookId)return true;
    if(!root.KeloAvatar?.use||!root.KeloAnimation?.frameOverride||!root.KeloAssetRegistry)return false;
    hookId=root.KeloAvatar.use('visual-animation:spritesheet-frame',function(actor,isSelf,next){
      const override=root.KeloAnimation.frameOverride(actor);
      if(!override)return next();
      if(!draw(actor,override))return next();
      return true;
    },350);
    audit.installed=true;
    return true;
  }
  root.KeloSpritesheetAvatarBridge=Object.freeze({version:VERSION,install,getAudit(){return Object.freeze({...audit,last:audit.last?Object.freeze({...audit.last}):null});}});
  root.KELO_SPRITESHEET_AVATAR_AUDIT=audit;
  if(!install()&&root.document){
    if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});
    else setTimeout(install,0);
  }
})(typeof globalThis!=='undefined'?globalThis:window);
