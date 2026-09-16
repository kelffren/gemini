/* KELO-INDEX
 * area: CREATORS / ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG COMPRESS LOSSLESS PALETTE BIT DEPTH COLOR TYPE ALPHA DROP TRNS GRAYSCALE QUALITY GATE CONFORMANCE
 * purpose: reduce PNG byte size while proving decoded pixels remain identical and refusing structures the local decoder cannot fully prove
 * public-api: optimizePngLossless(), decodePngRgba(), encodeRgbaPng()
 * state-owned: none; pure byte transformation + audit metadata
 * online: N/A; creator/build-time capability only
 * do-not: resize, resample, transform APNG/Adam7/16-bit locally, or accept a candidate that fails strict equality
 */

import zlib from 'node:zlib';
import {evaluatePixelFidelity, judgePixelFidelity} from './png-quality-agent.mjs';
import {inspectPngStructure, sanitizeChunksForCriticalRewrite} from './png-conformance-guard.mjs';

const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const COLOR_CHANNELS=new Map([[0,1],[2,3],[3,1],[4,2],[6,4]]);
const PALETTE_BLOCKERS=new Set(['bKGD','hIST','sBIT']);
const ALPHA_DROP_BLOCKERS=new Set(['PLTE','tRNS','sBIT']);
const GRAYSCALE_BLOCKERS=new Set(['PLTE','bKGD','hIST','sBIT','iCCP','cICP','sRGB','gAMA','cHRM','mDCV','cLLI']);
const TRNS_REDUCTION_BLOCKERS=new Set(['PLTE','tRNS','bKGD','hIST','sBIT']);

const CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n+=1){let c=n;for(let k=0;k<8;k+=1)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table;})();
function crc32(buffer){let c=0xffffffff;for(const value of buffer)c=CRC_TABLE[(c^value)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function makeChunk(type,data=Buffer.alloc(0)){const typeBuffer=Buffer.from(type,'ascii');const length=Buffer.allocUnsafe(4);length.writeUInt32BE(data.length,0);const crc=Buffer.allocUnsafe(4);crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer,data])),0);return Buffer.concat([length,typeBuffer,data,crc]);}

function parseChunks(buffer){
  const chunks=[];let offset=8;
  while(offset+12<=buffer.length){
    const length=buffer.readUInt32BE(offset),type=buffer.toString('ascii',offset+4,offset+8),dataStart=offset+8,dataEnd=dataStart+length;
    if(dataEnd+4>buffer.length)throw new Error(`PNG_SPACE_TRUNCATED_CHUNK:${type}`);
    const data=buffer.subarray(dataStart,dataEnd),expected=buffer.readUInt32BE(dataEnd),actual=crc32(Buffer.concat([Buffer.from(type,'ascii'),data]));
    if(expected!==actual)throw new Error(`PNG_SPACE_CRC_MISMATCH:${type}`);
    chunks.push({type,data:Buffer.from(data),known:true});offset=dataEnd+4;if(type==='IEND')break;
  }
  return chunks;
}
function readIhdr(chunks){const data=chunks.find(c=>c.type==='IHDR')?.data;if(!data||data.length!==13)throw new Error('PNG_SPACE_INVALID_IHDR');return{width:data.readUInt32BE(0),height:data.readUInt32BE(4),bitDepth:data[8],colorType:data[9],compression:data[10],filter:data[11],interlace:data[12]};}
function paeth(a,b,c){const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:(pb<=pc?b:c);}

function assertSupported(ihdr){
  if(ihdr.compression!==0)throw new Error(`PNG_SPACE_UNSUPPORTED_COMPRESSION:${ihdr.compression}`);
  if(ihdr.filter!==0)throw new Error(`PNG_SPACE_UNSUPPORTED_FILTER_METHOD:${ihdr.filter}`);
  if(ihdr.interlace!==0)throw new Error('PNG_SPACE_UNSUPPORTED_INTERLACE');
  const channels=COLOR_CHANNELS.get(ihdr.colorType);if(!channels)throw new Error(`PNG_SPACE_UNSUPPORTED_COLOR_TYPE:${ihdr.colorType}`);
  const allowed=(ihdr.colorType===0||ihdr.colorType===3)?[1,2,4,8]:[8];
  if(!allowed.includes(ihdr.bitDepth))throw new Error(`PNG_SPACE_UNSUPPORTED_BIT_DEPTH:${ihdr.bitDepth}`);
  const bitsPerPixel=channels*ihdr.bitDepth;
  return{channels,rowBytes:Math.ceil(ihdr.width*bitsPerPixel/8),filterBpp:Math.max(1,Math.ceil(bitsPerPixel/8))};
}

