import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {getWorldSurgery} from '../src/studio/diagnostics/world-surgery-control.mjs';
import {installWorldSurgery} from '../src/studio/diagnostics/world-surgery-runtime.mjs';

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
  'assetPalette','authorityMirror','cameraController','grid','draftHydration','snapshotLoading'
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

const buildTools=readFileSync(new URL('../src/studio/tools/register-build-tools.mjs',import.meta.url),'utf8');
for(const id of ['paintCopies','quickBuild','roomBuild','roomOpening','roomMaterial']){
  assert.ok(buildTools.includes(`'${id}'`),`${id} is not wired in build tools`);
}

console.log('WORLD_SURGERY_CONTRACT_PASS');
