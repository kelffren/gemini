#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const dir=path.join(process.cwd(),'bugs','registry');
const bugs=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'))):[];
const byStatus={},bySeverity={},hotspots=new Map();
for(const b of bugs){
  byStatus[b.status]=(byStatus[b.status]||0)+1; bySeverity[b.severity]=(bySeverity[b.severity]||0)+1;
  const files=new Set([...(b.suspected_files||[]),...(b.fix?.files||[])]);
  for(const a of b.attempt_history||[])for(const f of a.change?.files||[])files.add(f);
  for(const f of files)hotspots.set(f,(hotspots.get(f)||0)+1);
}
const unstable=bugs.map(b=>({id:b.id,fail:(b.attempt_history||[]).filter(a=>a.validation?.result==='FAIL').length,status:b.status,severity:b.severity,title:b.title})).sort((a,b)=>b.fail-a.fail);
console.log('# BUG HEALTH');
console.log(`Total: ${bugs.length}`);
console.log('Status:',JSON.stringify(byStatus));
console.log('Severity:',JSON.stringify(bySeverity));
console.log('\nMost failure-heavy bugs:');
for(const x of unstable.slice(0,10))console.log(`- ${x.id} fails=${x.fail} [${x.status}/${x.severity}] ${x.title}`);
console.log('\nHistorical file hotspots:');
for(const [f,n] of [...hotspots.entries()].sort((a,b)=>b[1]-a[1]).slice(0,15))console.log(`- ${n}x ${f}`);
console.log('\nPending verification:');
for(const b of bugs.filter(b=>b.status==='FIXED_PENDING_VERIFY'))console.log(`- ${b.id}: ${b.verification?.method||'verification method missing'}`);