function unfilterByteRows(inflated,rowBytes,height,filterBpp){
  const expected=height*(rowBytes+1);if(inflated.length!==expected)throw new Error(`PNG_SPACE_INFLATE_LENGTH:${inflated.length}:${expected}`);
  const raw=Buffer.alloc(rowBytes*height);let read=0;
  for(let y=0;y<height;y+=1){const filter=inflated[read++];if(filter>4)throw new Error(`PNG_SPACE_UNSUPPORTED_FILTER:${filter}`);const rowStart=y*rowBytes,prevStart=rowStart-rowBytes;for(let x=0;x<rowBytes;x+=1){const encoded=inflated[read++],left=x>=filterBpp?raw[rowStart+x-filterBpp]:0,up=y?raw[prevStart+x]:0,upperLeft=y&&x>=filterBpp?raw[prevStart+x-filterBpp]:0,predictor=filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,upperLeft);raw[rowStart+x]=(encoded+predictor)&255;}}
  return raw;
}
function unpackSubByteRows(packed,width,height,bitDepth,colorType){const rowBytes=Math.ceil(width*bitDepth/8),mask=(1<<bitDepth)-1,samples=Buffer.alloc(width*height);let write=0;for(let y=0;y<height;y+=1){const rowStart=y*rowBytes;for(let x=0;x<width;x+=1){const bitOffset=x*bitDepth,byte=packed[rowStart+(bitOffset>>3)],shift=8-bitDepth-(bitOffset&7),value=(byte>>shift)&mask;samples[write++]=colorType===0?Math.round(value*255/mask):value;}}return samples;}
function transparentKeys(ihdr,transparency){if(!transparency)return{gray:null,rgb:null};if(ihdr.colorType===0){if(transparency.length!==2)throw new Error(`PNG_SPACE_INVALID_TRNS_LENGTH:0:${transparency.length}`);const mask=(1<<ihdr.bitDepth)-1,raw=transparency.readUInt16BE(0)&mask,gray=ihdr.bitDepth===8?raw:Math.round(raw*255/mask);return{gray,rgb:null};}if(ihdr.colorType===2){if(transparency.length!==6)throw new Error(`PNG_SPACE_INVALID_TRNS_LENGTH:2:${transparency.length}`);return{gray:null,rgb:[transparency.readUInt16BE(0)&255,transparency.readUInt16BE(2)&255,transparency.readUInt16BE(4)&255]};}return{gray:null,rgb:null};}
function samplesToRgba(samples,ihdr,chunks){
  const{width,height,colorType}=ihdr,channels=COLOR_CHANNELS.get(colorType),rgba=Buffer.alloc(width*height*4),palette=chunks.find(c=>c.type==='PLTE')?.data||null,transparency=chunks.find(c=>c.type==='tRNS')?.data||null,transparent=transparentKeys(ihdr,transparency);
  if(colorType===3&&(!palette||palette.length<3))throw new Error('PNG_SPACE_PALETTE_MISSING');
  if((colorType===4||colorType===6)&&transparency)throw new Error(`PNG_SPACE_TRNS_WITH_EXPLICIT_ALPHA:${colorType}`);
  for(let pixel=0;pixel<width*height;pixel+=1){const source=pixel*channels,target=pixel*4;if(colorType===6){rgba[target]=samples[source];rgba[target+1]=samples[source+1];rgba[target+2]=samples[source+2];rgba[target+3]=samples[source+3];}else if(colorType===2){const r=samples[source],g=samples[source+1],b=samples[source+2];rgba[target]=r;rgba[target+1]=g;rgba[target+2]=b;rgba[target+3]=transparent.rgb&&r===transparent.rgb[0]&&g===transparent.rgb[1]&&b===transparent.rgb[2]?0:255;}else if(colorType===4){const gray=samples[source];rgba[target]=rgba[target+1]=rgba[target+2]=gray;rgba[target+3]=samples[source+1];}else if(colorType===0){const gray=samples[source];rgba[target]=rgba[target+1]=rgba[target+2]=gray;rgba[target+3]=transparent.gray!==null&&gray===transparent.gray?0:255;}else{const index=samples[source],pi=index*3;if(pi+2>=palette.length)throw new Error(`PNG_SPACE_PALETTE_INDEX:${index}`);rgba[target]=palette[pi];rgba[target+1]=palette[pi+1];rgba[target+2]=palette[pi+2];rgba[target+3]=transparency?.[index]??255;}}
  return rgba;
}

