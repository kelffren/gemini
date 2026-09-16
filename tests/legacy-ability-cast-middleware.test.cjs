/* KELO-INDEX
 * area: QA / LEGACY ABILITY CAST CHAIN
 * owner: Evergreen migration contract
 * purpose: congela la retirada de monkey-patches de cast en engine-l/m y el orden LIFO del owner único
 */
const fs=require('node:fs');
const assert=require('node:assert/strict');

const owner=fs.readFileSync('src/core/legacy-ability-aim-system.js','utf8');
const plaza=fs.readFileSync('engine-l.js','utf8');
const world=fs.readFileSync('engine-m.js','utf8');

assert.ok(owner.includes('castMiddlewares.length-1'),'cast dispatcher must start from the last registered middleware');
assert.ok(owner.includes('return invoke(at-1)'),'cast middleware next() must descend through the chain');
assert.ok(owner.includes("throw new Error('cast middleware next() called twice: '+entry.owner)"),'middleware next() must be single-use');
assert.ok(owner.includes('registerCastMiddleware,'),'KeloAbilityAim public API must expose registerCastMiddleware');

for(const [name,text] of [['engine-l',plaza],['engine-m',world]]){
  assert.ok(!/castAimedSkill\s*=\s*function/.test(text),`${name} must not monkey-patch castAimedSkill`);
  assert.ok(!text.includes('const _cast=castAimedSkill')&&!text.includes('const _castAll = castAimedSkill'),`${name} must not capture a legacy cast wrapper`);
  assert.ok(text.includes('registerCastMiddleware('),`${name} must register with KeloAbilityAim`);
}
assert.ok(plaza.includes("'engine-l:plaza-cast-presentation'"),'plaza cast middleware owner missing');
assert.ok(world.includes("'engine-m:skill-shots'"),'world cast middleware owner missing');
assert.ok(plaza.includes('dashTween.dur=.11+.08*(land.range/170)'),'final plaza dash duration parity changed');
assert.ok(world.includes("if (typeId === 'dash') return next();"),'world middleware must delegate dash to plaza/base chain');
assert.ok(world.includes("typeId === 'fireball' || typeId === 'frostnova'"),'world projectile interception missing');

console.log('LEGACY ABILITY CAST MIDDLEWARE PASS');