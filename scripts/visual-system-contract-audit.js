/* KELO-INDEX
 * area: QA
 * keys: VISUAL CONTRACT DECOUPLING ANIMATION VFX PROJECTILE SFX SEQUENCE ONLINE
 * purpose: valida fronteras estáticas estables; los runtimes visuales específicos tienen sus propios audits ejecutables
 */
'use strict';

const fs=require('fs');
const path=require('path');
const assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
const read=rel=>fs.readFileSync(path.join(ROOT,rel),'utf8');
const exists=rel=>fs.existsSync(path.join(ROOT,rel));

const required=[
  'src/visuals/visual-system.js','src/visuals/visual-manifests.js','src/visuals/asset-registry.js',
  'src/visuals/animation-system.js','src/visuals/fx-system.js','src/visuals/sequence-system.js',
  'src/visuals/ability-visuals.js','src/visuals/combat-presentation-bridge.js','src/visuals/visual-integration.js'
];
required.forEach(rel=>assert(exists(rel),'missing visual foundation: '+rel));

const core=read('src/visuals/visual-system.js');
const manifests=read('src/visuals/visual-manifests.js');
const animation=read('src/visuals/animation-system.js');
const fx=read('src/visuals/fx-system.js');
const sequence=read('src/visuals/sequence-system.js');
const abilityVisuals=read('src/visuals/ability-visuals.js');
const bridge=read('src/visuals/combat-presentation-bridge.js');
const stone=read('src/abilities/stone-system.js');
const pvp=read('src/systems/pvp-world.js');
const net=read('engine-net.js');
const server=read('server/index.js');
const engine=read('engine-c.js');
const integration=read('src/visuals/visual-integration.js');
const index=read('index.html');

assert(core.includes('KeloVisualEventBus')&&core.includes('KeloVisualContext'),'visual core exposes semantic bus/context');
assert(core.includes("'groundFX'")&&core.includes("'foregroundFX'")&&core.includes("'actorFrontFX'"),'visual core owns explicit render layers');
assert(manifests.includes('hero_default_sheet')&&manifests.includes('cast_magic_01')&&manifests.includes('fire_explosion_medium'),'data-driven visual manifests remain registered');
assert(animation.includes('root.KeloAnchors')&&animation.includes('center: center')&&animation.includes('weapon:'),'animation foundation exposes semantic anchors independent from skin IDs');
assert(animation.includes('sampleTransform')&&animation.includes('frameOverride'),'animation system supports transform and sprite presentation');
assert(fx.includes('root.KeloFX')&&fx.includes('drawActorLayer'),'FX system owns actor/world presentation');
assert(sequence.includes('function play(')&&sequence.includes("cue.type === 'actorAnimation'")&&sequence.includes("cue.type === 'fx'"),'sequence system composes reusable presentation pieces');
assert(abilityVisuals.includes('KeloVisualProfileRegistry'),'ability visuals resolve optional profiles instead of owning gameplay');

['KeloAnimation','KeloFX','KeloSequence','KeloVisualProfile'].forEach(token=>assert(!stone.includes(token),'StoneSystem must not know visual runtime: '+token));
assert(!pvp.includes('emitVisual('),'PvP gameplay must not emit visual bus directly');
assert(bridge.includes("visualEmit('MELEE_ATTACK_STARTED'")&&bridge.includes("visualEmit('MELEE_HIT_CONFIRMED'"),'combat presentation bridge owns melee semantic translation');
assert(!/\.hp\s*=|keloShield\s*=/.test(bridge),'presentation bridge cannot mutate health/shield');

assert(net.includes("t: 'visual:event'")&&net.includes('VISUAL_EVENT_ALLOWLIST'),'client transports allowlisted semantic visual events');
assert(server.includes("msg.t==='visual:event'")&&server.includes('sanitizeVisualContext'),'server sanitizes relayed visual context');
assert(server.includes('VISUAL_EVENT_ALLOWLIST')&&server.includes('server-visual-relay-v2-aoi'),'visual relay is allowlisted and AOI scoped');

assert(engine.includes('KeloVisualSystem.update(dt)'),'central game loop owns visual update');
assert(integration.includes('renderAvatar.__keloVisualBridge'),'final avatar integration stays idempotent');
assert(!integration.includes('const _render = render')&&!integration.includes('render = function'),'visual integration does not wrap the global renderer again');

const coreAt=index.indexOf('src/visuals/visual-system.js');
const abilityAt=index.indexOf('src/abilities/kelo-ability-boot.js');
const resolverAt=index.indexOf('src/visuals/ability-visuals.js');
const netAt=index.indexOf('engine-net.js');
const finalAt=index.indexOf('src/visuals/visual-integration.js');
assert(coreAt>0&&coreAt<abilityAt&&abilityAt<resolverAt&&resolverAt<netAt&&finalAt>netAt,'visual load order preserves core -> gameplay -> resolver/network -> final bridge');

console.log('PASS visual system architecture contract');
console.log(JSON.stringify({semanticBus:true,semanticAnchors:true,stoneDecoupled:true,combatPresentationBridge:true,onlineRelaySanitized:true,centralVisualLoop:true},null,2));
