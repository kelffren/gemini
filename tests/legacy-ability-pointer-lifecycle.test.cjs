/* KELO-INDEX
 * area: QA / LEGACY ABILITY POINTER LIFECYCLE
 * owner: Evergreen migration contract
 * purpose: impide que engine-g vuelva a registrar listeners globales de aim y exige un lifecycle desmontable propiedad de KeloAbilityAim
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

assert.ok(legacy.includes("slot.addEventListener('pointerdown'"),'action slots must keep their local pointerdown contract');
assert.ok(owner.includes('setPointerCapture(e.pointerId)'),'aim owner must preserve pointer capture for touch drag continuity');
assert.ok(owner.includes("const lifecycleKey='__KELO_ABILITY_AIM_POINTER_LIFECYCLE__'"),'pointer lifecycle singleton key missing');
assert.ok(owner.includes("version:'kelo-ability-pointer-lifecycle-v1.0.0'"),'pointer lifecycle version missing');
assert.ok(owner.includes("const VERSION='kelo-ability-aim-v1.1.0-pointer-owner'"),'ability aim pointer-owner version missing');
assert.ok(owner.includes('previousLifecycle.detach()'),'hot reload/re-evaluation must detach the previous lifecycle before attaching another');

console.log('LEGACY ABILITY POINTER LIFECYCLE PASS');