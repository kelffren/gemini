/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: validate untrusted image containers before any expensive browser decoding
 * public-api: inspectAssetContainer(), assertSafeAssetInput()
 * authority: deterministic security boundary; AI output must never bypass this module
 */
const F=Object.freeze;
const U8=value=>value instanceof Uint8Array?value:new Uint8Array(value||0);
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
const ascii=(bytes,start,length)=>String.fromCharCode(...bytes.slice(start,start+length));
const u16be=(b,i)=>((b[i]<<8)|b[i+1])>>>0;
const u16le=(b,i)=>(b[i]|(b[i+1]<<8))>>>0;
const u24le=(b,i)=>(b[i]|(b[i+1]<<8)|(b[i+2]<<16))>>>0;
const u32be=(b,i)=>((b[i]<<24)|(b[i+1]<<16)|(b[i+2]<<8)|b[i+3])>>>0;
const u32le=(b,i)=>(b[i]|(b[i+1]<<8)|(b[i+2]<<16)|(b[i+3]<<24))>>>0;

function inspectPng(bytes){
 if(bytes.length<33||u32be(bytes,8)!==13||ascii(bytes,12,4)!=='IHDR')return F({format:'png',valid:false,reason:'PNG_IHDR_INVALID'});
 const width=u32be(bytes,16),height=u32be(bytes,20);if(!width||!height)return F({format:'png',valid:false,reason:'PNG_DIMENSIONS_INVALID'});
 let offset=8,animated=false,structureComplete=false;
 while(offset+12<=bytes.length){const length=u32be(bytes,offset),type=ascii(bytes,offset+4,4);if(type==='acTL')animated=true;if(type==='IEND'){structureComplete=true;break;}const next=offset+12+length;if(next<=offset||next>bytes.length)break;offset=next;}
 return F({format:'png',mimeType:'image/png',valid:true,width,height,animated,structureComplete,bitDepth:bytes[24],colorType:bytes[25]});
}

function inspectJpeg(bytes){
 let i=2;
 const sof=new Set([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf]);
 while(i+3<bytes.length){
   if(bytes[i]!==0xff){i++;continue;}while(i<bytes.length&&bytes[i]===0xff)i++;if(i>=bytes.length)break;const marker=bytes[i++];
   if(marker===0xd8||marker===0xd9||marker===0x01||(marker>=0xd0&&marker<=0xd7))continue;
   if(i+1>=bytes.length)break;const length=u16be(bytes,i);if(length<2)return F({format:'jpeg',valid:false,reason:'JPEG_SEGMENT_INVALID'});
   if(sof.has(marker)){if(i+7>bytes.length)break;const height=u16be(bytes,i+3),width=u16be(bytes,i+5);if(!width||!height)return F({format:'jpeg',valid:false,reason:'JPEG_DIMENSIONS_INVALID'});return F({format:'jpeg',mimeType:'image/jpeg',valid:true,width,height,animated:false,progressive:marker===0xc2||marker===0xca});}
   i+=length;
 }
 return F({format:'jpeg',mimeType:'image/jpeg',valid:true,width:null,height:null,animated:false,reason:'JPEG_SOF_NOT_IN_SCAN_WINDOW'});
}

