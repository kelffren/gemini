/* KELO-INDEX
 * area: BUILD / CREATOR ASSET LAB
 * owner: Kelo Creator Asset Bridge
 * keys: EXACT RECONSTRUCTION TILE DEDUP REVERSIBLE RGBA INFORMATION
 * purpose: detect repeated RGBA blocks and prove exact reversible tile-map representations before any runtime adoption
 * public-api: buildExactTilePlan(), reconstructExactTilePlan(), searchExactTilePlans()
 * state-owned: none
 * online: N/A; laboratory only
 * do-not: replace PNG SOURCE or introduce a runtime decoder automatically
 */
import crypto from 'node:crypto';
const hash=buffer=>crypto.createHash('sha256').update(buffer).digest('hex');
function assertInput(rgba,width,height){if(!Buffer.isBuffer(rgba)&&!(rgba instanceof Uint8Array))throw new Error('EXACT_RECONSTRUCTION_RGBA_REQUIRED');if(!(width>0&&height>0)||rgba.length!==width*height*4)throw new Error('EXACT_RECONSTRUCTION_DIMENSIONS_INVALID');}
function extractTile(rgba,width,x0,y0,size){const out=Buffer.alloc(size*size*4);let o=0;for(let y=0;y<size;y++){const start=((y0+y)*width+x0)*4;Buffer.from(rgba.buffer,rgba.byteOffset+start,size*4).copy(out,o);o+=size*4;}return out;}
export function buildExactTilePlan(rgba,width,height,tileSize){
  assertInput(rgba,width,height);tileSize=Math.max(1,Math.floor(Number(tileSize)||0));if(width%tileSize||height%tileSize)throw new Error('EXACT_RECONSTRUCTION_TILE_NOT_DIVISIBLE');
  const unique=[],hashBuckets=new Map(),indices=[];
  for(let y=0;y<height;y+=tileSize)for(let x=0;x<width;x+=tileSize){
    const tile=extractTile(rgba,width,x,y,tileSize),h=hash(tile),bucket=hashBuckets.get(h)||[];let index=bucket.find(i=>unique[i].equals(tile));
    if(index==null){index=unique.length;unique.push(tile);bucket.push(index);hashBuckets.set(h,bucket);}indices.push(index);
  }
  const bitsPerIndex=Math.max(1,Math.ceil(Math.log2(Math.max(1,unique.length)))),indexBytes=Math.ceil(indices.length*bitsPerIndex/8),tileBytes=unique.reduce((s,t)=>s+t.length,0),rawBytes=width*height*4,theoreticalBytes=tileBytes+indexBytes+32;
  return Object.freeze({schema:'kelo-exact-tile-plan-v1',width,height,tileSize,columns:width/tileSize,rows:height/tileSize,tileCount:indices.length,uniqueTileCount:unique.length,bitsPerIndex,indexBytes,tileBytes,rawBytes,theoreticalBytes,theoreticalRawSavingBytes:Math.max(0,rawBytes-theoreticalBytes),theoreticalRawSavingPercent:rawBytes?Math.max(0,(rawBytes-theoreticalBytes)/rawBytes*100):0,indices:Object.freeze(indices),uniqueTiles:Object.freeze(unique),sourceRgbaSha256:hash(Buffer.from(rgba))});
}
export function reconstructExactTilePlan(plan){
  const out=Buffer.alloc(plan.width*plan.height*4),size=plan.tileSize;let n=0;
  for(let row=0;row<plan.rows;row++)for(let col=0;col<plan.columns;col++){const tile=plan.uniqueTiles[plan.indices[n++]];for(let y=0;y<size;y++){const srcStart=y*size*4,dstStart=((row*size+y)*plan.width+col*size)*4;tile.copy(out,dstStart,srcStart,srcStart+size*4);}}
  return out;
}
export function searchExactTilePlans(rgba,width,height,{tileSizes=[8,16,32,64]}={}){
  assertInput(rgba,width,height);const candidates=[];
  for(const size of tileSizes){if(width%size||height%size)continue;const plan=buildExactTilePlan(rgba,width,height,size),reconstructed=reconstructExactTilePlan(plan),exact=hash(reconstructed)===plan.sourceRgbaSha256;if(!exact)throw new Error(`EXACT_RECONSTRUCTION_PROOF_FAILED:${size}`);candidates.push({...plan,reconstructionExact:true,uniqueTiles:undefined});}
  candidates.sort((a,b)=>a.theoreticalBytes-b.theoreticalBytes||a.tileSize-b.tileSize);return Object.freeze({schema:'kelo-exact-tile-search-v1',width,height,sourceRgbaSha256:hash(Buffer.from(rgba)),candidateCount:candidates.length,best:candidates[0]||null,candidates:Object.freeze(candidates)});
}
