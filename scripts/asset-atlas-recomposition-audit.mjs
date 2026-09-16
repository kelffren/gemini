/* KELO-INDEX
 * area: QA / CREATOR ASSET ATLAS
 * owner: Kelo Creator Asset Bridge
 * keys: ATLAS RECOMPOSITION TRIM ORIG ANCHOR MAXRECTS RENDER EXACT
 * purpose: prove every planned trimmed frame can be recomposed to its original visual result before any atlas promotion
 * online: N/A; deterministic build-time audit
 */

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {decodePngRgba} from '../src/creators/assets/png-space-optimizer.mjs';
import {evaluatePixelFidelity,judgePixelFidelity} from '../src/creators/assets/png-quality-agent.mjs';
import {planSmartAtlas} from '../src/creators/assets/smart-atlas-planner.mjs';

const manifestFile=process.argv.find(v=>v.startsWith('--manifest='))?.slice(11)||'src/environment/generated/forest-plaza-tileset-v2-manifest.js';
function parseManifest(file){const raw=fs.readFileSync(file,'utf8').trim(),equals=raw.indexOf('=');let json=raw.startsWith('{')?raw:raw.slice(equals+1).trim();if(json.endsWith(';'))json=json.slice(0,-1);return JSON.parse(json);}
function extract(rgba,width,rect){const out=Buffer.alloc(rect.w*rect.h*4);for(let y=0;y<rect.h;y+=1){const start=((rect.y+y)*width+rect.x)*4;rgba.copy(out,y*rect.w*4,start,start+rect.w*4);}return out;}
function copyRect(source,sourceWidth,sourceRect,target,targetWidth,tx,ty){for(let y=0;y<sourceRect.h;y+=1){const from=((sourceRect.y+y)*sourceWidth+sourceRect.x)*4,to=((ty+y)*targetWidth+tx)*4;source.copy(target,to,from,from+sourceRect.w*4);}}

const manifest=parseManifest(manifestFile),atlas=manifest.atlas||{},sourcePath=manifest.source?.path||atlas.sourcePath;assert.ok(sourcePath&&fs.existsSync(sourcePath),'atlas source missing');const decoded=decodePngRgba(fs.readFileSync(sourcePath)),plan=planSmartAtlas(atlas.frames,{originalWidth:decoded.ihdr.width,originalHeight:decoded.ihdr.height,padding:2,minAreaSavingPercent:0});assert.ok(plan.maxRects,'MaxRects plan missing');
const packed=Buffer.alloc(plan.maxRects.width*plan.maxRects.height*4),frameReports=[];
for(const frame of plan.frames){const placement=plan.maxRects.placements[frame.id];assert.ok(placement,`${frame.id}: placement missing`);const sourceTrim={x:frame.sourceRect.x+frame.trim.x,y:frame.sourceRect.y+frame.trim.y,w:frame.trim.w,h:frame.trim.h};copyRect(decoded.rgba,decoded.ihdr.width,sourceTrim,packed,plan.maxRects.width,placement.x,placement.y);}
for(const frame of plan.frames){const placement=plan.maxRects.placements[frame.id],original=extract(decoded.rgba,decoded.ihdr.width,frame.sourceRect),reconstructed=Buffer.alloc(frame.orig.w*frame.orig.h*4),packedTrim=extract(packed,plan.maxRects.width,placement);copyRect(packedTrim,placement.w,{x:0,y:0,w:placement.w,h:placement.h},reconstructed,frame.orig.w,frame.trim.x,frame.trim.y);const metrics=evaluatePixelFidelity(original,reconstructed,frame.orig.w,frame.orig.h),verdict=judgePixelFidelity(metrics,'render-exact');assert.equal(verdict.pass,true,`${frame.id}: recomposition changed visible pixels/alpha`);if(frame.originalAnchor&&frame.anchor){assert.equal(frame.anchor.x+frame.trim.x,frame.originalAnchor.x,`${frame.id}: anchor x drift`);assert.equal(frame.anchor.y+frame.trim.y,frame.originalAnchor.y,`${frame.id}: anchor y drift`);}frameReports.push({id:frame.id,renderExact:metrics.renderExactPixels,hiddenTransparentRgbChanges:metrics.hiddenTransparentRgbChangedPixels,anchorPreserved:!frame.originalAnchor||(frame.anchor.x+frame.trim.x===frame.originalAnchor.x&&frame.anchor.y+frame.trim.y===frame.originalAnchor.y)});}
console.log(JSON.stringify({status:'ASSET_ATLAS_RECOMPOSITION_OK',frames:frameReports.length,packed:{width:plan.maxRects.width,height:plan.maxRects.height,areaSavingPercent:plan.maxRects.estimatedAreaSavingPercent},renderExactFrames:frameReports.filter(f=>f.renderExact).length,anchorPreserved:frameReports.every(f=>f.anchorPreserved),hiddenTransparentRgbChanges:frameReports.reduce((s,f)=>s+f.hiddenTransparentRgbChanges,0)},null,2));
