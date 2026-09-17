/* KELO-INDEX
 * area: QA / X-FOUNDATION / ARCHITECTURE
 * owner: FOUNDATION CI
 * keys: CAPABILITY GRAPH DEPENDENCY FAILURE BLAST-RADIUS CHANGE-IMPACT CONTRACT
 * purpose: turns System Contracts into an executable dependency/failure graph and derives affected systems/tests from each change
 * public-api: CLI `node scripts/x-foundation-contract-audit.mjs`
 * consumes: docs/system-catalog.json, docs/system-contracts.json, config/x-foundation-policy.json, git diff
 * state-owned: generated diagnostic artifacts only
 * extension-points: add structured policy fields or explicit allow-path exceptions
 * online: build-time only; no gameplay authority
 * do-not: do not become a general linter or infer gameplay authority from imports
 */
import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const outDir=path.join(root,'artifacts','x-foundation');
const readJson=rel=>JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'));
const exists=rel=>fs.existsSync(path.join(root,rel));
const catalog=readJson('docs/system-catalog.json');
const contracts=readJson('docs/system-contracts.json');
const policy=readJson('config/x-foundation-policy.json');
const catalogById=new Map((catalog.systems||[]).map(row=>[row.id,row]));
const contractById=new Map((contracts.systems||[]).map(row=>[row.id,row]));
const policyIds=Object.keys(policy.systems||{});
const failures=[];
const warnings=[];
const fail=message=>failures.push(message);
const warn=message=>warnings.push(message);