export function decodePngRgba(buffer,options={}){
  const structure=inspectPngStructure(buffer,{limits:options.limits,rejectApng:true,rejectInterlaced:true,reject16Bit:true});
  const chunks=parseChunks(buffer),ihdr=readIhdr(chunks),layout=assertSupported(ihdr),compressed=Buffer.concat(chunks.filter(c=>c.type==='IDAT').map(c=>c.data));
  const maxOutputLength=Math.max(1,Math.min(structure.decodedUpperBound,structure.limits.maxDecodedBytes));
  const inflated=zlib.inflateSync(compressed,{maxOutputLength});
  const packedSamples=unfilterByteRows(inflated,layout.rowBytes,ihdr.height,layout.filterBpp),samples=ihdr.bitDepth<8?unpackSubByteRows(packedSamples,ihdr.width,ihdr.height,ihdr.bitDepth,ihdr.colorType):packedSamples,rgba=samplesToRgba(samples,ihdr,chunks);
  return{chunks,ihdr,structure,channels:layout.channels,rowBytes:layout.rowBytes,filterBpp:layout.filterBpp,samples,packedSamples,rgba};
}

function predictorForFilter(filter,left,up,upperLeft){return filter===0?0:filter===1?left:filter===2?up:filter===3?Math.floor((left+up)/2):paeth(left,up,upperLeft);}
function filteredRow(samples,rowStart,rowBytes,filterBpp,y,filter){const output=Buffer.allocUnsafe(rowBytes),prevStart=rowStart-rowBytes;let cost=0;for(let x=0;x<rowBytes;x+=1){const raw=samples[rowStart+x],left=x>=filterBpp?samples[rowStart+x-filterBpp]:0,up=y?samples[prevStart+x]:0,upperLeft=y&&x>=filterBpp?samples[prevStart+x-filterBpp]:0,value=(raw-predictorForFilter(filter,left,up,upperLeft)+256)&255;output[x]=value;cost+=Math.min(value,256-value);}return{output,cost};}
function filterByteRows(samples,rowBytes,height,filterBpp,strategy='adaptive'){const result=Buffer.allocUnsafe(height*(rowBytes+1));let write=0;for(let y=0;y<height;y+=1){const rowStart=y*rowBytes;let selected;if(strategy==='adaptive'){for(let filter=0;filter<=4;filter+=1){const candidate=filteredRow(samples,rowStart,rowBytes,filterBpp,y,filter);if(!selected||candidate.cost<selected.cost)selected={...candidate,filter};}}else{const filter=Number(strategy);selected={...filteredRow(samples,rowStart,rowBytes,filterBpp,y,filter),filter};}result[write++]=selected.filter;selected.output.copy(result,write);write+=rowBytes;}return result;}
function filterScanlines(samples,width,height,channels,strategy='adaptive'){return filterByteRows(samples,width*channels,height,channels,strategy);}
function rebuildWithIdat(chunks,compressed){const output=[PNG_SIGNATURE];let inserted=false;for(const chunk of chunks){if(chunk.type==='IDAT'){if(!inserted){output.push(makeChunk('IDAT',compressed));inserted=true;}continue;}output.push(makeChunk(chunk.type,chunk.data));}return Buffer.concat(output);}
function makeIhdr({width,height,bitDepth=8,colorType,compression=0,filter=0,interlace=0}){const data=Buffer.alloc(13);data.writeUInt32BE(width,0);data.writeUInt32BE(height,4);data[8]=bitDepth;data[9]=colorType;data[10]=compression;data[11]=filter;data[12]=interlace;return data;}
function buildFreshPng({ihdr,preIdat=[],idat,postIdat=[]}){return Buffer.concat([PNG_SIGNATURE,makeChunk('IHDR',makeIhdr(ihdr)),...preIdat.map(c=>makeChunk(c.type,c.data)),makeChunk('IDAT',idat),...postIdat.map(c=>makeChunk(c.type,c.data)),makeChunk('IEND')]);}

