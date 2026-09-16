/* KELO-INDEX
 * area: QA / BOOT PERFORMANCE
 * owner: Evergreen boot surface contract
 * purpose: impide que módulos internos/no críticos vuelvan al parser-blocking boot y mide/fija la superficie crítica
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const html=read('index.html');
const featureRegistry=read('src/core/feature-registry.js');
const assetRegistry=read('src/core/asset-registry.js');
const moduleLoader=read('src/core/module-loader.js');
const bootMarker='window.__keloBootReady=true';
const markerAt=html.indexOf(bootMarker);
assert.ok(markerAt>0,'boot-ready marker missing');

const before=html.slice(0,markerAt);
const after=html.slice(markerAt);
const scriptSrcs=(text)=>[...text.matchAll(/<script\s+src=["']([^"']+)["'][^>]*><\/script>/g)].map(m=>m[1]);
const critical=scriptSrcs(before);
const postBootStatic=scriptSrcs(after);
const localFile=(src)=>String(src).split(/[?#]/)[0].replace(/^\.\//,'').replace(/^\//,'');
const bytesFor=(items)=>items.reduce((total,src)=>{
  const rel=localFile(src);
  const full=path.join(root,rel);
  assert.ok(fs.existsSync(full),`boot script missing on disk: ${rel}`);
  return total+fs.statSync(full).size;
},0);
const criticalBytes=bytesFor(critical);
const postBootStaticBytes=bytesFor(postBootStatic);

assert.ok(critical.length<=48,`critical script budget exceeded: ${critical.length} > 48`);
assert.ok(postBootStatic.length<=3,`post-boot static script budget exceeded: ${postBootStatic.length} > 3`);
assert.ok(critical.some(src=>src.includes('src/core/legacy-ability-aim-system.js')),'KeloAbilityAim compatibility owner missing from critical boot');

const retiredEngines=Object.freeze(['engine-i.js','engine-j.js','engine-k.js']);
const forbiddenInIndex=[
  ...retiredEngines,
  'src/core/simulation-farm-shadow.js',
  'src/core/player-position-shadow.js',
  'src/ui/asset-library-launcher.js',
  'src/core/settings-lazy-gate.js',
  'src/core/update-gate.js',
  'src/systems/admin-key-system.js',
  'src/core/admin-control-lazy-gate.js',
  'src/core/account-live-control-gate.js',
  'src/core/creators-lazy-gate.js'
];
for(const value of forbiddenInIndex)assert.ok(!html.includes(`src="${value}`),`${value} must not return to static index boot`);

for(const id of ['controlPlane','observability']){
  const at=featureRegistry.indexOf(`${id}:{`);
  assert.ok(at>=0,`${id} feature missing`);
  const slice=featureRegistry.slice(at,at+900);
  assert.match(slice,/policy:'after-paint'/,`${id} must stay after-paint`);
  assert.match(slice,/userToggle:false/,`${id} must stay internal/non-toggleable`);
}
assert.match(assetRegistry,/toggleableIds/, 'asset registry must consume toggleable feature ids');
assert.match(moduleLoader,/function afterFirstPaint\(/, 'module loader must own after-paint scheduling');
assert.match(moduleLoader,/requestAnimationFrame\(function\(\)\{root\.requestAnimationFrame\(run\);\}\)/, 'after-paint scheduling must cross two animation frames');

function walk(dir,files=[]){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    if(['.git','node_modules','dist'].includes(entry.name))continue;
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full,files);
    else if(/\.(?:js|mjs|cjs|html|json)$/.test(entry.name))files.push(full);
  }
  return files;
}

const retiredRefs=Object.fromEntries(retiredEngines.map(name=>[name,[]]));
for(const full of walk(root)){
  const rel=path.relative(root,full).replaceAll('\\','/');
  if(rel==='scripts/boot-surface-audit.mjs'||retiredEngines.includes(rel))continue;
  let text='';try{text=fs.readFileSync(full,'utf8');}catch{continue;}
  for(const engine of retiredEngines){
    if(text.includes(engine))retiredRefs[engine].push(rel);
  }
}
for(const engine of retiredEngines){
  assert.deepEqual(retiredRefs[engine],[],`retired ${engine} still referenced by runtime/test code: ${retiredRefs[engine].join(', ')}`);
}

console.log(`BOOT SURFACE PASS critical=${critical.length} criticalBytes=${criticalBytes} postBootStatic=${postBootStatic.length} postBootStaticBytes=${postBootStaticBytes} deferredInternal=9 retiredRuntimeRefs=0`);
