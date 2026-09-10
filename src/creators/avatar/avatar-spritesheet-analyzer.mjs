/* KELO-INDEX
 * area: CREATORS / AVATAR
 * owner: Avatar Auto-Detect analyzer/compiler
 * keys: AVATAR AUTODETECT GRID SEGMENT BACKGROUND NORMALIZE PREVIEW
 * purpose: detecta fondo, frames, grid y orientación; normaliza spritesheets imperfectos antes del runtime
 * public-api: analyzeAvatarSpriteSheet(file), compileAvatarRuntime(file,config)
 * consumes: browser image decode + Canvas only
 * state-owned: ninguno; análisis puro por archivo
 * extension-points: detection candidates / direction heuristics
 * online: N/A; la persistencia sigue en Avatar Quick Import service
 * do-not: no persistir, no seleccionar personaje, no crear renderer paralelo
 */
const MAX_SOURCE_BYTES=5*1024*1024,MAX_SOURCE_DIM=2048,MAX_RUNTIME_DIM=1024,MAX_RUNTIME_BYTES=2*1024*1024,PROBE_MAX=360;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const median=values=>{const a=[...values].sort((x,y)=>x-y);if(!a.length)return 0;const m=(a.length-1)/2,lo=Math.floor(m),hi=Math.ceil(m);return(a[lo]+a[hi])/2;};
const mean=values=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
const cv=values=>{if(values.length<2)return 0;const m=mean(values);if(!m)return 1;return Math.sqrt(mean(values.map(x=>(x-m)**2)))/m;};
async function bitmapFor(file,root){if(root.createImageBitmap)return root.createImageBitmap(file);if(!root.document||!root.URL?.createObjectURL)throw new Error('AVATAR_IMAGE_DECODE_UNAVAILABLE');const url=root.URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('AVATAR_IMAGE_INVALID'));img.src=url;});}finally{root.URL.revokeObjectURL(url);}}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('AVATAR_RUNTIME_ENCODE_FAILED')),type,quality));}
function borderModel(image,width,height){
  const d=image.data,pts=[],step=Math.max(1,Math.floor(Math.max(width,height)/96)),take=(x,y)=>{const i=(y*width+x)*4;pts.push([d[i],d[i+1],d[i+2],d[i+3]]);};
  for(let x=0;x<width;x+=step){take(x,0);take(x,height-1);}for(let y=step;y<height-1;y+=step){take(0,y);take(width-1,y);}
  const transparent=pts.filter(p=>p[3]<32).length/Math.max(1,pts.length);
  const opaque=pts.filter(p=>p[3]>=32),rgb=[0,1,2].map(c=>median(opaque.map(p=>p[c]))),dist=opaque.map(p=>Math.hypot(p[0]-rgb[0],p[1]-rgb[1],p[2]-rgb[2])),p90=[...dist].sort((a,b)=>a-b)[Math.floor(Math.max(0,dist.length-1)*.9)]||0;
  return Object.freeze({kind:transparent>.55?'transparent':'color',rgb:Object.freeze(rgb.map(x=>Math.round(x))),transparentRatio:transparent,uniform:transparent>.55||p90<34,light:(rgb[0]+rgb[1]+rgb[2])/3>205,threshold:clamp(28+p90*1.8,32,96),borderNoise:p90});
}
function foregroundMask(image,width,height,bg){
  const d=image.data,out=new Uint8Array(width*height);
  for(let p=0;p<out.length;p++){const i=p*4,a=d[i+3];if(bg.kind==='transparent'){out[p]=a>38?1:0;continue;}const dist=Math.hypot(d[i]-bg.rgb[0],d[i+1]-bg.rgb[1],d[i+2]-bg.rgb[2]);out[p]=a>24&&dist>bg.threshold?1:0;}
  return out;
}
function connectedComponents(mask,width,height){
  const seen=new Uint8Array(mask.length),queue=new Int32Array(mask.length),out=[];
  for(let start=0;start<mask.length;start++){if(!mask[start]||seen[start])continue;let head=0,tail=0,area=0,minX=width,minY=height,maxX=0,maxY=0,sumX=0,sumY=0;seen[start]=1;queue[tail++]=start;
    while(head<tail){const p=queue[head++],x=p%width,y=(p/width)|0;area++;sumX+=x;sumY+=y;if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;
      for(let oy=-1;oy<=1;oy++)for(let ox=-1;ox<=1;ox++){if(!ox&&!oy)continue;const nx=x+ox,ny=y+oy;if(nx<0||ny<0||nx>=width||ny>=height)continue;const n=ny*width+nx;if(mask[n]&&!seen[n]){seen[n]=1;queue[tail++]=n;}}
    }
    out.push({area,x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1,cx:sumX/area,cy:sumY/area});
  }
  return out;
}
function clusterAxis(items,axis,sizeKey){
  if(!items.length)return[];const sizes=items.map(x=>x[sizeKey]),tol=Math.max(3,median(sizes)*.72),sorted=[...items].sort((a,b)=>a[axis]-b[axis]),groups=[];
  for(const item of sorted){let best=null,bestD=Infinity;for(const g of groups){const d=Math.abs(item[axis]-g.center);if(d<=tol&&d<bestD){best=g;bestD=d;}}if(!best){best={center:item[axis],items:[]};groups.push(best);}best.items.push(item);best.center=mean(best.items.map(x=>x[axis]));}
  groups.sort((a,b)=>a.center-b.center);return groups;
}
function regularity(groups){if(groups.length<3)return 1;const gaps=[];for(let i=1;i<groups.length;i++)gaps.push(groups[i].center-groups[i-1].center);return clamp(1-cv(gaps)*1.8,0,1);}
function componentGrid(mask,width,height,components,sourceW,sourceH){
  if(!components.length)return null;const maxArea=Math.max(...components.map(x=>x.area)),seedMin=Math.max(width*height*.00065,maxArea*.16),seeds=components.filter(x=>x.area>=seedMin&&x.w<width*.82&&x.h<height*.82);if(!seeds.length)return null;
  const xs=clusterAxis(seeds,'cx','w'),ys=clusterAxis(seeds,'cy','h'),columns=xs.length,rows=ys.length;if(columns<1||rows<1||columns>12||rows>12||columns*rows>72)return null;
  const occupancy=new Map();for(const c of seeds){let xi=0,yi=0,xd=Infinity,yd=Infinity;xs.forEach((g,i)=>{const d=Math.abs(c.cx-g.center);if(d<xd){xd=d;xi=i;}});ys.forEach((g,i)=>{const d=Math.abs(c.cy-g.center);if(d<yd){yd=d;yi=i;}});const k=yi*columns+xi;occupancy.set(k,(occupancy.get(k)||0)+1);}
  const frameCount=columns*rows,covered=[...occupancy.values()].filter(Boolean).length,coverage=covered/frameCount,unique=covered/Math.max(1,seeds.length),score=clamp(.48*coverage+.18*unique+.17*regularity(xs)+.17*regularity(ys),0,1);
  if(frameCount>1&&(coverage<.72||unique<.62||score<.68))return null;
  const noiseMin=Math.max(3,maxArea*.006),usable=components.filter(x=>x.area>=noiseMin&&x.w<width*.9&&x.h<height*.9),cells=Array.from({length:frameCount},()=>[]);
  for(const c of usable){let xi=0,yi=0,xd=Infinity,yd=Infinity;xs.forEach((g,i)=>{const d=Math.abs(c.cx-g.center);if(d<xd){xd=d;xi=i;}});ys.forEach((g,i)=>{const d=Math.abs(c.cy-g.center);if(d<yd){yd=d;yi=i;}});const xReach=Math.max(median(seeds.map(x=>x.w))*1.2,(columns>1?mean(xs.slice(1).map((g,i)=>g.center-xs[i].center))*.52:width)),yReach=Math.max(median(seeds.map(x=>x.h))*1.2,(rows>1?mean(ys.slice(1).map((g,i)=>g.center-ys[i].center))*.52:height));if(xd<=xReach&&yd<=yReach)cells[yi*columns+xi].push(c);}
  const sx=sourceW/width,sy=sourceH/height,medW=median(seeds.map(x=>x.w))*sx,medH=median(seeds.map(x=>x.h))*sy,padX=Math.max(2,medW*.045),padY=Math.max(2,medH*.035),rects=cells.map((list,index)=>{
    if(!list.length){const xi=index%columns,yi=(index/columns)|0;return{x:xi*sourceW/columns,y:yi*sourceH/rows,w:sourceW/columns,h:sourceH/rows,fallback:true};}
    const x0=Math.min(...list.map(x=>x.x))*sx,y0=Math.min(...list.map(x=>x.y))*sy,x1=Math.max(...list.map(x=>x.x+x.w))*sx,y1=Math.max(...list.map(x=>x.y+x.h))*sy,nx=clamp(x0-padX,0,sourceW),ny=clamp(y0-padY,0,sourceH),ex=clamp(x1+padX,0,sourceW),ey=clamp(y1+padY,0,sourceH);return{x:nx,y:ny,w:Math.max(1,ex-nx),h:Math.max(1,ey-ny),fallback:false};
  });
  const bounds={x:Math.min(...rects.map(r=>r.x)),y:Math.min(...rects.map(r=>r.y)),w:0,h:0};bounds.w=Math.max(...rects.map(r=>r.x+r.w))-bounds.x;bounds.h=Math.max(...rects.map(r=>r.y+r.h))-bounds.y;
  return{columns,rows,score,rects,bounds,seedCount:seeds.length,componentCount:usable.length,mode:'components'};
}
function regularGridFallback(mask,width,height,sourceW,sourceH){
  const ratio=sourceW/sourceH;let columns=1,rows=1,score=.35;if(sourceW>=384&&sourceH>=384&&ratio>.76&&ratio<1.32){columns=4;rows=4;score=.58;}else if(ratio>=2.2){rows=1;columns=clamp(Math.round(ratio),2,8);score=.48;}else if(ratio<=.46){columns=1;rows=clamp(Math.round(1/ratio),2,8);score=.48;}
  return{columns,rows,score,rects:null,bounds:{x:0,y:0,w:sourceW,h:sourceH},seedCount:0,componentCount:0,mode:'regular'};
}
function sampleMaskInRect(mask,width,height,rect,sourceW,sourceH,outSize=64){
  const out=new Uint8Array(outSize*outSize),sx=width/sourceW,sy=height/sourceH,x0=rect.x*sx,y0=rect.y*sy,rw=rect.w*sx,rh=rect.h*sy;
  for(let oy=0;oy<outSize;oy++)for(let ox=0;ox<outSize;ox++){const px=clamp(Math.floor(x0+(ox+.5)*rw/outSize),0,width-1),py=clamp(Math.floor(y0+(oy+.5)*rh/outSize),0,height-1);out[oy*outSize+ox]=mask[py*width+px];}
  return out;
}
function rowFeatures(mask,width,height,rects,columns,rows,sourceW,sourceH,image){
  const features=[];for(let row=0;row<rows;row++){const sym=[],shift=[],detail=[];for(let col=0;col<columns;col++){const rect=rects?.[row*columns+col]||{x:col*sourceW/columns,y:row*sourceH/rows,w:sourceW/columns,h:sourceH/rows},m=sampleMaskInRect(mask,width,height,rect,sourceW,sourceH,64);let inter=0,union=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++){const a=m[y*64+x],b=m[y*64+(63-x)];if(a||b)union++;if(a&&b)inter++;}sym.push(union?inter/union:0);
      let topX=0,topN=0,torsoX=0,torsoN=0;for(let y=0;y<64;y++)for(let x=0;x<64;x++){if(!m[y*64+x])continue;if(y<18){topX+=x;topN++;}else if(y>=20&&y<39){torsoX+=x;torsoN++;}}shift.push(topN&&torsoN?((topX/topN)-(torsoX/torsoN))/64:0);
      const sx=width/sourceW,sy=height/sourceH,x0=Math.floor(rect.x*sx),y0=Math.floor(rect.y*sy),x1=Math.min(width,Math.ceil((rect.x+rect.w)*sx)),y1=Math.min(height,Math.ceil((rect.y+rect.h*.32)*sy));let dark=0,fg=0;for(let y=Math.max(0,y0);y<y1;y++)for(let x=Math.max(0,x0);x<x1;x++){if(!mask[y*width+x])continue;const i=(y*width+x)*4,lum=(image.data[i]+image.data[i+1]+image.data[i+2])/3;fg++;if(lum<105)dark++;}detail.push(fg?dark/fg:0);
    }features.push({row,symmetry:mean(sym),headShift:mean(shift),detail:mean(detail)});}return features;
}
function inferDirections(mask,width,height,grid,sourceW,sourceH,image){
  const rows=grid.rows,columns=grid.columns,defaults={down:0,left:Math.min(1,rows-1),right:Math.min(2,rows-1),up:Math.min(3,rows-1)};if(rows!==4||columns<1)return{rowMap:defaults,confidence:.42,mode:'default'};
  const f=rowFeatures(mask,width,height,grid.rects,columns,rows,sourceW,sourceH,image),bySym=[...f].sort((a,b)=>a.symmetry-b.symmetry),side=bySym.slice(0,2),face=bySym.slice(2),left=side.find(x=>x.headShift<0),right=side.find(x=>x.headShift>0);if(!left||!right||Math.abs(left.headShift)<.025||Math.abs(right.headShift)<.025)return{rowMap:defaults,confidence:.55,mode:'symmetry-default'};
  const [a,b]=face,down=a.detail>=b.detail?a:b,up=down===a?b:a,sideConfidence=clamp((Math.abs(left.headShift)+Math.abs(right.headShift))/.12,0,1),fbGap=Math.abs(a.detail-b.detail),fbConfidence=clamp(fbGap/.07,0,1),confidence=clamp(.55+.25*sideConfidence+.2*fbConfidence,0,1);
  return{rowMap:{down:down.row,left:left.row,right:right.row,up:up.row},confidence,mode:'visual'};
}
function removeConnectedBackground(image,width,height,bg,threshold=72){
  const d=image.data,total=width*height,seen=new Uint8Array(total),queue=new Int32Array(total);let head=0,tail=0;const distAt=p=>{const i=p*4;return Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]);};const push=p=>{if(p<0||p>=total||seen[p]||distAt(p)>threshold)return;seen[p]=1;queue[tail++]=p;};for(let x=0;x<width;x++){push(x);push((height-1)*width+x);}for(let y=1;y<height-1;y++){push(y*width);push(y*width+width-1);}while(head<tail){const p=queue[head++],x=p%width,y=(p/width)|0,i=p*4,dist=distAt(p);d[i+3]=dist<threshold*.47?0:Math.round(d[i+3]*clamp((dist-threshold*.47)/(threshold*.53),0,1));if(x>0)push(p-1);if(x+1<width)push(p+1);if(y>0)push(p-width);if(y+1<height)push(p+width);}return image;
}
export async function analyzeAvatarSpriteSheet(file,{root=globalThis}={}){
  if(!/^image\/(png|webp|jpeg)$/.test(String(file?.type||'')))throw new Error('AVATAR_IMAGE_TYPE_UNSUPPORTED');if(!file.size||file.size>MAX_SOURCE_BYTES)throw new Error('AVATAR_IMAGE_SIZE_INVALID');
  const bmp=await bitmapFor(file,root),width=Number(bmp.width||bmp.naturalWidth)||0,height=Number(bmp.height||bmp.naturalHeight)||0;if(width<1||height<1||width>MAX_SOURCE_DIM||height>MAX_SOURCE_DIM)throw new Error('AVATAR_IMAGE_DIMENSIONS_INVALID');
  const scale=Math.min(1,PROBE_MAX/Math.max(width,height)),probe=root.document.createElement('canvas');probe.width=Math.max(1,Math.round(width*scale));probe.height=Math.max(1,Math.round(height*scale));const ctx=probe.getContext('2d',{willReadFrequently:true});ctx.drawImage(bmp,0,0,probe.width,probe.height);try{bmp.close?.();}catch{}
  const image=ctx.getImageData(0,0,probe.width,probe.height),background=borderModel(image,probe.width,probe.height),mask=foregroundMask(image,probe.width,probe.height,background),components=connectedComponents(mask,probe.width,probe.height),grid=componentGrid(mask,probe.width,probe.height,components,width,height)||regularGridFallback(mask,probe.width,probe.height,width,height),directions=inferDirections(mask,probe.width,probe.height,grid,width,height,image),confidenceScore=clamp(grid.score*(background.uniform?1:.82),0,1),confidence=confidenceScore>=.82?'high':confidenceScore>=.64?'medium':'low';
  return Object.freeze({version:'avatar-auto-detect-v2',width,height,columns:grid.columns,rows:grid.rows,frameWidth:width/grid.columns,frameHeight:height/grid.rows,confidence,confidenceScore,directionConfidence:directions.confidence,detectionMode:grid.mode,autoCrop:grid.mode==='components',sourceRects:grid.rects?Object.freeze(grid.rects.map(r=>Object.freeze({...r}))):null,contentBounds:Object.freeze(grid.bounds),seedCount:grid.seedCount,componentCount:grid.componentCount,rowMap:Object.freeze(directions.rowMap),directionMode:directions.mode,frameMs:140,removeBackground:background.kind==='color'&&background.uniform,backgroundKind:background.kind,backgroundUniform:background.uniform,backgroundRgb:background.rgb,backgroundThreshold:background.threshold});
}
function normalizeRuntime(sourceCanvas,config,root){
  const columns=Math.max(1,Number(config?.columns)||1),rows=Math.max(1,Number(config?.rows)||1),rects=Array.isArray(config?.sourceRects)&&config.sourceRects.length===columns*rows?config.sourceRects:null;if(!rects)return null;
  const maxW=Math.max(...rects.map(r=>Number(r.w)||1)),maxH=Math.max(...rects.map(r=>Number(r.h)||1)),cellW=Math.ceil(maxW*1.08),cellH=Math.ceil(maxH*1.06),scale=Math.min(1,MAX_RUNTIME_DIM/Math.max(cellW*columns,cellH*rows)),outCellW=Math.max(8,Math.floor(cellW*scale)),outCellH=Math.max(8,Math.floor(cellH*scale)),canvas=root.document.createElement('canvas');canvas.width=outCellW*columns;canvas.height=outCellH*rows;const ctx=canvas.getContext('2d',{alpha:true});
  for(let row=0;row<rows;row++)for(let col=0;col<columns;col++){const r=rects[row*columns+col],dw=Math.max(1,r.w*scale),dh=Math.max(1,r.h*scale),dx=col*outCellW+(outCellW-dw)/2,dy=row*outCellH+outCellH-dh;ctx.drawImage(sourceCanvas,r.x,r.y,r.w,r.h,dx,dy,dw,dh);}
  return{canvas,width:canvas.width,height:canvas.height,normalized:true,cellWidth:outCellW,cellHeight:outCellH};
}
export async function compileAvatarRuntime(file,config,{root=globalThis}={}){
  const bmp=await bitmapFor(file,root),sourceW=Number(bmp.width||bmp.naturalWidth),sourceH=Number(bmp.height||bmp.naturalHeight),source=root.document.createElement('canvas');source.width=sourceW;source.height=sourceH;const sctx=source.getContext('2d',{alpha:true,willReadFrequently:true});sctx.drawImage(bmp,0,0);try{bmp.close?.();}catch{}
  if(config?.removeBackground&&config?.backgroundKind!=='transparent'){let image=sctx.getImageData(0,0,sourceW,sourceH);image=removeConnectedBackground(image,sourceW,sourceH,(config.backgroundRgb||[255,255,255]).map(Number),clamp(Number(config.backgroundThreshold)||72,36,110));sctx.putImageData(image,0,0);}
  const normalized=normalizeRuntime(source,config,root);let canvas,width,height,wasNormalized=false;if(normalized){({canvas,width,height}=normalized);wasNormalized=true;}else{const scale=Math.min(1,MAX_RUNTIME_DIM/Math.max(sourceW,sourceH));width=Math.max(1,Math.round(sourceW*scale));height=Math.max(1,Math.round(sourceH*scale));canvas=root.document.createElement('canvas');canvas.width=width;canvas.height=height;canvas.getContext('2d',{alpha:true}).drawImage(source,0,0,width,height);}
  let type='image/webp',blob=await canvasBlob(canvas,type,.92);if(blob.size>MAX_RUNTIME_BYTES)blob=await canvasBlob(canvas,type,.78);if(blob.size>MAX_RUNTIME_BYTES){type='image/png';blob=await canvasBlob(canvas,type);}if(blob.size>MAX_RUNTIME_BYTES)throw new Error('AVATAR_RUNTIME_TOO_LARGE');
  return Object.freeze({blob,type,width,height,columns:Math.max(1,Number(config?.columns)||1),rows:Math.max(1,Number(config?.rows)||1),rowMap:config?.rowMap||{down:0,left:1,right:2,up:3},frameMs:clamp(Number(config?.frameMs)||140,70,500),normalized:wasNormalized,detectionMode:String(config?.detectionMode||'manual'),confidenceScore:clamp(Number(config?.confidenceScore)||0,0,1)});
}
