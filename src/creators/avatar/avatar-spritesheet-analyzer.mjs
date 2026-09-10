/* KELO-INDEX
 * area: CREATORS / AVATAR
 * owner: Avatar Quick Import analyzer
 * owns: local image probe, simple grid inference and runtime WebP compilation
 * does-not-own: persistence, renderer selection, Supabase or character identity
 */
const MAX_SOURCE_BYTES=5*1024*1024,MAX_SOURCE_DIM=2048,MAX_RUNTIME_DIM=1024,MAX_RUNTIME_BYTES=2*1024*1024;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
async function bitmapFor(file,root){if(root.createImageBitmap)return root.createImageBitmap(file);if(!root.document||!root.URL?.createObjectURL)throw new Error('AVATAR_IMAGE_DECODE_UNAVAILABLE');const url=root.URL.createObjectURL(file);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('AVATAR_IMAGE_INVALID'));img.src=url;});}finally{root.URL.revokeObjectURL(url);}}
function inferGrid(width,height){if(width>=512&&height>=512&&width===height&&width%4===0&&height%4===0)return{columns:4,rows:4,confidence:'high'};if(width%4===0&&height%4===0&&width/height>0.75&&width/height<1.34)return{columns:4,rows:4,confidence:'medium'};return{columns:1,rows:1,confidence:'low'};}
function sampleCorners(data,width,height){const pts=[[2,2],[width-3,2],[2,height-3],[width-3,height-3]],out=[];for(const[x,y]of pts){const i=(y*width+x)*4;out.push([data[i],data[i+1],data[i+2]]);}const avg=[0,1,2].map(c=>out.reduce((s,p)=>s+p[c],0)/out.length),spread=Math.max(...out.map(p=>Math.hypot(p[0]-avg[0],p[1]-avg[1],p[2]-avg[2])));return{rgb:avg,uniform:spread<22,light:(avg[0]+avg[1]+avg[2])/3>210};}
function removeConnectedBackground(image,width,height,bg){const d=image.data,total=width*height,seen=new Uint8Array(total),queue=new Int32Array(total);let head=0,tail=0;const distAt=p=>{const i=p*4;return Math.hypot(d[i]-bg[0],d[i+1]-bg[1],d[i+2]-bg[2]);};const push=p=>{if(p<0||p>=total||seen[p]||distAt(p)>72)return;seen[p]=1;queue[tail++]=p;};for(let x=0;x<width;x++){push(x);push((height-1)*width+x);}for(let y=1;y<height-1;y++){push(y*width);push(y*width+width-1);}while(head<tail){const p=queue[head++],x=p%width,y=(p/width)|0,i=p*4,dist=distAt(p);d[i+3]=dist<34?0:Math.round(d[i+3]*clamp((dist-34)/38,0,1));if(x>0)push(p-1);if(x+1<width)push(p+1);if(y>0)push(p-width);if(y+1<height)push(p+width);}return image;}
function canvasBlob(canvas,type,quality){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('AVATAR_RUNTIME_ENCODE_FAILED')),type,quality));}
export async function analyzeAvatarSpriteSheet(file,{root=globalThis}={}){
  if(!/^image\/(png|webp|jpeg)$/.test(String(file?.type||'')))throw new Error('AVATAR_IMAGE_TYPE_UNSUPPORTED');if(!file.size||file.size>MAX_SOURCE_BYTES)throw new Error('AVATAR_IMAGE_SIZE_INVALID');
  const bmp=await bitmapFor(file,root),width=Number(bmp.width||bmp.naturalWidth)||0,height=Number(bmp.height||bmp.naturalHeight)||0;if(width<1||height<1||width>MAX_SOURCE_DIM||height>MAX_SOURCE_DIM)throw new Error('AVATAR_IMAGE_DIMENSIONS_INVALID');
  const grid=inferGrid(width,height),probe=root.document.createElement('canvas');probe.width=Math.min(width,256);probe.height=Math.min(height,256);const pctx=probe.getContext('2d',{willReadFrequently:true});pctx.drawImage(bmp,0,0,probe.width,probe.height);const corners=sampleCorners(pctx.getImageData(0,0,probe.width,probe.height).data,probe.width,probe.height);try{bmp.close?.();}catch{}
  return Object.freeze({width,height,columns:grid.columns,rows:grid.rows,frameWidth:width/grid.columns,frameHeight:height/grid.rows,confidence:grid.confidence,rowMap:Object.freeze({down:0,left:Math.min(1,grid.rows-1),right:Math.min(2,grid.rows-1),up:Math.min(3,grid.rows-1)}),frameMs:140,removeBackground:corners.uniform&&corners.light,backgroundRgb:Object.freeze(corners.rgb.map(x=>Math.round(x))) });
}
export async function compileAvatarRuntime(file,config,{root=globalThis}={}){
  const bmp=await bitmapFor(file,root),sourceW=Number(bmp.width||bmp.naturalWidth),sourceH=Number(bmp.height||bmp.naturalHeight),scale=Math.min(1,MAX_RUNTIME_DIM/Math.max(sourceW,sourceH)),width=Math.max(1,Math.round(sourceW*scale)),height=Math.max(1,Math.round(sourceH*scale)),canvas=root.document.createElement('canvas');canvas.width=width;canvas.height=height;const ctx=canvas.getContext('2d',{alpha:true,willReadFrequently:true});ctx.drawImage(bmp,0,0,width,height);try{bmp.close?.();}catch{}
  if(config?.removeBackground){let image=ctx.getImageData(0,0,width,height);image=removeConnectedBackground(image,width,height,(config.backgroundRgb||[255,255,255]).map(Number));ctx.putImageData(image,0,0);}
  let type='image/webp',blob=await canvasBlob(canvas,type,.92);if(blob.size>MAX_RUNTIME_BYTES)blob=await canvasBlob(canvas,type,.78);if(blob.size>MAX_RUNTIME_BYTES){type='image/png';blob=await canvasBlob(canvas,type);}
  if(blob.size>MAX_RUNTIME_BYTES)throw new Error('AVATAR_RUNTIME_TOO_LARGE');
  return Object.freeze({blob,type,width,height,columns:Math.max(1,Number(config?.columns)||1),rows:Math.max(1,Number(config?.rows)||1),rowMap:config?.rowMap||{down:0,left:1,right:2,up:3},frameMs:clamp(Number(config?.frameMs)||140,70,500)});
}
