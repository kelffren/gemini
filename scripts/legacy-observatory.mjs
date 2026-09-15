/* KELO-INDEX
 * area: QA / LEGACY MODERNIZATION
 * owner: Kelo Legacy Observatory
 * owns: static census of legacy dependencies, globals, writers, timers and risk signals
 * does-not-own: runtime behavior, migration activation, gameplay semantics
 * purpose: make legacy ownership measurable before migration
 * public-api: CLI `node scripts/legacy-observatory.mjs`
 * extension-points: add narrow detectors and authority keys
 * reuse: CI + migration planning
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'artifacts', 'legacy-observatory');
const SOURCE_EXT = /\.(?:js|mjs|cjs|html)$/i;
const LEGACY_NAME = /(^|\/)engine-[^/]+\.js$/i;
const CRITICAL_KEYS = [
  'localPlayer.x','localPlayer.y','localPlayer.hp','localPlayer.maxHp',
  'cameraX','cameraY','velocityX','velocityY','obstacles','worldMap',
  'render','renderAvatar','updateSimulation','processInput','updateMovement'
];

function walk(dir, out=[]){
  if(!fs.existsSync(dir)) return out;
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules','dist','coverage','artifacts'].includes(entry.name)) continue;
    const abs=path.join(dir,entry.name);
    if(entry.isDirectory()) walk(abs,out);
    else if(SOURCE_EXT.test(entry.name)) out.push(abs);
  }
  return out;
}
function rel(abs){ return path.relative(ROOT,abs).replaceAll('\\','/'); }
function count(re,text){ return [...text.matchAll(re)].length; }
function uniq(values){ return [...new Set(values)].sort(); }
function esc(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
function detect(file){
  const text=fs.readFileSync(file,'utf8');
  const imports=uniq([
    ...[...text.matchAll(/\bimport\s+(?:[^'\"]+?\s+from\s+)?['\"]([^'\"]+)['\"]/g)].map(m=>m[1]),
    ...[...text.matchAll(/\bimport\s*\(\s*['\"]([^'\"]+)['\"]\s*\)/g)].map(m=>m[1])
  ]);
  const globalReads=uniq([...text.matchAll(/\b(?:window|globalThis|root)\.([A-Za-z_$][\w$]*)/g)].map(m=>m[1]));
  const globalWrites=uniq([...text.matchAll(/\b(?:window|globalThis|root)\.([A-Za-z_$][\w$]*)\s*=/g)].map(m=>m[1]));
  const writers=[];
  for(const key of CRITICAL_KEYS){
    const tail=key.includes('.') ? key.split('.').map(esc).join('\\.') : esc(key);
    const re=new RegExp('(?:\\b'+tail+'\\s*=|\\b'+tail+'\\s*(?:\\+\\+|--|\\+=|-=|\\*=|/=))','g');
    const n=count(re,text); if(n) writers.push({key,count:n});
  }
  const listeners=uniq([...text.matchAll(/addEventListener\s*\(\s*['\"]([^'\"]+)['\"]/g)].map(m=>m[1]));
  const timers={timeout:count(/\bsetTimeout\s*\(/g,text), interval:count(/\bsetInterval\s*\(/g,text), raf:count(/\brequestAnimationFrame\s*\(/g,text)};
  const legacyRefs=uniq([...text.matchAll(/engine-[a-z0-9_-]+\.js/gi)].map(m=>m[0]));
  const score = globalWrites.length*4 + writers.reduce((a,b)=>a+b.count*5,0) + timers.interval*3 + timers.timeout + legacyRefs.length*2 + (LEGACY_NAME.test(rel(file))?8:0);
  const risk=score>=40?'critical':score>=20?'high':score>=8?'medium':'low';
  return {file:rel(file),legacy:LEGACY_NAME.test(rel(file)),imports,legacyRefs,globalReads,globalWrites,writers,listeners,timers,score,risk};
}

const rows=walk(ROOT).map(detect);
const legacy=rows.filter(r=>r.legacy);
const authority={};
for(const row of rows){
  for(const w of row.writers){
    authority[w.key] ??=[];
    authority[w.key].push({file:row.file,count:w.count,legacy:row.legacy});
  }
}
const conflicts=Object.entries(authority).filter(([,writers])=>writers.length>1).map(([key,writers])=>({key,writers}));
const summary={
  generatedAt:new Date().toISOString(),
  filesScanned:rows.length,
  legacyFiles:legacy.length,
  criticalLegacy:legacy.filter(r=>r.risk==='critical').map(r=>r.file),
  highLegacy:legacy.filter(r=>r.risk==='high').map(r=>r.file),
  authorityConflicts:conflicts.length,
  criticalAuthorityConflicts:conflicts.filter(c=>['localPlayer.x','localPlayer.y','render','updateSimulation','processInput','updateMovement'].includes(c.key)).length
};

fs.mkdirSync(OUT_DIR,{recursive:true});
fs.writeFileSync(path.join(OUT_DIR,'report.json'),JSON.stringify({summary,authority,conflicts,legacy,files:rows},null,2));
const md=[];
md.push('# Kelo Legacy Observatory','',`Generated: ${summary.generatedAt}`,'',`- Files scanned: ${summary.filesScanned}`,`- Legacy engine files: ${summary.legacyFiles}`,`- Authority conflicts: ${summary.authorityConflicts}`,`- Critical authority conflicts: ${summary.criticalAuthorityConflicts}`,'','## Legacy risk');
for(const row of [...legacy].sort((a,b)=>b.score-a.score)) md.push(`- **${row.risk.toUpperCase()}** ${row.file} — score ${row.score}; globals writes ${row.globalWrites.length}; critical writes ${row.writers.reduce((a,b)=>a+b.count,0)}; timers ${row.timers.timeout+row.timers.interval}`);
md.push('','## Authority conflicts');
if(!conflicts.length) md.push('- None detected by static scanner.');
for(const c of conflicts) md.push(`- **${c.key}**: ${c.writers.map(w=>`${w.file} (${w.count})`).join(', ')}`);
md.push('','## Rule','A migration must not activate NEW authority while unresolved duplicate writers remain for the same state key.');
fs.writeFileSync(path.join(OUT_DIR,'report.md'),md.join('\n')+'\n');

console.log(JSON.stringify(summary,null,2));
if(summary.criticalAuthorityConflicts>0) console.warn('LEGACY_OBSERVATORY_WARN: critical duplicate writers detected; migration must remain LEGACY/SHADOW until reconciled.');
