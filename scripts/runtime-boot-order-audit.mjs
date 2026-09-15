/* KELO-INDEX
 * area: QA / RUNTIME BOOT
 * owner: Runtime Boot Contract
 * owns: deterministic validation of plaza-first parser boot + lazy feature/runtime manifests
 * does-not-own: runtime loading, feature behavior, cache versions
 * purpose: prevent Safari freeze regressions without forcing heavy modules back into parser boot
 * public-api: CLI `node scripts/runtime-boot-order-audit.mjs`
 * extension-points: add critical dependency edges to the phase that actually owns them
 * reuse: quality CI before runtime/deploy verification
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const INDEX=path.join(ROOT,'index.html');
const MODULE_LOADER=path.join(ROOT,'src/core/module-loader.js');
const RUNTIME_BOOTSTRAP=path.join(ROOT,'src/core/kelo-runtime-bootstrap.js');
let failures=0;
let warnings=0;
const fail=message=>{failures+=1;console.error('BOOT_ORDER_FAIL:',message);};
const warn=message=>{warnings+=1;console.warn('BOOT_ORDER_WARN:',message);};
const ok=message=>console.log('BOOT_ORDER_OK:',message);
const normalize=src=>String(src||'').split('?')[0].split('#')[0];
const exists=src=>fs.existsSync(path.join(ROOT,normalize(src)));

function srcList(source){
  return [...source.matchAll(/\bsrc\s*:\s*['"]([^'"]+)['"]/g)].map(match=>normalize(match[1]));
}
function quotedList(source){
  return [...source.matchAll(/['"]([^'"]+\.js(?:\?[^'"]*)?)['"]/g)].map(match=>normalize(match[1]));
}
function assertNoDuplicates(list,label){
  const seen=new Set();
  for(const src of list){
    if(seen.has(src)) fail(`${label} duplicates ${src}`);
    seen.add(src);
  }
}
function assertFiles(list,label){
  for(const src of list){
    if(/^https?:\/\//i.test(src)||/^\/\//.test(src)) continue;
    if(!exists(src)) fail(`${label} references missing module: ${src}`);
  }
}
function assertBefore(list,a,b,label){
  const ai=list.indexOf(a),bi=list.indexOf(b);
  if(ai<0){fail(`${label} missing ${a}`);return;}
  if(bi<0){fail(`${label} missing ${b}`);return;}
  if(ai>=bi) fail(`${a} must load before ${b} (${label})`);
}
function featureList(source,name){
  const match=source.match(new RegExp(`\\b${name}\\s*:\\s*\\[([\\s\\S]*?)\\n\\s*\\]`));
  if(!match){fail(`lazy feature pack missing: ${name}`);return [];}
  return srcList(match[1]);
}

if(!fs.existsSync(INDEX)){
  fail('index.html missing');
}else if(!fs.existsSync(MODULE_LOADER)){
  fail('src/core/module-loader.js missing');
}else if(!fs.existsSync(RUNTIME_BOOTSTRAP)){
  fail('src/core/kelo-runtime-bootstrap.js missing');
}else{
  const html=fs.readFileSync(INDEX,'utf8');
  const moduleLoaderSource=fs.readFileSync(MODULE_LOADER,'utf8');
  const runtimeBootstrapSource=fs.readFileSync(RUNTIME_BOOTSTRAP,'utf8');

  const scripts=[];
  const re=/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
  let match;
  while((match=re.exec(html))){
    const raw=match[1];
    scripts.push({raw,normalized:normalize(raw),offset:match.index});
  }
  const local=scripts.filter(item=>!/^https?:\/\//i.test(item.normalized)&&!/^\/\//.test(item.normalized));
  const staticList=local.map(item=>item.normalized);
  assertNoDuplicates(staticList,'parser boot');
  assertFiles(staticList,'parser boot');

  // The iPhone freeze fix depends on keeping parser boot small. Do not restore the historical 100+ tag boot.
  const STATIC_BUDGET=60;
  if(staticList.length>STATIC_BUDGET) fail(`parser boot budget exceeded: ${staticList.length} > ${STATIC_BUDGET}`);

  const staticEdges=[
    ['src/core/events/event-bus.js','src/core/input-lock-system.js','events before input locks'],
    ['src/core/input-lock-system.js','src/core/kelo-runtime-bootstrap.js','core primitives before lazy runtime bootstrap'],
    ['src/physics/collision-utils.js','engine-a.js','collision owner before legacy physics'],
    ['engine-a.js','src/core/input-system.js','legacy base before input owner adoption'],
    ['src/core/input-system.js','src/core/movement-system.js','movement consumes normalized input'],
    ['src/core/movement-system.js','engine-b.js','movement owner before legacy movement consumer'],
    ['engine-c.js','src/core/camera-system.js','camera follows initialized player/runtime'],
    ['src/core/camera-system.js','src/core/avatar-render-system.js','avatar follows viewport owner'],
    ['src/core/avatar-render-system.js','src/core/render-extension-system.js','render extensions follow avatar owner'],
    ['src/environment/terrain-contract.js','src/environment/tile-registry.js','tiles consume terrain semantics'],
    ['src/environment/tile-registry.js','src/environment/atlas-contract.js','atlas sees registered tiles'],
    ['src/environment/atlas-contract.js','src/environment/world-map.js','world consumes atlas contract'],
    ['src/environment/world-map.js','src/environment/environment-layer-stack.js','layers consume authored world'],
    ['src/environment/environment-layer-stack.js','src/environment/prop-contract.js','props attach to established phases'],
    ['src/environment/prop-contract.js','src/environment/generic-props.js','renderer consumes prop contract'],
    ['src/environment/generic-props.js','engine-l.js','legacy world renderer follows managed props'],
    ['src/ui/luxe-shell.js','src/ui/luxe-player-hud.js','HUD follows shell'],
    ['src/ui/luxe-player-hud.js','src/systems/performance-governor.js','governor arms after visible plaza UI']
  ];
  for(const [a,b,reason] of staticEdges) assertBefore(staticList,a,b,reason);

  const holdOffset=html.indexOf('window.__keloHoldGameLoop=true');
  const engineBOffset=html.indexOf('engine-b.js');
  const governorOffset=html.indexOf('src/systems/performance-governor.js');
  const readyOffset=html.indexOf('window.__keloBootReady=true');
  const loaderOffset=html.indexOf('src/core/module-loader.js');
  const loaderStartOffset=html.indexOf('KELO_MODULE_LOADER&&window.KELO_MODULE_LOADER.start');
  if(holdOffset<0||engineBOffset<0||holdOffset>=engineBOffset) fail('__keloHoldGameLoop must be armed before engine-b');
  if(governorOffset<0||readyOffset<0||loaderOffset<0||loaderStartOffset<0||!(governorOffset<readyOffset&&readyOffset<loaderOffset&&loaderOffset<loaderStartOffset)){
    fail('plaza release order must be governor -> boot-ready -> module-loader -> module-loader.start');
  }

  // Legacy engines after L are intentionally not parser-time scripts. Restoring them recreates the Safari compile freeze.
  const forbiddenParserEngines=staticList.filter(src=>/^engine-(?:m|n|o|p|q|r|s|t|u|v|w|x|y|z|aa|ab|ac|ad|ae|af|ag|ah|ai|aj)\.js$/i.test(src));
  if(forbiddenParserEngines.length) fail(`heavy legacy engines returned to parser boot: ${forbiddenParserEngines.join(', ')}`);

  const featureNames=['social','world','bag','mounts','market','titles','appearance','properties'];
  const features=new Map();
  const allFeatureModules=[];
  for(const name of featureNames){
    const list=featureList(moduleLoaderSource,name);
    features.set(name,list);
    allFeatureModules.push(...list);
    assertNoDuplicates(list,`feature:${name}`);
    assertFiles(list,`feature:${name}`);
  }
  const featureSeen=new Set();
  for(const src of allFeatureModules){
    if(featureSeen.has(src)) warn(`module ${src} appears in more than one first-use feature pack`);
    featureSeen.add(src);
  }
  for(const src of featureSeen){
    if(staticList.includes(src)) fail(`lazy feature module also present in parser boot: ${src}`);
  }

  assertBefore(features.get('social')||[],'src/ui/player-nameplate.js','src/systems/nobility.js','social pack');
  assertBefore(features.get('bag')||[],'src/systems/backpack-system.js','src/ui/backpack-ui.js','bag pack');
  assertBefore(features.get('mounts')||[],'src/mounts/mount-catalog.js','src/mounts/mount-system.js','mounts pack');
  assertBefore(features.get('mounts')||[],'src/mounts/mount-system.js','src/ui/mount-panel.js','mounts pack');
  assertBefore(features.get('titles')||[],'src/systems/player-stats.js','src/systems/title-system.js','titles pack');
  assertBefore(features.get('properties')||[],'src/property/property-system.js','src/ui/house-instance-ui.js','properties pack');

  const world=features.get('world')||[];
  ['engine-m.js','engine-n.js','engine-o.js','engine-p.js','engine-q.js','engine-s.js','engine-ah.js','engine-ai.js','src/systems/illumination.js'].forEach(src=>{
    if(!world.includes(src)) fail(`world first-use pack missing current module: ${src}`);
  });

  const modulesMatch=runtimeBootstrapSource.match(/const\s+MODULES\s*=\s*Object\.freeze\(\[([\s\S]*?)\]\);/);
  if(!modulesMatch){
    fail('KeloRuntimeBootstrap MODULES manifest missing');
  }else{
    const runtimeModules=quotedList(modulesMatch[1]);
    assertNoDuplicates(runtimeModules,'runtime foundation manifest');
    assertFiles(runtimeModules,'runtime foundation manifest');
    const allowedShared=new Set(['src/core/events/event-bus.js']);
    for(const src of runtimeModules){
      if(staticList.includes(src)&&!allowedShared.has(src)) fail(`lazy runtime foundation also present in parser boot: ${src}`);
    }
    assertBefore(runtimeModules,'src/systems/combat/combat-schema.js','src/systems/combat/combat-engine.js','lazy PvP foundation');
    assertBefore(runtimeModules,'src/systems/effects/status-engine.js','src/systems/effects/effect-engine.js','lazy effects foundation');
    assertBefore(runtimeModules,'src/systems/melee/melee-schema.js','src/systems/melee/melee-engine.js','lazy melee foundation');
    ok(`validated ${runtimeModules.length} lazy runtime foundation modules`);
  }

  // Loader must remain first-use only. Auto-loading or periodic polling while gameLoop runs was a measured freeze source.
  const startMatch=moduleLoaderSource.match(/function\s+start\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/);
  if(!startMatch){
    fail('KeloModuleLoader.start missing');
  }else{
    const body=startMatch[1];
    if(/\bloadFeature\s*\(/.test(body)) fail('KeloModuleLoader.start must not auto-load feature packs');
    if(/\bsetInterval\s*\(/.test(body)||/\bfetch\s*\(/.test(body)) fail('KeloModuleLoader.start must not poll/download while gameplay is running');
  }

  const inlineMutations=[...html.matchAll(/<script>([^<]*(?:window|globalThis)\.[A-Z0-9_]+\s*=.*?)[<]\/script>/gsi)];
  if(inlineMutations.length) warn(`${inlineMutations.length} inline global boot mutation(s) remain; migrate them into explicit config owners gradually`);

  ok(`validated plaza-first parser boot: ${staticList.length}/${STATIC_BUDGET} script budget, ${staticEdges.length} static edges, ${featureSeen.size} first-use modules`);
}

if(failures){
  console.error(`\nRuntime boot order audit failed with ${failures} violation(s) and ${warnings} warning(s).`);
  process.exit(1);
}
ok(`Runtime boot order contract passed${warnings?` with ${warnings} warning(s)`:''}`);