function inspectWebp(bytes){
 if(bytes.length<20)return F({format:'webp',valid:false,reason:'WEBP_HEADER_TOO_SHORT'});
 const declaredBytes=u32le(bytes,4)+8,fourcc=ascii(bytes,12,4);
 if(fourcc==='VP8X'){
   if(bytes.length<30)return F({format:'webp',valid:false,reason:'WEBP_VP8X_SHORT'});const flags=bytes[20],width=u24le(bytes,24)+1,height=u24le(bytes,27)+1;
   return F({format:'webp',mimeType:'image/webp',valid:!!width&&!!height,width,height,declaredBytes,animated:!!(flags&0x02),hasAlpha:!!(flags&0x10),hasIcc:!!(flags&0x20),hasExif:!!(flags&0x08),hasXmp:!!(flags&0x04),profile:'extended'});
 }
 if(fourcc==='VP8L'){
   if(bytes.length<25||bytes[20]!==0x2f)return F({format:'webp',valid:false,reason:'WEBP_VP8L_INVALID'});const bits=(bytes[21]|(bytes[22]<<8)|(bytes[23]<<16)|(bytes[24]<<24))>>>0,width=(bits&0x3fff)+1,height=((bits>>>14)&0x3fff)+1;
   return F({format:'webp',mimeType:'image/webp',valid:true,width,height,declaredBytes,animated:false,hasAlpha:!!((bits>>>28)&1),profile:'lossless'});
 }
 if(fourcc==='VP8 '){
   if(bytes.length<30||bytes[23]!==0x9d||bytes[24]!==0x01||bytes[25]!==0x2a)return F({format:'webp',valid:false,reason:'WEBP_VP8_FRAME_HEADER_INVALID'});const width=u16le(bytes,26)&0x3fff,height=u16le(bytes,28)&0x3fff;
   return F({format:'webp',mimeType:'image/webp',valid:!!width&&!!height,width,height,declaredBytes,animated:false,profile:'lossy'});
 }
 return F({format:'webp',valid:false,reason:'WEBP_IMAGE_CHUNK_UNSUPPORTED'});
}

export function inspectAssetContainer(input){
 const bytes=U8(input);if(bytes.length<12)return F({format:'unknown',valid:false,reason:'HEADER_TOO_SHORT'});
 if(bytes[0]===0x89&&ascii(bytes,1,3)==='PNG'&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a)return inspectPng(bytes);
 if(ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,4)==='WEBP')return inspectWebp(bytes);
 if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return inspectJpeg(bytes);
 return F({format:'unknown',valid:false,reason:'UNSUPPORTED_MAGIC'});
}

export async function assertSafeAssetInput(file,{maxBytes=12*1024*1024,maxDimension=4096,maxPixels=16_777_216,maxDecodedBytes=96*1024*1024,maxHeaderScanBytes=1024*1024,allowAnimation=false}={}){
 if(!file||typeof file.arrayBuffer!=='function')throw new Error('ASSET_FILE_REQUIRED');const size=finite(file.size,0);if(size<1)throw new Error('ASSET_FILE_EMPTY');if(size>maxBytes)throw new Error('ASSET_FILE_TOO_LARGE');
 const scanBytes=Math.min(size,Math.max(65536,Math.min(maxHeaderScanBytes,2*1024*1024))),head=new Uint8Array(await file.slice(0,scanBytes).arrayBuffer()),container=inspectAssetContainer(head);
 if(!container.valid)throw new Error(`ASSET_CONTAINER_INVALID:${container.reason||'UNKNOWN'}`);if(file.type&&file.type!==container.mimeType)throw new Error('ASSET_MIME_MAGIC_MISMATCH');
 if(!container.width||!container.height)throw new Error(`ASSET_DIMENSIONS_UNRESOLVED:${container.reason||container.format}`);if(container.animated&&!allowAnimation)throw new Error('ASSET_ANIMATION_NOT_ALLOWED');
 if(container.format==='webp'&&container.declaredBytes&&container.declaredBytes!==size)throw new Error('ASSET_CONTAINER_SIZE_MISMATCH');
 if(container.width>maxDimension||container.height>maxDimension)throw new Error('ASSET_DIMENSION_LIMIT');const pixels=container.width*container.height;if(!Number.isSafeInteger(pixels)||pixels>maxPixels)throw new Error('ASSET_PIXEL_LIMIT');const decodedBytes=pixels*4;if(decodedBytes>maxDecodedBytes)throw new Error('ASSET_DECODE_MEMORY_LIMIT');
 return F({...container,size,name:String(file.name||''),pixels,decodedBytes,headerScanBytes:scanBytes,limits:F({maxBytes,maxDimension,maxPixels,maxDecodedBytes,maxHeaderScanBytes,allowAnimation})});
}

export const __assetSafeDecode=F({ascii,u16be,u16le,u24le,u32be,u32le,inspectPng,inspectJpeg,inspectWebp});