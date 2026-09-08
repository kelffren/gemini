/* KELO-INDEX
 * area: QA / RENDER
 * owner: FOUNDATION CI
 * keys: RENDER HOOK BEFORE AFTER INTERCEPT WRAPPER CONTRACT
 * purpose: valida KeloRender como bridge único, su intercept exclusivo y wrappers legacy migrados
 * public-api: CLI
 * consumes: render extension owner, engines migrados, index.html
 * state-owned: ninguno
 * extension-points: invariantes del contrato de render
 * reuse: Foundation CI
 * legacy: simula el render de engine-c
 * do-not: no sustituir smoke browser visual
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('src/core/render-extension-system.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migrated=['engine-d.js','engine-g.js','engine-h.js','engine-l.js','engine-m.js','engine-o.js','engine-p.js','engine-s.js','engine-y.js','engine-aa.js','engine-ae.js','engine-ai.js','engine-net.js','src/systems/pvp-world.js'];
const trace=[];
const context={console,ctx:{},screenW:390,screenH:844,camera:{x:1,y:2},CONFIG:{zoom:1},render:function(){trace.push('base');return 7;}};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'render-extension-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(context.KeloRender&&context.KELO_RENDER_EXTENSION_AUDIT.installed,'OWNER_NOT_INSTALLED');
context.KeloRender.beforeFrame('late',()=>trace.push('before-late'),20);
const early=context.KeloRender.beforeFrame('early',()=>trace.push('before-early'),10);
context.KeloRender.afterFrame('after-1',()=>trace.push('after-1'),10);
context.KeloRender.afterFrame('after-2',()=>trace.push('after-2'),20);
const out=context.render();
ok(out===7,'BASE_RETURN');
ok(trace.join('|')==='before-early|before-late|base|after-1|after-2','HOOK_ORDER');
ok(context.KeloRender.unregister(early),'UNREGISTER');
trace.length=0;context.render();
ok(trace.join('|')==='before-late|base|after-1|after-2','UNREGISTER_EFFECT');
const exclusive=context.KeloRender.intercept('exclusive',()=>{trace.push('exclusive');return true;},1);
trace.length=0;context.render();
ok(trace.join('|')==='exclusive','EXCLUSIVE_MUST_SKIP_BASE_AND_NORMAL_HOOKS');
ok(context.KeloRender.unregister(exclusive),'INTERCEPT_UNREGISTER');
migrated.forEach(file=>{const text=fs.readFileSync(file,'utf8');ok(!/\brender\s*=\s*function\b/.test(text),file+'_MUST_NOT_WRAP_RENDER');});
ok(fs.readFileSync('engine-d.js','utf8').includes("KeloRender.afterFrame('engine-d:minimap'"),'MINIMAP_HOOK');
ok(fs.readFileSync('engine-g.js','utf8').includes("KeloRender.afterFrame('engine-g:skill-indicator'"),'SKILL_HOOK');
ok(fs.readFileSync('engine-h.js','utf8').includes("KeloRender.beforeFrame('engine-h:legacy-plaza-fillrect'")&&fs.readFileSync('engine-h.js','utf8').includes("KeloRender.afterFrame('engine-h:legacy-plaza-fillrect'"),'HD_HOOKS');
ok(fs.readFileSync('engine-l.js','utf8').includes("KeloRender.beforeFrame('engine-l:hidpi'")&&fs.readFileSync('engine-l.js','utf8').includes("KeloRender.afterFrame('engine-l:landing-marker'"),'PLAZA_HOOKS');
ok(fs.readFileSync('engine-ae.js','utf8').includes("KeloRender.beforeFrame('engine-ae:frame-counter'"),'FRAME_COUNTER_HOOK');
ok(fs.readFileSync('engine-ai.js','utf8').includes("KeloRender.afterFrame('engine-ai:cafe-overlay'"),'CAFE_HOOK');
ok(fs.readFileSync('engine-net.js','utf8').includes("KeloRender.afterFrame('engine-net:peers'"),'NETWORK_PEER_HOOK');
const pvp=fs.readFileSync('src/systems/pvp-world.js','utf8');
ok(pvp.includes("KeloRender.intercept('pvp-world:arena-exclusive'")&&pvp.includes("KeloRender.afterFrame('pvp-world:transition-fx'"),'PVP_RENDER_OWNER_HOOKS');
const iC=html.indexOf('engine-c.js');const iR=html.indexOf('src/core/render-extension-system.js');const iD=html.indexOf('engine-d.js');
ok(iC>=0&&iR>iC&&iD>iR,'LOAD_ORDER');
console.log('RENDER_EXTENSION_OK: single bridge + exclusive intercept + deterministic hooks + migrated render chain passed');
