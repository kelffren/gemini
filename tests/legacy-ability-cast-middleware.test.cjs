/* KELO-INDEX
 * area: QA / LEGACY ABILITY CAST CHAIN
 * owner: Evergreen migration contract
 * purpose: congela retirada de monkey-patches, orden LIFO y migración gradual de consumidores desde KeloAbilityAim hacia KeloLegacyAbilityCast
 */
const fs=require('node:fs');
const assert=require('node:assert/strict');

const owner=fs.readFileSync('src/core/legacy-ability-aim-system.js','utf8');
const plaza=fs.readFileSync('engine-l.js','utf8');
const world=fs.readFileSync('engine-m.js','utf8');

assert.ok(owner.includes('castMiddlewares.length-1'),'cast dispatcher must start from the last registered middleware');
assert.ok(owner.includes('return invoke(at-1)'),'cast middleware next() must descend through the chain');
assert.ok(owner.includes("throw new Error('cast middleware next() called twice: '+entry.owner)"),'middleware next() must be single-use');
assert.ok(owner.includes('root.KeloLegacyAbilityCast=Object.freeze({'),'separate legacy cast owner must exist');
assert.ok(owner.includes('registerMiddleware:registerCastMiddleware'),'legacy cast owner must expose registration');
assert.ok(owner.includes('dispatch:dispatchCast'),'legacy cast owner must expose the existing dispatcher');
assert.ok(owner.includes('registerCastMiddleware,'),'KeloAbilityAim must temporarily keep the compatibility adapter');

for(const [name,text] of [['engine-l',plaza],['engine-m',world]]){
  assert.ok(!/castAimedSkill\s*=\s*function/.test(text),`${name} must not monkey-patch castAimedSkill`);
  assert.ok(!text.includes('const _cast=castAimedSkill')&&!text.includes('const _castAll = castAimedSkill'),`${name} must not capture a legacy cast wrapper`);
}
assert.ok(plaza.includes('window.KeloAbilityAim'),'engine-l remains the single direct KeloAbilityAim cast consumer for this migration step');
assert.ok(plaza.includes('registerCastMiddleware('),'engine-l must preserve its existing middleware path until separately migrated');
assert.ok(world.includes('window.KeloLegacyAbilityCast'),'engine-m must use the separated legacy cast owner');
assert.ok(world.includes('registerMiddleware('),'engine-m must register through KeloLegacyAbilityCast');
assert.ok(!world.includes('window.KeloAbilityAim'),'engine-m direct KeloAbilityAim dependency must stay retired');
assert.ok(plaza.includes("'engine-l:plaza-cast-presentation'"),'plaza cast middleware owner missing');
assert.ok(world.includes("'engine-m:skill-shots'"),'world cast middleware owner missing');
assert.ok(plaza.includes('dashTween.dur=.11+.08*(land.range/170)'),'final plaza dash duration parity changed');
assert.ok(world.includes("if (typeId === 'dash') return next();"),'world middleware must delegate dash to plaza/base chain');
assert.ok(world.includes("typeId === 'fireball' || typeId === 'frostnova'"),'world projectile interception missing');

console.log('LEGACY ABILITY CAST MIDDLEWARE PASS');
