/* KELO-INDEX
 * area: QA / BUG INTELLIGENCE / WORLD FORENSICS
 * owner: /bugs Bug Intelligence + Recovery Mesh
 * keys: FORENSIC AUTOPSY FIRST-BAD REVALIDATE DIFF SIDE-EFFECTS FIX-CANDIDATE
 * purpose: envuelve recovery:bisect con validación de endpoints, revalidación parent GOOD / child BAD, diff quirúrgico y búsqueda de fixes posteriores
 * public-api: FORENSIC_GOOD=<sha> FORENSIC_BAD=<sha> FORENSIC_MODE=BOOT|WORLD_MOUNT|MOVEMENT|FULL node scripts/world-forensic-autopsy.mjs
 * consumes: scripts/recovery-bisect.mjs, scripts/recovery-profile-runner.mjs, git, Playwright instalado
 * state-owned: forensics/world-autopsy-* y temporales bajo os.tmpdir()
 * online: N/A; QA cloud/local only
 * do-not: no implementa otro bisect paralelo, no force-push, no modifica main, no declara causalidad solo por score
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync,spawn,spawnSync} from 'node:child_process';

const root=process.cwd();
const good=String(process.env.FORENSIC_GOOD||'').trim();
const bad=String(process.env.FORENSIC_BAD||'').trim();
const mode=String(process.env.FORENSIC_MODE||'WORLD_MOUNT').trim().toUpperCase();
const repeat=Math.max(1,Math.min(5,Number(process.env.FORENSIC_REPEAT||2)));
const modeToProfile={BOOT:'boot',WORLD_MOUNT:'world',MOVEMENT:'movement',FULL:'full'};
const profile=modeToProfile[mode];

if(!good||!bad||!profile){
  console.error('Usage: FORENSIC_GOOD=<sha> FORENSIC_BAD=<sha> FORENSIC_MODE=BOOT|WORLD_MOUNT|MOVEMENT|FULL node scripts/world-forensic-autopsy.mjs');
  process.exit(2);
}

const git=(args,opts={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:opts.stdio||['ignore','pipe','pipe'],...opts}).trim();
const originalSha=git(['rev-parse','HEAD']);
const originalRef=(()=>{try{return git(['symbolic-ref','--short','-q','HEAD']);}catch{return '';}})();
const runId=`${new Date().toISOString().replace(/[:.]/g,'-')}-${bad.slice(0,10)}`;
const tempRoot=fs.mkdtempSync(path.join(os.tmpdir(),'kelo-world-forensic-'));
const tempRecovery=path.join(tempRoot,'recovery-bisect');
const tempEvidence=path.join(tempRoot,'revalidation');
const stableRunner=path.join(tempRoot,'recovery-profile-runner.mjs');
const outputDir=path.join(root,'forensics',`world-autopsy-${runId}`);
fs.mkdirSync(tempRecovery,{recursive:true});
fs.mkdirSync(tempEvidence,{recursive:true});
fs.copyFileSync(path.join(root,'scripts','recovery-profile-runner.mjs'),stableRunner);

const report={
  schema:'kelo-world-forensic-autopsy-v2',
  owner:'Bug Intelligence / Recovery Mesh',
  startedAt:new Date().toISOString(),
  originalSha,
  originalRef:originalRef||null,
  inputs:{good,bad,mode,profile,repeat},
  endpointValidation:{},
  revalidation:[],
  recoveryBisect:null,
  boundary:null,
  changedFiles:[],
  riskFindings:[],
  probableFixes:[],
  notes:[]
};

function restore(){
  try{
    if(originalRef)git(['checkout','--force',originalRef]);
    else git(['checkout','--detach','--force',originalSha]);
  }catch{
    try{git(['checkout','--detach','--force',originalSha]);}catch{}
  }
}
process.on('SIGINT',()=>{restore();process.exit(130);});
process.on('SIGTERM',()=>{restore();process.exit(143);});

function resolveRef(ref){return git(['rev-parse','--verify',`${ref}^{commit}`]);}
function isAncestor(a,b){return spawnSync('git',['merge-base','--is-ancestor',a,b],{cwd:root,stdio:'ignore'}).status===0;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function startServer(port){
  const logPath=path.join(tempRoot,`server-${port}.log`);
  const fd=fs.openSync(logPath,'a');
  const child=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1'],{cwd:root,stdio:['ignore',fd,fd]});
  const base=`http://127.0.0.1:${port}/`;
  const deadline=Date.now()+15000;
  while(Date.now()<deadline){
    try{const r=await fetch(base,{cache:'no-store'});if(r.ok)return {child,fd,base,logPath};}catch{}
    await sleep(250);
  }
  try{child.kill('SIGTERM');}catch{}
  try{fs.closeSync(fd);}catch{}
  throw new Error('FORENSIC_REVALIDATION_SERVER_NOT_READY');
}
function stopServer(server){
  try{server?.child?.kill('SIGTERM');}catch{}
  try{if(server?.fd!=null)fs.closeSync(server.fd);}catch{}
}

function runProfileAt(sha,label,base){
  git(['checkout','--detach','--force',sha]);
  const started=Date.now();
  const proc=spawnSync(process.execPath,[stableRunner,`--profile=${profile}`,`--base=${base}`,`--artifacts=${tempEvidence}`],{
    cwd:root,
    encoding:'utf8',
    timeout:90000,
    env:{...process.env,KELO_PAGES:base,KELO_RECOVERY_PROFILE:profile,KELO_RECOVERY_ARTIFACTS:tempEvidence}
  });
  const row={
    sha,label,profile,durationMs:Date.now()-started,status:proc.status,signal:proc.signal||null,
    result:proc.status===0?'PASS':proc.status===125?'SKIP':'FAIL',
    stdout:String(proc.stdout||'').slice(-10000),stderr:String(proc.stderr||'').slice(-10000),at:new Date().toISOString()
  };
  if(proc.error)row.error=String(proc.error?.stack||proc.error);
  report.revalidation.push(row);
  console.log(`[FORENSIC] ${label} ${sha.slice(0,12)} => ${row.result}`);
  return row;
}

function changedInventory(parent,firstBad){
  const names=git(['diff','--name-status',parent,firstBad]).split('\n').filter(Boolean);
  const nums=new Map(git(['diff','--numstat',parent,firstBad]).split('\n').filter(Boolean).map(line=>{
    const [add,del,...rest]=line.split('\t');return [rest.join('\t'),{additions:add,deletions:del}];
  }));
  return names.map(line=>{
    const [status,...rest]=line.split('\t');const file=rest[rest.length-1];return {status,file,...(nums.get(file)||{})};
  });
}

const RISK_PATTERNS=[
  ['MutationObserver',7,/\bMutationObserver\b/],
  ['broad/global observer',6,/subtree\s*:\s*true|document\.body/],
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
  let file='';const findings=[];
  for(const raw of diff.split('\n')){
    if(raw.startsWith('+++ b/')){file=raw.slice(6);continue;}
    if(!raw.startsWith('+')||raw.startsWith('+++'))continue;
    const line=raw.slice(1);
    for(const [kind,score,re] of RISK_PATTERNS)if(re.test(line))findings.push({file,kind,score,line:line.trim().slice(0,500)});
  }
  return findings.sort((a,b)=>b.score-a.score);
}
function findProbableFixes(firstBad,head,files){
  const keyword=/\b(fix|freeze|frozen|hang|storm|observer|loop|boot|mount|safari|iphone|performance|regression|deadlock|stuck)\b/i;
  const seen=new Set(),rows=[];
  for(const file of files){
    let text='';try{text=git(['log','--format=%H%x09%s','--reverse',`${firstBad}..${head}`,'--',file]);}catch{}
    for(const line of text.split('\n').filter(Boolean)){
      const tab=line.indexOf('\t');if(tab<0)continue;
      const sha=line.slice(0,tab),subject=line.slice(tab+1);if(!keyword.test(subject))continue;
      const key=`${sha}:${file}`;if(seen.has(key))continue;seen.add(key);rows.push({sha,subject,file});
    }
  }
  return rows.slice(0,80);
}
function markdown(r){
  const b=r.boundary||{};
  const risks=r.riskFindings.slice(0,30).map(x=>`| ${x.score} | \`${x.file}\` | ${x.kind} | \`${x.line.replaceAll('|','\\|')}\` |`).join('\n')||'| — | — | — | — |';
  const files=r.changedFiles.map(x=>`- ${x.status} \`${x.file}\` (+${x.additions??'?'} / -${x.deletions??'?'})`).join('\n')||'- none';
  const fixes=r.probableFixes.slice(0,30).map(x=>`- \`${x.sha.slice(0,12)}\` ${x.subject} — \`${x.file}\``).join('\n')||'- none found';
  const checks=r.revalidation.map(x=>`- ${x.result} \`${x.sha.slice(0,12)}\` ${x.label} (${x.durationMs} ms)`).join('\n')||'- none';
  return `# World Forensic Autopsy Report\n\nGenerated: ${r.endedAt||new Date().toISOString()}\n\nOwner: **${r.owner}**\n\n## Inputs\n\n- GOOD: \`${r.inputs.good}\`\n- BAD: \`${r.inputs.bad}\`\n- Mode: **${r.inputs.mode}** / recovery profile **${r.inputs.profile}**\n\n## Recovery bisect\n\n- Result: **${r.recoveryBisect?.result||'—'}**\n- First bad candidate: \`${r.recoveryBisect?.firstBad||'—'}\`\n\n## Boundary revalidation\n\n- Status: **${b.confirmed?'CONFIRMED':'UNCONFIRMED'}**\n- Parent / last GOOD: \`${b.parent||'—'}\`\n- First BAD: \`${b.firstBad||'—'}\`\n- Commit: ${b.subject||'—'}\n- Parent repeats: ${(b.parentResults||[]).join(', ')||'—'}\n- Bad repeats: ${(b.badResults||[]).join(', ')||'—'}\n\n${checks}\n\n## Files changed at boundary\n\n${files}\n\n## Side-effect risk scanner\n\nScores prioritize code review; they are not causal proof.\n\n| Score | File | Side effect | Added line |\n| ---: | --- | --- | --- |\n${risks}\n\n## Probable later fixes touching the same files\n\n${fixes}\n\n## Rules\n\n- `recovery:bisect` is the single owner of historical binary search.\n- FIRST BAD is confirmed only when parent repeatedly PASSes and candidate repeatedly FAILs.\n- Use the smallest probe matching the symptom; richer UI tests can expose secondary boundaries.\n- Chromium/mobile emulation is not REAL IPHONE evidence.\n- Risk findings and fix-message matches are leads, not causal verdicts.\n`;
}

let exitCode=0;
try{
  const goodSha=resolveRef(good),badSha=resolveRef(bad);
  report.inputs.goodResolved=goodSha;report.inputs.badResolved=badSha;
  if(!isAncestor(goodSha,badSha))throw new Error('FORENSIC_GOOD_IS_NOT_ANCESTOR_OF_BAD');

  // Devil's Advocate: validate the assumptions before asking git bisect to trust them.
  let server=await startServer(4183);
  const goodEndpoint=runProfileAt(goodSha,'ENDPOINT_GOOD',server.base);
  const badEndpoint=runProfileAt(badSha,'ENDPOINT_BAD',server.base);
  stopServer(server);restore();
  report.endpointValidation={good:goodEndpoint.result,bad:badEndpoint.result};
  if(goodEndpoint.result!=='PASS'||badEndpoint.result!=='FAIL'){
    report.notes.push('INVALID_ENDPOINTS: GOOD must PASS and BAD must FAIL with the same stable recovery profile');
    exitCode=3;
  }else{
    // Cartographer: delegate binary search to the existing Bug Intelligence owner.
    const bisectProc=spawnSync(process.execPath,[path.join(root,'scripts','recovery-bisect.mjs'),`--good=${goodSha}`,`--bad=${badSha}`,`--profile=${profile}`,`--artifacts=${tempRecovery}`],{
      cwd:root,encoding:'utf8',timeout:60*60*1000,env:{...process.env,KELO_RECOVERY_ARTIFACTS:tempRecovery}
    });
    const bisectReportPath=path.join(tempRecovery,'bisect-report.json');
    if(!fs.existsSync(bisectReportPath))throw new Error(`FORENSIC_RECOVERY_BISECT_REPORT_MISSING:${String(bisectProc.stderr||'').slice(-3000)}`);
    report.recoveryBisect=JSON.parse(fs.readFileSync(bisectReportPath,'utf8'));
    report.recoveryBisect.stdout=String(bisectProc.stdout||'').slice(-12000);
    report.recoveryBisect.stderr=String(bisectProc.stderr||'').slice(-12000);
    const firstBad=report.recoveryBisect.firstBad;
    if(!firstBad)throw new Error('FORENSIC_RECOVERY_BISECT_INCONCLUSIVE');

    // Interpreter + Devil's Advocate: prove the boundary again with the same frozen runner.
    const parent=git(['rev-parse',`${firstBad}^`]);
    server=await startServer(4184);
    const parentRows=[],badRows=[];
    for(let i=0;i<repeat;i++)parentRows.push(runProfileAt(parent,`REVALIDATE_PARENT_GOOD#${i+1}`,server.base));
    for(let i=0;i<repeat;i++)badRows.push(runProfileAt(firstBad,`REVALIDATE_FIRST_BAD#${i+1}`,server.base));
    stopServer(server);restore();
    const parentResults=parentRows.map(x=>x.result),badResults=badRows.map(x=>x.result);
    const confirmed=parentResults.every(x=>x==='PASS')&&badResults.every(x=>x==='FAIL');
    const subject=git(['show','-s','--format=%s',firstBad]);
    const date=git(['show','-s','--format=%cI',firstBad]);
    report.boundary={firstBad,parent,subject,date,parentResults,badResults,confirmed};

    // Reporter: reduce the suspect surface to exactly the boundary diff.
    report.changedFiles=changedInventory(parent,firstBad);
    report.riskFindings=scanDiff(parent,firstBad);
    report.probableFixes=findProbableFixes(firstBad,originalSha,report.changedFiles.map(x=>x.file));
    if(!confirmed){report.notes.push('BOUNDARY_FLAKY_OR_UNCONFIRMED');exitCode=4;}
  }
}catch(error){
  report.fatal=String(error?.stack||error?.message||error);exitCode=5;
}finally{
  restore();
  report.endedAt=new Date().toISOString();
  fs.mkdirSync(outputDir,{recursive:true});
  fs.writeFileSync(path.join(outputDir,'report.json'),JSON.stringify(report,null,2));
  fs.writeFileSync(path.join(outputDir,'REPORT.md'),markdown(report));
  if(fs.existsSync(tempRecovery))fs.cpSync(tempRecovery,path.join(outputDir,'recovery-bisect'),{recursive:true});
  if(fs.existsSync(tempEvidence))fs.cpSync(tempEvidence,path.join(outputDir,'revalidation-evidence'),{recursive:true});
  console.log(`[FORENSIC] report: ${path.relative(root,outputDir)}`);
  if(report.boundary)console.log(`[FORENSIC] ${report.boundary.confirmed?'CONFIRMED':'UNCONFIRMED'} first bad: ${report.boundary.firstBad} ${report.boundary.subject}`);
}
process.exit(exitCode);
