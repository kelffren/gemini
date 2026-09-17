/* KELO-INDEX
 * area: CORE / AVATAR / CREATOR BRIDGE
 * owner: KeloUniversalLookRuntime
 * keys: CREATOR SPRITE LOOK ORIGINAL GAME AVATAR RUNTIME SESSION STORAGE PIXEL ART
 * purpose: Render the temporary creator Look on the local player in the original game.
 * consumes: kelo.universal.look.preview.v1 + KeloAvatar middleware
 * state-owned: decoded preview image cache + persisted runtime mirror
 * gameplay-authority: false
 */
(function(root){
  'use strict';
  if(root.KeloUniversalLookRuntime)return;

  const VERSION='kelo-universal-look-runtime-v1.0.0';
  const PREVIEW_KEY='kelo.universal.look.preview.v1';
  const RUNTIME_KEY='kelo.universal.look.runtime.v1';
  const OWNER='creator:universal-look-runtime';
  const PRIORITY=900;
  const MAX_ITEMS=8;
  const imageCache=new Map();
  let middlewareId=null;
  let lastRaw=null;
  let items=[];
  let drawCount=0;
  let loadErrors=0;

  function safeStorage(storage,key){
    try{return storage&&storage.getItem(key);}catch{return null;}
  }
  function setStorage(storage,key,value){
    try{if(storage)storage.setItem(key,value);}catch{}
  }
  function removeStorage(storage,key){
    try{if(storage)storage.removeItem(key);}catch{}
  }
  function finite(value,fallback){const n=Number(value);return Number.isFinite(n)?n:fallback;}
  function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

  function normalizeItem(row){
    if(!row||typeof row!=='object'||!row.previewUrl||!row.profile)return null;
    const p=row.profile||{};
    const slot=String(p.slot||'generic');
    return {
      id:String(row.id||row.previewUrl),
      name:String(row.name||row.id||'Sprite'),
      previewUrl:String(row.previewUrl),
      contentKind:String(row.contentKind||'image'),
      columns:Math.max(1,Math.floor(finite(row.columns,1))),
      rows:Math.max(1,Math.floor(finite(row.rows,1))),
      profile:{
        slot:slot,
        x:clamp(finite(p.x,.5),-.5,1.5),
        y:clamp(finite(p.y,.52),-.5,1.5),
        scale:clamp(finite(p.scale,.52),.05,3),
        rotation:clamp(finite(p.rotation,0),-360,360),
        alpha:clamp(finite(p.alpha,1),.05,1),
        layer:p.layer==='back'?'back':'front',
        order:finite(p.order,9)
      }
    };
  }

  function readRaw(){
    const sessionRaw=safeStorage(root.sessionStorage,PREVIEW_KEY);
    if(sessionRaw!==null){
      setStorage(root.localStorage,RUNTIME_KEY,sessionRaw);
      return sessionRaw;
    }
    return safeStorage(root.localStorage,RUNTIME_KEY)||'[]';
  }

  function refresh(force){
    const raw=readRaw();
    if(!force&&raw===lastRaw)return false;
    lastRaw=raw;
    let rows=[];
    try{const parsed=JSON.parse(raw||'[]');if(Array.isArray(parsed))rows=parsed;}catch{}
    items=rows.slice(0,MAX_ITEMS).map(normalizeItem).filter(Boolean);
    return true;
  }

  function imageRecord(url){
    let rec=imageCache.get(url);
    if(rec)return rec;
    rec={img:null,ready:false,error:false};
    imageCache.set(url,rec);
    const Img=root.Image||(typeof Image==='function'?Image:null);
    if(!Img){rec.error=true;loadErrors+=1;return rec;}
    const img=new Img();
    rec.img=img;
    img.decoding='async';
    img.onload=function(){rec.ready=!!(img.naturalWidth&&img.naturalHeight);rec.error=!rec.ready;if(rec.error)loadErrors+=1;};
    img.onerror=function(){rec.ready=false;rec.error=true;loadErrors+=1;};
    img.src=url;
    return rec;
  }

  function activeContext(){
    if(typeof ctx!=='undefined'&&ctx)return ctx;
    if(root.ctx)return root.ctx;
    if(root.gameCtx)return root.gameCtx;
    if(typeof document==='undefined')return null;
    const canvas=document.querySelector('#gameCanvas,#arcadeGameCanvas,#game-canvas,canvas');
    return canvas&&typeof canvas.getContext==='function'?canvas.getContext('2d'):null;
  }

  function normalizeFace(value){
    const face=String(value||'').toLowerCase().replace(/_/g,'-');
    const aliases={south:'down',southeast:'down-right','south-east':'down-right',east:'right',northeast:'up-right','north-east':'up-right',north:'up',northwest:'up-left','north-west':'up-left',west:'left',southwest:'down-left','south-west':'down-left'};
    return aliases[face]||face;
  }
  function vectorFace(x,y){
    const vx=finite(x,0),vy=finite(y,0);
    if(Math.hypot(vx,vy)<=.01)return'';
    const oct=Math.round(Math.atan2(vy,vx)/(Math.PI/4));
    return ({'-4':'left','-3':'up-left','-2':'up','-1':'up-right','0':'right','1':'down-right','2':'down','3':'down-left','4':'left'})[String(oct)]||'';
  }
  function actorFace(actor){
    return vectorFace(actor?._visualMotion?.dx,actor?._visualMotion?.dy)||vectorFace(actor?.vx,actor?.vy)||normalizeFace(actor?._visualMotion?.face)||normalizeFace(actor?._face)||'down';
  }

  function sourceRect(img,item,actor){
    const iw=Math.max(1,img.naturalWidth||img.width||1),ih=Math.max(1,img.naturalHeight||img.height||1);
    const cols=Math.max(1,item.columns||1),rows=Math.max(1,item.rows||1);
    let col=0,row=0;
    if(cols>1)col=Math.abs(Math.floor(finite(actor?.frame,0)))%cols;
    if(rows===4){
      row=({down:0,left:1,right:2,up:3,'down-left':0,'down-right':0,'up-left':3,'up-right':3})[actorFace(actor)]||0;
    }else if(rows>=8){
      row=({up:0,'up-left':1,left:2,'down-left':3,down:4,'down-right':5,right:6,'up-right':7})[actorFace(actor)]||4;
      row%=rows;
    }
    if(cols>1||rows>1)return{x:col*iw/cols,y:row*ih/rows,w:iw/cols,h:ih/rows};

    // Some providers omit rows/columns metadata. Detect common horizontal sprite strips
    // without guessing aggressively on normal single-frame pixel art.
    if(item.contentKind==='sprite'&&iw>ih*1.8){
      const candidates=[32,48,64,96,128,192,256];
      for(const fw of candidates){
        if(iw%fw===0&&iw/fw>=2&&iw/fw<=16&&ih>=fw*.5&&ih<=fw*2)return{x:0,y:0,w:fw,h:ih};
      }
    }
    return{x:0,y:0,w:iw,h:ih};
  }

  function actorBox(actor){
    const radius=Math.max(1,finite(actor?.radius,20));
    const h=Math.max(92,radius*4.8);
    const feetY=finite(actor?.y,0)+Math.max(14,radius*.9);
    return{x:finite(actor?.x,0),top:feetY-h,feetY:feetY,h:h};
  }

  function drawItem(context,actor,item){
    const rec=imageRecord(item.previewUrl);
    if(!rec.ready||!rec.img)return false;
    const rect=sourceRect(rec.img,item,actor),p=item.profile,box=actorBox(actor);
    const h=Math.max(4,box.h*p.scale),w=Math.max(4,h*(rect.w/rect.h));
    const x=box.x+(p.x-.5)*box.h;
    const y=box.top+p.y*box.h;
    context.save();
    const oldSmooth=context.imageSmoothingEnabled;
    context.imageSmoothingEnabled=false;
    context.globalAlpha=clamp(p.alpha,.05,1);
    context.translate(x,y);
    context.rotate(p.rotation*Math.PI/180);
    context.drawImage(rec.img,rect.x,rect.y,rect.w,rect.h,-w/2,-h/2,w,h);
    context.imageSmoothingEnabled=oldSmooth;
    context.restore();
    drawCount+=1;
    return true;
  }

  function sorted(layer){
    return items.filter(function(item){return item.profile.layer===layer;}).sort(function(a,b){return a.profile.order-b.profile.order;});
  }

  function middleware(actor,isSelf,next){
    if(!isSelf||!actor)return next();
    refresh(false);
    if(!items.length)return next();
    const context=activeContext();
    if(!context)return next();

    const back=sorted('back');
    const front=sorted('front');
    const body=items.find(function(item){return item.profile.slot==='body';})||null;
    back.forEach(function(item){drawItem(context,actor,item);});

    let bodyDrawn=false;
    if(body)bodyDrawn=drawItem(context,actor,body);
    if(!bodyDrawn)next();

    front.forEach(function(item){if(item!==body)drawItem(context,actor,item);});
    return undefined;
  }

  function snapshot(){
    return Object.freeze({
      version:VERSION,
      installed:!!middlewareId,
      middlewareId:middlewareId,
      itemCount:items.length,
      bodyActive:items.some(function(item){return item.profile.slot==='body';}),
      drawCount:drawCount,
      imageCount:imageCache.size,
      loadErrors:loadErrors,
      storage:PREVIEW_KEY,
      runtimeMirror:RUNTIME_KEY
    });
  }

  function clear(){
    removeStorage(root.sessionStorage,PREVIEW_KEY);
    removeStorage(root.localStorage,RUNTIME_KEY);
    lastRaw=null;items=[];
  }

  refresh(true);
  if(root.KeloAvatar&&typeof root.KeloAvatar.use==='function'){
    middlewareId=root.KeloAvatar.use(OWNER,middleware,PRIORITY);
  }
  if(typeof root.addEventListener==='function'){
    root.addEventListener('focus',function(){refresh(true);});
    root.addEventListener('storage',function(event){if(event&&[PREVIEW_KEY,RUNTIME_KEY].includes(event.key))refresh(true);});
  }

  root.KeloUniversalLookRuntime=Object.freeze({version:VERSION,refresh:refresh,clear:clear,snapshot:snapshot});
  root.KELO_UNIVERSAL_LOOK_RUNTIME_AUDIT=snapshot();
})(typeof globalThis!=='undefined'?globalThis:window);
