'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','engine-g.js'),'utf8');
let interceptor=null;
let abilityBeginCalls=[];
let damageCalls=[];
let collisionMode='none';
const windowListeners=new Map();
let rafQueue=[];

function makeElement(tag){
  const listeners={};
  const element={
    tagName:String(tag||'').toUpperCase(),
    id:'',className:'',children:[],
    addEventListener(type,fn){(listeners[type]||(listeners[type]=[])).push(fn);},
    dispatch(type,event){for(const fn of listeners[type]||[])fn(event);},
    appendChild(child){this.children.push(child);return child;}
  };
  let html='';
  Object.defineProperty(element,'innerHTML',{
    get(){return html;},
    set(value){html=String(value);if(value==='')element.children.length=0;}
  });
  return element;
}

const container=makeElement('div');
container.id='action-bar-container';
const document={
  getElementById(id){return id==='action-bar-container'?container:null;},
  createElement(tag){return makeElement(tag);}
};
function addWindowListener(type,fn){
  if(!windowListeners.has(type))windowListeners.set(type,[]);
  windowListeners.get(type).push(fn);
}
function fireWindow(type,event={}){
  for(const fn of windowListeners.get(type)||[])fn(event);
}
function requestAnimationFrame(fn){rafQueue.push(fn);return rafQueue.length;}
function flushFrame(){const batch=rafQueue;rafQueue=[];for(const fn of batch)fn(0);}

const context={
  console,
  Math,
  document,
  STATE:{equipped:[
    {typeId:'dash',currentCd:0,baseCd:3,color:'#0ff',dmg:27,icon:'D',name:'Dash',isUlt:false},
    {typeId:'fireball',currentCd:0,baseCd:4,color:'#f40',dmg:19,icon:'F',name:'Fireball',isUlt:true}
  ]},
  localPlayer:{x:0,y:0,vx:0,vy:0,radius:10},
  obstacles:[],
  isPvPActive:false,
  arenaPvP:{rival:null},
  resolveCircleAABB(){
    if(collisionMode==='push')return{collided:true,pushX:7,pushY:-3};
    return{collided:false,pushX:0,pushY:0};
  },
  applyPvPDamage(target,amount){damageCalls.push({target,amount});},
  KeloMovement:{
    intercept(owner,fn,priority){interceptor={owner,fn,priority};return 'dash-interceptor-test';}
  },
  KeloAbilityAim:{
    begin(index,event){abilityBeginCalls.push({index,event});}
  },
  addEventListener:addWindowListener,
  requestAnimationFrame
};
context.window=context;
vm.createContext(context);
vm.runInContext(source,context,{filename:'engine-g.js'});

function setDash(values){
  context.__dashInput=values;
  vm.runInContext('Object.assign(dashTween,__dashInput)',context);
  delete context.__dashInput;
}
function getDash(){return vm.runInContext('({active:dashTween.active,t:dashTween.t,dur:dashTween.dur,fromX:dashTween.fromX,fromY:dashTween.fromY,toX:dashTween.toX,toY:dashTween.toY})',context);}
function approx(actual,expected,epsilon=1e-12){assert.ok(Math.abs(actual-expected)<=epsilon,`expected ${actual} ≈ ${expected}`);}

assert.ok(interceptor,'engine-g must register the legacy dash movement interceptor');
assert.equal(interceptor.owner,'engine-g:legacy-dash');
assert.equal(interceptor.priority,10);
assert.equal((windowListeners.get('pointermove')||[]).length,0,'engine-g must not own pointermove');
assert.equal((windowListeners.get('pointerup')||[]).length,0,'engine-g must not own pointerup');
assert.equal((windowListeners.get('pointercancel')||[]).length,0,'engine-g must not own pointercancel');

