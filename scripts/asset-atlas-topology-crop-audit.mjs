#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET ATLAS
 * owner: Kelo Creator Asset Bridge
 * keys: SMART ATLAS TOPOLOGY CROP GLOBAL BOUNDS OVERLAP RENDER EXACT ANCHOR
 * purpose: prove whether preserving source overlap topology and cropping only unused outer borders beats frame repacking safely
 * online: N/A; deterministic build-time proof only
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {decodePngRgba} from '../src/creators/assets/png-space-optimizer.mjs';
import {evaluatePixelFidelity,judgePixelFidelity} from '../src/creators/assets/png-quality-agent.mjs';
import {planSmartAtlas} from '../src/creators/assets/smart-atlas-planner.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const token=args.find(v=>v.startsWith(`--${name}=`));return token?token.slice(name.length+3):fallback;};
const manifestPath=path.resolve(argument('manifest','src/environment/generated/forest-plaza-tileset-v2-manifest.js'));
const reportDir=path.resolve(argument('report','test-results/asset-atlas-topology-crop'));
const paddings=String(argument('paddings','0,1,2')).split(',').map(v=>Math.max(0,Math.round(Number(v)||0))).filter((v,i,a)=>a.indexOf(v)===i);

function parseManifest(file){const raw=fs.readFileSync(file,'utf8').trim();if(raw.startsWith('{'))return JSON.parse(raw);const equals=raw.indexOf('=');if(equals<0)throw new Error('ATLAS_TOPOLOGY_MANIFEST_ASSIGNMENT_NOT_FOUND');let json=raw.slice(equals+1).trim();if(json.endsWith(';'))json=json.slice(0,-1);return JSON.parse(json);}
function extract(rgba,width,rect){const out=Buffer.alloc(rect.w*rect.h*4);for(let y=0;y<rect.h;y+=1){const from=((rect.y+y)*width+rect.x)*4;rgba.copy(out,y*rect.w*4,from,from+rect.w*4);}return out;}
function copyRect(source,sourceWidth,sourceRect,target,targetWidth,tx,ty){for(let y=0;y<sourceRect.h;y+=1){const from=((sourceRect.y+y)*sourceWidth+sourceRect.x)*4,to=((ty+y)*targetWidth+tx)*4;source.copy(target,to,from,from+sourceRect.w*4);}}
function bounds(rects){const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y)),right=Math.max(...rects.map(r=>r.x+r.w)),bottom=Math.max(...rects.map(r=>r.y+r.h));return{x,y,w:right-x,h:bottom-y,right,bottom};}
function pct(n,d){return d?Number((n/d*100).toFixed(3)):0;}

assert.ok(fs.existsSync(manifestPath),`manifest missing: ${manifestPath}`);
const manifest=parseManifest(manifestPath),atlas=manifest.atlas||{},sourcePath=path.resolve(manifest.source?.path||atlas.sourcePath||'');
assert.ok(fs.existsSync(sourcePath),`source missing: ${sourcePath}`);
const decoded=decodePngRgba(fs.readFileSync(sourcePath)),width=decoded.ihdr.width,height=decoded.ihdr.height,originalArea=width*height;
const plan=planSmartAtlas(atlas.frames,{originalWidth:width,originalHeight:height,padding:0,minAreaSavingPercent:0,rgba:decoded.rgba,atlasWidth:width});
assert.equal(plan.frames.length,Object.keys(atlas.frames||{}).length,'all manifest frames must be planned');
const absTrims=plan.frames.map(frame=>({id:frame.id,x:frame.sourceRect.x+frame.trim.x,y:frame.sourceRect.y+frame.trim.y,w:frame.trim.w,h:frame.trim.h})),global=bounds(absTrims),cases=[];
for(const padding of paddings){
  const crop={x:Math.max(0,global.x-padding),y:Math.max(0,global.y-padding),right:Math.min(width,global.right+padding),bottom:Math.min(height,global.bottom+padding)};crop.w=crop.right-crop.x;crop.h=crop.bottom-crop.y;
  const cropped=extract(decoded.rgba,width,crop),frames=[];
  for(const frame of plan.frames){
    const abs={x:frame.sourceRect.x+frame.trim.x,y:frame.sourceRect.y+frame.trim.y,w:frame.trim.w,h:frame.trim.h};
    const placement={x:abs.x-crop.x,y:abs.y-crop.y,w:abs.w,h:abs.h};
    assert.ok(placement.x>=0&&placement.y>=0&&placement.x+placement.w<=crop.w&&placement.y+placement.h<=crop.h,`${frame.id}: trim outside crop p=${padding}`);
    const original=extract(decoded.rgba,width,frame.sourceRect),trimmed=extract(cropped,crop.w,placement),reconstructed=Buffer.alloc(frame.orig.w*frame.orig.h*4);
    copyRect(trimmed,placement.w,{x:0,y:0,w:placement.w,h:placement.h},reconstructed,frame.orig.w,frame.trim.x,frame.trim.y);
    const metrics=evaluatePixelFidelity(original,reconstructed,frame.orig.w,frame.orig.h),verdict=judgePixelFidelity(metrics,'render-exact');
    assert.equal(verdict.pass,true,`${frame.id}: topology crop changed visible pixels/alpha p=${padding}`);
    const anchorPreserved=!frame.originalAnchor||(frame.anchor.x+frame.trim.x===frame.originalAnchor.x&&frame.anchor.y+frame.trim.y===frame.originalAnchor.y);assert.equal(anchorPreserved,true,`${frame.id}: anchor drift p=${padding}`);
    frames.push({id:frame.id,renderExact:metrics.renderExactPixels,hiddenTransparentRgbChanges:metrics.hiddenTransparentRgbChangedPixels,anchorPreserved,placement});
  }
  const area=crop.w*crop.h;cases.push({padding,crop:{x:crop.x,y:crop.y,w:crop.w,h:crop.h},area,areaSavingPercent:pct(originalArea-area,originalArea),renderExactFrames:frames.filter(f=>f.renderExact).length,anchorPreserved:frames.every(f=>f.anchorPreserved),hiddenTransparentRgbChanges:frames.reduce((s,f)=>s+f.hiddenTransparentRgbChanges,0),frames});
}
const report={status:'ASSET_ATLAS_TOPOLOGY_CROP_OK',version:'kelo-atlas-topology-crop-v1',manifest:path.relative(process.cwd(),manifestPath).replaceAll('\\','/'),source:path.relative(process.cwd(),sourcePath).replaceAll('\\','/'),original:{width,height,area:originalArea},globalTrimBounds:{x:global.x,y:global.y,w:global.w,h:global.h},frameCount:plan.frames.length,cases:cases.map(c=>({...c,frames:undefined})),best:[...cases].sort((a,b)=>a.area-b.area)[0]};
fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify({...report,best:{...report.best,frames:undefined}},null,2));
for(const c of cases)console.log(`ATLAS_TOPOLOGY_CROP p=${c.padding} crop=${c.crop.x},${c.crop.y} ${c.crop.w}x${c.crop.h} area=${c.area} saving=${c.areaSavingPercent}% exact=${c.renderExactFrames}/${plan.frames.length} anchors=${c.anchorPreserved} hiddenRgb=${c.hiddenTransparentRgbChanges}`);
console.log(JSON.stringify({status:report.status,original:report.original,globalTrimBounds:report.globalTrimBounds,frameCount:report.frameCount,cases:report.cases}));