function git(args){
  try{return cp.execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
  catch{return '';}
}
function resolveBase(){
  const explicit=process.env.KELO_X_FOUNDATION_BASE;
  if(explicit&&git(['rev-parse','--verify',explicit]))return explicit;
  const gh=process.env.GITHUB_BASE_REF;
  if(gh&&git(['rev-parse','--verify',`origin/${gh}`]))return `origin/${gh}`;
  if(git(['rev-parse','--verify','HEAD^']))return 'HEAD^';
  return null;
}
function normalizePath(value){return String(value||'').replaceAll('\\','/');}
function pathMatchesPrefix(file,prefix){return normalizePath(file).startsWith(normalizePath(prefix));}

for(const id of policyIds){
  const spec=policy.systems[id];
  if(!contractById.has(id))fail(`policy system missing System Contract: ${id}`);
  if(!catalogById.has(id))fail(`policy system missing catalog entry: ${id}`);
  if(!policy.failureModes.includes(spec.failureMode))fail(`${id} invalid failureMode: ${spec.failureMode}`);
  if(!policy.browserPolicies.includes(spec.browserPolicy))fail(`${id} invalid browserPolicy: ${spec.browserPolicy}`);
  if(!policy.killSwitchPolicies.includes(spec.killSwitchPolicy))fail(`${id} invalid killSwitchPolicy: ${spec.killSwitchPolicy}`);
  if(!String(spec.blastRadius||'').trim())fail(`${id} missing blastRadius`);
  if(!Array.isArray(spec.dependsOnSystems))fail(`${id} dependsOnSystems must be an array`);
  for(const dep of spec.dependsOnSystems||[])if(!catalogById.has(dep))fail(`${id} depends on unknown system: ${dep}`);
}

for(const id of contractById.keys())if(!policy.systems[id])fail(`critical System Contract missing X-Foundation policy: ${id}`);

const visiting=new Set(),visited=new Set(),cycles=[];
function visit(id,stack=[]){
  if(visited.has(id))return;
  if(visiting.has(id)){
    const start=stack.indexOf(id);
    cycles.push([...stack.slice(start),id]);
    return;
  }
  visiting.add(id);
  const next=policy.systems[id]?.dependsOnSystems||[];
  for(const dep of next)if(policy.systems[dep])visit(dep,[...stack,id]);
  visiting.delete(id);visited.add(id);
}
for(const id of policyIds)visit(id,[]);
for(const cycle of cycles)fail(`dependency cycle: ${cycle.join(' -> ')}`);

const reverse=new Map();
for(const id of policyIds)reverse.set(id,new Set());
for(const id of policyIds){
  for(const dep of policy.systems[id].dependsOnSystems||[]){
    if(!reverse.has(dep))reverse.set(dep,new Set());
    reverse.get(dep).add(id);
  }
}

function dependencyClosure(seed){
  const seen=new Set(seed),queue=[...seed];
  while(queue.length){
    const current=queue.shift();
    for(const dependent of reverse.get(current)||[]){
      if(seen.has(dependent))continue;
      seen.add(dependent);queue.push(dependent);
    }
  }
  return seen;
}

const base=resolveBase();
let changedFiles=[];
let addedLines=[];
if(!base){
  warn('no git base found; diff-only guards skipped');
}else{
  const names=git(['diff','--name-only',`${base}...HEAD`]);
  changedFiles=names?names.split('\n').map(normalizePath).filter(Boolean):[];
  const diff=git(['diff','--unified=0',`${base}...HEAD`,'--','*.js','*.mjs']);
  let current='';
  for(const line of diff.split('\n')){
    if(line.startsWith('+++ b/')){current=normalizePath(line.slice(6));continue;}
    if(line.startsWith('+')&&!line.startsWith('+++'))addedLines.push({file:current,line:line.slice(1)});
  }
}

function codeOnly(line){
  const t=String(line||'').trim();
  if(!t||t.startsWith('//')||t.startsWith('/*')||t.startsWith('*'))return '';
  let out='',quote='',escaped=false;
  for(let i=0;i<line.length;i++){
    const c=line[i],n=line[i+1];
    if(quote){
      if(escaped){escaped=false;out+=' ';continue;}
      if(c==='\\'){escaped=true;out+=' ';continue;}
      if(c===quote){quote='';out+=' ';continue;}
      out+=' ';continue;
    }
    if(c==='/'&&n==='/')break;
    if(c==='/'&&n==='*')break;
    if(c==='"'||c==="'"||c==='`'){quote=c;out+=' ';continue;}
    out+=c;
  }
  return out;
}

for(const rule of policy.forbiddenNewCodePatterns||[]){
  let re;
  try{re=new RegExp(rule.pattern);}catch{fail(`invalid regex for ${rule.id}`);continue;}
  for(const entry of addedLines){
    if(!(rule.paths||[]).some(prefix=>pathMatchesPrefix(entry.file,prefix)))continue;
    if((rule.allowPaths||[]).includes(entry.file))continue;
    if(re.test(codeOnly(entry.line)))fail(`${rule.id} in ${entry.file}: ${entry.line.trim()}`);
  }
}

const directlyImpacted=new Set();
for(const [id,contract] of contractById){
  const source=normalizePath(contract.source),doc=normalizePath(contract.technicalDoc);
  const sourceDir=source.includes('/')?source.slice(0,source.lastIndexOf('/')+1):source;
  if(changedFiles.some(file=>file===source||file===doc||file.startsWith(sourceDir)))directlyImpacted.add(id);
}
if(changedFiles.some(file=>file==='docs/system-contracts.json'||file==='config/x-foundation-policy.json'||file==='docs/authority-matrix.json'))for(const id of policyIds)directlyImpacted.add(id);
const impacted=dependencyClosure(directlyImpacted);
const requiredTests=[...new Set([...impacted].flatMap(id=>contractById.get(id)?.requiredTests||[]))].sort();

const graph={
  schema:1,
  generatedAt:new Date().toISOString(),
  base:base||null,
  nodes:policyIds.sort().map(id=>({
    id,
    owner:contractById.get(id)?.owner||null,
    dependsOnSystems:[...(policy.systems[id].dependsOnSystems||[])],
    failureMode:policy.systems[id].failureMode,
    blastRadius:policy.systems[id].blastRadius,
    killSwitchPolicy:policy.systems[id].killSwitchPolicy,
    browserPolicy:policy.systems[id].browserPolicy
  })),
  edges:policyIds.flatMap(id=>(policy.systems[id].dependsOnSystems||[]).map(dep=>({from:id,to:dep})))
};
const impact={
  schema:1,
  generatedAt:graph.generatedAt,
  base:base||null,
  changedFiles,
  directlyImpacted:[...directlyImpacted].sort(),
  impacted:[...impacted].sort(),
  requiredTests
};
fs.mkdirSync(outDir,{recursive:true});
fs.writeFileSync(path.join(outDir,'capability-graph.json'),JSON.stringify(graph,null,2)+'\n');
fs.writeFileSync(path.join(outDir,'change-impact.json'),JSON.stringify(impact,null,2)+'\n');

for(const message of warnings)console.warn('X_FOUNDATION_WARN:',message);
if(failures.length){
  for(const message of failures)console.error('X_FOUNDATION_FAIL:',message);
  console.error(`X-Foundation contract audit failed with ${failures.length} violation(s).`);
  process.exit(1);
}
console.log(`X_FOUNDATION_OK: ${graph.nodes.length} policy nodes · ${graph.edges.length} dependency edges · ${impact.impacted.length} impacted system(s)`);
if(requiredTests.length)console.log('X_FOUNDATION_REQUIRED_TESTS:',requiredTests.join(', '));
