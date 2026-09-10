/* KELO-INDEX
 * area: QA / CREATORS
 * keys: SPRITE ABILITY BUILDER SPRITESHEET IMPACT GENERATE ANIMATION ABILITY
 * purpose: valida el contrato puro upload-authoring → Animation + Ability sin ejecutar combate
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { normalizeSpriteAbilityDocument,frameRect,spriteAbilityTiming,validateSpriteAbilityDocument,buildGeneratedDrafts } from '../src/creators/sprite-ability/sprite-ability-document.mjs';
import { normalizeCreatorProject } from '../src/creators/core/creator-project.mjs';
import { normalizeAnimationDocument,validateAnimationDocument } from '../src/creators/animation/animation-document.mjs';
import { normalizeAbilityDocument,validateAbilityDocument } from '../src/creators/ability/ability-document.mjs';

const dataUrl='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB';
const source=normalizeSpriteAbilityDocument({name:'Sword Burst',sheet:{assetId:'sword_burst_sheet',fileName:'sword.png',dataUrl,imageWidth:512,imageHeight:768,frameWidth:128,frameHeight:192,columns:4,rows:4,startFrame:0,endFrame:5,fps:16},combat:{key:'sword_burst',name:'Sword Burst',impactFrame:2,damage:31,range:146,arcDeg:100,knockback:24,hitstopMs:52,cooldownMs:420,lunge:18,recoveryMs:190,cancelWindowMs:70,movementScale:.76,deliveryType:'instant'}});
const report=validateSpriteAbilityDocument(source);assert.equal(report.ok,true,report.errors.join(','));
const rect=frameRect(source,5);assert.deepEqual(rect,{sx:128,sy:192,sw:128,sh:192});
const timing=spriteAbilityTiming(source);assert.equal(timing.frameMs,62.5);assert.equal(timing.impactMs,125);assert(timing.totalMs>=315);
const built=buildGeneratedDrafts(source,{animationProjectId:'anim-project',abilityProjectId:'ability-project'});
assert.equal(built.animation.assetSource.dataUrl,dataUrl);assert.deepEqual(built.animation.clip.frameSequence,[0,1,2,3,4,5]);assert.equal(built.animation.clip.markers.impact,.125);assert.equal(built.ability.links.animationProjectId,'anim-project');assert.equal(built.ability.definition.effects[0].amount,31);assert.equal(built.ability.definition.targeting.range,146);assert.equal(built.ability.definition.action.movementScale,.76);
const anim=normalizeAnimationDocument(built.animation);assert.equal(anim.assetSource.dataUrl,dataUrl);assert.equal(validateAnimationDocument(anim,{assetRegistry:{get:()=>null}}).ok,true,'embedded sheet should satisfy animation asset validation');
const ability=normalizeAbilityDocument(built.ability);assert.equal(validateAbilityDocument(ability,{supportedDeliveryTypes:['instant','dash','self_aoe','projectile']}).ok,true);assert.equal(ability.links.animationProjectId,'anim-project');
const project=normalizeCreatorProject({type:'SPRITE_ABILITY',name:'Sword Burst Builder',ownerId:'tester'});assert.equal(project.type,'SPRITE_ABILITY');
const entry=fs.readFileSync(new URL('../src/creators/creator-entry.mjs',import.meta.url),'utf8'),hub=fs.readFileSync(new URL('../src/creators/ui/creator-hub.mjs',import.meta.url),'utf8'),controller=fs.readFileSync(new URL('../src/creators/sprite-ability/sprite-ability-live-controller.mjs',import.meta.url),'utf8');
assert(entry.includes('registerSpriteAbilityWorkspace'));assert(hub.includes("['sprite-ability','Sprite Ability','active']"));for(const token of ['image/png,image/webp','SHEET','ABILITY','DUMMY','Impact Frame','Hitstop ms','⚡ GENERATE','OPEN ABILITY','EXPORT JSON'])assert(controller.includes(token),`missing UI contract: ${token}`);
console.log('PASS Sprite Ability Builder contract audit');
console.log(JSON.stringify({frameRect:rect,timing,animationProjectId:built.ability.links.animationProjectId,damage:built.ability.definition.effects[0].amount,embeddedAsset:true},null,2));