function chunkPartitions(decoded,excluded,blockers=null){
  if(blockers&&decoded.chunks.some(c=>blockers.has(c.type)))return null;
  const firstIdat=decoded.chunks.findIndex(c=>c.type==='IDAT');let lastIdat=firstIdat;for(let i=firstIdat+1;i<decoded.chunks.length;i+=1)if(decoded.chunks[i].type==='IDAT')lastIdat=i;
  const preRaw=decoded.chunks.slice(1,firstIdat).filter(c=>!excluded.has(c.type)),postRaw=decoded.chunks.slice(lastIdat+1).filter(c=>!excluded.has(c.type));
  const pre=sanitizeChunksForCriticalRewrite(preRaw,excluded),post=sanitizeChunksForCriticalRewrite(postRaw,excluded);
  return{preIdat:pre.kept,postIdat:post.kept,droppedChunks:[...pre.dropped,...post.dropped]};
}

function packSamples(values,width,height,bitDepth){if(bitDepth===8)return Buffer.from(values);const rowBytes=Math.ceil(width*bitDepth/8),packed=Buffer.alloc(rowBytes*height),mask=(1<<bitDepth)-1;for(let y=0;y<height;y+=1){const rowStart=y*rowBytes;for(let x=0;x<width;x+=1){const value=values[y*width+x]&mask,bitOffset=x*bitDepth,byteOffset=rowStart+(bitOffset>>3),shift=8-bitDepth-(bitOffset&7);packed[byteOffset]|=value<<shift;}}return packed;}
function quantizedGray(gray,bitDepth){if(bitDepth===8)return gray;const mask=(1<<bitDepth)-1,raw=Math.round(gray*mask/255);return Math.round(raw*255/mask)===gray?raw:null;}
function minimalGrayDepth(values){for(const depth of[1,2,4]){let ok=true;for(const gray of values)if(quantizedGray(gray,depth)===null){ok=false;break;}if(ok)return depth;}return 8;}

function paletteRepresentation(decoded){
  if(decoded.ihdr.colorType===3)return null;const partitions=chunkPartitions(decoded,new Set(['IHDR','PLTE','tRNS','IDAT','IEND']),PALETTE_BLOCKERS);if(!partitions)return null;
  const map=new Map(),colors=[],indexes=Buffer.alloc(decoded.ihdr.width*decoded.ihdr.height),rgba=decoded.rgba;
  for(let pixel=0;pixel<indexes.length;pixel+=1){const o=pixel*4,key=((((rgba[o]<<24)>>>0)|(rgba[o+1]<<16)|(rgba[o+2]<<8)|rgba[o+3])>>>0);let index=map.get(key);if(index===undefined){if(colors.length>=256)return null;index=colors.length;map.set(key,index);colors.push([rgba[o],rgba[o+1],rgba[o+2],rgba[o+3]]);}indexes[pixel]=index;}
  const plte=Buffer.alloc(colors.length*3);let lastTransparent=-1;colors.forEach((c,i)=>{plte[i*3]=c[0];plte[i*3+1]=c[1];plte[i*3+2]=c[2];if(c[3]!==255)lastTransparent=i;});const trns=lastTransparent>=0?Buffer.from(colors.slice(0,lastTransparent+1).map(c=>c[3])):null,bitDepth=colors.length<=2?1:colors.length<=4?2:colors.length<=16?4:8;return{...partitions,indexes,plte,trns,colorCount:colors.length,bitDepth};
}
function palettePng(decoded,r,filterStrategy,zlibOptions){const packed=packSamples(r.indexes,decoded.ihdr.width,decoded.ihdr.height,r.bitDepth),rowBytes=Math.ceil(decoded.ihdr.width*r.bitDepth/8),filtered=filterByteRows(packed,rowBytes,decoded.ihdr.height,1,filterStrategy),compressed=zlib.deflateSync(filtered,zlibOptions),pre=[...r.preIdat,{type:'PLTE',data:r.plte}];if(r.trns)pre.push({type:'tRNS',data:r.trns});return buildFreshPng({ihdr:{...decoded.ihdr,bitDepth:r.bitDepth,colorType:3},preIdat:pre,idat:compressed,postIdat:r.postIdat});}

