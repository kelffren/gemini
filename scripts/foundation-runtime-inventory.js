/* KELO-INDEX
 * area: QA / FOUNDATION
 * owner: FOUNDATION CI
 * keys: INVENTORY OWNERSHIP WRAPPERS GLOBALS TIMERS LOCKS STORAGE LIVE RUNTIME
 * purpose: inventaría patrones sensibles en repo completo y separa los archivos cargados directamente por index.html
 * public-api: CLI `node scripts/foundation-runtime-inventory.js`
 * consumes: archivos JS/HTML del repo + script src de index.html
 * state-owned: ninguno
 * extension-points: añadir patrones observables, no inferencias subjetivas
 * reuse: auditoría Foundation y revisión de PR
 * legacy: carga dinámica no declarada en index se reporta en repoTotal hasta que tenga manifest explícito
 * do-not: no falla CI por deuda histórica; el guard de regresión vive en foundation-architecture-audit.js
 */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
function walk(dir,out=[]){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const abs=path.join(dir,ent.name),rel=path.relative(ROOT,abs).replace(/\\/g,'/');
    if(ent.isDirectory()){
      if(ent.name==='.git'||ent.name==='node_modules'||rel.startsWith('docs/archive'))continue;
      walk(abs,out);
    }else if(/\.(js|mjs|html)$/.test(ent.name))out.push({abs,rel});
  }
  return out;
}
function directRuntimeFiles(){
  const set=new Set();
  const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const re=/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let m;
  while((m=re.exec(html))){
    const src=m[1].split('?')[0].replace(/^\.\//,'');
    if(!/^(https?:)?\/\//.test(src))set.add(src);
  }
  return set;
}
const rules=[
  ['modalLock',/KELO_MODAL_INPUT_LOCK/g],
  ['buildMode',/\bisBuildMode\b/g],
  ['processInputWrapper',/\bprocessInput\s*=\s*function\b/g],
  ['movementWrapper',/\bupdateMovement\s*=\s*function\b/g],
  ['renderWrapper',/\brender\s*=\s*function\b/g],
  ['avatarWrapper',/\brenderAvatar\s*=\s*function\b/g],
  ['simulationWrapper',/\bupdateSimulation\s*=\s*function\b/g],
  ['socialToolWrite',/\bopenSocialTool\s*=\s*function\b/g],
  ['obstaclesPush',/\bobstacles\.push\s*\(/g],
  ['setInterval',/\bsetInterval\s*\(/g],
  ['mutationObserver',/\bnew\s+MutationObserver\b/g],
  ['localStorageWrite',/\blocalStorage\.setItem\s*\(/g]
];
const files=walk(ROOT),runtimeFiles=directRuntimeFiles();
const totals=Object.fromEntries(rules.map(r=>[r[0],0]));
const runtimeTotals=Object.fromEntries(rules.map(r=>[r[0],0]));
const byRule=Object.fromEntries(rules.map(r=>[r[0],[]]));
const runtimeByRule=Object.fromEntries(rules.map(r=>[r[0],[]]));
for(const file of files){
  const text=fs.readFileSync(file.abs,'utf8');
  const isRuntime=runtimeFiles.has(file.rel);
  for(const [name,re] of rules){
    re.lastIndex=0;let count=0;while(re.exec(text))count+=1;
    if(!count)continue;
    totals[name]+=count;byRule[name].push({file:file.rel,count});
    if(isRuntime){runtimeTotals[name]+=count;runtimeByRule[name].push({file:file.rel,count});}
  }
}
console.log('FOUNDATION_RUNTIME_INVENTORY files='+files.length+' directRuntimeScripts='+runtimeFiles.size);
for(const [name] of rules){
  console.log('\n['+name+'] repoTotal='+totals[name]+' liveDirect='+runtimeTotals[name]);
  runtimeByRule[name].sort((a,b)=>b.count-a.count||a.file.localeCompare(b.file)).forEach(x=>console.log('  LIVE '+x.count+'  '+x.file));
  const runtimeNames=new Set(runtimeByRule[name].map(x=>x.file));
  byRule[name].filter(x=>!runtimeNames.has(x.file)).sort((a,b)=>b.count-a.count||a.file.localeCompare(b.file)).forEach(x=>console.log('  REPO '+x.count+'  '+x.file));
}
console.log('\nFOUNDATION_RUNTIME_INVENTORY_JSON '+JSON.stringify({totals,runtimeTotals,byRule,runtimeByRule,directRuntimeFiles:[...runtimeFiles].sort()}));
