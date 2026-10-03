/* KELO-INDEX
 * area: CREATORS / EXTERNAL ASSET NORMALIZATION
 * owner: Kelo Universal Content Bridge
 * purpose: turn ranked external raster assets into renderer-ready manifests without per-animal code
 */
const F=Object.freeze;
const n=(v,d=0)=>Number.isFinite(Number(v))?Number(v):d;
function hints(asset){return [asset?.name,asset?.category,asset?.contentKind,...(asset?.tags||[])].filter(Boolean).join(' ').toLowerCase();}
export function inferExternalSpriteProfile(asset={},imageInfo={}){
 const text=hints(asset),w=Math.max(1,n(imageInfo.width||asset.width,32)),h=Math.max(1,n(imageInfo.height||asset.height,32));
 const tagged=text.match(/\b(8|16|24|32|48|64|96|128)x\1\b/),cell=tagged?Number(tagged[1]):0;
 let frameWidth=cell||Math.min(w,h),frameHeight=cell||Math.min(w,h),columns=Math.max(1,Math.floor(w/frameWidth)),rows=Math.max(1,Math.floor(h/frameHeight));
 if(/sprite\s*sheet|spritesheet|animation|animated|walk|run/.test(text)&&columns===1&&w>h){frameWidth=h;columns=Math.max(1,Math.floor(w/frameWidth));}
 return F({kind:'sprite-sheet',frameWidth,frameHeight,columns,rows,frameCount:columns*rows,anchor:F({x:.5,y:1}),background:'auto-corners',transparent:true,pixelArt:/pixel|8x8|16x16|32x32/.test(text)});
}
export function createNormalizedAssetManifest(asset={},profile={}){
 if(!asset?.id)throw new Error('NORMALIZER_ASSET_ID_REQUIRED');
 const p=Object.keys(profile).length?profile:inferExternalSpriteProfile(asset,{});
 return F({schema:'kelo-normalized-external-v1',source:F({id:String(asset.id),provider:String(asset.provider||'external'),url:asset.downloadUrl||asset.previewUrl||null,license:asset.license||null,author:asset.author||null}),render:F({...p}),runtime:F({mode:'normalized-raster',cacheKey:`normalized:${asset.id}`,fallbackUrl:asset.previewUrl||asset.downloadUrl||null})});
}
export async function normalizeExternalRasterAsset(asset,{imageFactory=()=>new Image(),canvasFactory=()=>document.createElement('canvas')}={}){
 const url=asset?.downloadUrl||asset?.previewUrl;if(!url)throw new Error('NORMALIZER_SOURCE_URL_REQUIRED');
 const image=imageFactory();await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('NORMALIZER_IMAGE_LOAD_FAILED'));image.src=url});
 const profile=inferExternalSpriteProfile(asset,{width:image.naturalWidth||image.width,height:image.naturalHeight||image.height});
 const canvas=canvasFactory();canvas.width=profile.frameWidth;canvas.height=profile.frameHeight;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.imageSmoothingEnabled=!profile.pixelArt;
 ctx.drawImage(image,0,0,profile.frameWidth,profile.frameHeight,0,0,profile.frameWidth,profile.frameHeight);
 const data=ctx.getImageData(0,0,canvas.width,canvas.height),px=data.data,corners=[[0,0],[canvas.width-1,0],[0,canvas.height-1],[canvas.width-1,canvas.height-1]].map(([x,y])=>{const i=(y*canvas.width+x)*4;return[px[i],px[i+1],px[i+2],px[i+3]]});
 const bg=corners.sort((a,b)=>corners.filter(x=>x.slice(0,3).join()==b.slice(0,3).join()).length-corners.filter(x=>x.slice(0,3).join()==a.slice(0,3).join()).length)[0],tol=18;
 if(bg?.[3]===255)for(let i=0;i<px.length;i+=4)if(Math.abs(px[i]-bg[0])<=tol&&Math.abs(px[i+1]-bg[1])<=tol&&Math.abs(px[i+2]-bg[2])<=tol)px[i+3]=0;
 ctx.putImageData(data,0,0);const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('NORMALIZER_PNG_ENCODE_FAILED');
 return F({manifest:createNormalizedAssetManifest(asset,profile),blob,objectUrl:URL.createObjectURL(blob),width:canvas.width,height:canvas.height});
}
export const EXTERNAL_ASSET_NORMALIZER=F({inferExternalSpriteProfile,createNormalizedAssetManifest,normalizeExternalRasterAsset});
