/* KELO-INDEX
 * area: QA / LEGACY ABILITY PARITY
 * owner: KeloAbilityAim characterization
 * purpose: congela la matemática final que engine-j/engine-k aportaban para migrarla sin cambiar feel ni balance
 */
'use strict';
const assert=require('node:assert/strict');
const aim=require('../src/core/legacy-ability-aim-system.js');
const approx=(actual,expected,epsilon=1e-9)=>assert.ok(Math.abs(actual-expected)<=epsilon,`expected ${actual} ≈ ${expected}`);

assert.equal(aim.version,'kelo-ability-aim-v1.4.0-cast-owner-split');
assert.deepEqual(aim.max,{dash:170,fireball:300,frostnova:230,meteor:260});
assert.deepEqual(aim.min,{dash:0.32,fireball:0.45,frostnova:0.45,meteor:0.4});
assert.equal(aim.stickRadius,72);
assert.equal(aim.initialPower,0.45);
assert.equal(aim.minimumPointerPower,0.28);

assert.equal(aim.maxRange('dash'),170);
assert.equal(aim.maxRange('fireball'),300);
assert.equal(aim.maxRange('frostnova'),230);
assert.equal(aim.maxRange('meteor'),260);
assert.equal(aim.maxRange('unknown'),0);

assert.equal(aim.powerFromButtonDistance(0),0);
approx(aim.powerFromButtonDistance(36),0.5);
assert.equal(aim.powerFromButtonDistance(72),1);
assert.equal(aim.powerFromButtonDistance(144),1);
assert.equal(aim.powerFromButtonDistance(-5),0);

approx(aim.measuredRange('dash',0),170*0.32);
approx(aim.measuredRange('dash',1),170);
approx(aim.measuredRange('fireball',0),300*0.45);
approx(aim.measuredRange('frostnova',1),230);
approx(aim.measuredRange('meteor',0.5),260*(0.4+0.6*0.5));
approx(aim.measuredRange('unknown',0),160*0.4);
approx(aim.measuredRange('unknown',1),160);

const p0=Math.max(aim.minimumPointerPower,aim.powerFromButtonDistance(0));
const pHalf=Math.max(aim.minimumPointerPower,aim.powerFromButtonDistance(36));
approx(aim.measuredRange('dash',p0),170*(0.32+0.68*0.28));
approx(aim.measuredRange('dash',pHalf),170*(0.32+0.68*0.5));

console.log('LEGACY ABILITY AIM PARITY PASS');
