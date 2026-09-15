/* KELO-INDEX
 * area: CREATORS / SPRITE COMPILER / HARDENING
 * purpose: validate image containers before expensive browser decoding
 * public-api: inspectAssetContainer(), assertSafeAssetInput()
 */
const F=Object.freeze;
const U8=value=>value instanceof Uint8Array?value:new Uint8Array(value||0);
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;

function ascii(bytes,start,length){return String.fromCharCode(...bytes.slice(start,start+length));}
function u32be(bytes,i){return ((bytes[i]<<24)|(bytes[i+1]<<16)|(bytes[i+2]<<8)|bytes[i+3])>>>0;}
function u16le(bytes,i){return bytes[i]|(bytes[i+1]<<8);}

export function inspectAssetContainer(input){
  const bytes=U8(input);if(bytes.length<12) return F({format:'unknown',valid:false,reason:'HEADER_TOO_SHORT'});
  if(bytes[0]===0x89&&ascii(bytes,1,3)==='PNG'&&bytes[4]===0x0d&&bytes[5]===0x0a&&bytes[6]===0x1a&&bytes[7]===0x0a){
    if(bytes.length<24||ascii(bytes,12,4)!=='IHDR')return F({format:'png',valid:false,reason:'PNG_IHDR_MISSING'});
    return F({format:'png',mimeType:'image/png',valid:true,width:u32be(bytes,16),height:u32be(bytes,20)});
  }
  if(ascii(bytes,0,4)==='RIFF'&&ascii(bytes,8,4)==='WEBP')return F({format:'webp',mimeType:'image/webp',valid:true,width:null,height:null});
  if(bytes[0]===0xff&&bytes[1]===0xd8&&bytes[2]===0xff)return F({format:'jpeg',mimeType:'image/jpeg',valid:true,width:null,height:null});
  return F({format:'unknown',valid:false,reason:'UNSUPPORTED_MAGIC'});
}

export async function assertSafeAssetInput(file,{maxBytes=12*1024*1024,maxDimension=4096,maxPixels=16_777_216,maxDecodedBytes=96*1024*1024}={}){
  if(!file||typeof file.arrayBuffer!=='function')throw new Error('ASSET_FILE_REQUIRED');
  const size=finite(file.size,0);if(size<1)throw new Error('ASSET_FILE_EMPTY');if(size>maxBytes)throw new Error('ASSET_FILE_TOO_LARGE');
  const head=new Uint8Array(await file.slice(0,Math.min(size,65536)).arrayBuffer()),container=inspectAssetContainer(head);
  if(!container.valid)throw new Error(`ASSET_CONTAINER_INVALID:${container.reason||'UNKNOWN'}`);
  if(file.type&&file.type!==container.mimeType)throw new Error('ASSET_MIME_MAGIC_MISMATCH');
  if(container.width&&container.height){
    if(container.width>maxDimension||container.height>maxDimension)throw new Error('ASSET_DIMENSION_LIMIT');
    const pixels=container.width*container.height;if(pixels>maxPixels)throw new Error('ASSET_PIXEL_LIMIT');
    if(pixels*4>maxDecodedBytes)throw new Error('ASSET_DECODE_MEMORY_LIMIT');
  }
  return F({...container,size,name:String(file.name||''),limits:F({maxBytes,maxDimension,maxPixels,maxDecodedBytes})});
}

export const __assetSafeDecode=F({ascii,u32be,u16le});