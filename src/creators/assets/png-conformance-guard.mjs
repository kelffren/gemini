/* KELO-INDEX
 * area: CREATORS / ASSET SECURITY
 * owner: Kelo Creator Asset Bridge
 * keys: PNG CONFORMANCE CHUNKS APNG LIMITS SAFE-TO-COPY BOMB GUARD
 * purpose: reject structurally unsafe/unsupported PNGs before any transform and apply PNG editor safe-to-copy rules
 * public-api: inspectPngStructure(), isPngChunkSafeToCopy(), sanitizeChunksForCriticalRewrite()
 * state-owned: none; pure validation
 * online: N/A; creator/build-time capability
 * do-not: silently accept APNG/unknown critical chunks or allocate based on untrusted dimensions without budgets
 */

const SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const KNOWN_CRITICAL=new Set(['IHDR','PLTE','IDAT','IEND']);
const KNOWN_ANCILLARY=new Set([
  'cHRM','gAMA','iCCP','sBIT','sRGB','cICP','mDCV','cLLI','bKGD','hIST','tRNS','pHYs','sPLT','tIME','eXIf','tEXt','zTXt','iTXt',
  'acTL','fcTL','fdAT'
]);
const CRITICAL_REWRITE_SAFE_KNOWN=new Set([
  'cHRM','gAMA','iCCP','sRGB','cICP','mDCV','cLLI','pHYs','tIME','eXIf','tEXt','zTXt','iTXt','sPLT'
]);
const DEPTHS={0:new Set([1,2,4,8,16]),2:new Set([8,16]),3:new Set([1,2,4,8]),4:new Set([8,16]),6:new Set([8,16])};
const CHANNELS={0:1,2:3,3:1,4:2,6:4};

export const DEFAULT_PNG_LIMITS=Object.freeze({
  maxFileBytes:128*1024*1024,
  maxPixels:100_000_000,
  maxDecodedBytes:512*1024*1024,
  maxChunkBytes:64*1024*1024,
  maxAncillaryBytes:32*1024*1024,
  maxChunks:100_000
});

function isLetter(ch){return /^[A-Za-z]$/.test(ch);}
function isLower(ch){return ch===ch.toLowerCase()&&ch!==ch.toUpperCase();}
export function isPngChunkSafeToCopy(type){return typeof type==='string'&&type.length===4&&isLower(type[3]);}
export function isPngChunkAncillary(type){return typeof type==='string'&&type.length===4&&isLower(type[0]);}

function fail(code,detail=''){
  const error=new Error(detail?`${code}:${detail}`:code);
  error.code=code;
  throw error;
}

