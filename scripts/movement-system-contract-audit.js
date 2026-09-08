/* KELO-INDEX
 * area: QA / MOVEMENT
 * owner: FOUNDATION CI
 * keys: MOVEMENT HOOK BEFORE AFTER ORDER WRAPPER CONTRACT
 * purpose: valida el owner único de extensiones de movimiento sin ejecutar el juego completo
 * public-api: CLI
 * consumes: src/core/movement-system.js, engine-ac.js, engine-ah.js, index.html
 * state-owned: ninguno
 * extension-points: invariantes del contrato KeloMovement
 * reuse: Foundation CI
 * legacy: simula updateMovement de engine-a
 * do-not: no sustituir smoke browser de movimiento real
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const movementSource=fs.readFileSync('src/core/movement-system.js','utf8');
const ac=fs.readFileSync('engine-ac.js','utf8');
const ah=fs.readFileSync('engine-ah.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const trace=[];
const context={
  console,
  localPlayer:{x:0,y:0,vx:0,vy:0},
  input:{normX:0,normY:0},
  CONFIG:{},
  updateMovement:function(dt){trace.push('base:'+dt);context.localPlayer.x+=1;}
};
context.window=context;
context.globalThis=context;
vm.createContext(context);
vm.runInContext(movementSource,context,{filename:'movement-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(context.KeloMovement&&context.KELO_MOVEMENT_SYSTEM_AUDIT.installed,'OWNER_NOT_INSTALLED');
const late=context.KeloMovement.before('late',()=>trace.push('before-late'),20);
context.KeloMovement.before('early',()=>trace.push('before-early'),10);
context.KeloMovement.after('after',()=>trace.push('after'),5);
context.updateMovement(.5);
ok(trace.join('|')==='before-early|before-late|base:0.5|after','HOOK_ORDER');
ok(context.localPlayer.x===1,'BASE_EXACTLY_ONCE');
ok(context.KeloMovement.unregister(late),'UNREGISTER');
trace.length=0;context.updateMovement(.25);
ok(trace.join('|')==='before-early|base:0.25|after','UNREGISTER_EFFECT');
ok(!/\bupdateMovement\s*=\s*function\b/.test(ac),'ENGINE_AC_MUST_NOT_WRAP');
ok(!/\bupdateMovement\s*=\s*function\b/.test(ah),'ENGINE_AH_MUST_NOT_WRAP');
ok(ac.includes("KeloMovement.before('engine-ac:gait-speed'")&&ac.includes("KeloMovement.after('engine-ac:visual-motion'"),'ENGINE_AC_HOOKS');
ok(ah.includes("KeloMovement.after('engine-ah:release-brake'"),'ENGINE_AH_HOOK');
const iA=html.indexOf('engine-a.js');
const iM=html.indexOf('src/core/movement-system.js');
const iAc=html.indexOf('engine-ac.js');
ok(iA>=0&&iM>iA&&iAc>iM,'LOAD_ORDER');
console.log('MOVEMENT_SYSTEM_OK: single wrapper + deterministic hooks + legacy extension migration passed');