function alphaDropRepresentation(decoded){if(![4,6].includes(decoded.ihdr.colorType)||decoded.ihdr.bitDepth!==8||decoded.chunks.some(c=>ALPHA_DROP_BLOCKERS.has(c.type)))return null;const rgba=decoded.rgba;for(let o=3;o<rgba.length;o+=4)if(rgba[o]!==255)return null;const targetColorType=decoded.ihdr.colorType===6?2:0,targetChannels=targetColorType===2?3:1,samples=Buffer.alloc(decoded.ihdr.width*decoded.ihdr.height*targetChannels);let w=0;for(let o=0;o<rgba.length;o+=4){if(targetColorType===2){samples[w++]=rgba[o];samples[w++]=rgba[o+1];samples[w++]=rgba[o+2];}else samples[w++]=rgba[o];}const partitions=chunkPartitions(decoded,new Set(['IHDR','PLTE','tRNS','IDAT','IEND']));return partitions?{...partitions,samples,targetColorType,targetChannels}:null;}
function alphaDropPng(decoded,r,filterStrategy,zlibOptions){const filtered=filterScanlines(r.samples,decoded.ihdr.width,decoded.ihdr.height,r.targetChannels,filterStrategy),compressed=zlib.deflateSync(filtered,zlibOptions);return buildFreshPng({ihdr:{...decoded.ihdr,bitDepth:8,colorType:r.targetColorType},preIdat:r.preIdat,idat:compressed,postIdat:r.postIdat});}

function grayscaleRepresentation(decoded){
  if(![2,6].includes(decoded.ihdr.colorType)||decoded.ihdr.bitDepth!==8||decoded.chunks.some(c=>GRAYSCALE_BLOCKERS.has(c.type)))return null;
  const rgba=decoded.rgba,count=decoded.ihdr.width*decoded.ihdr.height,grays=Buffer.alloc(count),alphas=Buffer.alloc(count);let allOpaque=true,binaryAlpha=true;for(let p=0;p<count;p+=1){const o=p*4,r=rgba[o],g=rgba[o+1],b=rgba[o+2],a=rgba[o+3];if(r!==g||g!==b)return null;grays[p]=r;alphas[p]=a;if(a!==255)allOpaque=false;if(a!==0&&a!==255)binaryAlpha=false;}
  const partitions=chunkPartitions(decoded,new Set(['IHDR','PLTE','tRNS','IDAT','IEND']));if(!partitions)return null;
  if(allOpaque){const depth=minimalGrayDepth(grays);return{...partitions,targetColorType:0,bitDepth:depth,grays,alphas:null,trnsRaw:null};}
  if(binaryAlpha){let transparentGray=null,conflict=false;const opaqueGrays=new Set();for(let p=0;p<count;p+=1){if(alphas[p]===255)opaqueGrays.add(grays[p]);else if(transparentGray===null)transparentGray=grays[p];else if(transparentGray!==grays[p])conflict=true;}if(!conflict&&transparentGray!==null&&!opaqueGrays.has(transparentGray)){const depth=minimalGrayDepth(grays),raw=quantizedGray(transparentGray,depth);if(raw!==null)return{...partitions,targetColorType:0,bitDepth:depth,grays,alphas:null,trnsRaw:raw};}}
  return{...partitions,targetColorType:4,bitDepth:8,grays,alphas,trnsRaw:null};
}
function grayscalePng(decoded,r,filterStrategy,zlibOptions){let packed,rowBytes,filterBpp,pre=[...r.preIdat];if(r.targetColorType===0){const samples=r.bitDepth===8?r.grays:Buffer.from([...r.grays].map(g=>quantizedGray(g,r.bitDepth))),packedRows=packSamples(samples,decoded.ihdr.width,decoded.ihdr.height,r.bitDepth);packed=packedRows;rowBytes=Math.ceil(decoded.ihdr.width*r.bitDepth/8);filterBpp=1;if(r.trnsRaw!==null){const trns=Buffer.alloc(2);trns.writeUInt16BE(r.trnsRaw,0);pre.push({type:'tRNS',data:trns});}}else{packed=Buffer.alloc(decoded.ihdr.width*decoded.ihdr.height*2);for(let p=0;p<r.grays.length;p+=1){packed[p*2]=r.grays[p];packed[p*2+1]=r.alphas[p];}rowBytes=decoded.ihdr.width*2;filterBpp=2;}const filtered=filterByteRows(packed,rowBytes,decoded.ihdr.height,filterBpp,filterStrategy),compressed=zlib.deflateSync(filtered,zlibOptions);return buildFreshPng({ihdr:{...decoded.ihdr,bitDepth:r.bitDepth,colorType:r.targetColorType},preIdat:pre,idat:compressed,postIdat:r.postIdat});}

