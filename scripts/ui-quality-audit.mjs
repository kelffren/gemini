#!/usr/bin/env node
/* KELO-INDEX
 * area: TOOLING / UI QUALITY
 * purpose: scan Kelo UI surfaces for hierarchy, accessibility and consistency drift
 * policy: report whole project; fail only on critical regressions in UI files changed by the latest commit
 */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT=process.cwd();
const UI_ROOTS=['src/ui','src/studio/ui','src/creators/ui'];
const EXTENSIONS=new Set(['.js','.mjs','.css','.html']);

function walk(rel){
  const abs=path.join(ROOT,rel);
  if(!fs.existsSync(abs))return [];
  const stat=fs.statSync(abs);
  if(stat.isFile())return EXTENSIONS.has(path.extname(abs))?[rel]:[];
  return fs.readdirSync(abs,{withFileTypes:true}).flatMap(entry=>walk(path.join(rel,entry.name)));
}

function changedFiles(){
  try{
    const out=execFileSync('git',['diff','--name-only','HEAD^','HEAD'],{encoding:'utf8',stdio:['ignore','pipe','ignore']});
    return new Set(out.split(/\r?\n/).map(x=>x.trim()).filter(Boolean));
  }catch{return new Set();}
}

const isUiText=text=>/(<button|createElement\(['"]button|\.\w*(?:btn|button|tab|menu|card|panel)|role=['"]dialog|position\s*:\s*fixed)/i.test(text);
const hexColors=text=>new Set(text.match(/#[0-9a-f]{3,8}\b/ig)||[]);

function cssBlocks(text){
  const blocks=[];
  const rx=/([^{}]+)\{([^{}]*)\}/g;let m;
  while((m=rx.exec(text)))blocks.push({selector:m[1].trim(),body:m[2]});
  return blocks;
}

function auditFile(file,text){
  const warnings=[];
  const add=(code,severity,message)=>warnings.push({file,code,severity,message});

  if(/outline\s*:\s*none/i.test(text)&&!/:focus-visible/i.test(text))
    add('FOCUS_REPLACEMENT_MISSING','critical','Uses outline:none without a :focus-visible replacement.');

  const colors=hexColors(text);
  if(colors.size>28)add('PALETTE_SPRAWL','info',`Contains ${colors.size} unique hex colors; prefer shared interface tokens.`);

  const infinite=(text.match(/\binfinite\b/gi)||[]).length;
  if(infinite>2)add('MOTION_SPRAWL','warn',`Contains ${infinite} infinite animations; continuous motion should communicate active state only.`);

  const hasFixedOverlay=/position\s*:\s*fixed/i.test(text);
  const hasClose=/\b(close|cerrar|back|volver|destroy)\b/i.test(text);
  if(hasFixedOverlay&&!hasClose)add('EXIT_ROUTE_UNCLEAR','warn','Fixed UI surface has no obvious close/back route in the same module.');

  for(const block of cssBlocks(text)){
    const control=/(button|\.\w*(?:btn|button|tab|menu-item|tool|card))/i.test(block.selector);
    if(!control)continue;
    const heights=[...block.body.matchAll(/(?:min-height|height)\s*:\s*(\d+(?:\.\d+)?)px/ig)].map(m=>Number(m[1]));
    if(heights.length&&Math.max(...heights)<32)add('TINY_CONTROL_TARGET','critical',`${block.selector.slice(0,90)} has a declared control height below 32px.`);
    else if(heights.length&&Math.max(...heights)<40)add('SMALL_CONTROL_TARGET','warn',`${block.selector.slice(0,90)} declares a control height below 40px.`);
    const sizes=[...block.body.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/ig)].map(m=>Number(m[1]));
    if(sizes.some(v=>v<9))add('TINY_CONTROL_TEXT','warn',`${block.selector.slice(0,90)} declares control text below 9px.`);
    if(/Georgia|Times New Roman/i.test(block.body))add('ORNAMENTAL_CONTROL_FONT','warn',`${block.selector.slice(0,90)} uses an ornamental serif font for a software control.`);
  }

  return warnings;
}

const files=UI_ROOTS.flatMap(walk).sort();
const changed=changedFiles();
const warnings=[];
let uiFiles=0;
for(const file of files){
  const text=fs.readFileSync(path.join(ROOT,file),'utf8');
  if(!isUiText(text))continue;
  uiFiles++;
  warnings.push(...auditFile(file,text));
}

const weight={critical:8,warn:2,info:.5};
const debt=warnings.reduce((sum,w)=>sum+(weight[w.severity]||0),0);
const score=Math.max(0,Math.round(100-debt/Math.max(1,uiFiles)*2));
const counts=warnings.reduce((a,w)=>(a[w.severity]=(a[w.severity]||0)+1,a),{});
const changedCritical=warnings.filter(w=>w.severity==='critical'&&changed.has(w.file));

console.log(`Kelo UI Quality Audit`);
console.log(`Scanned UI files: ${uiFiles}`);
console.log(`Score: ${score}/100`);
console.log(`Warnings: ${warnings.length} (critical ${counts.critical||0}, warn ${counts.warn||0}, info ${counts.info||0})`);
if(changed.size)console.log(`Latest commit changed ${changed.size} file(s); critical UI regressions: ${changedCritical.length}`);

const ordered=[...warnings].sort((a,b)=>({critical:0,warn:1,info:2}[a.severity]-({critical:0,warn:1,info:2}[b.severity])||a.file.localeCompare(b.file));
for(const w of ordered.slice(0,60))console.log(`[${w.severity.toUpperCase()}] ${w.code} ${w.file}: ${w.message}`);
if(ordered.length>60)console.log(`... ${ordered.length-60} additional warning(s) omitted from console output.`);

const contractFiles=['src/ui/kelo-interface-system.css','docs/KELO_INTERFACE_STANDARD.md'];
const missing=contractFiles.filter(file=>!fs.existsSync(path.join(ROOT,file)));
if(missing.length){console.error(`Missing UI contract file(s): ${missing.join(', ')}`);process.exit(2);}

const index=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
if(!index.includes('src/ui/kelo-interface-system.css')){console.error('index.html does not load the shared Kelo Interface System.');process.exit(3);}

if(changedCritical.length){
  console.error('\nCritical UI regression introduced in the latest commit. Fix before merging.');
  process.exit(1);
}
