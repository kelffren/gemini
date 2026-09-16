/* KELO-INDEX
 * area: QA / CREATOR ASSET INGEST
 * owner: Kelo Creator Asset Bridge
 * keys: PNG SPACE COMPILER AUDIT LOSSLESS PALETTE BIT DEPTH ALPHA DROP TRNS SUBBYTE CACHE QUALITY GATE
 * purpose: prove exact PNG reductions, tRNS decoding and cache integrity without changing delivered RGBA pixels
 * online: N/A; deterministic build-time audit
 */

import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {decodePngRgba, encodeRgbaPng, optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {evaluatePixelFidelity, judgePixelFidelity} from '../src/creators/assets/png-quality-agent.mjs';

const PNG_SIGNATURE=Buffer.from([137,80,78,71,13,10,26,10]);
const CRC_TABLE=(()=>{
  const table=new Uint32Array(256);
  for(let n=0;n<256;n+=1){let c=n;for(let k=0;k<8;k+=1)c=(c&1)?(0xedb88320^(c>>>1)):(c>>>1);table[n]=c>>>0;}
  return table;
})();
const crc32=buffer=>{let c=0xffffffff;for(const value of buffer)c=CRC_TABLE[(c^value)&255]^(c>>>8);return(c^0xffffffff)>>>0;};
function chunk(type,data=Buffer.alloc(0)){
  const t=Buffer.from(type,'ascii'),len=Buffer.alloc(4),crc=Buffer.alloc(4);
  len.writeUInt32BE(data.length);crc.writeUInt32BE(crc32(Buffer.concat([t,data])));
  return Buffer.concat([len,t,data,crc]);
}
function ihdr(width,height,bitDepth,colorType){
  const data=Buffer.alloc(13);data.writeUInt32BE(width,0);data.writeUInt32BE(height,4);data[8]=bitDepth;data[9]=colorType;return data;
}
function makeTrnsRgbFixture(){
  const row=Buffer.from([0,10,20,30,40,50,60]);
  const trns=Buffer.alloc(6);trns.writeUInt16BE(10,0);trns.writeUInt16BE(20,2);trns.writeUInt16BE(30,4);
  return Buffer.concat([PNG_SIGNATURE,chunk('IHDR',ihdr(2,1,8,2)),chunk('tRNS',trns),chunk('IDAT',zlib.deflateSync(row)),chunk('IEND')]);
}
function makeTrnsGray2Fixture(){
  // Four 2-bit samples 0,1,2,3 packed MSB-first => 00 01 10 11.
  const row=Buffer.from([0,0b00011011]);
  const trns=Buffer.alloc(2);trns.writeUInt16BE(2,0);
  return Buffer.concat([PNG_SIGNATURE,chunk('IHDR',ihdr(4,1,2,0)),chunk('tRNS',trns),chunk('IDAT',zlib.deflateSync(row)),chunk('IEND')]);
}

function strictCheck(originalRgba, optimizedBuffer, width, height, label) {
  const decoded = decodePngRgba(optimizedBuffer);
  const metrics = evaluatePixelFidelity(originalRgba, decoded.rgba, width, height);
  const verdict = judgePixelFidelity(metrics, 'strict');
  assert.equal(verdict.pass, true, `${label}: strict visual gate`);
  assert.equal(metrics.changedPixels, 0, `${label}: zero changed pixels`);
  assert.equal(metrics.alphaChangedPixels, 0, `${label}: zero alpha changes`);
  return {decoded,metrics,verdict};
}

function makePattern(width, height, colors) {
  const rgba = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = colors[((x >> 4) + (y >> 4)) % colors.length];
      const offset = (y * width + x) * 4;
      rgba[offset] = color[0];
      rgba[offset + 1] = color[1];
      rgba[offset + 2] = color[2];
      rgba[offset + 3] = color[3];
    }
  }
  return rgba;
}

const width = 128;
const height = 128;
const rgba = makePattern(width,height,[
  [0,0,0,0],
  [24,40,72,255],
  [212,172,72,255],
  [232,236,244,255],
  [160,54,62,255]
]);
const original = encodeRgbaPng(rgba,width,height,{level:1,filterStrategy:0});
const optimized = optimizePngLossless(original);
const baseCheck = strictCheck(rgba,optimized.buffer,width,height,'base');
assert.ok(optimized.buffer.length < original.length,'base: optimized fixture is smaller');
assert.equal(optimized.report.winner.kind,'exact-palette','base: exact palette candidate wins');
assert.equal(optimized.report.paletteCandidate.bitDepth,4,'base: 5-colour palette selects 4-bit indexes');

const fourRgba = makePattern(96,96,[
  [0,0,0,0],
  [30,80,180,255],
  [230,180,50,255],
  [245,245,245,255]
]);
const fourOriginal = encodeRgbaPng(fourRgba,96,96,{level:1,filterStrategy:0});
const fourOptimized = optimizePngLossless(fourOriginal);
const fourCheck = strictCheck(fourRgba,fourOptimized.buffer,96,96,'palette-2bit');
assert.equal(fourOptimized.report.winner.kind,'exact-palette','palette-2bit: palette wins');
assert.equal(fourOptimized.report.paletteCandidate.bitDepth,2,'palette-2bit: minimum legal bit depth');
assert.equal(fourCheck.decoded.ihdr.bitDepth,2,'palette-2bit: output IHDR uses 2 bits');

