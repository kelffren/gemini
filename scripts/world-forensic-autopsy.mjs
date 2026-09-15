import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const root=process.cwd();
const good=String(process.env.FORENSIC_GOOD||'').trim();
const bad=String(process.env.FORENSIC_BAD||'').trim();
const mode=String(process.env.FORENSIC_MODE||'WORLD_MOUNT').trim().toUpperCase();
const customCommand=String(process.env.FORENSIC_PROBE_COMMAND||'').trim();
const repeat=Math.max(1,Math.min(5,Number(process.env.FORENSIC_REPEAT||2)));
const timeoutMs=Math.max(5000,Number(process.env.FORENSIC_TIMEOUT_MS||30000));

if(!good||!bad){
  console.error('FORENSIC_GOOD and FORENSIC_BAD are required');
  process.exit(2);
}
if(mode==='CUSTOM'&&!customCommand){
  console.error('FORENSIC_PROBE_COMMAND is required for CUSTOM mode');
  process.exit(2);
}

const git=(args,opts={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:opts.stdio||['ignore','pipe','pipe'],...opts}).trim();
const originalSha=git(['rev-parse','HEAD']);
const originalRef=(()=>{try{return git(['symbolic-ref','--short','-q','HEAD']);}catch{return '';}})();
const runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-${bad.slice(0,10)}`;
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-world-forensic-'));
const tempEvidence=path.join(tempRoot,'evidence');
fs.mkdirSync(tempEvidence,{recursive:true});
const outputDir=path.join(root,'forensics',`world-autopsy-${runId}`);
const probeSnapshot=path.join(tempRoot,'world-forensic-probe.mjs');

if(mode!=='CUSTOM'){
  const source=path.join(root,'scripts','world-forensic-probe.mjs');
  if(!fs.existsSync(source))throw new Error(`FORENSIC_PROBE_SOURCE_MISSING:${source}`);
  fs.copyFileSync(source,probeSnapshot);
}

const report={
  schema:'kelo-world-forensic-autopsy-v1',
  startedAt:new Date().toISOString(),
  originalSha,
  originalRef:originalRef||null,
  inputs:{good,bad,mode,repeat,timeoutMs,customCommand:mode==='CUSTOM'?customCommand:null},
  endpointValidation:{},
  probes:[],
  boundary:null,
  changedFiles:[],
  riskFindings:[],
  probableFixes:[],
  notes:[]
};

function restore(){
  try{git(['checkout','--detach','--force',originalSha]);}catch{}
}
process.on('SIGINT',()=>{restore();process.exit(130);});
process.on('SIGTERM',()=>{restore();process.exit(143);});

function resolveRef(ref){return git(['rev-parse','--verify',`${ref}^{commit}`]);}
function isAncestor(a,b){
  const r=spawnSync('git',['merge-base','--is-ancestor',a,b],{cwd:root,stdio:'ignore'});
  return r.status===0;
}

function runProbe(sha,label){
  git(['checkout','--detach','--force',sha]);
  const started=Date.now();
  let proc;
  if(mode==='CUSTOM'){
    proc=spawnSync('/bin/bash',['-lc',customCommand],{
      cwd:root,
      encoding:'utf8',
      timeout:timeoutMs+15000,
      env:{...process.env,FORENSIC_SHA:sha,FORENSIC_EVIDENCE_DIR:tempEvidence}
    });
  }else{
    proc=spawnSync(process.execPath,[probeSnapshot],{
      cwd:root,
      encoding:'utf8',
      timeout:timeoutMs+20000,
      env:{...process.env,FORENSIC_MODE:mode,FORENSIC_TIMEOUT_MS:String(timeoutMs),FORENSIC_EVIDENCE_DIR:tempEvidence}
    });
  }
  const row={
    sha,
    label,
    ok:proc.status===0,
    status:proc.status,
    signal:proc.signal||null,
    durationMs:Date.now()-started,
    stdout:String(proc.stdout||'').slice(-12000),
    stderr:String(proc.stderr||'').slice(-12000),
    at:new Date().toISOString()
  };
  if(proc.error)row.error=String(proc.error?.stack||proc.error);
  report.probes.push(row);
  console.log(`[FORENSIC] ${label} ${sha.slice(0,12)} => ${row.ok?'GOOD':'BAD'} (${row.durationMs}ms)`);
  return row.ok;
}

function repeatProbe(sha,prefix,count){
  const results=[];
  for(let i=0;i<count;i++)results.push(runProbe(sha,`${prefix}#${i+1}`));
  return results;
}

