import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const SKIP_DIRS=new Set(['.git','node_modules','docs','tests','.github','coverage','dist','build']);
const EXTENSIONS=new Set(['.js','.mjs','.cjs','.html']);
const TOKENS=[
  'KeloAbilityAim',
  'beginSkillAim',
  'endSkillAim',
  'castAimedSkill',
  'skillAim',
  'triggerStone'
];

function walk(dir,out=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(entry.name.startsWith('.')&&entry.name!=='.well-known')continue;
    if(entry.isDirectory()){
      if(SKIP_DIRS.has(entry.name))continue;
      walk(path.join(dir,entry.name),out);
      continue;
    }
    const full=path.join(dir,entry.name);
    if(!EXTENSIONS.has(path.extname(entry.name)))continue;
    out.push(full);
  }
  return out;
}

function lineMatches(source,token){
  const lines=source.split(/\r?\n/),matches=[];
  for(let i=0;i<lines.length;i++){
    if(lines[i].includes(token))matches.push(i+1);
  }
  return matches;
}

const files=walk(ROOT).sort();
const consumers=[];
for(const full of files){
  const rel=path.relative(ROOT,full).replaceAll('\\','/');
  const source=fs.readFileSync(full,'utf8');
  const refs={};
  for(const token of TOKENS){
    const lines=lineMatches(source,token);
    if(lines.length)refs[token]=lines;
  }
  if(Object.keys(refs).length)consumers.push({file:rel,refs});
}

const runtimeConsumers=consumers.filter(item=>!item.file.startsWith('scripts/'));
const directAimConsumers=runtimeConsumers.filter(item=>item.refs.KeloAbilityAim||item.refs.beginSkillAim||item.refs.endSkillAim||item.refs.castAimedSkill||item.refs.skillAim);
const triggerConsumers=runtimeConsumers.filter(item=>item.refs.triggerStone);

console.log(`LEGACY ABILITY CONSUMER AUDIT runtimeFiles=${runtimeConsumers.length} directAimFiles=${directAimConsumers.length} triggerFiles=${triggerConsumers.length}`);
for(const item of runtimeConsumers){
  const summary=Object.entries(item.refs).map(([token,lines])=>`${token}@${lines.join(',')}`).join(' ');
  console.log(`ABILITY_CONSUMER ${item.file} ${summary}`);
}

const forbidden=[
  'engine-g.js'
];
for(const file of forbidden){
  const hit=directAimConsumers.find(item=>item.file===file);
  if(hit)throw new Error(`${file} must not reclaim legacy ability aim ownership`);
}

const json={
  schema:1,
  runtimeFiles:runtimeConsumers.length,
  directAimFiles:directAimConsumers.length,
  triggerFiles:triggerConsumers.length,
  consumers:runtimeConsumers
};
console.log('LEGACY_ABILITY_CONSUMER_JSON='+JSON.stringify(json));
