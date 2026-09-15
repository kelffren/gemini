import assert from 'node:assert/strict';
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

api.setEnabled('paintCopies',false);
assert.equal(api.enabled('paintCopies'),false);
api.setEnabled('paintCopies',true);
assert.equal(api.enabled('paintCopies'),true);

const token=api.moduleStart('paintCopies','CONTRACT');
assert.ok(token&&token.id==='paintCopies');
api.moduleDone('paintCopies',token,{contract:true});
assert.equal(api.getFlight().lastCompleted?.module,'paintCopies');

api.moduleDisabled('assetPalette','CONTRACT');
assert.equal(api.status('assetPalette').status,'DISABLED');

console.log('WORLD_SURGERY_CONTRACT_PASS');