assert.equal(container.children.length,0,'hidden social action bar must not build during parser-blocking boot');
assert.equal((windowListeners.get('kelo:boot-ready')||[]).length,1,'action bar waits for boot-ready');
fireWindow('kelo:boot-ready');
assert.equal(container.children.length,0,'first rAF only yields toward first paint');
flushFrame();
assert.equal(container.children.length,0,'action bar still deferred until second frame');
flushFrame();
assert.equal(container.children.length,2,'action bar renders after first paint');
assert.equal(container.children[0].id,'action-slot-0');
assert.equal(container.children[0].className,'stone-slot');
assert.equal(container.children[1].className,'stone-slot ultimate');
const pointerEvent={pointerId:77,clientX:36,clientY:40};
container.children[1].dispatch('pointerdown',pointerEvent);
assert.equal(abilityBeginCalls.length,1);
assert.equal(abilityBeginCalls[0].index,1);
assert.equal(abilityBeginCalls[0].event,pointerEvent);

assert.equal(interceptor.fn({dt:0.016}),false,'inactive dash must not intercept movement');

setDash({active:true,t:0,dur:0.2,fromX:100,fromY:200,toX:200,toY:400});
context.localPlayer.x=100;context.localPlayer.y=200;
collisionMode='none';
let handled=interceptor.fn({dt:0.1});
assert.equal(handled,true);
let dash=getDash();
assert.equal(dash.active,true);
approx(dash.t,0.1);
// u=.5, quadratic ease-out = 1-(1-.5)^2 = .75
approx(context.localPlayer.x,175);
approx(context.localPlayer.y,350);

context.obstacles=[{id:'wall'}];
collisionMode='push';
setDash({active:true,t:0,dur:1,fromX:10,fromY:20,toX:110,toY:120});
context.localPlayer.x=10;context.localPlayer.y=20;
interceptor.fn({dt:0});
approx(context.localPlayer.x,17);
approx(context.localPlayer.y,17);
context.obstacles=[];
collisionMode='none';

setDash({active:true,t:0,dur:0.1,fromX:1000,fromY:1000,toX:1100,toY:1000});
context.localPlayer.x=1000;context.localPlayer.y=1000;
context.isPvPActive=true;
context.arenaPvP.rival={x:1151,y:1000};
damageCalls=[];
interceptor.fn({dt:0.1});
assert.equal(damageCalls.length,1,'legacy tween PvP radius must include distance 51');
assert.equal(damageCalls[0].amount,27,'dash stone damage must be preserved');
dash=getDash();
assert.equal(dash.active,false,'dash tween must deactivate when u reaches 1');

setDash({active:true,t:0,dur:0.1,fromX:1000,fromY:1000,toX:1100,toY:1000});
context.localPlayer.x=1000;context.localPlayer.y=1000;
context.arenaPvP.rival={x:1152,y:1000};
damageCalls=[];
interceptor.fn({dt:0.1});
assert.equal(damageCalls.length,0,'legacy tween PvP radius remains strict < 52');

const savedEquipped=context.STATE.equipped;
context.STATE.equipped=[savedEquipped[1]];
setDash({active:true,t:0,dur:0.1,fromX:1000,fromY:1000,toX:1100,toY:1000});
context.localPlayer.x=1000;context.localPlayer.y=1000;
context.arenaPvP.rival={x:1151,y:1000};
damageCalls=[];
interceptor.fn({dt:0.1});
assert.equal(damageCalls.length,1);
assert.equal(damageCalls[0].amount,15,'missing dash stone keeps legacy fallback damage 15');
context.STATE.equipped=savedEquipped;

context.isPvPActive=false;
context.arenaPvP.rival=null;
setDash({active:true,t:0.19,dur:0.2,fromX:100,fromY:200,toX:200,toY:400});
interceptor.fn({dt:0.05});
dash=getDash();
assert.equal(dash.active,false);
approx(context.localPlayer.x,200);
approx(context.localPlayer.y,400);

console.log('LEGACY DASH TWEEN PARITY PASS');
