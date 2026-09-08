/* KELO-INDEX
 * area: QA / SIMULATION
 * owner: FOUNDATION CI
 * keys: SIMULATION HOOK BEFORE AFTER WRAPPER CONTRACT
 * purpose: valida KeloSimulation como bridge único y módulos legacy ya migrados
 * public-api: CLI
 * consumes: simulation extension owner, engines migrados, index.html
 * state-owned: ninguno
 * extension-points: invariantes del contrato de simulación
 * reuse: Foundation CI
 * legacy: simula updateSimulation post-engine-c
 * do-not: no sustituir smoke browser de gameplay
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('src/core/simulation-extension-system.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migrated=['engine-m.js','engine-o.js','engine-p.js','engine-q.js','engine-s.js','engine-net.js','src/systems/pvp-world.js','src/abilities/sword-swap-runtime.js','src/visuals/sword-swap-pvp-visuals.js'];
const trace=[];
const context={console,localPlayer:{x:0,y:0},STATE:{},updateSimulation:function(dt){trace.push('base:'+dt);return 9;}};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'simulation-extension-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(context.KeloSimulation&&context.KELO_SIMULATION_EXTENSION_AUDIT.installed,'OWNER_NOT_INSTALLED');
context.KeloSimulation.before('late',()=>trace.push('before-late'),20);
const early=context.KeloSimulation.before('early',()=>trace.push('before-early'),10);
context.KeloSimulation.after('after-1',()=>trace.push('after-1'),10);
context.KeloSimulation.after('after-2',()=>trace.push('after-2'),20);
const out=context.updateSimulation(.25);
ok(out===9,'BASE_RETURN');
ok(trace.join('|')==='before-early|before-late|base:0.25|after-1|after-2','HOOK_ORDER');
ok(context.KeloSimulation.unregister(early),'UNREGISTER');
trace.length=0;context.updateSimulation(.5);
ok(trace.join('|')==='before-late|base:0.5|after-1|after-2','UNREGISTER_EFFECT');
migrated.forEach(file=>{const text=fs.readFileSync(file,'utf8');ok(!/\bupdateSimulation\s*=\s*function\b/.test(text),file+'_MUST_NOT_WRAP_SIMULATION');});
ok(fs.readFileSync('engine-m.js','utf8').includes("KeloSimulation.after('engine-m:skill-shots'"),'ENGINE_M_HOOK');
ok(fs.readFileSync('engine-o.js','utf8').includes("KeloSimulation.after('engine-o:training-dummy'"),'ENGINE_O_HOOK');
ok(fs.readFileSync('engine-p.js','utf8').includes("KeloSimulation.after('engine-p:plaza-npcs'"),'ENGINE_P_HOOK');
ok(fs.readFileSync('engine-q.js','utf8').includes("KeloSimulation.after('engine-q:maestro-trial'"),'ENGINE_Q_HOOK');
ok(fs.readFileSync('engine-s.js','utf8').includes("KeloSimulation.before('engine-s:social-bot-snapshot'")&&fs.readFileSync('engine-s.js','utf8').includes("KeloSimulation.after('engine-s:social-world'"),'ENGINE_S_HOOKS');
ok(fs.readFileSync('engine-net.js','utf8').includes("KeloSimulation.after('engine-net:network'"),'NETWORK_SIM_HOOK');
ok(fs.readFileSync('src/systems/pvp-world.js','utf8').includes("KeloSimulation.after('pvp-world:tick'"),'PVP_SIM_HOOK');
ok(fs.readFileSync('src/abilities/sword-swap-runtime.js','utf8').includes("KeloSimulation.after('sword-swap-runtime:tick'"),'SWORD_SWAP_RUNTIME_SIM_HOOK');
ok(fs.readFileSync('src/visuals/sword-swap-pvp-visuals.js','utf8').includes("KeloSimulation.after('sword-swap-pvp-visuals:blocker'"),'SWORD_SWAP_VISUAL_BLOCKER_SIM_HOOK');
const iC=html.indexOf('engine-c.js');const iS=html.indexOf('src/core/simulation-extension-system.js');const iD=html.indexOf('engine-d.js');
ok(iC>=0&&iS>iC&&iD>iS,'LOAD_ORDER');
console.log('SIMULATION_EXTENSION_OK: single bridge + deterministic hooks + complete migrated simulation chain passed');
