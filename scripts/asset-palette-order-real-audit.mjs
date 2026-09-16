#!/usr/bin/env node
/* KELO-INDEX
 * area: QA / CREATOR ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG PALETTE ORDER REAL ASSETS EXACT BYTES SCAN
 * purpose: measure whether exact palette-index permutation wins on real repository PNGs without rewriting source assets
 * online: N/A; deterministic build-time audit
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {decodePngRgba,optimizePngLossless} from '../src/creators/assets/png-space-optimizer.mjs';
import {PALETTE_ORDER_DEEP} from '../src/creators/assets/png-palette-order.mjs';

const args=process.argv.slice(2);
const argument=(name,fallback)=>{const prefix=`--${name}=`,token=args.find(v=>v.startsWith(prefix));return token?token.slice(prefix.length):fallback;};
const root=path.resolve(argument('input','assets'));
const reportDir=path.resolve(argument('report','test-results/asset-palette-real'));
const maxFiles=Math.max(1,Number(argument('max-files','200'))||200);
const maxSourceBytes=Math.max(1024,Number(argument('max-source-bytes',String(8*1024*1024)))||8*1024*1024);

function walk(target){
  const out=[],stack=[target];
  while(stack.length&&out.length<maxFiles){
    const current=stack.pop(),stat=fs.statSync(current);
    if(stat.isFile()){
      if(/\.png$/i.test(current))out.push(current);
      continue;
    }
    const entries=fs.readdirSync(current,{withFileTypes:true}).sort((a,b)=>b.name.localeCompare(a.name));
    for(const entry of entries){
      if(['node_modules','.git','.cache','dist','test-results'].includes(entry.name))continue;
      const full=path.join(current,entry.name);
      if(entry.isDirectory())stack.push(full);
      else if(entry.isFile()&&/\.png$/i.test(entry.name))out.push(full);
      if(out.length>=maxFiles)break;
    }
  }
  return out.sort().slice(0,maxFiles);
}
function exactUniqueColors(rgba,limit=257){
  const seen=new Set();
  for(let o=0;o<rgba.length;o+=4){
    const key=`${rgba[o]},${rgba[o+1]},${rgba[o+2]},${rgba[o+3]}`;
    seen.add(key);
    if(seen.size>=limit)return seen.size;
  }
  return seen.size;
}
function strictExact(source,result,label){
  assert.equal(result.report.exactPixels,true,`${label}: optimizer strict gate`);
  const a=decodePngRgba(source),b=decodePngRgba(result.buffer);
  assert.equal(a.ihdr.width,b.ihdr.width,`${label}: width`);
  assert.equal(a.ihdr.height,b.ihdr.height,`${label}: height`);
  assert.deepEqual(a.rgba,b.rgba,`${label}: exact RGBA`);
}

if(!fs.existsSync(root))throw new Error(`ASSET_PALETTE_REAL_INPUT_NOT_FOUND:${root}`);
const files=walk(root),rows=[];
let decodedFiles=0,eligibleFiles=0,testedFiles=0,wins=0,totalFirst=0,totalTournament=0,skippedLarge=0,decodeSkipped=0;
for(const file of files){
  const relative=path.relative(process.cwd(),file).replaceAll('\\','/');
  const source=fs.readFileSync(file);
  if(source.length>maxSourceBytes){skippedLarge+=1;rows.push({file:relative,status:'skipped-large',sourceBytes:source.length});continue;}
  let decoded;
  try{decoded=decodePngRgba(source);}catch(error){decodeSkipped+=1;rows.push({file:relative,status:'decode-skipped',sourceBytes:source.length,error:String(error?.message||error)});continue;}
  decodedFiles+=1;
  const uniqueColors=exactUniqueColors(decoded.rgba);
  if(uniqueColors>256){rows.push({file:relative,status:'high-color',sourceBytes:source.length,uniqueColors});continue;}
  eligibleFiles+=1;
  const common={disableColorReduction:true,filterStrategies:['adaptive',0,4],paletteFilterStrategies:['adaptive',0,4]};
  const first=optimizePngLossless(source,{...common,paletteOrderStrategies:['first-seen']});
  const tournament=optimizePngLossless(source,{...common,paletteOrderStrategies:PALETTE_ORDER_DEEP});
  strictExact(source,first,`${relative}:first`);
  strictExact(source,tournament,`${relative}:tournament`);
  testedFiles+=1;totalFirst+=first.buffer.length;totalTournament+=tournament.buffer.length;
  const saved=Math.max(0,first.buffer.length-tournament.buffer.length);if(saved>0)wins+=1;
  rows.push({file:relative,status:saved>0?'tournament-win':'same',sourceBytes:source.length,uniqueColors,firstSeenBytes:first.buffer.length,tournamentBytes:tournament.buffer.length,savedBytes:saved,savedPercent:first.buffer.length?Number((saved/first.buffer.length*100).toFixed(4)):0,firstWinner:first.report.winner,tournamentWinner:tournament.report.winner,orderings:tournament.report.paletteCandidate?.orderings||[]});
  console.log(`PALETTE_REAL ${saved>0?'WIN':'SAME'} ${relative} colors=${uniqueColors} first=${first.buffer.length} tournament=${tournament.buffer.length} saved=${saved}`);
}
const savedBytes=Math.max(0,totalFirst-totalTournament),savedPercent=totalFirst?Number((savedBytes/totalFirst*100).toFixed(4)):0;
const summary={status:'ASSET_PALETTE_ORDER_REAL_AUDIT_OK',root:path.relative(process.cwd(),root).replaceAll('\\','/'),maxFiles,maxSourceBytes,scannedFiles:files.length,decodedFiles,eligibleFiles,testedFiles,wins,skippedLarge,decodeSkipped,totalFirstSeenBytes:totalFirst,totalTournamentBytes:totalTournament,savedBytes,savedPercent,rows};
fs.mkdirSync(reportDir,{recursive:true});fs.writeFileSync(path.join(reportDir,'report.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,rows:undefined}));
