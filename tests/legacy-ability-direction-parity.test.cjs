'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','engine-f.js'),'utf8');
let afterHook=null;
let particleCount=0;
let pvpDamageCount=0;
let fallbackInvocations=0;

const context={
  console,
  Math,
  KeloInput:{
    after(owner,fn,priority){afterHook={owner,fn,priority};return 'test-hook';}
  },
  input:{normX:0,normY:0},
  localPlayer:{x:1000,y:1000,vx:0,vy:0,radius:10},
  CONFIG:{worldWidth:5000,worldHeight:5000},
  STATE:{equipped:[
    {typeId:'dash',currentCd:0,baseCd:3,color:'#0ff',dmg:17},
    {typeId:'fireball',currentCd:0,baseCd:4,color:'#f40',dmg:19},
    {typeId:'light_aura',currentCd:0,baseCd:5,color:'#fff',dmg:0}
  ]},
  obstacles:[],
  arenaPvP:{rival:null,projectiles:[]},
  isPvPActive:false,
  spawnParticle(){particleCount++;},
  resolveCircleAABB(){return{collided:false,pushX:0,pushY:0};},
  applyPvPDamage(){pvpDamageCount++;},
  triggerStone(){fallbackInvocations++;return 'fallback';}
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'engine-f.js'});

function plain(value){return JSON.parse(JSON.stringify(value));}
function approx(actual,expected,epsilon=1e-12){assert.ok(Math.abs(actual-expected)<=epsilon,`expected ${actual} ≈ ${expected}`);}

assert.ok(afterHook,'engine-f must register its KeloInput after hook');
assert.equal(afterHook.owner,'engine-f:legacy-aim');
assert.equal(afterHook.priority,10);
assert.ok(context.KeloAbilityDirection);
assert.ok(context.KeloLegacyAbilityTrigger);

let directionSnapshot=plain(context.KeloAbilityDirection.snapshot());
assert.equal(directionSnapshot.owner,'KeloAbilityDirection');
assert.equal(directionSnapshot.inputThreshold,0.15);
assert.equal(directionSnapshot.dashInputThreshold,0.12);
assert.equal(directionSnapshot.velocityThreshold,12);
assert.deepEqual(directionSnapshot.aim,{x:1,y:0});

context.input.normX=0.15;context.input.normY=0;
afterHook.fn({input:context.input});
directionSnapshot=plain(context.KeloAbilityDirection.snapshot());
assert.deepEqual(directionSnapshot.aim,{x:1,y:0},'aim threshold is strict > 0.15');
assert.equal(directionSnapshot.inputAimUpdates,0);

context.input.normX=-1;context.input.normY=0;
afterHook.fn({input:context.input});
directionSnapshot=plain(context.KeloAbilityDirection.snapshot());
assert.deepEqual(directionSnapshot.aim,{x:-1,y:0});
assert.equal(directionSnapshot.inputAimUpdates,1);

context.input.normX=0.12;context.input.normY=0;
context.localPlayer.vx=0;context.localPlayer.vy=13;
let dashDir=plain(context.KeloAbilityDirection.dashDirection());
approx(dashDir.x,0);approx(dashDir.y,1);

context.input.normX=0;context.input.normY=0;
context.localPlayer.vx=12;context.localPlayer.vy=0;
dashDir=plain(context.KeloAbilityDirection.dashDirection());
assert.deepEqual(dashDir,{x:-1,y:0},'velocity threshold is strict > 12');

context.input.normX=0;context.input.normY=1;
context.localPlayer.vx=100;context.localPlayer.vy=0;
dashDir=plain(context.KeloAbilityDirection.dashDirection());
approx(dashDir.x,0);approx(dashDir.y,1);

context.input.normX=1;context.input.normY=0;
context.localPlayer.vx=0;context.localPlayer.vy=0;
context.localPlayer.x=1000;context.localPlayer.y=1000;
context.STATE.equipped[0].currentCd=0;
particleCount=0;
context.triggerStone(0);
assert.equal(context.localPlayer.x,1150,'direct legacy dash distance must remain 150');
assert.equal(context.localPlayer.y,1000);
assert.equal(context.STATE.equipped[0].currentCd,3);
assert.equal(particleCount,11,'dash trail keeps 10 steps plus both endpoints');

context.STATE.equipped[0].currentCd=0;
context.localPlayer.x=1000;context.localPlayer.y=1000;
context.isPvPActive=true;
context.arenaPvP.rival={x:1209,y:1000};
pvpDamageCount=0;
context.triggerStone(0);
assert.equal(pvpDamageCount,1,'direct dash PvP hit radius must still include distance 59');

context.STATE.equipped[0].currentCd=0;
context.localPlayer.x=1000;context.localPlayer.y=1000;
context.arenaPvP.rival={x:1210,y:1000};
pvpDamageCount=0;
context.triggerStone(0);
assert.equal(pvpDamageCount,0,'direct dash PvP hit radius remains strict < 60');

context.isPvPActive=false;
context.arenaPvP.rival=null;
context.input.normX=0;context.input.normY=1;
context.localPlayer.x=1000;context.localPlayer.y=1000;
context.STATE.equipped[1].currentCd=0;
context.arenaPvP.projectiles.length=0;
context.triggerStone(1);
assert.equal(context.arenaPvP.projectiles.length,1);
const projectile=context.arenaPvP.projectiles[0];
approx(projectile.vx,0,1e-10);approx(projectile.vy,450);
assert.equal(projectile.radius,10);
assert.equal(projectile.life,2);
assert.equal(projectile.fromPlayer,true);

context.STATE.equipped[2].currentCd=0;
const fallbackResult=context.triggerStone(2);
assert.equal(fallbackResult,'fallback');
assert.equal(fallbackInvocations,1);

const bridge=plain(context.KeloLegacyAbilityTrigger.snapshot());
assert.equal(bridge.directDashCasts,3);
assert.equal(bridge.directProjectileCasts,1);
assert.equal(bridge.fallbackCasts,1);
assert.equal(bridge.rejectedCasts,0);
assert.equal(bridge.totalCalls,5);

console.log('LEGACY ABILITY DIRECTION PARITY PASS');
