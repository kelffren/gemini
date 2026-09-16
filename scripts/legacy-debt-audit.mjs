/* KELO-INDEX
 * area: QA / LEGACY DEBT
 * owner: Evergreen migration contract
 * purpose: mide deuda legacy con contadores objetivos; no inventa un score global ni bloquea por deuda existente
 * public-api: salida LEGACY_DEBT_JSON para CI/reportes
 * do-not: NO convertir estas métricas en porcentaje total de calidad; el % de retiro solo aplica a engine-a..l
 */
import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const exists=(p)=>fs.existsSync(path.join(root,p));
const rel=(p)=>path.relative(root,p).replaceAll('\\','/');

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

const alphabet='abcdefghijkl'.split('');
const historical=alphabet.map(letter=>`engine-${letter}.js`);
const remainingEngines=historical.filter(exists);
const retiredEngines=historical.filter(p=>!exists(p));
const engineRetirementPct=Math.round((retiredEngines.length/historical.length)*1000)/10;

const html=read('index.html');
const bootMarker='window.__keloBootReady=true';
const markerAt=html.indexOf(bootMarker);
const srcs=(text)=>[...text.matchAll(/<script\s+src=["']([^"']+)["'][^>]*><\/script>/g)].map(m=>m[1]);
const criticalScripts=markerAt>=0?srcs(html.slice(0,markerAt)):[];
const postBootStaticScripts=markerAt>=0?srcs(html.slice(markerAt)):[];
const criticalLegacyEngines=criticalScripts.filter(src=>/engine-[a-l]\.js(?:\?|$)/.test(src));

const directPositionWrites=occurrences(/\blocalPlayer\.(?:x|y)\s*(?:\+\+|--|[+\-*/]?=)/g,{exclude:['src/core/player-position-system.js']});
const directCameraTargetWrites=occurrences(/\bcamera\.(?:targetX|targetY)\s*(?:\+\+|--|[+\-*/]?=)/g,{exclude:['src/core/camera-system.js']});
const obstacleMutations=occurrences(/\bobstacles\s*\.\s*(?:push|pop|splice|shift|unshift|sort|reverse)\s*\(/g,{exclude:['src/physics/']});

const reassignedLegacyGlobals=[
  'triggerStone','renderActionBar','beginSkillAim','updateAimFromPointer','castAimedSkill','drawSkillIndicator',
  'startPvP','endPvP','teleportToPlot','teleportToFarm','render','updateMovement','processInput'
];
const globalReassignments={};
let globalReassignmentCount=0;
for(const name of reassignedLegacyGlobals){
  const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const found=occurrences(new RegExp(`(^|[^.$\\w])${escaped}\\s*=\\s*(?:function|\\()`, 'gm'));
  if(found.count){globalReassignments[name]=found;globalReassignmentCount+=found.count;}
}

const inlineEventHandlers=[...html.matchAll(/\son(?:click|change|input|pointerdown|pointerup|touchstart|touchend|submit)=/gi)].length;
const inlineScripts=[...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>/gi)].length;

const transitionalCandidates=[
  ['KeloStateStore','src/core/state-store-bootstrap.js'],
  ['KeloInput','src/core/input-system.js'],
  ['KeloMovement','src/core/movement-system.js'],
  ['KeloPlayerPosition','src/core/player-position-system.js'],
  ['KeloLegacyTransitionBridge','src/core/legacy-transition-bridge.js'],
  ['KeloAbilityAim','src/core/legacy-ability-aim-system.js']
];
const transitionalOwners=transitionalCandidates.filter(([,p])=>exists(p)).map(([name])=>name);

const result={
  schema:1,
  historicalEngineFiles:{baseline:historical.length,remaining:remainingEngines.length,retired:retiredEngines.length,retirementPct:engineRetirementPct,remainingFiles:remainingEngines,retiredFiles:retiredEngines},
  boot:{criticalExternalScripts:criticalScripts.length,postBootStaticScripts:postBootStaticScripts.length,criticalLegacyEngines:criticalLegacyEngines.length,criticalLegacyEngineFiles:criticalLegacyEngines},
  legacyWrites:{directPlayerPosition:directPositionWrites,directCameraTargets:directCameraTargetWrites,obstacleMutationsOutsidePhysics:obstacleMutations},
  legacyGlobalReassignments:{count:globalReassignmentCount,byName:globalReassignments},
  htmlLegacySurface:{inlineEventHandlers,inlineScripts},
  transitionalOwners:{count:transitionalOwners.length,names:transitionalOwners}
};

console.log(`LEGACY DEBT engineRetired=${retiredEngines.length}/${historical.length} (${engineRetirementPct}%) engineRemaining=${remainingEngines.length} criticalScripts=${criticalScripts.length} criticalLegacyEngines=${criticalLegacyEngines.length} directPositionWrites=${directPositionWrites.count} globalReassignments=${globalReassignmentCount} inlineHandlers=${inlineEventHandlers} transitionalOwners=${transitionalOwners.length}`);
console.log('LEGACY_DEBT_JSON='+JSON.stringify(result));
