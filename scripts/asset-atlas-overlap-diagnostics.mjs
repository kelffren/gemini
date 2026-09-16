#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET ATLAS
 * owner: Kelo Creator Asset Bridge
 * keys: SMART ATLAS OVERLAP SHARED REGION UNION COMPONENT PACKING EXACT
 * purpose: measure frame-trim overlap and test whether packing shared source regions can beat per-frame duplication without changing pixels
 * online: N/A; deterministic build-time evidence only
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {decodePngRgba} from '../src/creators/assets/png-space-optimizer.mjs';
import {planSmartAtlas} from '../src/creators/assets/smart-atlas-planner.mjs';
import {packRectanglesTournament} from '../src/creators/assets/smart-atlas-packer-tournament.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const token=args.find(v=>v.startsWith(`--${name}=`));return token?token.slice(name.length+3):fallback;};
const manifestPath=path.resolve(argument('manifest','src/environment/generated/forest-plaza-tileset-v2-manifest.js'));
const reportDir=path.resolve(argument('report','test-results/asset-atlas-overlap-diagnostics'));

function parseManifest(file){const raw=fs.readFileSync(file,'utf8').trim();if(raw.startsWith('{'))return JSON.parse(raw);const equals=raw.indexOf('=');if(equals<0)throw new Error('ATLAS_OVERLAP_MANIFEST_ASSIGNMENT_NOT_FOUND');let json=raw.slice(equals+1).trim();if(json.endsWith(';'))json=json.slice(0,-1);return JSON.parse(json);}
function overlap(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;}
function unionArea(rects,width,height){const bitmap=new Uint8Array(width*height);let count=0;for(const r of rects){const x0=Math.max(0,r.x),y0=Math.max(0,r.y),x1=Math.min(width,r.x+r.w),y1=Math.min(height,r.y+r.h);for(let y=y0;y<y1;y+=1){let i=y*width+x0;for(let x=x0;x<x1;x+=1,i+=1)if(!bitmap[i]){bitmap[i]=1;count+=1;}}}return count;}
function components(rects){const seen=new Uint8Array(rects.length),groups=[];for(let start=0;start<rects.length;start+=1){if(seen[start])continue;const queue=[start],indices=[];seen[start]=1;while(queue.length){const i=queue.pop();indices.push(i);for(let j=0;j<rects.length;j+=1){if(seen[j]||!overlap(rects[i],rects[j]))continue;seen[j]=1;queue.push(j);}}groups.push(indices);}return groups;}
function bbox(rects){const x=Math.min(...rects.map(r=>r.x)),y=Math.min(...rects.map(r=>r.y)),right=Math.max(...rects.map(r=>r.x+r.w)),bottom=Math.max(...rects.map(r=>r.y+r.h));return{x,y,w:right-x,h:bottom-y};}
function pct(delta,base){return base?Number((delta/base*100).toFixed(3)):0;}

