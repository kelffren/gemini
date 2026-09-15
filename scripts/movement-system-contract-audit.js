/* KELO-INDEX
 * area: QA / MOVEMENT
 * owner: FOUNDATION CI
 * keys: MOVEMENT HOOK BEFORE INTERCEPT AFTER ORDER WRAPPER CONTRACT PLAZA FIRST LAZY
 * purpose: valida owner único y orden real de movimiento sin exigir extensiones legacy pesadas en parser boot
 * public-api: CLI
 * consumes: src/core/movement-system.js, engine-g/ac/ah/ai.js, index.html
 * state-owned: ninguno
 * extension-points: invariantes del contrato KeloMovement
 * reuse: Foundation CI
 * legacy: simula updateMovement de engine-a; extensiones legacy pueden estar deferred/inactivas
 * do-not: no sustituir smoke browser de movimiento real ni reinsertar engines pesados en index.html
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const movementSource=fs.readFileSync('src/core/movement-system.js','utf8');
const g=fs.readFileSync('engine-g.js','utf8');
const ac=fs.readFileSync('engine-ac.js','utf8');
const ah=fs.readFileSync('engine-ah.js','utf8');
const ai=fs.readFileSync('engine-ai.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const trace=[];
const context={
  console,
  localPlayer:{x:0,y:0,vx:0,vy:0},
  input:{normX:0,normY:0},
  CONFIG:{},
  updateMovement:function(dt){trace.push('base:'+dt);context.localPlayer.x+=1;}
};
context.window=context;context.globalThis=context;
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
const intercept=context.KeloMovement.intercept('exclusive',()=>{trace.push('intercept');return true;},1);
trace.length=0;context.updateMovement(.1);
ok(trace.join('|')==='before-early|intercept|after','INTERCEPT_SKIPS_BASE_BUT_PRESERVES_PHASES');
ok(context.localPlayer.x===2,'INTERCEPT_BASE_NOT_CALLED');
context.KeloMovement.unregister(intercept);
[g,ac,ah,ai].forEach((source,i)=>ok(!/\bupdateMovement\s*=\s*function\b/.test(source),'LEGACY_MOVEMENT_WRAPPER_'+i));
ok(g.includes("KeloMovement.intercept('engine-g:legacy-dash'"),'ENGINE_G_INTERCEPT');
ok(ac.includes("KeloMovement.before('engine-ac:gait-speed'")&&ac.includes("KeloMovement.after('engine-ac:visual-motion'"),'ENGINE_AC_HOOKS');
ok(ah.includes("KeloMovement.after('engine-ah:release-brake'"),'ENGINE_AH_HOOK');
ok(ai.includes("KeloMovement.after('engine-ai:cafe-room-clamp'"),'ENGINE_AI_HOOK');

// Plaza-first boot deliberately keeps heavy legacy engines out of parser-time HTML.
// The owner must be installed before the active static consumer engine-g. If optional
// legacy extensions ever return to parser boot, they must still come after KeloMovement.
const iA=html.indexOf('engine-a.js');
const iM=html.indexOf('src/core/movement-system.js');
const iG=html.indexOf('engine-g.js');
const optional=['engine-ac.js','engine-ah.js','engine-ai.js'];
ok(iA>=0&&iM>iA&&iG>iM,'LOAD_ORDER_STATIC');
for(const src of optional){
  const pos=html.indexOf(src);
  ok(pos<0||pos>iM,'OPTIONAL_EXTENSION_BEFORE_MOVEMENT:'+src);
}
ok(html.indexOf('engine-ac.js')<0,'ENGINE_AC_MUST_REMAIN_OUT_OF_PARSER_BOOT');

console.log('MOVEMENT_SYSTEM_OK: single wrapper + hooks + interceptors + plaza-first owner order passed');
