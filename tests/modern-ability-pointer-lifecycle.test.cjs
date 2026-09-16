'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'..','src','abilities','kelo-ability-boot.js'),'utf8');
const start=source.indexOf('const aim=');
const end=source.indexOf('function hotbarPaintKey()',start);
assert.ok(start>=0&&end>start,'modern hotbar pointer fragment missing');
const fragment=source.slice(start,end);

assert.ok(fragment.includes("addEventListener('pointerdown'"),'modern slots must bind pointerdown locally');
assert.ok(fragment.includes("addEventListener('pointermove'"),'modern slots must bind pointermove locally');
assert.ok(fragment.includes("addEventListener('pointerup'"),'modern slots must bind pointerup locally');
assert.ok(fragment.includes("addEventListener('pointercancel'"),'modern slots must bind pointercancel locally');
assert.ok(fragment.includes('setPointerCapture(event.pointerId)'),'modern hotbar must capture the active pointer for drag continuity');
assert.ok(!fragment.includes('window.addEventListener'),'modern hotbar must not create a global pointer lifecycle');

function button(){
  const handlers=new Map();
  return {
    handlers,
    captures:[],
    addEventListener(name,fn){handlers.set(name,fn);},
    setPointerCapture(pointerId){this.captures.push(pointerId);}
  };
}
function event(pointerId,x=100,y=100){
  return {pointerId,clientX:x,clientY:y,preventDefault(){},stopPropagation(){}};
}
const casts=[];
const hotbar={slots:Array.from({length:5},(_,slot)=>({definition:{targeting:{type:slot===4?'self':'direction'}}}))};
const context={
  console,
  hotbar,
  CONFIG:{zoom:1},
  localPlayer:{x:500,y:500},
  toast(){},
  cast(request){casts.push(request);return{valid:true};},
  direction(x,y){const length=Math.hypot(x,y)||1;return{x:x/length,y:y/length};}
};
context.globalThis=context;
vm.createContext(context);
vm.runInContext(fragment+'\nglobalThis.__bindSlot=bindSlot;globalThis.__aim=aim;',context,{filename:'modern-hotbar-pointer-fragment.js'});

const buttons=Array.from({length:5},button);
buttons.forEach((candidate,slot)=>context.__bindSlot(candidate,slot));
for(const candidate of buttons){
  assert.deepEqual(Array.from(candidate.handlers.keys()).sort(),['pointercancel','pointerdown','pointermove','pointerup']);
}

// Pointer 11 owns the gesture. A second finger must not steal or mutate it.
buttons[0].handlers.get('pointerdown')(event(11,100,100));
assert.equal(context.__aim.active,true);
assert.equal(context.__aim.slot,0);
assert.equal(context.__aim.pointerId,11,'active modern gesture must remember pointerId');
assert.deepEqual(buttons[0].captures,[11]);

buttons[1].handlers.get('pointerdown')(event(22,300,300));
assert.equal(context.__aim.slot,0,'second pointer must not steal active slot');
assert.equal(context.__aim.pointerId,11,'second pointer must not replace active pointerId');
assert.deepEqual(buttons[1].captures,[],'second pointer must not capture while another gesture owns the hotbar');

buttons[0].handlers.get('pointermove')(event(22,900,900));
assert.equal(context.__aim.x1,100,'foreign pointermove must not mutate aim X');
assert.equal(context.__aim.y1,100,'foreign pointermove must not mutate aim Y');
buttons[0].handlers.get('pointerup')(event(22,900,900));
assert.equal(casts.length,0,'foreign pointerup must not cast');
assert.equal(context.__aim.active,true,'foreign pointerup must not terminate active gesture');

buttons[0].handlers.get('pointermove')(event(11,160,100));
buttons[0].handlers.get('pointerup')(event(11,160,100));
assert.equal(casts.length,1,'owning pointerup must cast exactly once');
assert.equal(casts[0].slotIndex,0);
assert.ok(casts[0].direction.x>0.99&&Math.abs(casts[0].direction.y)<0.01,'owning drag direction changed');
assert.equal(context.__aim.active,false);
assert.equal(context.__aim.pointerId,null,'completed gesture must clear pointerId');

// Cancel must terminate without a cast.
buttons[2].handlers.get('pointerdown')(event(33,120,120));
buttons[2].handlers.get('pointermove')(event(33,120,180));
buttons[2].handlers.get('pointercancel')(event(33,120,180));
assert.equal(casts.length,1,'pointercancel must never cast');
assert.equal(context.__aim.active,false);
assert.equal(context.__aim.pointerId,null,'cancelled gesture must clear pointerId');

// Self-target keeps its intentional immediate-cast behavior and never enters drag state.
buttons[4].handlers.get('pointerdown')(event(44,200,200));
assert.equal(casts.length,2);
assert.equal(casts[1].slotIndex,4);
assert.equal(context.__aim.active,false);
assert.deepEqual(buttons[4].captures,[]);

console.log('MODERN ABILITY POINTER LIFECYCLE PASS');
