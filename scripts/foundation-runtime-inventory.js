/* KELO-INDEX
 * area: QA / FOUNDATION
 * owner: FOUNDATION CI
 * keys: INVENTORY OWNERSHIP WRAPPERS GLOBALS TIMERS LOCKS STORAGE
 * purpose: inventaría patrones arquitectónicos sensibles para medir deuda y guiar migración incremental
 * public-api: CLI `node scripts/foundation-runtime-inventory.js`
 * consumes: archivos JS/HTML del repo
 * state-owned: ninguno
 * extension-points: añadir patrones observables, no inferencias subjetivas
 * reuse: auditoría Foundation y revisión de PR
 * legacy: N/A
 * do-not: no falla CI por deuda histórica; el guard de regresión vive en foundation-architecture-audit.js
 */
'use strict';
const fs=require('fs');
const path=require('path');
const ROOT=path.resolve(__dirname,'..');
const SKIP=new Set(['.git','node_modules','docs/archive']);
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
const files=walk(ROOT);
const totals=Object.fromEntries(rules.map(r=>[r[0],0]));
const byRule=Object.fromEntries(rules.map(r=>[r[0],[]]));
for(const file of files){
  const text=fs.readFileSync(file.abs,'utf8');
  for(const [name,re] of rules){
    re.lastIndex=0;let count=0;while(re.exec(text))count+=1;
    if(count){totals[name]+=count;byRule[name].push({file:file.rel,count});}
  }
}
console.log('FOUNDATION_RUNTIME_INVENTORY files='+files.length);
for(const [name] of rules){
  console.log('\n['+name+'] total='+totals[name]);
  byRule[name].sort((a,b)=>b.count-a.count||a.file.localeCompare(b.file)).forEach(x=>console.log('  '+x.count+'  '+x.file));
}
console.log('\nFOUNDATION_RUNTIME_INVENTORY_JSON '+JSON.stringify({totals,byRule}));
