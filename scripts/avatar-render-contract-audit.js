/* KELO-INDEX
 * area: QA / AVATAR
 * owner: FOUNDATION CI
 * keys: AVATAR RENDER BASE MIDDLEWARE FALLBACK CONTRACT
 * purpose: valida KeloAvatar como único owner de renderAvatar y conserva el orden de fallback LIVE
 * public-api: CLI
 * consumes: avatar owner, engines d/e/w/ab, character-appearance, index.html
 * state-owned: ninguno
 * extension-points: invariantes pequeñas del contrato Avatar
 * reuse: Foundation CI
 * legacy: simula la cadena histórica sin Canvas real
 * do-not: no sustituir smoke browser visual
 */
'use strict';
const fs=require('fs');
const vm=require('vm');
const source=fs.readFileSync('src/core/avatar-render-system.js','utf8');
const html=fs.readFileSync('index.html','utf8');
const migrated=['engine-d.js','engine-e.js','engine-w.js','engine-ab.js','src/characters/character-appearance.js'];
const trace=[];
const context={console,renderAvatar:function(){trace.push('engine-c');return 'engine-c';}};
context.window=context;context.globalThis=context;
vm.createContext(context);vm.runInContext(source,context,{filename:'avatar-render-system.js'});
function ok(cond,msg){if(!cond)throw new Error(msg);}
ok(context.KeloAvatar&&context.KELO_AVATAR_RENDER_AUDIT.installed,'OWNER_NOT_INSTALLED');
context.KeloAvatar.setBase('engine-d',()=>{trace.push('d');return 'd';});
context.KeloAvatar.setBase('engine-e',()=>{trace.push('e');return 'e';});
context.KeloAvatar.setBase('engine-w',()=>{trace.push('w');return 'w';});
let heroReady=false,appearanceReady=false;
context.KeloAvatar.use('engine-ab',(actor,isSelf,next)=>{trace.push('ab');return heroReady?'ab':next();},100);
context.KeloAvatar.use('appearance',(actor,isSelf,next)=>{trace.push('appearance');return appearanceReady?'appearance':next();},200);
trace.length=0;let out=context.renderAvatar({},true);
ok(out==='w'&&trace.join('|')==='appearance|ab|w','FALLBACK_ORDER');
heroReady=true;trace.length=0;out=context.renderAvatar({},true);
ok(out==='ab'&&trace.join('|')==='appearance|ab','HERO_OVERRIDE');
appearanceReady=true;trace.length=0;out=context.renderAvatar({},true);
ok(out==='appearance'&&trace.join('|')==='appearance','APPEARANCE_OVERRIDE');
const snap=context.KeloAvatar.snapshot();
ok(snap.baseOwner==='engine-w','LAST_BASE_WINS');
ok(snap.middleware[0].owner==='appearance'&&snap.middleware[1].owner==='engine-ab','MIDDLEWARE_PRIORITY_DESC');
migrated.forEach(file=>{const text=fs.readFileSync(file,'utf8');ok(!/\brenderAvatar\s*=\s*function\b/.test(text),file+'_MUST_NOT_ASSIGN_RENDER_AVATAR');});
ok(fs.readFileSync('engine-d.js','utf8').includes("KeloAvatar.setBase('engine-d:rank-jewels'"),'ENGINE_D_BASE');
ok(fs.readFileSync('engine-e.js','utf8').includes("KeloAvatar.setBase('engine-e:identity-jewels'"),'ENGINE_E_BASE');
ok(fs.readFileSync('engine-w.js','utf8').includes("KeloAvatar.setBase('engine-w:legacy-pixel-hero'"),'ENGINE_W_BASE');
ok(fs.readFileSync('engine-ab.js','utf8').includes("KeloAvatar.use('engine-ab:production-hero'")&&fs.readFileSync('engine-ab.js','utf8').includes(', 100);'),'ENGINE_AB_MIDDLEWARE');
ok(fs.readFileSync('src/characters/character-appearance.js','utf8').includes("KeloAvatar.use('character-appearance:custom-sprite'")&&fs.readFileSync('src/characters/character-appearance.js','utf8').includes(', 200);'),'APPEARANCE_MIDDLEWARE');
const iC=html.indexOf('engine-c.js');const iA=html.indexOf('src/core/avatar-render-system.js');const iD=html.indexOf('engine-d.js');
ok(iC>=0&&iA>iC&&iD>iA,'LOAD_ORDER');
console.log('AVATAR_RENDER_OK: single owner + last-base-wins + conditional fallback chain passed');
