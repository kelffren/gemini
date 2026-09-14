#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root=process.cwd();
const riskMap=JSON.parse(fs.readFileSync(path.join(root,'bugs','RISK_MAP.json'),'utf8'));
const registryDir=path.join(root,'bugs','registry');

function changedFiles(){
  const args=process.argv.slice(2).filter(x=>x!=='--gate');
  const base=args[0]||'HEAD~1';
  const head=args[1]||'HEAD';
  try{
    return execFileSync('git',['diff','--name-only',base,head],{encoding:'utf8'}).split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  }catch(error){
    console.error(`bug:risk could not diff ${base}..${head}: ${error.message}`);
    process.exit(1);
  }
}

function loadBugs(){
  if(!fs.existsSync(registryDir))return [];
  return fs.readdirSync(registryDir).filter(n=>/^BUG-\d{4}\.json$/.test(n)).map(name=>{
    try{return JSON.parse(fs.readFileSync(path.join(registryDir,name),'utf8'));}catch{return null;}
  }).filter(Boolean);
}

function historicalFiles(bug){
  const out=new Set([...(bug.suspected_files||[]),...(bug.fix?.files||[])]);
  for(const attempt of bug.attempt_history||[])for(const file of attempt.change?.files||[])out.add(file);
  return out;
}

const files=changedFiles();
const bugs=loadBugs();
let score=Math.min(18,files.length*2);
const reasons=[];
const tests=new Set();
const matchedRules=[];

for(const rule of riskMap.rules||[]){
  const hits=files.filter(file=>(rule.patterns||[]).some(pattern=>file.toLowerCase().includes(String(pattern).toLowerCase())));
  if(!hits.length)continue;
  score+=Number(rule.score)||0;
  matchedRules.push({id:rule.id,hits});
  reasons.push(`${rule.id}: ${rule.reason} [${hits.join(', ')}]`);
  for(const test of rule.tests||[])tests.add(test);
}

const related=[];
for(const bug of bugs){
  const hist=historicalFiles(bug);
  const exact=files.filter(file=>hist.has(file));
  const areaHits=(bug.area||[]).filter(area=>files.some(file=>file.toLowerCase().includes(String(area).toLowerCase())));
  if(exact.length||areaHits.length){
    const weight=Math.min(20,exact.length*6+areaHits.length*3+(bug.severity==='critical'?6:bug.severity==='high'?3:0));
    score+=weight;
    related.push({id:bug.id,status:bug.status,severity:bug.severity,exact,areaHits,weight});
    tests.add(`npm run bug:brief -- ${bug.id}`);
  }
}

score=Math.min(100,Math.round(score));
const level=score>=75?'CRITICAL':score>=50?'HIGH':score>=25?'MEDIUM':'LOW';
console.log(`# BUG RISK — ${level} ${score}/100`);
console.log(`Changed files: ${files.length}`);
for(const file of files)console.log(`- ${file}`);
console.log('\nRisk signals:');
if(!reasons.length&&!related.length)console.log('- no specific historical/risk-map signal');
for(const reason of reasons)console.log(`- ${reason}`);
for(const item of related)console.log(`- history ${item.id} [${item.status}/${item.severity}] +${item.weight}: exact=${item.exact.join(',')||'-'} areas=${item.areaHits.join(',')||'-'}`);
console.log('\nRecommended verification:');
if(!tests.size)console.log('- npm test');
for(const test of tests)console.log(`- ${test}`);
console.log('\nPolicy: HIGH/CRITICAL means targeted verification before claiming the change safe. It does not mean the commit is defective.');

if(process.argv.includes('--gate')&&score>=75)process.exitCode=2;
