/* KELO-INDEX
 * area: QA / CREATOR ASSET INGEST
 * owner: Kelo Creator Asset Bridge
 * keys: PNG SPACE CLI SMOKE STARTUP REPORT PROVENANCE PROCESS
 * purpose: execute the real asset-space CLI on a tiny generated PNG so startup/fingerprint/report regressions fail before larger asset scans
 * public-api: CLI audit
 * state-owned: temporary directory only
 * online: N/A; deterministic build-time audit
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {encodeRgbaPng} from '../src/creators/assets/png-space-optimizer.mjs';

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-asset-space-cli-'));
try{
  const width=16,height=16,rgba=Buffer.alloc(width*height*4);
  for(let y=0;y<height;y+=1)for(let x=0;x<width;x+=1){const o=(y*width+x)*4,inside=x>=4&&x<=11&&y>=4&&y<=11;rgba[o]=inside?220:0;rgba[o+1]=inside?170:0;rgba[o+2]=inside?60:0;rgba[o+3]=inside?255:0;}
  const input=path.join(temp,'fixture.png'),reportDir=path.join(temp,'report'),cacheDir=path.join(temp,'cache');
  fs.writeFileSync(input,encodeRgbaPng(rgba,width,height,{level:1,filterStrategy:0}));
  const run=spawnSync(process.execPath,[
    path.resolve('scripts/asset-space-compiler.mjs'),
    `--input=${input}`,
    '--mode=strict',
    '--effort=auto',
    '--max-files=1',
    `--report=${reportDir}`,
    `--cache=${cacheDir}`
  ],{cwd:process.cwd(),encoding:'utf8',timeout:60_000});
  assert.equal(run.error,undefined,`CLI process error: ${run.error?.message||''}`);
  assert.equal(run.status,0,`CLI exit=${run.status}\nstdout=${run.stdout}\nstderr=${run.stderr}`);
  assert.ok(fs.existsSync(path.join(reportDir,'report.json')),'CLI report.json missing');
  assert.ok(fs.existsSync(path.join(reportDir,'index.html')),'CLI index.html missing');
  const report=JSON.parse(fs.readFileSync(path.join(reportDir,'report.json'),'utf8'));
  assert.equal(report.fileCount,1,'CLI must process one fixture');
  assert.equal(report.mode,'strict','CLI strict mode missing');
  assert.equal(report.effort,'auto','CLI auto effort missing');
  assert.ok(typeof report.engineFingerprint==='string'&&report.engineFingerprint.length===64,'engine fingerprint missing');
  assert.ok(report.toolchain?.sha256?.length===64,'toolchain fingerprint missing');
  assert.equal(report.publishBlocked,0,'strict smoke must not be publish-blocked');
  assert.equal(report.files[0]?.exactPixels,true,'strict smoke output must be exact');
  const provenance=path.join(reportDir,report.files[0].provenance);
  assert.ok(fs.existsSync(provenance),'CLI provenance missing');
  console.log(JSON.stringify({status:'ASSET_SPACE_CLI_SMOKE_OK',fileCount:report.fileCount,beforeBytes:report.beforeBytes,afterBytes:report.afterBytes,savedPercent:Number(report.savedPercent.toFixed(3)),engineFingerprint:report.engineFingerprint.slice(0,12),toolchain:report.toolchain.sha256.slice(0,12)},null,2));
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
