/* KELO-INDEX
 * area: QA / LEGACY PLAZA CAST PRESENTATION
 * owner: Evergreen migration contract
 * purpose: ejecuta el fragmento real de engine-l y congela la presentación de cast antes de cambiar su owner de registro
 */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');

const source=fs.readFileSync('engine-l.js','utf8');
const start=source.indexOf('  function landingPoint(){');
const end=source.indexOf('  function drawLanding(){',start);
assert.ok(start>=0&&end>start,'engine-l cast presentation fragment not found');
const fragment=source.slice(start,end);

let middleware=null,registeredOwner=null,registrationApi=null;
const register=(api)=>(owner,fn)=>{registeredOwner=owner;middleware=fn;registrationApi=api;return()=>{};};
const particles=[];
const dashTrails=[];
const context={
  console,
  Math,
  window:{
    KeloAbilityAim:{registerCastMiddleware:register('KeloAbilityAim.registerCastMiddleware')},
    KeloLegacyAbilityCast:{registerMiddleware:register('KeloLegacyAbilityCast.registerMiddleware')}
  },
  skillAim:{active:false,typeId:'dash',castRange:85,dirX:0.6,dirY:0.8},
  localPlayer:{x:100,y:200},
  STATE:{equipped:[{typeId:'dash',currentCd:0,baseCd:3.5,color:'#abc'}]},
  CONFIG:{worldWidth:500,worldHeight:500},
  dashTween:{active:false,t:99,dur:0,fromX:0,fromY:0,toX:0,toY:0},
  aim:{x:1,y:0},
  spawnParticle:(...args)=>particles.push(args),
  spawnDashTrail:(...args)=>dashTrails.push(args)
};
vm.createContext(context);
vm.runInContext(fragment,context,{filename:'engine-l-cast-presentation-fragment.js'});

assert.equal(registeredOwner,'engine-l:plaza-cast-presentation','engine-l middleware owner changed');
assert.equal(typeof middleware,'function','engine-l middleware did not register');
assert.ok(['KeloAbilityAim.registerCastMiddleware','KeloLegacyAbilityCast.registerMiddleware'].includes(registrationApi),'unexpected cast registration API');

let nextCalls=0;
const next=()=>{nextCalls++;return 'base-result';};
const dashResult=middleware({index:0,typeId:'dash',dirX:0.6,dirY:0.8},next);
assert.equal(dashResult,undefined,'dash presentation must consume the legacy cast');
assert.equal(nextCalls,0,'dash must not delegate to base cast');
assert.equal(context.STATE.equipped[0].currentCd,3.5,'dash cooldown changed');
assert.equal(context.dashTween.active,true,'dash tween must activate');
assert.equal(context.dashTween.t,0,'dash tween time must reset');
assert.ok(Math.abs(context.dashTween.dur-0.15)<1e-12,'dash duration formula changed');
assert.equal(context.dashTween.fromX,100);
assert.equal(context.dashTween.fromY,200);
assert.equal(context.dashTween.toX,151);
assert.equal(context.dashTween.toY,268);
assert.equal(context.aim.x,0.6);
assert.equal(context.aim.y,0.8);
assert.equal(dashTrails.length,1,'dash presentation must preserve one legacy dash trail call');
assert.equal(particles.length,36,'dash trail/burst particle count changed');

particles.length=0;dashTrails.length=0;nextCalls=0;
context.STATE.equipped[0]={typeId:'fireball',currentCd:0,baseCd:4,color:'#f00'};
context.skillAim.typeId='fireball';
context.skillAim.castRange=100;
context.skillAim.dirX=1;
context.skillAim.dirY=0;
context.localPlayer.x=200;
context.localPlayer.y=250;
context.dashTween.active=false;
const nonDashResult=middleware({index:0,typeId:'fireball',dirX:1,dirY:0},next);
assert.equal(nonDashResult,'base-result','non-dash result must come from next()');
assert.equal(nextCalls,1,'non-dash cast must delegate exactly once');
assert.equal(context.STATE.equipped[0].currentCd,0,'presentation middleware must not own non-dash cooldown');
assert.equal(context.dashTween.active,false,'non-dash cast must not activate dash tween');
assert.equal(dashTrails.length,1,'non-dash presentation trail changed');
assert.equal(particles.length,34,'non-dash trail/burst particle count changed');

console.log('LEGACY PLAZA CAST PRESENTATION PARITY PASS registrationApi='+registrationApi);
