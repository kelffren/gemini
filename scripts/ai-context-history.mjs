#!/usr/bin/env node
/**
 * Kelo Context History
 * Builds a compact change/regression memory for a natural-language task.
 *
 * Usage:
 *   npm run context:history -- "world editor freeze"
 *
 * Local git is preferred because it is exact, fast and offline. If git history
 * is unavailable (shallow/exported checkout), the command degrades cleanly.
 */
import { promises as fs } from 'node:fs';
import { execFileSync } from 'node:child_process';

const query=process.argv.slice(2).join(' ').trim();
if(!query){console.error('Usage: npm run context:history -- "task"');process.exit(1)}
let map;
try{map=JSON.parse(await fs.readFile('docs/generated/AI_CODE_MAP.json','utf8'))}
catch{console.error('Run npm run context:build first');process.exit(1)}

const stop=new Set(['the','and','for','with','from','para','como','esta','este','que','una','unos','las','los','del','por']);
const terms=[...new Set(query.toLowerCase().split(/[^a-z0-9_:-]+/).filter(x=>x.length>2&&!stop.has(x)))];
const score=e=>{
 const h=[e.path,e.owner,e.system,e.purpose,e.tags,...(e.ownerSymbols||[])].filter(Boolean).join(' ').toLowerCase();
 return terms.reduce((n,t)=>n+(h.includes(t)?1:0),0);
};
const targets=map.files.map(e=>({e,s:score(e)})).filter(x=>x.s).sort((a,b)=>b.s-a.s).slice(0,8).map(x=>x.e.path);
console.log('KELO HISTORY ROUTE');
console.log('query:',query);
console.log('targets:',targets.join(', ')||'(none)');

function git(args){
 try{return execFileSync('git',args,{encoding:'utf8',stdio:['ignore','pipe','ignore'],maxBuffer:4*1024*1024}).trim()}
 catch{return ''}
}
const history=[];
for(const file of targets){
 const out=git(['log','-n','12','--date=short','--pretty=format:%H%x09%ad%x09%s','--',file]);
 for(const line of out.split('\n').filter(Boolean)){
   const [sha,date,...rest]=line.split('\t');
   history.push({sha,date,subject:rest.join('\t'),file});
 }
}
const dedup=new Map();
for(const h of history){
 const row=dedup.get(h.sha)||{sha:h.sha,date:h.date,subject:h.subject,files:[]};
 row.files.push(h.file);dedup.set(h.sha,row);
}
const rows=[...dedup.values()].sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,24);
if(!rows.length){
 console.log('\nNo local history available. Use GitHub commit search for the query/target paths.');
 process.exit(0);
}
console.log('\nRecent relevant history:');
for(const r of rows) console.log(`- ${r.date} ${r.sha.slice(0,9)} ${r.subject} [${[...new Set(r.files)].join(', ')}]`);

const regressionWords=/fix|bug|regress|freeze|crash|restore|revert|broken|hotfix|repair/i;
const signals=rows.filter(r=>regressionWords.test(r.subject));
if(signals.length){
 console.log('\nRegression/fix signals:');
 for(const r of signals.slice(0,10)) console.log(`- ${r.sha.slice(0,9)} ${r.subject}`);
}
console.log('\nRule: history is evidence, not proof. Confirm candidate commits with diff/bisect + owner-specific QA before naming a culprit.');