assert.ok(fs.existsSync(manifestPath),`manifest missing: ${manifestPath}`);
const manifest=parseManifest(manifestPath),atlas=manifest.atlas||{},sourcePath=path.resolve(manifest.source?.path||atlas.sourcePath||'');
assert.ok(fs.existsSync(sourcePath),`atlas source missing: ${sourcePath}`);
const decoded=decodePngRgba(fs.readFileSync(sourcePath)),width=Number(atlas.width||manifest.source?.width||decoded.ihdr.width),height=Number(atlas.height||manifest.source?.height||decoded.ihdr.height),originalArea=width*height;
const plan=planSmartAtlas(atlas.frames,{originalWidth:width,originalHeight:height,padding:0,minAreaSavingPercent:0,rgba:decoded.rgba,atlasWidth:width});
const trims=plan.frames.map(f=>({id:f.id,x:f.sourceRect.x+f.trim.x,y:f.sourceRect.y+f.trim.y,w:f.trim.w,h:f.trim.h}));
const sumTrimArea=trims.reduce((s,r)=>s+r.w*r.h,0),uniqueTrimArea=unionArea(trims,width,height),sharedPixelReferences=Math.max(0,sumTrimArea-uniqueTrimArea);
const groups=components(trims),regions=groups.map((indices,n)=>{const members=indices.map(i=>trims[i]),box=bbox(members);return{id:`region-${String(n).padStart(3,'0')}`,members:members.map(m=>m.id),memberCount:members.length,...box,area:box.w*box.h,memberAreaSum:members.reduce((s,m)=>s+m.w*m.h,0),uniqueArea:unionArea(members,width,height)};});
const multiRegions=regions.filter(r=>r.memberCount>1),componentBoxArea=regions.reduce((s,r)=>s+r.area,0),componentUniqueArea=regions.reduce((s,r)=>s+r.uniqueArea,0);
const packCases=[];for(const padding of[0,1,2]){const packed=packRectanglesTournament(regions.map(r=>({id:r.id,w:r.w,h:r.h})),{originalWidth:width,originalHeight:height,padding});assert.ok(packed,`shared region pack missing p=${padding}`);packCases.push({padding,width:packed.width,height:packed.height,area:packed.area,areaSavingPercent:pct(originalArea-packed.area,originalArea),lowerBoundArea:packed.lowerBoundArea,lowerBoundSavingPercent:pct(originalArea-packed.lowerBoundArea,originalArea),occupancy:packed.occupancy,wasteArea:packed.wasteArea,heuristic:packed.heuristic,sort:packed.sort,tested:packed.tournament?.tested??0});}
const report={status:'ASSET_ATLAS_OVERLAP_DIAGNOSTICS_OK',version:'kelo-atlas-overlap-diagnostics-v1',manifest:path.relative(process.cwd(),manifestPath).replaceAll('\\','/'),source:path.relative(process.cwd(),sourcePath).replaceAll('\\','/'),original:{width,height,area:originalArea},frames:trims.length,sumTrimArea,uniqueTrimArea,uniqueTrimSavingVsOriginalPercent:pct(originalArea-uniqueTrimArea,originalArea),sharedPixelReferences,sharedReferenceRatio:pct(sharedPixelReferences,sumTrimArea),componentCount:regions.length,multiFrameComponentCount:multiRegions.length,maxFramesInComponent:Math.max(...regions.map(r=>r.memberCount)),componentBoxArea,componentBoxSavingVsOriginalPercent:pct(originalArea-componentBoxArea,originalArea),componentBoundingOverhead:Math.max(0,componentBoxArea-componentUniqueArea),packCases,largestSharedRegions:[...multiRegions].sort((a,b)=>b.memberCount-a.memberCount||b.area-a.area).slice(0,12).map(r=>({id:r.id,memberCount:r.memberCount,x:r.x,y:r.y,w:r.w,h:r.h,area:r.area,memberAreaSum:r.memberAreaSum,uniqueArea:r.uniqueArea}))};
fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
console.log(`ATLAS_OVERLAP frames=${report.frames} sumTrim=${sumTrimArea} uniqueTrim=${uniqueTrimArea} sharedRefs=${sharedPixelReferences} (${report.sharedReferenceRatio}%) components=${regions.length} multi=${multiRegions.length} componentBoxes=${componentBoxArea}`);
for(const c of packCases)console.log(`ATLAS_SHARED_PACK p=${c.padding} ${c.width}x${c.height} area=${c.area} saving=${c.areaSavingPercent}% lower=${c.lowerBoundArea} lowerSaving=${c.lowerBoundSavingPercent}% occupancy=${(c.occupancy*100).toFixed(2)}% ${c.heuristic}/${c.sort}`);
console.log(JSON.stringify({status:report.status,original:report.original,sumTrimArea,uniqueTrimArea,uniqueTrimSavingVsOriginalPercent:report.uniqueTrimSavingVsOriginalPercent,sharedPixelReferences,sharedReferenceRatio:report.sharedReferenceRatio,componentCount:report.componentCount,multiFrameComponentCount:report.multiFrameComponentCount,maxFramesInComponent:report.maxFramesInComponent,componentBoxArea,componentBoxSavingVsOriginalPercent:report.componentBoxSavingVsOriginalPercent,packCases}));
