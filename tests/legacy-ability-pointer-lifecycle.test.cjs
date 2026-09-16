/* KELO-INDEX
 * area: QA / LEGACY ABILITY POINTER LIFECYCLE
 * owner: Evergreen migration contract
 * purpose: impide que engine-g recupere aim/listeners/render y exige lifecycle/cast registry propiedad de KeloAbilityAim
 */
const fs=require('node:fs');
const assert=require('node:assert/strict');

const legacy=fs.readFileSync('engine-g.js','utf8');
const owner=fs.readFileSync('src/core/legacy-ability-aim-system.js','utf8');

for(const eventName of ['pointermove','pointerup','pointercancel']){
  assert.ok(!legacy.includes(`window.addEventListener('${eventName}'`),`engine-g must not own global ${eventName}`);
  assert.ok(owner.includes(`root.addEventListener('${eventName}'`),`KeloAbilityAim must own ${eventName}`);
  assert.ok(owner.includes(`root.removeEventListener('${eventName}'`),`KeloAbilityAim must be able to detach ${eventName}`);
}
for(const retired of ['function skillRange(','function isAimSkill(','function updateAimFromPointer(','function beginSkillAim(','function endSkillAim(','function castAimedSkill(']){
  assert.ok(!legacy.includes(retired),`engine-g retired aim/cast implementation returned: ${retired}`);
}

assert.ok(!legacy.includes('KeloRender.afterFrame'),'engine-g must not register the retired skill indicator render hook');
assert.ok(!legacy.includes('function drawSkillIndicator'),'engine-g retired skill indicator renderer must stay removed');
assert.ok(legacy.includes("slot.addEventListener('pointerdown'"),'action slots must keep their local pointerdown contract');
assert.ok(legacy.includes("typeof owner.begin === 'function'"),'action slots must delegate pointerdown to KeloAbilityAim.begin');
assert.ok(owner.includes('setPointerCapture(e.pointerId)'),'aim owner must preserve pointer capture for touch drag continuity');
assert.ok(owner.includes('root.endSkillAim=endSkillAimCompat'),'KeloAbilityAim must own endSkillAim compatibility');
assert.ok(owner.includes('function registerCastMiddleware(owner,fn)'),'KeloAbilityAim must own the cast middleware registry');
assert.ok(owner.includes('root.castAimedSkill=dispatchCast'),'legacy global cast compatibility must point to the single dispatcher');
assert.ok(owner.includes("const lifecycleKey='__KELO_ABILITY_AIM_POINTER_LIFECYCLE__'"),'pointer lifecycle singleton key missing');
assert.ok(owner.includes("version:'kelo-ability-pointer-lifecycle-v1.1.0'"),'pointer lifecycle version missing');
assert.ok(owner.includes("const VERSION='kelo-ability-aim-v1.3.0-cast-middleware-owner'"),'ability aim cast-middleware owner version missing');
assert.ok(owner.includes('previousLifecycle.detach()'),'hot reload/re-evaluation must detach the previous lifecycle before attaching another');

console.log('LEGACY ABILITY POINTER LIFECYCLE PASS');