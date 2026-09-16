#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG PALETTE ORDER TOURNAMENT LUMINANCE ADJACENCY EXACT REGRESSION DEDUP
 * purpose: prove unique palette-index permutations can reduce real PNG bytes while preserving exact RGBA and keeping first-seen as the conservative baseline
 * online: N/A; deterministic build-time audit
 */

import assert from 'node:assert/strict';
import {decodePngRgba,encodeRgbaPng,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {buildPaletteOrderings,PALETTE_ORDER_DEEP} from '../src/creators/assets/png-palette-order.mjs';

const width=256,height=96,colorCount=16;
const colors=Array.from({length:colorCount},(_,i)=>[i*15,20,200-i*8,255]);
const scramble=[0,15,1,14,2,13,3,12,4,11,5,10,6,9,7,8];
const rgba=Buffer.alloc(width*height*4);
function setPixel(p,c){const o=p*4;rgba[o]=c[0];rgba[o+1]=c[1];rgba[o+2]=c[2];rgba[o+3]=c[3];}
// Force a deliberately poor first-seen palette order in row 0.
for(let x=0;x<width;x+=1)setPixel(x,colors[x<colorCount?scramble[x]:0]);
// The dominant image then uses smoothly ordered neighbouring colours.
for(let y=1;y<height;y+=1)for(let x=0;x<width;x+=1)setPixel(y*width+x,colors[Math.floor(x/(width/colorCount))]);

const source=encodeRgbaPng(rgba,width,height,{level:1,filterStrategy:0});
const decoded=decodePngRgba(source);
assert.deepEqual(decoded.rgba,rgba,'fixture source must decode exactly');

// Independent ordering primitive invariants. A named strategy is allowed to
// disappear when it produces the same exact permutation as an earlier strategy;
// duplicate permutations are intentionally removed before expensive encoding.
const firstMap=new Map(),baseColors=[],indexes=Buffer.alloc(width*height);for(let p=0;p<width*height;p+=1){const o=p*4,key=`${rgba[o]},${rgba[o+1]},${rgba[o+2]},${rgba[o+3]}`;let index=firstMap.get(key);if(index===undefined){index=baseColors.length;firstMap.set(key,index);baseColors.push([rgba[o],rgba[o+1],rgba[o+2],rgba[o+3]]);}indexes[p]=index;}
const orderings=buildPaletteOrderings({colors:baseColors,indexes,width,height,strategies:PALETTE_ORDER_DEEP});
assert.equal(orderings[0].name,'first-seen','first ordering remains backward-compatible baseline');
assert.ok(orderings.length>=2,'at least one unique reordered permutation generated');
assert.ok(orderings.some(o=>o.name==='luminance'),'luminance ordering generated for this fixture');
assert.ok(orderings.some(o=>o.name!=='first-seen'),'a non-baseline unique ordering survives dedup');
for(const ordering of orderings){assert.equal(ordering.indexes.length,indexes.length,`${ordering.name}: index count`);assert.equal(ordering.colors.length,colorCount,`${ordering.name}: color count`);}

const result=optimizePngLossless(source,{disableColorReduction:true,filterStrategies:['adaptive',1],paletteFilterStrategies:[1],paletteOrderStrategies:PALETTE_ORDER_DEEP});
const finalDecoded=decodePngRgba(result.buffer);
assert.deepEqual(finalDecoded.rgba,rgba,'palette tournament winner must remain exact RGBA');
assert.equal(result.report.exactPixels,true,'strict gate must pass');
assert.deepEqual(result.report.paletteCandidate.orderings,orderings.map(o=>o.name),'report records measured unique orderings');

const paletteCandidates=result.report.candidates.filter(c=>c.kind==='exact-palette');
const firstSeen=paletteCandidates.filter(c=>!c.label.includes('order=')).reduce((best,c)=>Math.min(best,c.bytes),Infinity);
const reordered=paletteCandidates.filter(c=>c.label.includes('order=')).sort((a,b)=>a.bytes-b.bytes)[0];
assert.ok(Number.isFinite(firstSeen),'first-seen candidates exist');
assert.ok(reordered,'reordered candidates exist');
assert.ok(reordered.bytes<firstSeen,`at least one exact reordered palette must beat first-seen (${reordered?.bytes} < ${firstSeen})`);

console.log(JSON.stringify({status:'ASSET_PALETTE_ORDER_AUDIT_OK',sourceBytes:source.length,outputBytes:result.buffer.length,firstSeenBytes:firstSeen,bestReordered:{label:reordered.label,bytes:reordered.bytes},savedVsFirstSeen:firstSeen-reordered.bytes,winner:result.report.winner,orderings:result.report.paletteCandidate.orderings}));