const twoRgba = makePattern(96,96,[
  [15,20,28,255],
  [220,226,238,255]
]);
const twoOriginal = encodeRgbaPng(twoRgba,96,96,{level:1,filterStrategy:0});
const twoOptimized = optimizePngLossless(twoOriginal);
const twoCheck = strictCheck(twoRgba,twoOptimized.buffer,96,96,'palette-1bit');
assert.equal(twoOptimized.report.winner.kind,'exact-palette','palette-1bit: palette wins');
assert.equal(twoOptimized.report.paletteCandidate.bitDepth,1,'palette-1bit: minimum legal bit depth');
assert.equal(twoCheck.decoded.ihdr.bitDepth,1,'palette-1bit: output IHDR uses 1 bit');

const twoAgain = optimizePngLossless(twoOptimized.buffer);
const twoAgainCheck = strictCheck(twoRgba,twoAgain.buffer,96,96,'palette-1bit-idempotent');
assert.equal(twoAgainCheck.decoded.ihdr.bitDepth,1,'palette-1bit-idempotent: sub-byte decoder/refilter remains active');
assert.ok(twoAgain.buffer.length <= twoOptimized.buffer.length,'palette-1bit-idempotent: reoptimization must not grow');

const opaqueWidth = 160;
const opaqueHeight = 96;
const opaqueRgba = Buffer.alloc(opaqueWidth*opaqueHeight*4);
for (let y=0; y<opaqueHeight; y+=1) {
  for (let x=0; x<opaqueWidth; x+=1) {
    const o=(y*opaqueWidth+x)*4;
    opaqueRgba[o]=(x*3+y*5)&255;
    opaqueRgba[o+1]=(x*7+y*2)&255;
    opaqueRgba[o+2]=(x*11+y*13)&255;
    opaqueRgba[o+3]=255;
  }
}
const opaqueOriginal = encodeRgbaPng(opaqueRgba,opaqueWidth,opaqueHeight,{level:1,filterStrategy:0});
const opaqueOptimized = optimizePngLossless(opaqueOriginal,{disablePalette:true});
const opaqueCheck = strictCheck(opaqueRgba,opaqueOptimized.buffer,opaqueWidth,opaqueHeight,'alpha-drop');
assert.deepEqual(opaqueOptimized.report.alphaDropCandidate,{fromColorType:6,toColorType:2},'alpha-drop: redundant channel representation discovered');
const alphaDropCandidates = opaqueOptimized.report.candidates.filter(item=>item.kind==='exact-alpha-drop');
assert.ok(alphaDropCandidates.length > 0,'alpha-drop: exact candidates generated');
assert.ok(alphaDropCandidates.some(item=>item.bytes < opaqueOriginal.length),'alpha-drop: at least one representation is smaller than source');
if (opaqueOptimized.report.winner.kind === 'exact-alpha-drop') {
  assert.equal(opaqueCheck.decoded.ihdr.colorType,2,'alpha-drop winner: RGBA becomes RGB');
}
assert.ok(opaqueOptimized.buffer.length < opaqueOriginal.length,'alpha-drop fixture: chosen exact output smaller');

const trnsRgb=decodePngRgba(makeTrnsRgbFixture());
assert.deepEqual([...trnsRgb.rgba],[10,20,30,0,40,50,60,255],'tRNS truecolor: transparent key applied exactly');
const trnsRgbOptimized=optimizePngLossless(makeTrnsRgbFixture());
strictCheck(trnsRgb.rgba,trnsRgbOptimized.buffer,2,1,'tRNS truecolor optimize');

const trnsGray=decodePngRgba(makeTrnsGray2Fixture());
assert.deepEqual([...trnsGray.rgba],[0,0,0,255,85,85,85,255,170,170,170,0,255,255,255,255],'tRNS gray2: raw key scales to delivered gray exactly');
const trnsGrayOptimized=optimizePngLossless(makeTrnsGray2Fixture());
strictCheck(trnsGray.rgba,trnsGrayOptimized.buffer,4,1,'tRNS gray2 optimize');

console.log(JSON.stringify({
  status:'PNG_SPACE_COMPILER_AUDIT_OK',
  base:{beforeBytes:original.length,afterBytes:optimized.buffer.length,savedPercent:optimized.report.savedPercent,winner:optimized.report.winner},
  palette2bit:{beforeBytes:fourOriginal.length,afterBytes:fourOptimized.buffer.length,winner:fourOptimized.report.winner,bitDepth:fourCheck.decoded.ihdr.bitDepth},
  palette1bit:{beforeBytes:twoOriginal.length,afterBytes:twoOptimized.buffer.length,winner:twoOptimized.report.winner,bitDepth:twoCheck.decoded.ihdr.bitDepth,reoptimizedBytes:twoAgain.buffer.length},
  alphaDrop:{beforeBytes:opaqueOriginal.length,afterBytes:opaqueOptimized.buffer.length,winner:opaqueOptimized.report.winner,candidateCount:alphaDropCandidates.length,outputColorType:opaqueCheck.decoded.ihdr.colorType},
  trns:{truecolorAlpha:[trnsRgb.rgba[3],trnsRgb.rgba[7]],gray2Alpha:[trnsGray.rgba[3],trnsGray.rgba[7],trnsGray.rgba[11],trnsGray.rgba[15]]},
  qualityScore:baseCheck.verdict.score
}));

await import('./asset-optimization-cache-audit.mjs');
