#!/usr/bin/env node
/* KELO-INDEX
 * area: BUILD / CREATORS / PIXELORAMA RUNTIME CDN
 * owner: Netlify static adapter
 * keys: PIXELORAMA GODOT MATCHED RUNTIME ORPHAN BRANCH VERSIONED CDN CORS
 * purpose: materialize the isolated matched Pixelorama Web runtime into an immutable versioned Netlify path without committing WASM/PCK to main
 * do-not: NO compile Godot here, NO trust unverified runtime metadata, NO overwrite versioned runtime in place
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const repo=process.env.KELO_RUNTIME_REPO||'https://github.com/kelffren/gemini.git';
const branch=process.env.KELO_PIXELORAMA_RUNTIME_BRANCH||'pixelorama-runtime-v1';
const runtimeRoot=path.join(root,'tools','pixelorama','runtime');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-pixelorama-runtime-'));

function fail(message){throw new Error(`PIXELORAMA_RUNTIME_SYNC_FAILED: ${message}`);}
function requireFile(file,minBytes=1){
  const target=path.join(temp,file);
  if(!fs.existsSync(target))fail(`missing ${file}`);
  const size=fs.statSync(target).size;
  if(size<minBytes)fail(`${file} too small (${size} bytes)`);
  return size;
}

try{
  execFileSync('git',['clone','--depth=1','--single-branch','--branch',branch,repo,temp],{stdio:'inherit'});
  const runtimeCommit=execFileSync('git',['-C',temp,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
  const metadata=JSON.parse(fs.readFileSync(path.join(temp,'kelo-runtime.json'),'utf8'));

  if(metadata.keloWebBridge!==true)fail('runtime metadata does not prove KeloWebBridge');
  if(metadata.matchedEngine!==true)fail('runtime metadata is not a matched JS/WASM/PCK export');
  if(String(metadata.godot)!=='4.7.2')fail(`unexpected Godot ${metadata.godot}`);
  if(metadata.threads!==false)fail('mobile runtime must remain threadless');

  const sizes={
    js:requireFile('index.js',100000),
    wasm:requireFile('index.wasm',30000000),
    pck:requireFile('index.pck',5000000),
    html:requireFile('index.html',1000),
  };

  fs.mkdirSync(runtimeRoot,{recursive:true});
  const versionDir=path.join(runtimeRoot,runtimeCommit);
  fs.rmSync(versionDir,{recursive:true,force:true});
  fs.mkdirSync(versionDir,{recursive:true});

  for(const entry of fs.readdirSync(temp,{withFileTypes:true})){
    if(entry.name==='.git')continue;
    fs.cpSync(path.join(temp,entry.name),path.join(versionDir,entry.name),{recursive:true});
  }

  const current={
    runtimeCommit,
    branch,
    syncedAt:new Date().toISOString(),
    metadata,
    sizes,
    basePath:`/tools/pixelorama/runtime/${runtimeCommit}`,
  };
  fs.writeFileSync(path.join(runtimeRoot,'current.json'),JSON.stringify(current,null,2));
  console.log(`PIXELORAMA NETLIFY RUNTIME SYNC PASS — ${runtimeCommit} — WASM ${(sizes.wasm/1048576).toFixed(1)} MB`);
}finally{
  fs.rmSync(temp,{recursive:true,force:true});
}