function trnsRepresentation(decoded){
  if(decoded.ihdr.colorType!==6||decoded.ihdr.bitDepth!==8||decoded.chunks.some(c=>TRNS_REDUCTION_BLOCKERS.has(c.type)))return null;const rgba=decoded.rgba;let key=null;const opaque=new Set();for(let o=0;o<rgba.length;o+=4){const a=rgba[o+3],rgb=(rgba[o]<<16)|(rgba[o+1]<<8)|rgba[o+2];if(a===255)opaque.add(rgb);else if(a===0){if(key===null)key=rgb;else if(key!==rgb)return null;}else return null;}if(key===null||opaque.has(key))return null;const samples=Buffer.alloc(decoded.ihdr.width*decoded.ihdr.height*3);let w=0;for(let o=0;o<rgba.length;o+=4){samples[w++]=rgba[o];samples[w++]=rgba[o+1];samples[w++]=rgba[o+2];}const partitions=chunkPartitions(decoded,new Set(['IHDR','PLTE','tRNS','IDAT','IEND']));return partitions?{...partitions,samples,key}:null;
}
function trnsPng(decoded,r,filterStrategy,zlibOptions){const filtered=filterScanlines(r.samples,decoded.ihdr.width,decoded.ihdr.height,3,filterStrategy),compressed=zlib.deflateSync(filtered,zlibOptions),trns=Buffer.alloc(6);trns.writeUInt16BE((r.key>>16)&255,0);trns.writeUInt16BE((r.key>>8)&255,2);trns.writeUInt16BE(r.key&255,4);return buildFreshPng({ihdr:{...decoded.ihdr,bitDepth:8,colorType:2},preIdat:[...r.preIdat,{type:'tRNS',data:trns}],idat:compressed,postIdat:r.postIdat});}

function candidateRecord(kind,label,buffer){return{kind,label,buffer,bytes:buffer.length,tested:false,accepted:null,quality:null,qualityScore:null,error:null};}
function validateCandidate(candidate,original){try{const decoded=decodePngRgba(candidate.buffer),quality=evaluatePixelFidelity(original.rgba,decoded.rgba,original.ihdr.width,original.ihdr.height),verdict=judgePixelFidelity(quality,'strict');return{...candidate,tested:true,quality,verdict,accepted:verdict.pass,qualityScore:verdict.score};}catch(error){return{...candidate,tested:true,quality:{comparable:false,exactPixels:false,changedPixels:null,maxRgbDelta:null},accepted:false,qualityScore:0,error:String(error?.message||error)};}}
function zlibProfiles(){return[{name:'default-l6',options:{level:6,strategy:zlib.constants.Z_DEFAULT_STRATEGY}},{name:'default-l9',options:{level:9,strategy:zlib.constants.Z_DEFAULT_STRATEGY}},{name:'filtered-l9',options:{level:9,strategy:zlib.constants.Z_FILTERED}},{name:'rle-l9',options:{level:9,strategy:zlib.constants.Z_RLE}}];}

