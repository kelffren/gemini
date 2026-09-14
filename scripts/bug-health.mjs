#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const dir=path.join(root,'bugs','registry');
const incomingDir=path.join(root,'bugs','incoming');
const bugs=fs.existsSync(dir)?fs.readdirSync(dir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8'))):[];
const reports=[];
if(fs.existsSync(incomingDir)){
  for(const name of fs.readdirSync(incomingDir).filter(n=>/^REPORT-.*\.json$/.test(n))){
    try{reports.push({name,...JSON.parse(fs.readFileSync(path.join(incomingDir,n),'utf8'))});}catch{}
  }
}
const severityWeight={critical:40,high:25,medium:12,low:5};
const terminal=new Set(['CLOSED','WONT_FIX']);
const byStatus={},bySeverity={},hotspots=new Map(),reportStatus={},fingerprints=new Map();

function regressionProtected(b){
  const refs=[...(b.fix?.files||[]),...(b.verification?.evidence||[])];
  return refs.some(v=>typeof v==='string'&&(/(^|\/)(tests?|scripts)\//i.test(v)||/\.(spec|test)\.[cm]?[jt]s$/i.test(v)))||Boolean(b.regression?.test||b.regression?.command);
}
function attentionScore(b){
  let score=severityWeight[String(b.severity).toLowerCase()]||5;
  const fails=(b.attempt_history||[]).filter(a=>a.validation?.result==='FAIL').length;
  score+=Math.min(24,fails*4);
  if(b.status==='FIXED_PENDING_VERIFY')score+=16;
  if(b.status==='REOPENED')score+=20;
  if(b.status==='BLOCKED')score+=10;
  if((b.blocked_by||[]).length)score+=Math.min(12,b.blocked_by.length*4);
  if(['VERIFIED','CLOSED'].includes(b.status)&&!regressionProtected(b))score+=18;
  if(terminal.has(b.status)&&b.status!=='CLOSED')score=Math.max(0,score-8);
  return {score,fails};
}

for(const b of bugs){
  byStatus[b.status]=(byStatus[b.status]||0)+1;
  bySeverity[b.severity]=(bySeverity[b.severity]||0)+1;
  const weight=(severityWeight[String(b.severity).toLowerCase()]||5)+((b.attempt_history||[]).filter(a=>a.validation?.result==='FAIL').length*2);
  const files=new Set([...(b.suspected_files||[]),...(b.fix?.files||[])]);
  for(const a of b.attempt_history||[])for(const f of a.change?.files||[])files.add(f);
  for(const f of files){
    const prev=hotspots.get(f)||{bugs:new Set(),weight:0};
    prev.bugs.add(b.id);prev.weight+=weight;hotspots.set(f,prev);
  }
}
for(const r of reports){
  const status=r.triage?.status||'UNKNOWN';
  reportStatus[status]=(reportStatus[status]||0)+1;
  const fp=r.diagnostics?.fingerprint;
  if(fp){
    const c=fingerprints.get(fp)||{count:0,bugIds:new Set(),latest:null};
    c.count++;if(r.triage?.bug_id)c.bugIds.add(r.triage.bug_id);
    if(r.created_at&&(!c.latest||r.created_at>c.latest))c.latest=r.created_at;
    fingerprints.set(fp,c);
  }
}
const attention=bugs.map(b=>({id:b.id,status:b.status,severity:b.severity,title:b.title,...attentionScore(b)})).sort((a,b)=>b.score-a.score||b.fails-a.fails);
const active=bugs.filter(b=>!terminal.has(b.status)).length;
const verificationDebt=bugs.filter(b=>b.status==='FIXED_PENDING_VERIFY').length;
const reopened=bugs.filter(b=>b.status==='REOPENED').length;
const blocked=bugs.filter(b=>b.status==='BLOCKED'||(b.blocked_by||[]).length).length;

console.log('# BUG HEALTH');
console.log(`Canonical bugs: ${bugs.length} | active=${active} | pending_verify=${verificationDebt} | reopened=${reopened} | blocked=${blocked}`);
console.log(`Incoming reports: ${reports.length} | fingerprinted=${[...fingerprints.values()].reduce((n,c)=>n+c.count,0)}`);
console.log('Status:',JSON.stringify(byStatus));
console.log('Severity:',JSON.stringify(bySeverity));
console.log('Report triage:',JSON.stringify(reportStatus));

console.log('\nHighest attention debt:');
for(const x of attention.slice(0,10))console.log(`- score=${x.score} ${x.id} fails=${x.fails} [${x.status}/${x.severity}] ${x.title}`);

console.log('\nWeighted historical file hotspots:');
for(const [f,v] of [...hotspots.entries()].sort((a,b)=>b[1].weight-a[1].weight||b[1].bugs.size-a[1].bugs.size).slice(0,15))console.log(`- weight=${v.weight} bugs=${v.bugs.size} ${f} (${[...v.bugs].join(', ')})`);

console.log('\nRecurring incoming fingerprints:');
const recurrent=[...fingerprints.entries()].filter(([,c])=>c.count>=2).sort((a,b)=>b[1].count-a[1].count);
if(!recurrent.length)console.log('- none');
for(const [fp,c] of recurrent.slice(0,10))console.log(`- ${fp} x${c.count} bugs=${[...c.bugIds].join(', ')||'unassigned'} latest=${c.latest||'unknown'}`);

console.log('\nPending verification:');
const pending=bugs.filter(b=>b.status==='FIXED_PENDING_VERIFY');
if(!pending.length)console.log('- none');
for(const b of pending)console.log(`- ${b.id}: ${b.verification?.method||'verification method missing'} | regression=${regressionProtected(b)?'yes':'missing'}`);

console.log('\nInterpretation: attention score is a triage heuristic, not proof of product impact or root cause.');
