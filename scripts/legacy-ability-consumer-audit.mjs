import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const SKIP_DIRS=new Set(['.git','node_modules','docs','tests','.github','coverage','dist','build']);
const EXTENSIONS=new Set(['.js','.mjs','.cjs','.html']);
const TOKENS=['KeloAbilityAim','beginSkillAim','endSkillAim','castAimedSkill','skillAim','triggerStone'];
const EXPECTED_DIRECT_AIM_CONSUMERS=Object.freeze(['engine-l.js','engine-m.js']);

function walk(dir,out=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')&&entry.name!=='.well-known')continue;
    if(entry.isDirectory()){
      if(SKIP_DIRS.has(entry.name))continue;
      walk(path.join(dir,entry.name),out);
      continue;
    }
    const full=path.join(dir,entry.name);
    if(EXTENSIONS.has(path.extname(entry.name)))out.push(full);
  }
  return out;
}

function stripCommentsPreserveLines(source){
  return source
    .replace(/\/\*[\s\S]*?\*\//g,match=>match.replace(/[^\n]/g,' '))
    .replace(/(^|[^:])\/\/.*$/gm,(match,prefix)=>prefix+' '.repeat(Math.max(0,match.length-prefix.length)));
}

function lineMatches(source,token){
  const lines=source.split(/\r?\n/),matches=[];
  for(let i=0;i<lines.length;i++)if(lines[i].includes(token))matches.push(i+1);
  return matches;
}

const files=walk(ROOT).sort();
const consumers=[];
for(const full of files){
  const rel=path.relative(ROOT,full).replaceAll('\\','/');
  const source=fs.readFileSync(full,'utf8');
  const executable=stripCommentsPreserveLines(source);
  const refs={},codeRefs={};
  for(const token of TOKENS){
    const lines=lineMatches(source,token);
    const codeLines=lineMatches(executable,token);
    if(lines.length)refs[token]=lines;
    if(codeLines.length)codeRefs[token]=codeLines;
  }
  if(Object.keys(refs).length)consumers.push({file:rel,refs,codeRefs});
}

const runtimeConsumers=consumers.filter(item=>!item.file.startsWith('scripts/'));
const directAimConsumers=runtimeConsumers
  .filter(item=>item.file!=='src/core/legacy-ability-aim-system.js'&&item.codeRefs.KeloAbilityAim)
  .map(item=>item.file)
  .sort();
const aimStateConsumers=runtimeConsumers
  .filter(item=>item.file!=='src/core/legacy-ability-aim-system.js'&&item.codeRefs.skillAim)
  .map(item=>item.file)
  .sort();
const triggerConsumers=runtimeConsumers
  .filter(item=>item.codeRefs.triggerStone)
  .map(item=>item.file)
  .sort();

console.log(`LEGACY ABILITY CONSUMER AUDIT runtimeFiles=${runtimeConsumers.length} directAimFiles=${directAimConsumers.length} aimStateFiles=${aimStateConsumers.length} triggerFiles=${triggerConsumers.length}`);
for(const item of runtimeConsumers){
  const summary=Object.entries(item.codeRefs).map(([token,lines])=>`${token}@${lines.join(',')}`).join(' ');
  console.log(`ABILITY_CONSUMER ${item.file}${summary?' '+summary:''}`);
}

if(JSON.stringify(directAimConsumers)!==JSON.stringify(EXPECTED_DIRECT_AIM_CONSUMERS)){
  throw new Error(`direct KeloAbilityAim consumers changed: expected ${EXPECTED_DIRECT_AIM_CONSUMERS.join(',')} got ${directAimConsumers.join(',')||'none'}`);
}
if(directAimConsumers.includes('engine-g.js'))throw new Error('engine-g.js must not reclaim KeloAbilityAim dependency');

const json={schema:2,runtimeFiles:runtimeConsumers.length,directAimConsumers,aimStateConsumers,triggerConsumers,consumers:runtimeConsumers};
console.log('LEGACY_ABILITY_CONSUMER_JSON='+JSON.stringify(json));
