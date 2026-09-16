#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG INDEXED COLOR TYPE 3 PALETTE PLTE TRNS BIT DEPTH CANONICALIZATION OPPORTUNITY
 * purpose: measure real indexed-PNG canonicalization opportunities before enabling exact palette reconstruction for color type 3
 * online: N/A; deterministic build-time audit only
 */

import fs from 'node:fs';
import path from 'node:path';
import {decodePngRgba} from '../src/creators/assets/png-space-optimizer.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const prefix=`--${name}=`,token=args.find(v=>v.startsWith(prefix));return token?token.slice(prefix.length):fallback;};
const root=path.resolve(argument('input','assets'));
const reportDir=path.resolve(argument('report','test-results/asset-indexed-png-opportunity'));
const maxFiles=Math.max(1,Number(argument('max-files','10000'))||10000);
const blockerNames=['bKGD','hIST','sBIT'];

function walk(target){
  const stat=fs.statSync(target);
  if(stat.isFile())return /\.png$/i.test(target)?[target]:[];
  const out=[],stack=[target];
  while(stack.length&&out.length<maxFiles){
    const dir=stack.pop();
    const entries=fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>b.name.localeCompare(a.name));
    for(const entry of entries){
      if(['node_modules','.git','.cache','dist','test-results'].includes(entry.name))continue;
      const full=path.join(dir,entry.name);
      if(entry.isDirectory())stack.push(full);
      else if(entry.isFile()&&/\.png$/i.test(entry.name))out.push(full);
      if(out.length>=maxFiles)break;
    }
  }
  return out.sort().slice(0,maxFiles);
}
function minimalPaletteDepth(colorCount){return colorCount<=2?1:colorCount<=4?2:colorCount<=16?4:8;}
function rgbaKey(rgba,o){return `${rgba[o]},${rgba[o+1]},${rgba[o+2]},${rgba[o+3]}`;}
function trailingOpaqueTrimLength(colors){let last=-1;for(let i=0;i<colors.length;i+=1)if(colors[i][3]!==255)last=i;return last<0?0:last+1;}

if(!fs.existsSync(root))throw new Error(`ASSET_INDEXED_PNG_INPUT_NOT_FOUND:${root}`);
const files=walk(root),rows=[];
let decodedFiles=0,indexedSources=0,unblockedIndexed=0,structuralOpportunities=0,blockedIndexed=0,totalUnusedEntries=0,totalDuplicateUsedRgba=0,totalPotentialPlteBytes=0,totalPotentialTrnsBytes=0,decodeSkipped=0;
const blockerCounts=Object.fromEntries(blockerNames.map(name=>[name,0]));
for(const file of files){
  const relative=path.relative(process.cwd(),file).replaceAll('\\','/'),source=fs.readFileSync(file);
  let decoded;
  try{decoded=decodePngRgba(source);}catch(error){decodeSkipped+=1;rows.push({file:relative,status:'decode-skipped',sourceBytes:source.length,error:String(error?.message||error)});continue;}
  decodedFiles+=1;
  if(decoded.ihdr.colorType!==3)continue;
  indexedSources+=1;
  const plte=decoded.chunks.find(c=>c.type==='PLTE')?.data||Buffer.alloc(0),trns=decoded.chunks.find(c=>c.type==='tRNS')?.data||null;
  const paletteEntries=Math.floor(plte.length/3),usedIndices=[...new Set(decoded.samples)].sort((a,b)=>a-b),usedIndexSet=new Set(usedIndices);
  const colors=Array.from({length:paletteEntries},(_,i)=>[plte[i*3],plte[i*3+1],plte[i*3+2],trns?.[i]??255]);
  const usedRgba=new Set();for(const index of usedIndices){const c=colors[index];if(c)usedRgba.add(c.join(','));}
  // Cross-check against final decoded pixels so corrupt/index-mismatch cases cannot create a false opportunity.
  const decodedRgba=new Set();for(let o=0;o<decoded.rgba.length;o+=4)decodedRgba.add(rgbaKey(decoded.rgba,o));
  const exactUsedColors=decodedRgba.size;
  const unusedEntries=Math.max(0,paletteEntries-usedIndexSet.size),duplicateUsedRgba=Math.max(0,usedIndices.length-usedRgba.size),minimalBitDepth=minimalPaletteDepth(exactUsedColors);
  const canonicalColors=[...decodedRgba].map(key=>key.split(',').map(Number));
  const canonicalTrnsEntries=trailingOpaqueTrimLength(canonicalColors);
  const blockers=blockerNames.filter(name=>decoded.chunks.some(c=>c.type===name));for(const name of blockers)blockerCounts[name]+=1;
  const unblocked=blockers.length===0;if(unblocked)unblockedIndexed+=1;else blockedIndexed+=1;
  const bitDepthOpportunity=decoded.ihdr.bitDepth>minimalBitDepth;
  const paletteEntryOpportunity=paletteEntries>exactUsedColors;
  const trnsOpportunity=Boolean(trns)&&trns.length>canonicalTrnsEntries;
  const structural=unblocked&&(bitDepthOpportunity||paletteEntryOpportunity||duplicateUsedRgba>0||trnsOpportunity);
  if(structural)structuralOpportunities+=1;
  totalUnusedEntries+=unusedEntries;totalDuplicateUsedRgba+=duplicateUsedRgba;
  if(unblocked){totalPotentialPlteBytes+=Math.max(0,(paletteEntries-exactUsedColors)*3);totalPotentialTrnsBytes+=Math.max(0,(trns?.length||0)-canonicalTrnsEntries);}
  rows.push({file:relative,status:structural?'structural-opportunity':unblocked?'indexed-unblocked':'indexed-blocked',sourceBytes:source.length,width:decoded.ihdr.width,height:decoded.ihdr.height,sourceBitDepth:decoded.ihdr.bitDepth,minimalBitDepth,paletteEntries,usedIndices:usedIndices.length,exactUsedColors,unusedEntries,duplicateUsedRgba,trnsEntries:trns?.length||0,canonicalTrnsEntries,blockers,opportunity:{bitDepth:bitDepthOpportunity,paletteEntries:paletteEntryOpportunity,duplicateUsedRgba:duplicateUsedRgba>0,trnsTail:trnsOpportunity}});
}
const summary={status:'ASSET_INDEXED_PNG_OPPORTUNITY_AUDIT_OK',root:path.relative(process.cwd(),root).replaceAll('\\','/'),scannedFiles:files.length,decodedFiles,decodeSkipped,indexedSources,unblockedIndexed,blockedIndexed,structuralOpportunities,totalUnusedEntries,totalDuplicateUsedRgba,totalPotentialPlteBytes,totalPotentialTrnsBytes,blockerCounts,rows};
fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,rows:undefined}));
for(const row of rows.filter(r=>r.status?.startsWith('indexed')||r.status==='structural-opportunity'))console.log(`INDEXED_PNG ${row.status.toUpperCase()} ${row.file} depth=${row.sourceBitDepth}->${row.minimalBitDepth} PLTE=${row.paletteEntries}->${row.exactUsedColors} unused=${row.unusedEntries} dupUsed=${row.duplicateUsedRgba} blockers=${row.blockers.join(',')||'none'}`);
