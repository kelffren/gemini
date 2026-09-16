'use strict';
const assert=require('node:assert/strict');
const api=require('../engine-f.js');

function approx(actual,expected,epsilon=1e-12){
  assert.ok(Math.abs(actual-expected)<=epsilon,`expected ${actual} ≈ ${expected}`);
}

assert.match(api.version,/^kelo-ability-direction-v1\.1\.0-/);
assert.deepEqual(api.thresholds,{aimInput:0.15,dashInput:0.12,dashVelocity:12});
assert.deepEqual(api.balance,{
  directDashDistance:150,
  directDashPvpRadius:60,
  projectileSpeed:450,
  projectileRadius:10,
  projectileLife:2,
  trailSteps:10
});

const normalized=api.normalized(3,4,{x:1,y:0});
approx(normalized.x,0.6);
approx(normalized.y,0.8);
assert.deepEqual(api.normalized(0,0,{x:0,y:1}),{x:0,y:1},'zero-axis fallback must preserve vertical aim');

const thresholdAim=api.aimFromInput(0.15,0,{x:0,y:1});
assert.deepEqual(thresholdAim,{x:0,y:1,updated:false},'aim threshold is strict > 0.15');
const liveAim=api.aimFromInput(0.150001,0,{x:0,y:1});
assert.equal(liveAim.updated,true);
approx(liveAim.x,1);
approx(liveAim.y,0);

const inputWins=api.chooseDashDirection({inputX:0,inputY:1,velocityX:100,velocityY:0,aimX:-1,aimY:0});
assert.deepEqual(inputWins,{x:0,y:1},'live input must win over velocity and stored aim');

const thresholdInputFallsThrough=api.chooseDashDirection({inputX:0.12,inputY:0,velocityX:0,velocityY:13,aimX:-1,aimY:0});
approx(thresholdInputFallsThrough.x,0);
approx(thresholdInputFallsThrough.y,1);

const thresholdVelocityFallsThrough=api.chooseDashDirection({inputX:0,inputY:0,velocityX:12,velocityY:0,aimX:0,aimY:-1});
assert.deepEqual(thresholdVelocityFallsThrough,{x:0,y:-1},'velocity threshold is strict > 12');

const velocityWins=api.chooseDashDirection({inputX:0,inputY:0,velocityX:3,velocityY:4,aimX:0,aimY:-1});
assert.deepEqual(velocityWins,{x:0,y:-1},'velocity below threshold must preserve stored aim');
const fastVelocity=api.chooseDashDirection({inputX:0,inputY:0,velocityX:9,velocityY:12,aimX:-1,aimY:0});
approx(fastVelocity.x,0.6);
approx(fastVelocity.y,0.8);

assert.ok(Object.isFrozen(api.thresholds));
assert.ok(Object.isFrozen(api.balance));
console.log('LEGACY ABILITY DIRECTION PARITY PASS');
