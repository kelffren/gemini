import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getWorldSurgery} from '../src/studio/diagnostics/world-surgery-control.mjs';
import {installWorldSurgery} from '../src/studio/diagnostics/world-surgery-runtime.mjs';
import {createKeloRuntimeAdapter} from '../src/studio/adapters/kelo-runtime-adapter.mjs';

function memoryStorage(){
  const data=new Map();
  return {getItem:key=>data.has(key)?data.get(key):null,setItem:(key,value)=>data.set(key,String(value)),removeItem:key=>data.delete(key)};
}

const root={
  localStorage:memoryStorage(),
  setInterval:globalThis.setInterval.bind(globalThis),
  clearInterval:globalThis.clearInterval.bind(globalThis),
  setTimeout:globalThis.setTimeout.bind(globalThis),
  clearTimeout:globalThis.clearTimeout.bind(globalThis)
};

const base=getWorldSurgery({root});
assert.equal(typeof base.enabled,'function');
assert.equal(typeof base.start,'function');
assert.equal(typeof base.done,'function');
assert.equal(typeof base.fail,'function');
assert.equal(typeof base.open,'function');

const api=installWorldSurgery({root});
assert.equal(root.KELO_WORLD_SURGERY,api);
assert.equal(api.version,'world-surgery-v1.1.0-unified');
for(const name of ['enabled','setEnabled','start','done','fail','moduleStart','moduleDone','moduleDisabled','moduleFailed','openPanel','startBisect','markBisect']){
  assert.equal(typeof api[name],'function',`${name} missing`);
}

const expectedSwitches=[
  'paintCopies','quickBuild','roomBuild','roomOpening','roomMaterial',
  'assetPalette','authorityMirror','cameraController','grid','draftHydration','snapshotLoading',
  'compiler','assetCatalog','treeCatalog'
];
const known=new Set(api.modules.map(row=>row.id));
for(const id of expectedSwitches){
  assert.ok(known.has(id),`${id} missing from surgery module catalog`);
  api.setEnabled(id,false);
  assert.equal(api.enabled(id),false,`${id} did not turn OFF`);
  api.setEnabled(id,true);
  assert.equal(api.enabled(id),true,`${id} did not turn ON`);
}

const token=api.moduleStart('paintCopies','CONTRACT');
assert.ok(token&&token.id==='paintCopies');
api.moduleDone('paintCopies',token,{contract:true});
assert.equal(api.getFlight().lastCompleted?.module,'paintCopies');

api.moduleDisabled('assetPalette','CONTRACT');
assert.equal(api.status('assetPalette').status,'DISABLED');

const live=readFileSync(new URL('../src/studio/integration/live-studio-controller.mjs',import.meta.url),'utf8');
assert.match(live,/createNoopAuthorityMirror/,'authority mirror fallback missing');
assert.match(live,/createNoopCameraController/,'camera fallback missing');
assert.match(live,/enabled\?\.\('authorityMirror'\)/,'authority mirror switch is not wired');
assert.match(live,/enabled\?\.\('cameraController'\)/,'camera switch is not wired');
assert.match(live,/createStudioOverlayCanvas:null/,'live overlay import gate missing');

const studioEntry=readFileSync(new URL('../src/studio/studio-entry.mjs',import.meta.url),'utf8');
assert.match(studioEntry,/WORLD_SURGERY_COMPILER_DISABLED/,'disabled compiler fail-safe missing');
assert.match(studioEntry,/compilerMod=\{createWorldCompiler:null\}/,'compiler import gate missing');
assert.match(studioEntry,/enabled\?\.\('compiler'\)===false/,'compiler flag is not checked before import');
assert.match(studioEntry,/surgery\.markStatus\('compiler'/,'compiler runtime status missing');

const buildTools=readFileSync(new URL('../src/studio/tools/register-build-tools.mjs',import.meta.url),'utf8');
for(const id of ['paintCopies','quickBuild','roomBuild','roomOpening','roomMaterial']){
  assert.ok(buildTools.includes(`'${id}'`),`${id} is not wired in build tools`);
}

const catalogRows=[
  {id:'tree:oak',label:'Oak Tree',category:'nature/tree'},
  {id:'prop:bench',label:'Bench',category:'furniture'}
];
root.KELO_PROPERTY_CATALOG={
  get:id=>catalogRows.find(row=>row.id===id)||null,
  list:()=>catalogRows.slice(),
  categories:()=>['nature/tree','furniture']
};

api.setEnabled('assetCatalog',true);
api.setEnabled('treeCatalog',false);
let adapter=createKeloRuntimeAdapter(root);
assert.equal(adapter.assetCatalog.get('tree:oak'),null,'treeCatalog OFF still exposes tree get');
assert.equal(adapter.assetCatalog.get('prop:bench')?.id,'prop:bench','treeCatalog OFF hid non-tree asset');
assert.deepEqual(adapter.assetCatalog.list().map(row=>row.id),['prop:bench'],'treeCatalog OFF did not filter tree list');

api.setEnabled('assetCatalog',false);
adapter=createKeloRuntimeAdapter(root);
assert.equal(adapter.assetCatalog.get('prop:bench'),null,'assetCatalog OFF still exposes get');
assert.deepEqual(adapter.assetCatalog.list(),[],'assetCatalog OFF still exposes list');
assert.deepEqual(adapter.assetCatalog.categories(),[],'assetCatalog OFF still exposes categories');

console.log('WORLD_SURGERY_CONTRACT_PASS');
