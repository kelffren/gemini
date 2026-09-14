#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const input=process.argv[2];
if(!input){console.error('Usage: npm run bug:scan -- <log-file>');process.exit(1);}
const raw=input==='-'?fs.readFileSync(0,'utf8'):fs.readFileSync(input,'utf8');
const norm=raw.toLowerCase()
 .replace(/https?:\/\/\S+/g,'<url>')
 .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi,'<uuid>')
 .replace(/\b[0-9a-f]{12,}\b/gi,'<hex>')
 .replace(/\b\d{4}-\d\d-\d\d[t ][\d:.+-z]+\b/gi,'<time>')
 .replace(/:\d+:\d+/g,':<line>')
 .replace(/\b\d{3,}\b/g,'<n>')
 .replace(/\s+/g,' ').trim();
const fingerprint=crypto.createHash('sha256').update(norm).digest('hex').slice(0,16);
const tokens=new Set(norm.split(/[^a-z0-9_.-]+/).filter(x=>x.length>=4));
const dir=path.join(process.cwd(),'bugs','registry');
const bugs=fs.readdirSync(dir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(dir,n),'utf8')));
function similarity(b){
 const text=[b.title,b.actual,b.expected,...(b.evidence||[]),...(b.area||[])].join(' ').toLowerCase();
 const bt=new Set(text.split(/[^a-z0-9_.-]+/).filter(x=>x.length>=4));
 let hit=0; for(const t of tokens)if(bt.has(t))hit++;
 return tokens.size?hit/Math.sqrt(tokens.size*Math.max(1,bt.size)):0;
}
const ranked=bugs.map(b=>({bug:b,score:similarity(b)})).sort((a,b)=>b.score-a.score);
const infra=/browserstack|playwright|runner|github actions|ci\b/.test(norm);
const external=/safari|webkit|ios|network|timeout|fetch|cdn/.test(norm);
console.log(`# BUG SCAN fingerprint=${fingerprint}`);
console.log(`Likely class: ${infra?'INFRA/TEST':external?'PRODUCT_OR_EXTERNAL_ENV':'PRODUCT_OR_UNKNOWN'}`);
console.log('Closest known bugs:');
for(const r of ranked.slice(0,5))console.log(`- ${r.bug.id} score=${r.score.toFixed(3)} [${r.bug.status}] ${r.bug.title}`);
if((ranked[0]?.score||0)<0.08)console.log('Suggestion: no strong known match; create/sanitize an incoming REPORT before creating a new canonical BUG.');
else console.log(`Suggestion: inspect ${ranked[0].bug.id} first and append evidence if symptom matches; do not create a duplicate.`);
