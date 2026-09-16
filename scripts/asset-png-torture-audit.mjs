/* KELO-INDEX
 * area: QA / CREATOR ASSET SECURITY
 * owner: Kelo Creator Asset Bridge
 * keys: PNG TORTURE FUZZ APNG TRAILING CRITICAL CHUNK LIMITS GRAYSCALE TRNS
 * purpose: exercise malformed, unsupported and exact-reduction PNG cases so the optimizer fails closed instead of crashing or corrupting output
 * online: N/A; deterministic CI audit
 */

import assert from 'node:assert/strict';
import {encodeRgbaPng,optimizePngLossless,decodePngRgba} from '../src/creators/assets/png-space-optimizer.mjs';
import {inspectPngStructure} from '../src/creators/assets/png-conformance-guard.mjs';

const CRC_TABLE=(()=>{const table=new Uint32Array(256);for(let n=0;n<256;n+=1){let c=n;for(let k=0;k<8;k+=1)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}return table;})();
function crc32(buffer){let c=0xffffffff;for(const value of buffer)c=CRC_TABLE[(c^value)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function chunk(type,data=Buffer.alloc(0)){const t=Buffer.from(type,'ascii'),l=Buffer.alloc(4),crc=Buffer.alloc(4);l.writeUInt32BE(data.length,0);crc.writeUInt32BE(crc32(Buffer.concat([t,data])),0);return Buffer.concat([l,t,data,crc]);}
function injectBeforeIend(buffer,type,data){const marker=Buffer.from('IEND');const typeOffset=buffer.indexOf(marker);assert.ok(typeOffset>0);const chunkStart=typeOffset-4;return Buffer.concat([buffer.subarray(0,chunkStart),chunk(type,data),buffer.subarray(chunkStart)]);}
function replaceIhdr(buffer,mutate){const typeOffset=buffer.indexOf(Buffer.from('IHDR'));const start=typeOffset-4,dataStart=typeOffset+4,data=Buffer.from(buffer.subarray(dataStart,dataStart+13));mutate(data);const end=dataStart+13+4;return Buffer.concat([buffer.subarray(0,start),chunk('IHDR',data),buffer.subarray(end)]);}
function rgbaPattern(width,height){const rgba=Buffer.alloc(width*height*4);for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){const o=(y*width+x)*4;rgba[o]=(x*13+y*7)&255;rgba[o+1]=(x*3+y*17)&255;rgba[o+2]=(x*19+y*5)&255;rgba[o+3]=255;}return rgba;}

const base=encodeRgbaPng(rgbaPattern(32,24),32,24,{level:1,filterStrategy:0});
assert.equal(inspectPngStructure(base).apng,false);

const trailing=Buffer.concat([base,Buffer.from([1,2,3,4])]);
assert.match(optimizePngLossless(trailing).report.reason,/TRAILING_DATA/);

const apngCtl=Buffer.alloc(8);apngCtl.writeUInt32BE(1,0);apngCtl.writeUInt32BE(0,4);
const apng=injectBeforeIend(base,'acTL',apngCtl);
assert.match(optimizePngLossless(apng).report.reason,/APNG_UNSUPPORTED/);

const unknownCritical=injectBeforeIend(base,'ABCD',Buffer.from([1]));
assert.match(optimizePngLossless(unknownCritical).report.reason,/UNKNOWN_CRITICAL/);

const interlaced=replaceIhdr(base,data=>{data[12]=1;});
assert.match(optimizePngLossless(interlaced).report.reason,/INTERLACE_UNSUPPORTED/);

const huge=replaceIhdr(base,data=>{data.writeUInt32BE(100000,0);data.writeUInt32BE(100000,4);});
assert.match(optimizePngLossless(huge).report.reason,/PIXEL_BUDGET/);

// Exact grayscale reduction.
const gray=Buffer.alloc(128*64*4);for(let p=0;p<128*64;p+=1){const v=[0,85,170,255][p%4],o=p*4;gray[o]=gray[o+1]=gray[o+2]=v;gray[o+3]=255;}
const graySource=encodeRgbaPng(gray,128,64,{level:1,filterStrategy:0}),grayOut=optimizePngLossless(graySource);
assert.equal(decodePngRgba(grayOut.buffer).rgba.equals(gray),true);
assert.ok(grayOut.report.candidates.some(c=>c.kind==='exact-grayscale'));

// Exact binary-alpha tRNS reduction with one unique transparent RGB key.
const keyed=rgbaPattern(96,48);for(let p=0;p<96*48;p+=7){const o=p*4;keyed[o]=11;keyed[o+1]=22;keyed[o+2]=33;keyed[o+3]=0;}
for(let p=0;p<96*48;p+=1){const o=p*4;if(keyed[o+3]===255&&keyed[o]===11&&keyed[o+1]===22&&keyed[o+2]===33)keyed[o]=12;}
const keyedSource=encodeRgbaPng(keyed,96,48,{level:1,filterStrategy:0}),keyedOut=optimizePngLossless(keyedSource,{disablePalette:true});
assert.equal(decodePngRgba(keyedOut.buffer).rgba.equals(keyed),true);
assert.ok(keyedOut.report.candidates.some(c=>c.kind==='exact-trns'));

// Deterministic mutation fuzz: any malformed input must fail closed, never throw from optimizePngLossless.
let skipped=0,accepted=0;
for(let i=0;i<96;i+=1){let mutant=Buffer.from(base);if(i%3===0){const cut=Math.max(1,mutant.length-(i%31)-1);mutant=mutant.subarray(0,cut);}else{const index=8+((i*97)%(mutant.length-8));mutant[index]^=(1<<((i>>1)%8));}let result;assert.doesNotThrow(()=>{result=optimizePngLossless(mutant);});if(result.report.status==='skipped')skipped+=1;else accepted+=1;}
assert.ok(skipped>0);

console.log(JSON.stringify({status:'ASSET_PNG_TORTURE_AUDIT_OK',baseBytes:base.length,grayWinner:grayOut.report.winner,keyedCandidate:keyedOut.report.trnsCandidate,mutations:{skipped,accepted}}));