function changedInventory(parent,firstBad){
  const names=git(['diff','--name-status',parent,firstBad]).split('\n').filter(Boolean);
  const nums=new Map(git(['diff','--numstat',parent,firstBad]).split('\n').filter(Boolean).map(line=>{
    const [add,del,...rest]=line.split('\t');return [rest.join('\t'),{additions:add,deletions:del}];
  }));
  return names.map(line=>{
    const [status,...rest]=line.split('\t');
    const file=rest[rest.length-1];
    return {status,file,...(nums.get(file)||{})};
  });
}

const RISK_PATTERNS=[
  ['MutationObserver',7,/\bMutationObserver\b/],
  ['broad subtree observer',6,/subtree\s*:\s*true|document\.body/],
  ['DOM rewrite',5,/\.innerHTML\s*=|\.outerHTML\s*=|replaceChildren\s*\(|insertAdjacentHTML\s*\(/],
  ['event listener',2,/addEventListener\s*\(/],
  ['interval',3,/setInterval\s*\(/],
  ['timeout',1,/setTimeout\s*\(/],
  ['animation frame',3,/requestAnimationFrame\s*\(/],
  ['worker',4,/\bnew\s+Worker\s*\(|\bWorker\s*\(/],
  ['structured clone',2,/structuredClone\s*\(/],
  ['IndexedDB',2,/\bindexedDB\b|IDBDatabase/],
  ['dynamic import',1,/\bimport\s*\(/],
  ['cloneNode',2,/cloneNode\s*\(/],
  ['unbounded loop',8,/while\s*\(\s*true\s*\)|for\s*\(\s*;\s*;\s*\)/]
];

function scanDiff(parent,firstBad){
  const diff=git(['diff','--unified=0','--no-color',parent,firstBad]);
  let file='';
  const findings=[];
  for(const raw of diff.split('\n')){
    if(raw.startsWith('+++ b/')){file=raw.slice(6);continue;}
    if(!raw.startsWith('+')||raw.startsWith('+++'))continue;
    const line=raw.slice(1);
    for(const [kind,score,re] of RISK_PATTERNS){
      if(re.test(line))findings.push({file,kind,score,line:line.trim().slice(0,500)});
    }
  }
  return findings.sort((a,b)=>b.score-a.score);
}

function findProbableFixes(firstBad,head,files){
  const keyword=/\b(fix|freeze|frozen|hang|storm|observer|loop|boot|mount|safari|iphone|performance|regression|deadlock|stuck)\b/i;
  const seen=new Set(),rows=[];
  for(const file of files){
    let text='';
    try{text=git(['log','--format=%H%x09%s','--reverse',`${firstBad}..${head}`,'--',file]);}catch{}
    for(const line of text.split('\n').filter(Boolean)){
      const tab=line.indexOf('\t');
      if(tab<0)continue;
      const sha=line.slice(0,tab),subject=line.slice(tab+1);
      if(!keyword.test(subject))continue;
      const key=`${sha}:${file}`;
      if(seen.has(key))continue;
      seen.add(key);
      rows.push({sha,subject,file});
    }
  }
  return rows.slice(0,80);
}

function markdown(r){
  const b=r.boundary||{};
  const risks=r.riskFindings.slice(0,30).map(x=>`| ${x.score} | \`${x.file}\` | ${x.kind} | \`${x.line.replaceAll('|','\\|')}\` |`).join('\n')||'| — | — | — | — |';
  const files=r.changedFiles.map(x=>`- ${x.status} \`${x.file}\` (+${x.additions??'?'} / -${x.deletions??'?'})`).join('\n')||'- none';
  const fixes=r.probableFixes.slice(0,30).map(x=>`- \`${x.sha.slice(0,12)}\` ${x.subject} — \`${x.file}\``).join('\n')||'- none found';
  const probes=r.probes.map(x=>`- ${x.ok?'GOOD':'BAD'} \`${x.sha.slice(0,12)}\` ${x.label} (${x.durationMs} ms)`).join('\n');
  return `# World Forensic Autopsy Report\n\nGenerated: ${r.endedAt||new Date().toISOString()}\n\n## Inputs\n\n- GOOD: \`${r.inputs.good}\`\n- BAD: \`${r.inputs.bad}\`\n- Mode: **${r.inputs.mode}**\n\n## Boundary\n\n- Status: **${b.confirmed?'CONFIRMED':'UNCONFIRMED'}**\n- Last GOOD / parent: \`${b.parent||'—'}\`\n- First BAD: \`${b.firstBad||'—'}\`\n- Commit: ${b.subject||'—'}\n- Parent repeats: ${(b.parentResults||[]).map(Boolean).join(', ')||'—'}\n- Bad repeats: ${(b.badResults||[]).map(Boolean).join(', ')||'—'}\n\n## Probe trail\n\n${probes}\n\n## Files changed at boundary\n\n${files}\n\n## Risk scanner\n\nRisk score prioritizes review; it is not proof of causality.\n\n| Score | File | Side effect | Added line |\n| ---: | --- | --- | --- |\n${risks}\n\n## Probable later fixes touching the same files\n\n${fixes}\n\n## Interpretation rules\n\n- Do not call FIRST BAD confirmed unless the parent repeatedly passes and FIRST BAD repeatedly fails.\n- Run BOOT and WORLD_MOUNT separately when a richer UI test may introduce a secondary boundary.\n- Chromium evidence is not REAL IPHONE evidence.\n- A risk hit is a lead for code review, not a causal verdict.\n`;
}

let exitCode=0;
try{
  const goodSha=resolveRef(good),badSha=resolveRef(bad);
  report.inputs.goodResolved=goodSha;
  report.inputs.badResolved=badSha;
  if(!isAncestor(goodSha,badSha))throw new Error('FORENSIC_GOOD_IS_NOT_ANCESTOR_OF_BAD');

  const goodOk=runProbe(goodSha,'ENDPOINT_GOOD');
  const badOk=runProbe(badSha,'ENDPOINT_BAD');
  report.endpointValidation={goodOk,badIsBad:!badOk};
  if(!goodOk||badOk){
    report.notes.push('INVALID_ENDPOINTS: expected GOOD=pass and BAD=fail');
    exitCode=3;
  }else{
    const commits=git(['rev-list','--ancestry-path','--reverse',`${goodSha}..${badSha}`]).split('\n').filter(Boolean);
    if(!commits.length)throw new Error('FORENSIC_EMPTY_ANCESTRY_PATH');
    let lo=0,hi=commits.length-1;
    while(lo<hi){
      const mid=Math.floor((lo+hi)/2);
      const ok=runProbe(commits[mid],`BISECT_${mid+1}_OF_${commits.length}`);
      if(ok)lo=mid+1;else hi=mid;
    }
    const firstBad=commits[lo];
    const parent=git(['rev-parse',`${firstBad}^`]);
    const parentResults=repeatProbe(parent,'REVALIDATE_PARENT_GOOD',repeat);
    const badResults=repeatProbe(firstBad,'REVALIDATE_FIRST_BAD',repeat);
    const confirmed=parentResults.every(Boolean)&&badResults.every(v=>!v);
    const subject=git(['show','-s','--format=%s',firstBad]);
    const date=git(['show','-s','--format=%cI',firstBad]);
    report.boundary={firstBad,parent,subject,date,parentResults,badResults,confirmed,candidateCount:commits.length};
    report.changedFiles=changedInventory(parent,firstBad);
    report.riskFindings=scanDiff(parent,firstBad);
    report.probableFixes=findProbableFixes(firstBad,originalSha,report.changedFiles.map(x=>x.file));
    if(!confirmed){report.notes.push('BOUNDARY_FLAKY_OR_UNCONFIRMED');exitCode=4;}
  }
}catch(error){
  report.fatal=String(error?.stack||error?.message||error);
  exitCode=5;
}finally{
  restore();
  report.endedAt=new Date().toISOString();
  fs.mkdirSync(outputDir,{recursive:true});
  fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(outputDir,'REPORT.md'),markdown(report));
  if(fs.existsSync(tempEvidence))fs.cpSync(tempEvidence,path.join(outputDir,'probe-evidence'),{recursive:true});
  console.log(`[FORENSIC] report: ${path.relative(root,outputDir)}`);
  if(report.boundary)console.log(`[FORENSIC] ${report.boundary.confirmed?'CONFIRMED':'UNCONFIRMED'} first bad: ${report.boundary.firstBad} ${report.boundary.subject}`);
}

process.exit(exitCode);
