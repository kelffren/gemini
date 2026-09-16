/* KELO-INDEX
 * area: QA / LEGACY DEBT
 * owner: Evergreen migration contract
 * purpose: mide deuda legacy con contadores objetivos y separa deuda LIVE del inventario histórico del repo
 * public-api: salida LEGACY_DEBT_JSON para CI/reportes
 * do-not: NO convertir estas métricas en un porcentaje total de calidad; los porcentajes de retiro solo describen conjuntos de engine-* definidos
 */
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const exists=(p)=>fs.existsSync(path.join(root,p));
const rel=(p)=>path.relative(root,p).replaceAll('\\','/');
const stripQuery=(p)=>String(p||'').split('?')[0].replace(/^\.\//,'');

function walk(dir,files=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules','dist','docs','tests','scripts','.github'].includes(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,files);
    else if(/\.(?:js|mjs|cjs|html)$/i.test(entry.name))files.push(full);
  }
  return files;
}
const runtimeFiles=walk(root);
function occurrences(regex,{exclude=[]}={}){
  let count=0;const files=[];
  for(const full of runtimeFiles){
    const r=rel(full);
    if(exclude.some(x=>r===x||r.startsWith(x)))continue;
    let text='';try{text=fs.readFileSync(full,'utf8');}catch{continue;}
    const matches=[...text.matchAll(regex)];
    if(matches.length){count+=matches.length;files.push({path:r,count:matches.length});}
  }
  return {count,files};
}
function onlyPaths(metric,paths){
  const files=metric.files.filter(row=>paths.has(row.path));
  return{count:files.reduce((n,row)=>n+row.count,0),files};
}

const html=read('index.html');
const bootMarker='window.__keloBootReady=true';
const markerAt=html.indexOf(bootMarker);
const srcs=(text)=>[...text.matchAll(/<script\s+src=["']([^"']+)["'][^>]*><\/script>/g)].map(m=>m[1]);
const allStaticScripts=srcs(html);
const criticalScripts=markerAt>=0?srcs(html.slice(0,markerAt)):[];
const postBootStaticScripts=markerAt>=0?srcs(html.slice(markerAt)):[];
const allStaticPaths=new Set(allStaticScripts.map(stripQuery));

// Núcleo histórico A-L: métrica estable para seguir la migración principal.
const coreHistorical='abcdefghijkl'.split('').map(letter=>`engine-${letter}.js`);
const coreRemaining=coreHistorical.filter(exists);
const coreRetired=coreHistorical.filter(p=>!exists(p));
const coreRetirementPct=Math.round((coreRetired.length/coreHistorical.length)*1000)/10;

// Inventario engine-* completo del root. I/J/K son retiros conocidos de esta migración.
const knownRetiredEngineArtifacts=['engine-i.js','engine-j.js','engine-k.js'];
const rootEngineArtifacts=fs.readdirSync(root).filter(name=>/^engine-[a-z]+\.js$/i.test(name)).sort();
const knownEngineArtifactSet=[...new Set([...rootEngineArtifacts,...knownRetiredEngineArtifacts])].sort();
const artifactRetirementPct=Math.round((knownRetiredEngineArtifacts.filter(name=>!exists(name)).length/knownEngineArtifactSet.length)*1000)/10;
const staticEngineArtifacts=rootEngineArtifacts.filter(name=>allStaticPaths.has(name));
const notStaticIndexEngineArtifacts=rootEngineArtifacts.filter(name=>!allStaticPaths.has(name));
const unreferencedEngineArtifacts=[];
for(const name of rootEngineArtifacts){
  let refs=0;
  for(const full of runtimeFiles){
    const r=rel(full);if(r===name)continue;
    let text='';try{text=fs.readFileSync(full,'utf8');}catch{continue;}
    if(text.includes(name))refs++;
  }
  if(refs===0)unreferencedEngineArtifacts.push(name);
}

const criticalLegacyEngines=criticalScripts.filter(src=>/^engine-[a-z]+\.js(?:\?|$)/i.test(src));

