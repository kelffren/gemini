#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createBugObserver } from '../src/core/bug-observability.mjs';

const root=process.cwd();
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
for(const name of ['bug:scan','bug:risk','bug:health','audit:bugs','audit:bug-regressions']){
  if(!pkg.scripts?.[name])throw new Error(`missing package script ${name}`);
}
const risk=JSON.parse(fs.readFileSync(path.join(root,'bugs','RISK_MAP.json'),'utf8'));
if(!Array.isArray(risk.rules)||risk.rules.length<3)throw new Error('risk map missing rules');
for(const rule of risk.rules){
  if(!rule.id||!Array.isArray(rule.patterns)||!rule.patterns.length||!Number.isFinite(Number(rule.score)))throw new Error(`invalid risk rule ${rule.id||'unknown'}`);
}
execFileSync(process.execPath,['scripts/bug-health.mjs'],{cwd:root,stdio:'pipe'});
execFileSync(process.execPath,['scripts/bug-regression-audit.mjs'],{cwd:root,stdio:'pipe'});
const tmp=path.join(os.tmpdir(),`kelo-bug-scan-${process.pid}.log`);
fs.writeFileSync(tmp,'Safari World Editor failed after loading shell: CREATOR_WORLD_STUDIO_MOUNT_FAILED at world-workspace.mjs:123:4\n');
try{
  const scan=execFileSync(process.execPath,['scripts/bug-scan.mjs',tmp],{cwd:root,encoding:'utf8'});
  if(!/fingerprint=[0-9a-f]{16}/.test(scan))throw new Error('bug:scan did not produce a fingerprint');
  if(!/BUG-0003/.test(scan))throw new Error('bug:scan did not surface the known World bug in top matches');
}finally{try{fs.unlinkSync(tmp);}catch{}}
const mem=new Map();
const storage={getItem:k=>mem.has(k)?mem.get(k):null,setItem:(k,v)=>mem.set(k,v),removeItem:k=>mem.delete(k)};
const fakeRoot={sessionStorage:storage,dispatchEvent(){}};
const obs=createBugObserver({root:fakeRoot,flow:'selftest',bugId:'BUG-TEST',version:'selftest'});
obs.mark('START');
obs.fail(new Error('synthetic'),'SELFTEST');
const events=obs.read();
if(events.length!==2||events[0].milestone!=='START'||events[1].milestone!=='FAIL')throw new Error('runtime observability timeline failed');
console.log(`BUG INTELLIGENCE SELFTEST PASS — ${risk.rules.length} risk rules, scanner fingerprinting, health/regression audits and runtime milestones validated.`);
