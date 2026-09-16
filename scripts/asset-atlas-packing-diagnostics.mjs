#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET ATLAS
 * owner: Kelo Creator Asset Bridge
 * keys: SMART ATLAS PACKING DIAGNOSTICS PADDING FRAGMENTATION LOWER BOUND OCCUPANCY
 * purpose: isolate whether Smart Atlas losses come from padding cost or packing fragmentation before any atlas promotion
 * online: N/A; deterministic build-time evidence only
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {decodePngRgba} from '../src/creators/assets/png-space-optimizer.mjs';
import {planSmartAtlas} from '../src/creators/assets/smart-atlas-planner.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const token=args.find(v=>v.startsWith(`--${name}=`));return token?token.slice(name.length+3):fallback;};
const manifestPath=path.resolve(argument('manifest','src/environment/generated/forest-plaza-tileset-v2-manifest.js'));
const reportDir=path.resolve(argument('report','test-results/asset-atlas-packing-diagnostics'));
const paddings=String(argument('paddings','0,1,2')).split(',').map(v=>Math.max(0,Math.round(Number(v)||0))).filter((v,i,a)=>a.indexOf(v)===i);

function parseManifest(file){
  const raw=fs.readFileSync(file,'utf8').trim();
  if(raw.startsWith('{'))return JSON.parse(raw);
  const equals=raw.indexOf('=');if(equals<0)throw new Error('ASSET_ATLAS_DIAG_MANIFEST_ASSIGNMENT_NOT_FOUND');
  let json=raw.slice(equals+1).trim();if(json.endsWith(';'))json=json.slice(0,-1);return JSON.parse(json);
}
function pct(n,d){return d?Number((n/d*100).toFixed(3)):0;}

assert.ok(fs.existsSync(manifestPath),`manifest missing: ${manifestPath}`);
const manifest=parseManifest(manifestPath),atlas=manifest.atlas||{},sourcePath=path.resolve(manifest.source?.path||atlas.sourcePath||'');
assert.ok(fs.existsSync(sourcePath),`atlas source missing: ${sourcePath}`);
const decoded=decodePngRgba(fs.readFileSync(sourcePath));
const originalWidth=Number(atlas.width||manifest.source?.width||decoded.ihdr.width),originalHeight=Number(atlas.height||manifest.source?.height||decoded.ihdr.height),originalArea=originalWidth*originalHeight;
assert.equal(decoded.ihdr.width,originalWidth,'source width mismatch');assert.equal(decoded.ihdr.height,originalHeight,'source height mismatch');

const cases=[];
for(const padding of paddings){
  const plan=planSmartAtlas(atlas.frames,{originalWidth,originalHeight,padding,minAreaSavingPercent:0,rgba:decoded.rgba,atlasWidth:originalWidth});
  assert.ok(plan.maxRects,`padding ${padding}: packing plan missing`);
  const pack=plan.maxRects,lower=plan.packing.theoreticalPaddedLowerBoundArea,packed=pack.area;
  const paddingTax=Math.max(0,lower-plan.trim.trimArea),fragmentation=Math.max(0,packed-lower);
  cases.push({padding,trimContentArea:plan.trim.trimArea,trimContentSavingPercent:pct(originalArea-plan.trim.trimArea,originalArea),paddedLowerBoundArea:lower,paddedLowerBoundSavingPercent:pct(originalArea-lower,originalArea),paddingTaxArea:paddingTax,paddingTaxVsOriginalPercent:pct(paddingTax,originalArea),packed:{width:pack.width,height:pack.height,area:packed,areaSavingPercent:pack.estimatedAreaSavingPercent,heuristic:pack.heuristic,sort:pack.sort,candidateWidth:pack.candidateWidth,occupancy:pack.occupancy,wasteArea:pack.wasteArea},fragmentationArea:fragmentation,fragmentationVsOriginalPercent:pct(fragmentation,originalArea),fragmentationVsPackedPercent:pct(fragmentation,packed),tournamentTested:pack.tournament?.tested??0,promotionCandidate:plan.promotionCandidate});
}
const p2=cases.find(c=>c.padding===2)||null,p0=cases.find(c=>c.padding===0)||null;
let diagnosis='unknown';
if(p2){
  if(p2.paddedLowerBoundArea>=originalArea)diagnosis='padding-lower-bound-exceeds-original';
  else if(p2.packed.area>=originalArea)diagnosis='fragmentation-blocks-positive-pack';
  else diagnosis='padding2-pack-positive';
}
const report={status:'ASSET_ATLAS_PACKING_DIAGNOSTICS_OK',version:'kelo-atlas-packing-diagnostics-v1',manifest:path.relative(process.cwd(),manifestPath).replaceAll('\\','/'),source:path.relative(process.cwd(),sourcePath).replaceAll('\\','/'),original:{width:originalWidth,height:originalHeight,area:originalArea},frameCount:Object.keys(atlas.frames||{}).length,diagnosis,cases,ceiling:{padding0Positive:Boolean(p0&&p0.packed.area<originalArea),padding2Positive:Boolean(p2&&p2.packed.area<originalArea),padding2LowerBoundPositive:Boolean(p2&&p2.paddedLowerBoundArea<originalArea)}};
fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(report,null,2));
for(const c of cases)console.log(`ATLAS_PACK_DIAG p=${c.padding} content=${c.trimContentArea} lower=${c.paddedLowerBoundArea} packed=${c.packed.area} ${c.packed.width}x${c.packed.height} saving=${c.packed.areaSavingPercent}% occupancy=${(c.packed.occupancy*100).toFixed(2)}% paddingTax=${c.paddingTaxArea} fragmentation=${c.fragmentationArea} heuristic=${c.packed.heuristic}/${c.packed.sort}`);
console.log(JSON.stringify({status:report.status,original:report.original,diagnosis,ceiling:report.ceiling,cases:cases.map(c=>({padding:c.padding,paddedLowerBoundSavingPercent:c.paddedLowerBoundSavingPercent,packedAreaSavingPercent:c.packed.areaSavingPercent,paddingTaxVsOriginalPercent:c.paddingTaxVsOriginalPercent,fragmentationVsOriginalPercent:c.fragmentationVsOriginalPercent,occupancy:c.packed.occupancy,packed:`${c.packed.width}x${c.packed.height}`,heuristic:c.packed.heuristic,sort:c.packed.sort}))}));
