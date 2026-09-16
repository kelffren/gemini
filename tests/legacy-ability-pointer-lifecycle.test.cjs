/* KELO-INDEX
 * area: QA / LEGACY ABILITY POINTER LIFECYCLE
 * owner: Evergreen migration contract
 * purpose: impide que engine-g recupere hotbar/aim/listeners/render y exige lifecycle legacy en KeloAbilityAim con cast registry separado en KeloLegacyAbilityCast
 */
const fs=require('node:fs');
const assert=require('node:assert/strict');

const legacy=fs.readFileSync('engine-g.js','utf8');
const owner=fs.readFileSync('src/core/legacy-ability-aim-system.js','utf8');
const modern=fs.readFileSync('src/abilities/kelo-ability-boot.js','utf8');
const aimPublic=owner.slice(owner.indexOf('root.KeloAbilityAim=Object.freeze'),owner.indexOf('})(typeof globalThis'));

for(const eventName of ['pointermove','pointerup','pointercancel']){
  assert.ok(!legacy.includes(`window.addEventListener('${eventName}'`),`engine-g must not own global ${eventName}`);
  assert.ok(owner.includes(`root.addEventListener('${eventName}'`),`KeloAbilityAim must own legacy global ${eventName}`);
  assert.ok(owner.includes(`root.removeEventListener('${eventName}'`),`KeloAbilityAim must be able to detach legacy global ${eventName}`);
}
for(const retired of ['function skillRange(','function isAimSkill(','function updateAimFromPointer(','function beginSkillAim(','function endSkillAim(','function castAimedSkill(']){
  assert.ok(!legacy.includes(retired),`engine-g retired aim/cast implementation returned: ${retired}`);
}

assert.ok(!legacy.includes('KeloRender.afterFrame'),'engine-g must not register the retired skill indicator render hook');
assert.ok(!legacy.includes('function drawSkillIndicator'),'engine-g retired skill indicator renderer must stay removed');
assert.ok(!legacy.includes("addEventListener('pointerdown'"),'engine-g must not rebuild or bind action-bar slots');
assert.ok(!legacy.includes('renderActionBar'),'engine-g must not reclaim action-bar ownership');
assert.ok(modern.includes('window.renderActionBar=()=>'),'modern KeloAbilities must own the renderActionBar compatibility adapter');
assert.ok(modern.includes('function paintHotbar(force)'),'modern KeloAbilities must retain the hotbar renderer');
assert.ok(owner.includes('setPointerCapture(e.pointerId)'),'legacy aim owner must preserve pointer capture for touch drag continuity');
assert.ok(owner.includes('root.endSkillAim=endSkillAimCompat'),'KeloAbilityAim must own endSkillAim compatibility');
assert.ok(owner.includes("const CAST_OWNER_VERSION='kelo-legacy-ability-cast-v1.0.0'"),'legacy cast owner version missing');
assert.ok(owner.includes('root.KeloLegacyAbilityCast=Object.freeze({'),'separate legacy cast owner missing');
assert.ok(owner.includes('registerMiddleware:registerCastMiddleware'),'legacy cast owner must expose middleware registration');
assert.ok(owner.includes('root.castAimedSkill=dispatchCast'),'legacy global cast compatibility must point to the single dispatcher');
assert.ok(owner.includes("const lifecycleKey='__KELO_ABILITY_AIM_POINTER_LIFECYCLE__'"),'pointer lifecycle singleton key missing');
assert.ok(owner.includes("version:'kelo-ability-pointer-lifecycle-v1.1.0'"),'pointer lifecycle version missing');
assert.ok(owner.includes("const VERSION='kelo-ability-aim-v1.4.1-cast-adapter-retired'"),'ability aim adapter-retired version missing');
assert.ok(!aimPublic.includes('registerCastMiddleware,'),'KeloAbilityAim cast registration adapter must remain retired');
assert.ok(owner.includes('aimAdapterTemporary:false'),'cast audit must record retired temporary adapter');
assert.ok(owner.includes('aimAdapterRetired:true'),'cast audit retirement flag missing');
assert.ok(owner.includes('previousLifecycle.detach()'),'hot reload/re-evaluation must detach the previous lifecycle before attaching another');

console.log('LEGACY ABILITY POINTER LIFECYCLE PASS aimAdapter=retired');