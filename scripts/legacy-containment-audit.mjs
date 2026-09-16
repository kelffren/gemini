/* KELO-INDEX
 * area: QA / FOUNDATION / LEGACY CONTAINMENT
 * owner: Kelo Legacy Containment
 * keys: LEGACY ENGINE-A ENGINE-C FITNESS MONOTONIC GLOBALS WRITERS MUTATIONS TIMERS
 * purpose: prevent legacy engines from gaining executable surface, global authority or new side-effect responsibilities
 * public-api: CLI + inspectLegacySource/compareLegacyMetrics for deterministic self-tests
 * consumes: git history + engine-a.js + engine-c.js
 * state-owned: none; emits deterministic audit evidence only
 * extension-points: add monotonic metrics only when they are stable enough to gate main
 * legacy: measures legacy; never mutates runtime
 * do-not: NO runtime imports, NO auto-fixes, NO hidden growth exceptions
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TARGETS=['engine-a.js','engine-c.js'];
const ZERO_SHA=/^0+$/;
const SHA=/^[0-9a-f]{7,40}$/i;
const OUT_DIR=path.join(ROOT,'artifacts','legacy-containment');
const CRITICAL_ROOTS=['localPlayer','camera','STATE','CONFIG'];
const CORE_ASSIGNMENTS=['render','renderAvatar','updateSimulation','processInput','updateMovement'];
const MUTATOR_METHODS=['push','splice','pop','shift','unshift','sort','reverse','copyWithin','fill','set','delete','clear','add'];
export const LEGACY_MONOTONIC_METRICS=Object.freeze([
  'semanticBytes','topLevelDeclarations','explicitGlobalWrites','criticalWriteCount',
  'eventListeners','intervals','timeouts','rafCalls','localStorageWrites','domMutations'
]);

function git(args,{optional=false}={}){
  const out=spawnSync('git',args,{cwd:ROOT,encoding:'utf8'});
  if(out.status!==0){
    if(optional)return null;
    throw new Error(`git ${args.join(' ')} failed: ${String(out.stderr||out.stdout).trim()}`);
  }
  return out.stdout;
}
function validSha(candidate){return !!candidate&&SHA.test(candidate)&&!ZERO_SHA.test(candidate);}
function resolveBase(){
  const cli=process.argv.find(v=>v.startsWith('--base='))?.slice(7);
  if(validSha(cli))return {sha:cli,source:'cli'};

  // pull_request workflows checkout GitHub's synthetic merge commit. HEAD^1 is
  // therefore the exact base commit used to build/test this candidate, even if
  // the event payload's pull_request.base.sha was captured before main advanced.
  if(process.env.GITHUB_EVENT_NAME==='pull_request'){
    const mergeParent=git(['rev-parse','HEAD^1'],{optional:true})?.trim();
    if(validSha(mergeParent))return {sha:mergeParent,source:'pr-merge-parent'};
  }

  const env=process.env.KELO_LEGACY_BASE_SHA;
  if(validSha(env))return {sha:env,source:'env'};

  const parent=git(['rev-parse','HEAD^'],{optional:true})?.trim();
  if(validSha(parent))return {sha:parent,source:'head-parent'};
  return null;
}
function sourceAt(ref,file){
  if(!ref)return null;
  return git(['show',`${ref}:${file}`],{optional:true});
}
function count(re,text){return [...text.matchAll(re)].length;}
function uniq(values){return [...new Set(values)].sort();}
function esc(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}
function bump(target,key,n=1){target[key]=(target[key]||0)+n;}
function firstPathKey(root,path=''){
  const dot=path.match(/\.\s*([A-Za-z_$][\w$]*)/);
  if(dot)return `${root}.${dot[1]}`;
  if(path.trim().startsWith('['))return `${root}[]`;
  return root;
}

// Removes comments and insignificant whitespace while preserving strings/template literals.
// This lets documentation/comments grow without giving executable legacy code a larger budget.
export function legacySemanticSource(text){
  let out='',state='code',quote='',escaped=false;
  for(let i=0;i<text.length;i++){
    const c=text[i],n=text[i+1];
    if(state==='line'){if(c==='\n')state='code';continue;}
    if(state==='block'){if(c==='*'&&n==='/'){state='code';i++;}continue;}
    if(state==='string'){
      out+=c;
      if(escaped){escaped=false;continue;}
      if(c==='\\'){escaped=true;continue;}
      if(c===quote){state='code';quote='';}
      continue;
    }
    if(c==='/'&&n==='/'){state='line';i++;continue;}
    if(c==='/'&&n==='*'){state='block';i++;continue;}
    if(c==='\''||c==='"'||c==='`'){state='string';quote=c;out+=c;continue;}
    if(/\s/.test(c))continue;
    out+=c;
  }
  return out;
}
function topLevelDeclarations(text){
  const names=[];
  for(const line of text.split(/\r?\n/)){
    let m=line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/);
    if(m){names.push(m[1]);continue;}
    m=line.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/);
    if(m)names.push(m[1]);
  }
  return uniq(names);
}
function detectCriticalWrites(text){
  const writes={};
  const op='(?:=|\\+=|-=|\\*=|/=|\\+\\+|--)';
  const path='((?:\\s*\\.\\s*[A-Za-z_$][\\w$]*|\\s*\\[[^\\]]+\\])*)';
  for(const root of CRITICAL_ROOTS){
    const assignment=new RegExp(`\\b${esc(root)}${path}\\s*${op}`,'g');
    for(const m of text.matchAll(assignment))bump(writes,firstPathKey(root,m[1]));
    const mutation=new RegExp(`\\b${esc(root)}${path}\\s*\\.\\s*(${MUTATOR_METHODS.join('|')})\\s*\\(`,'g');
    for(const m of text.matchAll(mutation))bump(writes,`${firstPathKey(root,m[1])}.${m[2]}()`);
  }
  const obstaclesMutator=new RegExp(`\\bobstacles\\s*\\.\\s*(${MUTATOR_METHODS.join('|')})\\s*\\(`,'g');
  for(const m of text.matchAll(obstaclesMutator))bump(writes,`obstacles.${m[1]}()`);
  const obstaclesIndex=new RegExp(`\\bobstacles\\s*\\[[^\\]]+\\]\\s*${op}`,'g');
  for(const _ of text.matchAll(obstaclesIndex))bump(writes,'obstacles[]');
  for(const key of CORE_ASSIGNMENTS){
    const re=new RegExp(`\\b${esc(key)}\\s*${op}`,'g');
    const n=count(re,text);if(n)bump(writes,key,n);
  }
  return Object.fromEntries(Object.entries(writes).sort(([a],[b])=>a.localeCompare(b)));
}
export function inspectLegacySource(text){
  const semantic=legacySemanticSource(text);
  const globalWriteNames=uniq([...text.matchAll(/\b(?:window|globalThis|root)\.([A-Za-z_$][\w$]*)\s*=/g)].map(m=>m[1]));
  const criticalWrites=detectCriticalWrites(text);
  const criticalWriteCount=Object.values(criticalWrites).reduce((a,b)=>a+b,0);
  const declarations=topLevelDeclarations(text);
  return {
    rawBytes:Buffer.byteLength(text),
    semanticBytes:Buffer.byteLength(semantic),
    topLevelDeclarations:declarations.length,
    topLevelDeclarationNames:declarations,
    explicitGlobalWrites:globalWriteNames.length,
    explicitGlobalWriteNames:globalWriteNames,
    criticalWriteCount,
    criticalWrites,
    eventListeners:count(/\baddEventListener\s*\(/g,text),
    intervals:count(/\bsetInterval\s*\(/g,text),
    timeouts:count(/\bsetTimeout\s*\(/g,text),
    rafCalls:count(/\brequestAnimationFrame\s*\(/g,text),
    localStorageWrites:count(/\blocalStorage\s*\.\s*setItem\s*\(/g,text),
    domMutations:count(/\b(?:appendChild|insertBefore|replaceChildren|replaceWith|removeChild|createElement)\s*\(/g,text)
  };
}
export function compareLegacyMetrics(before,after,file='synthetic.js'){
  const delta=Object.fromEntries(LEGACY_MONOTONIC_METRICS.map(k=>[k,after[k]-before[k]]));
  const newGlobals=after.explicitGlobalWriteNames.filter(name=>!before.explicitGlobalWriteNames.includes(name));
  const newCriticalKeys=Object.keys(after.criticalWrites).filter(key=>!(key in before.criticalWrites));
  const violations=[];
  for(const key of LEGACY_MONOTONIC_METRICS){
    if(after[key]>before[key])violations.push({file,type:'metric-growth',metric:key,before:before[key],after:after[key],delta:after[key]-before[key]});
  }
  for(const name of newGlobals)violations.push({file,type:'new-global-writer',name});
  for(const key of newCriticalKeys)violations.push({file,type:'new-critical-writer',key});
  return {delta,newGlobals,newCriticalKeys,violations};
}

export function runLegacyContainmentAudit(){
  const baseResolved=resolveBase();
  if(!baseResolved)throw new Error('LEGACY_CONTAINMENT_NO_BASE: provide --base=<sha>, PR merge parent, KELO_LEGACY_BASE_SHA, or HEAD^');
  const {sha:base,source:baseSource}=baseResolved;
  const report={version:3,base,baseSource,head:git(['rev-parse','HEAD']).trim(),targets:{},violations:[]};
  for(const file of TARGETS){
    const currentPath=path.join(ROOT,file);
    if(!fs.existsSync(currentPath))throw new Error(`LEGACY_CONTAINMENT_TARGET_MISSING:${file}`);
    const beforeText=sourceAt(base,file);
    if(beforeText==null)throw new Error(`LEGACY_CONTAINMENT_BASE_TARGET_MISSING:${file}@${base}`);
    const afterText=fs.readFileSync(currentPath,'utf8');
    const before=inspectLegacySource(beforeText),after=inspectLegacySource(afterText);
    const comparison=compareLegacyMetrics(before,after,file);
    report.targets[file]={before,after,delta:comparison.delta,newGlobals:comparison.newGlobals,newCriticalKeys:comparison.newCriticalKeys};
    report.violations.push(...comparison.violations);
  }
  fs.mkdirSync(OUT_DIR,{recursive:true});
  fs.writeFileSync(path.join(OUT_DIR,'report.json'),JSON.stringify(report,null,2)+'\n');
  console.log('KELO_LEGACY_CONTAINMENT',JSON.stringify({base:report.base,baseSource:report.baseSource,head:report.head,targets:Object.fromEntries(Object.entries(report.targets).map(([file,row])=>[file,{delta:row.delta,newGlobals:row.newGlobals,newCriticalKeys:row.newCriticalKeys}])),violations:report.violations},null,2));
  if(report.violations.length){
    console.error(`LEGACY_CONTAINMENT_FAIL:${report.violations.length}`);
    return 1;
  }
  console.log('LEGACY_CONTAINMENT_PASS: legacy executable/authority surface did not grow.');
  return 0;
}

const invokedPath=process.argv[1]?pathToFileURL(path.resolve(process.argv[1])).href:null;
if(invokedPath===import.meta.url)process.exitCode=runLegacyContainmentAudit();
