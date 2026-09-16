/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: BOOT FOOTPRINT RATCHET AUDIT FIRST PLAYABLE DEPENDENCY CLOSURE ASSET CSS
 * purpose: deterministic self-test for direct and static dependency byte measurement and regression classification
 * public-api: CLI audit
 * state-owned: temporary files only
 * online: N/A
 */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {measureBootFootprint,compareBootFootprints} from '../src/build/boot-footprint-ratchet.mjs';
const assert=(v,m)=>{if(!v)throw new Error(m);};
function fixture(scriptPad,{extraDirect=false,extraDependency=false,assetBytes=33}={}){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-boot-footprint-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.mkdirSync(path.join(dir,'assets'),{recursive:true});fs.writeFileSync(path.join(dir,'assets','core.png'),'p'.repeat(assetBytes));fs.writeFileSync(path.join(dir,'assets','bg.png'),'g'.repeat(17));fs.writeFileSync(path.join(dir,'assets','lazy.png'),'l'.repeat(400));if(extraDependency)fs.writeFileSync(path.join(dir,'assets','extra.png'),'e'.repeat(11));const dependency=`const CORE='assets/core.png?v=1';${extraDependency?"const EXTRA='assets/extra.png';":''}`;fs.writeFileSync(path.join(dir,'src','a.js'),dependency+'a'.repeat(scriptPad));fs.writeFileSync(path.join(dir,'style.css'),'body{background:url("assets/bg.png?v=2")}');fs.writeFileSync(path.join(dir,'lazy.js'),"const L='assets/lazy.png';");if(extraDirect)fs.writeFileSync(path.join(dir,'src','b.js'),'b'.repeat(5));fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><link rel="stylesheet" href="style.css?v=1"><script src="src/a.js?v=9"></script>${extraDirect?'<script src="src/b.js"></script>':''}<script>window.__keloBootReady=true;window.dispatchEvent(new Event('kelo:boot-ready'));</script><script src="lazy.js"></script>`);return dir;}
const baseDir=fixture(100),smallerDir=fixture(80),largerDir=fixture(120),addedDir=fixture(80,{extraDirect:true}),dependencyDir=fixture(80,{extraDependency:true}),dependencyGrewDir=fixture(100,{assetBytes:50});
try{
  const base=measureBootFootprint(baseDir),smaller=measureBootFootprint(smallerDir),larger=measureBootFootprint(largerDir),added=measureBootFootprint(addedDir),dependency=measureBootFootprint(dependencyDir),dependencyGrew=measureBootFootprint(dependencyGrewDir);
  assert(base.schema==='kelo-boot-footprint-v2-static-closure','V2 schema required');
  assert(base.directResourceCount===2,'lazy direct resources must not be counted before ready');
  assert(base.dependencyResourceCount===2,'script/CSS payload closure must be counted');
  assert(base.resources.some(r=>r.path==='assets/core.png'&&r.via==='dependency'),'script image dependency missing');
  assert(base.resources.some(r=>r.path==='assets/bg.png'&&r.via==='dependency'),'CSS url dependency missing');
  assert(!base.resources.some(r=>r.path==='assets/lazy.png'),'post-ready script dependency must stay outside closure');
  assert(compareBootFootprints(base,smaller,{maxHtmlPrefixGrowthBytes:1024}).pass,'smaller boot must pass');
  const grew=compareBootFootprints(base,larger,{maxHtmlPrefixGrowthBytes:1024});assert(!grew.pass&&grew.regressions.some(r=>r.type==='critical-resource-grew'),'direct resource growth must fail');
  const extra=compareBootFootprints(base,added,{maxHtmlPrefixGrowthBytes:1024});assert(!extra.pass&&extra.regressions.some(r=>r.type==='critical-resource-added'),'new direct critical resource must fail');
  const depAdded=compareBootFootprints(base,dependency,{maxHtmlPrefixGrowthBytes:1024});assert(!depAdded.pass&&depAdded.regressions.some(r=>r.type==='critical-dependency-added'&&r.path==='assets/extra.png'),'new static payload dependency must fail');
  const depGrew=compareBootFootprints(base,dependencyGrew,{maxHtmlPrefixGrowthBytes:1024});assert(!depGrew.pass&&depGrew.regressions.some(r=>r.type==='critical-dependency-grew'&&r.path==='assets/core.png'),'dependency byte growth must fail');
  console.log('BOOT_FOOTPRINT_RATCHET_AUDIT_PASS');
}finally{for(const dir of [baseDir,smallerDir,largerDir,addedDir,dependencyDir,dependencyGrewDir])fs.rmSync(dir,{recursive:true,force:true});}