const directPositionWrites=occurrences(/\blocalPlayer\.(?:x|y)\s*(?:\+\+|--|[+\-*/]?=)/g,{exclude:['src/core/player-position-system.js']});
const directCameraTargetWrites=occurrences(/\bcamera\.(?:targetX|targetY)\s*(?:\+\+|--|[+\-*/]?=)/g,{exclude:['src/core/camera-system.js']});
const obstacleMutations=occurrences(/\bobstacles\s*\.\s*(?:push|pop|splice|shift|unshift|sort|reverse)\s*\(/g,{exclude:['src/physics/']});
const staticBootPositionWrites=onlyPaths(directPositionWrites,allStaticPaths);
const staticBootCameraWrites=onlyPaths(directCameraTargetWrites,allStaticPaths);

const reassignedLegacyGlobals=[
  'triggerStone','renderActionBar','beginSkillAim','updateAimFromPointer','castAimedSkill','drawSkillIndicator',
  'startPvP','endPvP','teleportToPlot','teleportToFarm','render','updateMovement','processInput'
];
const globalReassignments={};
let globalReassignmentCount=0;
for(const name of reassignedLegacyGlobals){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const unqualified=new RegExp(`(^|[^.$\\w])${escaped}\\s*=\\s*(?:function|\\()`, 'gm');
  const qualified=new RegExp(`\\b(?:root|window|globalThis)\\.${escaped}\\s*=`, 'g');
  const a=occurrences(unqualified),b=occurrences(qualified);
  const merged=new Map();
  for(const row of [...a.files,...b.files])merged.set(row.path,(merged.get(row.path)||0)+row.count);
  const count=a.count+b.count;
  if(count){globalReassignments[name]={count,files:[...merged].map(([path,count])=>({path,count}))};globalReassignmentCount+=count;}
}

const inlineEventHandlers=[...html.matchAll(/\son(?:click|change|input|pointerdown|pointerup|touchstart|touchend|submit)=/gi)].length;
const inlineScripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/gi)].length;

const transitionalCandidates=[
  ['KeloStateStore','src/core/state-store-bootstrap.js'],
  ['KeloInput','src/core/input-system.js'],
  ['KeloMovement','src/core/movement-system.js'],
  ['KeloPlayerPosition','src/core/player-position-system.js'],
  ['KeloLegacyTransitionBridge','src/core/legacy-transition-bridge.js'],
  ['KeloAbilityAim','src/core/legacy-ability-aim-system.js'],
  ['KeloAbilityDirection','engine-f.js'],
  ['KeloLegacyAbilityTrigger','engine-f.js']
];
const transitionalOwners=transitionalCandidates.filter(([,p])=>exists(p)).map(([name])=>name);

const result={
  schema:2,
  coreHistoricalEngines:{baseline:coreHistorical.length,remaining:coreRemaining.length,retired:coreRetired.length,retirementPct:coreRetirementPct,remainingFiles:coreRemaining,retiredFiles:coreRetired},
  repoEngineArtifacts:{knownSet:knownEngineArtifactSet.length,current:rootEngineArtifacts.length,knownRetired:knownRetiredEngineArtifacts.filter(name=>!exists(name)).length,knownRetirementPct:artifactRetirementPct,staticInProductionIndex:staticEngineArtifacts.length,notStaticInProductionIndex:notStaticIndexEngineArtifacts.length,unreferencedRuntimeArtifacts:unreferencedEngineArtifacts.length,staticFiles:staticEngineArtifacts,unreferencedFiles:unreferencedEngineArtifacts},
  boot:{criticalExternalScripts:criticalScripts.length,postBootStaticScripts:postBootStaticScripts.length,criticalLegacyEngines:criticalLegacyEngines.length,criticalLegacyEngineFiles:criticalLegacyEngines},
  legacyWrites:{repoWide:{directPlayerPosition:directPositionWrites,directCameraTargets:directCameraTargetWrites,obstacleMutationsOutsidePhysics:obstacleMutations},staticProductionIndex:{directPlayerPosition:staticBootPositionWrites,directCameraTargets:staticBootCameraWrites}},
  legacyGlobalReassignments:{count:globalReassignmentCount,byName:globalReassignments},
  htmlLegacySurface:{inlineEventHandlers,inlineScripts},
  transitionalOwners:{count:transitionalOwners.length,names:transitionalOwners}
};

console.log(`LEGACY DEBT LIVE criticalScripts=${criticalScripts.length} criticalEngineScripts=${criticalLegacyEngines.length} staticPositionWrites=${staticBootPositionWrites.count} staticCameraWrites=${staticBootCameraWrites.count} globalReassignments=${globalReassignmentCount} inlineHandlers=${inlineEventHandlers}`);
console.log(`LEGACY DEBT REPO coreRetired=${coreRetired.length}/${coreHistorical.length} (${coreRetirementPct}%) engineArtifactsCurrent=${rootEngineArtifacts.length} knownArtifactSet=${knownEngineArtifactSet.length} knownArtifactRetiredPct=${artifactRetirementPct}% notStaticIndex=${notStaticIndexEngineArtifacts.length} unreferencedArtifacts=${unreferencedEngineArtifacts.length} transitionalOwners=${transitionalOwners.length}`);
console.log('LEGACY_DEBT_JSON='+JSON.stringify(result));
