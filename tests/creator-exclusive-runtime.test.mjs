import assert from 'node:assert/strict';
import {enterCreatorExclusiveMode,leaveCreatorExclusiveMode,getCreatorExclusiveSnapshot} from '../src/creators/core/creator-exclusive-runtime.mjs';

const calls=[];
class CustomEvent{constructor(type,init={}){this.type=type;this.detail=init.detail;}}
const root={
  CustomEvent,
  document:{documentElement:{setAttribute:(...v)=>calls.push(['attr',...v]),removeAttribute:(...v)=>calls.push(['removeAttr',...v])}},
  dispatchEvent:event=>calls.push(['event',event.type]),
  KeloEvents:{emit:(name)=>calls.push(['bus',name])},
  KeloInputLocks:{acquire:()=>{calls.push(['lock']);return 'lock-1';},release:id=>calls.push(['unlock',id])},
  KeloMovement:{intercept:(owner,fn)=>{root.moveIntercept=fn;calls.push(['movement-on',owner]);return 'move-1';},unregister:id=>calls.push(['movement-off',id])},
  KeloRender:{intercept:(owner,fn)=>{root.renderIntercept=fn;calls.push(['render-on',owner]);return 'render-1';},unregister:id=>calls.push(['render-off',id])},
  KeloSimulation:{suspend:owner=>{calls.push(['simulation-on',owner]);return 'sim-1';},resume:id=>calls.push(['simulation-off',id])},
  KELO_ATLAS_CONTRACT:{
    runtimeSnapshot:()=>[
      {key:'core-a',role:'core',refs:0},
      {key:'district-cold',role:'district',refs:0},
      {key:'optional-live',role:'optional',refs:1}
    ],
    evict:(key,reason)=>{calls.push(['evict',key,reason]);return true;}
  }
};

const first=enterCreatorExclusiveMode({root,owner:'pixelorama-pro'});
assert.equal(getCreatorExclusiveSnapshot().active,true);
assert.equal(root.moveIntercept(),true);
assert.equal(root.renderIntercept(),true);
assert.ok(calls.some(v=>v[0]==='evict'&&v[1]==='district-cold'));
assert.ok(!calls.some(v=>v[0]==='evict'&&v[1]==='core-a'));
assert.ok(!calls.some(v=>v[0]==='evict'&&v[1]==='optional-live'));

const second=enterCreatorExclusiveMode({root,owner:'second-editor'});
assert.equal(getCreatorExclusiveSnapshot().claims.length,2);
assert.equal(leaveCreatorExclusiveMode(first,{root}),true);
assert.equal(getCreatorExclusiveSnapshot().active,true);
assert.ok(!calls.some(v=>v[0]==='unlock'));
assert.equal(leaveCreatorExclusiveMode(second,{root}),true);
assert.equal(getCreatorExclusiveSnapshot().active,false);
assert.ok(calls.some(v=>v[0]==='unlock'&&v[1]==='lock-1'));
assert.ok(calls.some(v=>v[0]==='simulation-off'&&v[1]==='sim-1'));
assert.ok(calls.some(v=>v[0]==='movement-off'&&v[1]==='move-1'));
assert.ok(calls.some(v=>v[0]==='render-off'&&v[1]==='render-1'));

console.log('creator-exclusive-runtime.test.mjs OK');
