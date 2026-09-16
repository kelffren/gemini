/* KELO-INDEX
 * area: BUILD / BOOT QA
 * owner: Kelo Boot Footprint QA
 * keys: BOOT FOOTPRINT RATCHET AUDIT FIRST PLAYABLE
 * purpose: deterministic self-test for critical-path byte measurement and regression classification
 * public-api: CLI audit
 * state-owned: temporary files only
 * online: N/A
 */
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {measureBootFootprint,compareBootFootprints} from '../src/build/boot-footprint-ratchet.mjs';
const assert=(v,m)=>{if(!v)throw new Error(m);};
function fixture(scriptBytes,extra=false){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-boot-footprint-'));fs.mkdirSync(path.join(dir,'src'),{recursive:true});fs.writeFileSync(path.join(dir,'src','a.js'),'a'.repeat(scriptBytes));fs.writeFileSync(path.join(dir,'style.css'),'x'.repeat(20));if(extra)fs.writeFileSync(path.join(dir,'src','b.js'),'b'.repeat(5));fs.writeFileSync(path.join(dir,'index.html'),`<!doctype html><link rel="stylesheet" href="style.css?v=1"><script src="src/a.js?v=9"></script>${extra?'<script src="src/b.js"></script>':''}<script>window.__keloBootReady=true;window.dispatchEvent(new Event('kelo:boot-ready'));</script><script src="lazy.js"></script>`);return dir;}
const baseDir=fixture(100),smallerDir=fixture(80),largerDir=fixture(120),addedDir=fixture(80,true);
try{
  const base=measureBootFootprint(baseDir),smaller=measureBootFootprint(smallerDir),larger=measureBootFootprint(largerDir),added=measureBootFootprint(addedDir);
  assert(base.resourceCount===2,'lazy resources must not be counted before ready');
  assert(base.externalStoredBytes===120,'base byte measurement mismatch');
  assert(compareBootFootprints(base,smaller,{maxHtmlPrefixGrowthBytes:1024}).pass,'smaller boot must pass');
  const grew=compareBootFootprints(base,larger,{maxHtmlPrefixGrowthBytes:1024});assert(!grew.pass&&grew.regressions.some(r=>r.type==='critical-resource-grew'),'resource growth must fail');
  const extra=compareBootFootprints(base,added,{maxHtmlPrefixGrowthBytes:1024});assert(!extra.pass&&extra.regressions.some(r=>r.type==='critical-resource-added'),'new critical resource must fail');
  console.log('BOOT_FOOTPRINT_RATCHET_AUDIT_PASS');
}finally{for(const dir of [baseDir,smallerDir,largerDir,addedDir])fs.rmSync(dir,{recursive:true,force:true});}