export function optimizePngLossless(buffer,options={}){
  const originalBytes=buffer.length;let decoded;try{decoded=decodePngRgba(buffer,options);}catch(error){return{buffer,report:{status:'skipped',reason:String(error?.message||error),reasonCode:error?.code||null,originalBytes,optimizedBytes:originalBytes,savedBytes:0,savedPercent:0,exactPixels:null,qualityScore:null,candidates:[]}};}
  const filterStrategies=options.filterStrategies||['adaptive',0,1,2,3,4],profiles=zlibProfiles(),candidates=[candidateRecord('original','original',buffer)];
  for(const filterStrategy of filterStrategies){const filtered=filterByteRows(decoded.packedSamples,decoded.rowBytes,decoded.ihdr.height,decoded.filterBpp,filterStrategy);for(const profile of profiles)candidates.push(candidateRecord('refilter',`refilter:${filterStrategy}:${profile.name}`,rebuildWithIdat(decoded.chunks,zlib.deflateSync(filtered,profile.options))));}
  const structural=[];
  if(options.disableColorReduction!==true){const alphaDrop=alphaDropRepresentation(decoded);if(alphaDrop)structural.push({kind:'exact-alpha-drop',name:`alpha-drop:${decoded.ihdr.colorType}->${alphaDrop.targetColorType}`,rep:alphaDrop,build:alphaDropPng});const gray=grayscaleRepresentation(decoded);if(gray)structural.push({kind:'exact-grayscale',name:`grayscale:${gray.targetColorType}:${gray.bitDepth}b`,rep:gray,build:grayscalePng});const trns=trnsRepresentation(decoded);if(trns)structural.push({kind:'exact-trns',name:'trns:rgba->rgb-key',rep:trns,build:trnsPng});}
  for(const transform of structural)for(const filterStrategy of filterStrategies)for(const profile of profiles)candidates.push(candidateRecord(transform.kind,`${transform.name}:${filterStrategy}:${profile.name}`,transform.build(decoded,transform.rep,filterStrategy,profile.options)));
  const palette=options.disablePalette===true?null:paletteRepresentation(decoded);if(palette){const paletteFilters=options.paletteFilterStrategies||filterStrategies;for(const filterStrategy of paletteFilters)for(const profile of profiles)candidates.push(candidateRecord('exact-palette',`palette:${palette.colorCount}:${palette.bitDepth}b:${filterStrategy}:${profile.name}`,palettePng(decoded,palette,filterStrategy,profile.options)));}
  const ordered=candidates.slice().sort((a,b)=>a.bytes-b.bytes||a.label.localeCompare(b.label)),validatedByLabel=new Map();let winner=null;for(const candidate of ordered){const validated=validateCandidate(candidate,decoded);validatedByLabel.set(candidate.label,validated);if(validated.accepted){winner=validated;break;}}if(!winner)winner=validateCandidate(candidates[0],decoded);
  const savedBytes=Math.max(0,originalBytes-winner.bytes),savedPercent=originalBytes?savedBytes/originalBytes*100:0;
  const kinds=new Map(structural.map(t=>[t.kind,t.rep]));
  return{buffer:winner.buffer,report:{status:winner.bytes<originalBytes?'optimized':'unchanged',originalBytes,optimizedBytes:winner.bytes,savedBytes,savedPercent:Number(savedPercent.toFixed(3)),exactPixels:winner.quality.exactPixels,qualityScore:winner.qualityScore,winner:{kind:winner.kind,label:winner.label,bytes:winner.bytes},source:{width:decoded.ihdr.width,height:decoded.ihdr.height,colorType:decoded.ihdr.colorType,bitDepth:decoded.ihdr.bitDepth},conformance:{version:decoded.structure.version,apng:false,decodedUpperBound:decoded.structure.decodedUpperBound},alphaDropCandidate:kinds.get('exact-alpha-drop')?{fromColorType:decoded.ihdr.colorType,toColorType:kinds.get('exact-alpha-drop').targetColorType}:null,grayscaleCandidate:kinds.get('exact-grayscale')?{colorType:kinds.get('exact-grayscale').targetColorType,bitDepth:kinds.get('exact-grayscale').bitDepth,usesTrns:kinds.get('exact-grayscale').trnsRaw!==null}:null,trnsCandidate:Boolean(kinds.get('exact-trns')),paletteCandidate:palette?{exactColors:palette.colorCount,bitDepth:palette.bitDepth}:null,candidates:candidates.map(candidate=>{const v=validatedByLabel.get(candidate.label);return{kind:candidate.kind,label:candidate.label,bytes:candidate.bytes,tested:Boolean(v),accepted:v?.accepted??null,exactPixels:v?.quality?.exactPixels??null,changedPixels:v?.quality?.changedPixels??null,maxRgbDelta:v?.quality?.maxRgbDelta??null,error:v?.error||null};})}};
}

export function encodeRgbaPng(rgba,width,height,{level=6,filterStrategy=0}={}){if(!rgba||rgba.length!==width*height*4)throw new Error('PNG_SPACE_RGBA_LENGTH');const samples=Buffer.from(rgba),filtered=filterScanlines(samples,width,height,4,filterStrategy),idat=zlib.deflateSync(filtered,{level});return buildFreshPng({ihdr:{width,height,bitDepth:8,colorType:6,compression:0,filter:0,interlace:0},idat});}
