/* KELO-INDEX
 * area: QA / FOUNDATION / LEGACY CONTAINMENT
 * owner: Kelo Legacy Containment
 * keys: LEGACY ENGINE-A ENGINE-C FITNESS MONOTONIC GLOBALS WRITERS TIMERS
 * purpose: prevent legacy engines from gaining executable surface, global authority or new side-effect responsibilities
 * public-api: CLI `node scripts/legacy-containment-audit.mjs`
 * consumes: git history + engine-a.js + engine-c.js
 * state-owned: none; emits deterministic audit evidence only
 * extension-points: add monotonic metrics only when they are stable enough to gate main
 * legacy: measures legacy; never mutates runtime
 * do-not: NO runtime imports, NO auto-fixes, NO hidden growth exceptions
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const TARGETS=['engine-a.js','engine-c.js'];
const ZERO_SHA=/^0+$/;
const SHA=/^[0-9a-f]{7,40}$/i;
const OUT_DIR=path.join(ROOT,'artifacts','legacy-containment');
const CRITICAL_KEYS=[
  'localPlayer.x','localPlayer.y','localPlayer.hp','localPlayer.maxHp',
  'camera.x','camera.y','camera.targetX','camera.targetY',
  'obstacles','STATE','CONFIG','render','renderAvatar','updateSimulation','processInput','updateMovement'
];

function git(args,{optional=false}={}){
  const out=spawnSync('git',args,{cwd:ROOT,encoding:'utf8'});
  if(out.status!==0){
    if(optional)return null;
    throw new Error(`git ${args.join(' ')} failed: ${String(out.stderr||out.stdout).trim()}`);
  }
  return out.stdout;
}
function resolveBase(){
  const cli=process.argv.find(v=>v.startsWith('--base='))?.slice(7);
  const env=process.env.KELO_LEGACY_BASE_SHA;
  for(const candidate of [cli,env]){
    if(candidate&&SHA.test(candidate)&&!ZERO_SHA.test(candidate))return candidate;
  }
  const parent=git(['rev-parse','HEAD^'],{optional:true})?.trim();
  return parent&&SHA.test(parent)?parent:null;
}
function sourceAt(ref,file){
  if(!ref)return null;
  return git(['show',`${ref}:${file}`],{optional:true});
}
function count(re,text){return [...text.matchAll(re)].length;}
function uniq(values){return [...new Set(values)].sort();}
function esc(value){return value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');}

// Removes comments and insignificant whitespace while preserving strings/template literals.
// This lets documentation/comments grow without giving executable legacy code a larger budget.
function semanticSource(text){
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
function assignmentCount(text,key){
  const dotted=key.split('.').map(esc).join('\\s*\\.\\s*');
  const re=new RegExp(`\\b${dotted}\\s*(?:=|\\+=|-=|\\*=|/=|\\+\\+|--)`,'g');
  return count(re,text);
}
function inspect(text){
  const semantic=semanticSource(text);
  const globalWriteNames=uniq([...text.matchAll(/\b(?:window|globalThis|root)\.([A-Za-z_$][\w$]*)\s*=/g)].map(m=>m[1]));
  const criticalWrites=Object.fromEntries(CRITICAL_KEYS.map(key=>[key,assignmentCount(text,key)]).filter(([,n])=>n>0));
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

const MONOTONIC=[
  'semanticBytes','topLevelDeclarations','explicitGlobalWrites','criticalWriteCount',
  'eventListeners','intervals','timeouts','rafCalls','localStorageWrites','domMutations'
];
const base=resolveBase();
if(!base)throw new Error('LEGACY_CONTAINMENT_NO_BASE: provide KELO_LEGACY_BASE_SHA or --base=<sha>');

const report={version:1,base,head:git(['rev-parse','HEAD']).trim(),targets:{},violations:[]};
for(const file of TARGETS){
  const currentPath=path.join(ROOT,file);
  if(!fs.existsSync(currentPath))throw new Error(`LEGACY_CONTAINMENT_TARGET_MISSING:${file}`);
  const beforeText=sourceAt(base,file);
  if(beforeText==null)throw new Error(`LEGACY_CONTAINMENT_BASE_TARGET_MISSING:${file}@${base}`);
  const afterText=fs.readFileSync(currentPath,'utf8');
  const before=inspect(beforeText),after=inspect(afterText);
  const delta=Object.fromEntries(MONOTONIC.map(k=>[k,after[k]-before[k]]));
  const newGlobals=after.explicitGlobalWriteNames.filter(name=>!before.explicitGlobalWriteNames.includes(name));
  const newCriticalKeys=Object.keys(after.criticalWrites).filter(key=>!(key in before.criticalWrites));
  report.targets[file]={before,after,delta,newGlobals,newCriticalKeys};
  for(const key of MONOTONIC){
    if(after[key]>before[key])report.violations.push({file,type:'metric-growth',metric:key,before:before[key],after:after[key],delta:after[key]-before[key]});
  }
  for(const name of newGlobals)report.violations.push({file,type:'new-global-writer',name});
  for(const key of newCriticalKeys)report.violations.push({file,type:'new-critical-writer',key});
}

fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,'report.json'),JSON.stringify(report,null,2)+'\n');
console.log('KELO_LEGACY_CONTAINMENT',JSON.stringify({base:report.base,head:report.head,targets:Object.fromEntries(Object.entries(report.targets).map(([file,row])=>[file,{delta:row.delta,newGlobals:row.newGlobals,newCriticalKeys:row.newCriticalKeys}])),violations:report.violations},null,2));
if(report.violations.length){
  console.error(`LEGACY_CONTAINMENT_FAIL:${report.violations.length}`);
  process.exit(1);
}
console.log('LEGACY_CONTAINMENT_PASS: legacy executable/authority surface did not grow.');
