import assert from 'node:assert/strict';import {createSpawnPlan,createEncounterRuntime} from '../src/pve/pve-runtime.mjs';import {mountPveWorld} from '../src/pve/pve-world-integration.mjs';
const callbacks={};const sim={after(o,fn){callbacks.sim=fn;return's1'},unregister(){return true}};const render={afterFrame(o,fn){callbacks.render=fn;return'r1'},unregister(){return true}};
const encounter=createEncounterRuntime(createSpawnPlan({encounterId:'mount',count:2,seed:'x'}));let draws=0;const mounted=mountPveWorld({encounter,simulation:sim,render,getTarget:()=>({id:'p',x:0,y:0}),drawEnemy:()=>draws++});
assert.equal(mounted.hooks.length,2);callbacks.sim({dt:.016});callbacks.render({});assert.equal(draws,2);assert.equal(mounted.unmount(),true);console.log('pve-world-integration-audit: ok');
