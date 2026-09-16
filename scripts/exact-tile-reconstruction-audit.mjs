/* KELO-INDEX
 * area: BUILD / CREATOR ASSET LAB
 * owner: Kelo Creator Asset Bridge
 * keys: EXACT RECONSTRUCTION AUDIT TILE DEDUP REVERSIBLE
 * purpose: deterministic proof that repeated-tile plans reconstruct original RGBA byte-exactly
 * public-api: CLI audit
 * state-owned: none
 * online: N/A
 */
import {buildExactTilePlan,reconstructExactTilePlan,searchExactTilePlans} from '../src/creators/assets/exact-tile-reconstruction.mjs';
const assert=(v,m)=>{if(!v)throw new Error(m);};
const width=16,height=16,tileSize=8,rgba=Buffer.alloc(width*height*4);
function fillTile(tx,ty,r,g,b,a=255){for(let y=0;y<tileSize;y++)for(let x=0;x<tileSize;x++){const o=(((ty*tileSize+y)*width)+(tx*tileSize+x))*4;rgba[o]=r;rgba[o+1]=g;rgba[o+2]=b;rgba[o+3]=a;}}
fillTile(0,0,10,20,30);fillTile(1,0,10,20,30);fillTile(0,1,200,5,9);fillTile(1,1,10,20,30);
const plan=buildExactTilePlan(rgba,width,height,8),rebuilt=reconstructExactTilePlan(plan);
assert(plan.tileCount===4,'tile count mismatch');assert(plan.uniqueTileCount===2,'repeated tile dedup failed');assert(rebuilt.equals(rgba),'reconstruction must be byte exact');assert(plan.theoreticalRawSavingBytes>0,'expected repeated-block raw saving opportunity');
const search=searchExactTilePlans(rgba,width,height,{tileSizes:[4,8]});assert(search.best&&search.candidates.every(c=>c.reconstructionExact===true),'search must only expose exact candidates');
console.log('EXACT_TILE_RECONSTRUCTION_AUDIT_PASS');