export function inspectPngStructure(buffer,options={}){
  const limits={...DEFAULT_PNG_LIMITS,...(options.limits||{})};
  if(!Buffer.isBuffer(buffer)||buffer.length<33||!buffer.subarray(0,8).equals(SIGNATURE)) fail('PNG_GUARD_INVALID_SIGNATURE');
  if(buffer.length>limits.maxFileBytes) fail('PNG_GUARD_FILE_BUDGET',`${buffer.length}>${limits.maxFileBytes}`);
  const chunks=[];
  let offset=8, ancillaryBytes=0, sawIend=false, idatClosed=false, sawIdat=false;
  while(offset+12<=buffer.length){
    if(chunks.length>=limits.maxChunks) fail('PNG_GUARD_CHUNK_COUNT');
    const length=buffer.readUInt32BE(offset);
    const type=buffer.toString('ascii',offset+4,offset+8);
    if(type.length!==4||[...type].some(ch=>!isLetter(ch))) fail('PNG_GUARD_CHUNK_NAME',type);
    if(isLower(type[2])) fail('PNG_GUARD_RESERVED_BIT',type);
    const dataStart=offset+8, dataEnd=dataStart+length, next=dataEnd+4;
    if(length>limits.maxChunkBytes) fail('PNG_GUARD_CHUNK_BUDGET',`${type}:${length}`);
    if(next>buffer.length) fail('PNG_GUARD_TRUNCATED',type);
    const ancillary=isPngChunkAncillary(type);
    if(ancillary){ancillaryBytes+=length;if(ancillaryBytes>limits.maxAncillaryBytes) fail('PNG_GUARD_ANCILLARY_BUDGET');}
    else if(!KNOWN_CRITICAL.has(type)) fail('PNG_GUARD_UNKNOWN_CRITICAL',type);
    if(!ancillary&&!KNOWN_CRITICAL.has(type)) fail('PNG_GUARD_UNKNOWN_CRITICAL',type);
    if(type==='IHDR'&&chunks.length!==0) fail('PNG_GUARD_IHDR_ORDER');
    if(type==='IDAT'){
      if(idatClosed) fail('PNG_GUARD_IDAT_NONCONTIGUOUS');
      sawIdat=true;
    }else if(sawIdat&&type!=='IEND') idatClosed=true;
    chunks.push({type,length,offset,dataStart,dataEnd,ancillary,safeToCopy:isPngChunkSafeToCopy(type),known:KNOWN_CRITICAL.has(type)||KNOWN_ANCILLARY.has(type)});
    offset=next;
    if(type==='IEND'){sawIend=true;break;}
  }
  if(!chunks.length||chunks[0].type!=='IHDR') fail('PNG_GUARD_MISSING_IHDR');
  if(!sawIdat) fail('PNG_GUARD_MISSING_IDAT');
  if(!sawIend) fail('PNG_GUARD_MISSING_IEND');
  if(offset!==buffer.length) fail('PNG_GUARD_TRAILING_DATA',`${buffer.length-offset}`);
  if(chunks.filter(c=>c.type==='IHDR').length!==1||chunks.filter(c=>c.type==='IEND').length!==1) fail('PNG_GUARD_DUPLICATE_CRITICAL');
  const ihdrStart=chunks[0].dataStart;
  if(chunks[0].length!==13) fail('PNG_GUARD_IHDR_LENGTH');
  const width=buffer.readUInt32BE(ihdrStart), height=buffer.readUInt32BE(ihdrStart+4), bitDepth=buffer[ihdrStart+8], colorType=buffer[ihdrStart+9], compression=buffer[ihdrStart+10], filter=buffer[ihdrStart+11], interlace=buffer[ihdrStart+12];
  if(!width||!height) fail('PNG_GUARD_DIMENSIONS');
  if(!DEPTHS[colorType]?.has(bitDepth)) fail('PNG_GUARD_COLOR_DEPTH',`${colorType}/${bitDepth}`);
  if(compression!==0) fail('PNG_GUARD_COMPRESSION_METHOD',String(compression));
  if(filter!==0) fail('PNG_GUARD_FILTER_METHOD',String(filter));
  if(interlace!==0&&interlace!==1) fail('PNG_GUARD_INTERLACE_METHOD',String(interlace));
  const pixels=width*height;
  if(!Number.isSafeInteger(pixels)||pixels>limits.maxPixels) fail('PNG_GUARD_PIXEL_BUDGET',`${pixels}>${limits.maxPixels}`);
  const channels=CHANNELS[colorType];
  const rowBytes=Math.ceil(width*channels*bitDepth/8);
  const decodedUpperBound=interlace===0?(rowBytes+1)*height:Math.ceil(width*height*channels*bitDepth/8)+height*8+64;
  if(!Number.isSafeInteger(decodedUpperBound)||decodedUpperBound>limits.maxDecodedBytes) fail('PNG_GUARD_DECODE_BUDGET',`${decodedUpperBound}>${limits.maxDecodedBytes}`);
  const apng=chunks.some(c=>c.type==='acTL'||c.type==='fcTL'||c.type==='fdAT');
  if(apng&&options.rejectApng!==false) fail('PNG_GUARD_APNG_UNSUPPORTED');
  if(interlace===1&&options.rejectInterlaced!==false) fail('PNG_GUARD_INTERLACE_UNSUPPORTED');
  if(bitDepth===16&&options.reject16Bit!==false) fail('PNG_GUARD_16BIT_UNSUPPORTED');
  return {version:'kelo-png-conformance-v1',width,height,bitDepth,colorType,compression,filter,interlace,pixels,rowBytes,decodedUpperBound,apng,chunks,limits};
}

export function sanitizeChunksForCriticalRewrite(chunks,excluded=new Set()){
  const kept=[];
  const dropped=[];
  for(const chunk of chunks||[]){
    if(excluded.has(chunk.type)){dropped.push({type:chunk.type,reason:'excluded'});continue;}
    if(KNOWN_CRITICAL.has(chunk.type)){kept.push(chunk);continue;}
    if(CRITICAL_REWRITE_SAFE_KNOWN.has(chunk.type)||isPngChunkSafeToCopy(chunk.type)) kept.push(chunk);
    else dropped.push({type:chunk.type,reason:chunk.known?'critical-rewrite-dependency':'unknown-unsafe-to-copy'});
  }
  return {kept,dropped};
}
