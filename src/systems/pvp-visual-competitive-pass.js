/* KELO-INDEX
 * area: PVP / PRESENTATION SUPPORT
 * owner: KeloPvPVisualCompetitivePass
 * keys: TOUCH ASSIST TELEGRAPH HIT MISS RECOIL FINISHER HUD DODGE DIAGONAL CAST CAMERA
 * purpose: mejora perceptual/competitiva del PvP usando owners Foundation existentes; no posee daño, hitbox, cooldown ni input base
 * online: presentation/prediction only; nunca confirma hits ni autoridad
 * do-not: NO target lock, NO segundo loop, NO wrappers core, NO daño/rango/knockback
 */
(function(root){
'use strict';
if(root.KeloPvPVisualCompetitivePass)return;
const VERSION='pvp-visual-competitive-pass-v1.0.0';
const CFG=Object.freeze({
  touchAssist:Object.freeze({extraStrength:.055,maxAngleDeg:13,maxDistance:330,releaseHoldMs:90}),
  telegraph:Object.freeze({pulseMs:96,radius:10,duration:.105}),
  camera:Object.freeze({leadPx:14,verticalScale:.72,snap:false}),
  dodge:Object.freeze({trackMs:180,strength:.045}),
  diagonal:Object.freeze({threshold:.34,readabilityScale:1.08})
});
const metrics={touchCorrections:0,telegraphPulses:0,hitCues:0,missCues:0,recoilCues:0,finisherCues:0,hudCompactions:0,dodgeTracks:0,diagonalCues:0,cameraLeads:0,lastTouchAt:0,lastPulseAt:0};
let lastCombat=false,lastAim=null,lastDodgeStart=0;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function pvp(){return root.KeloPvPWorld||null;}
function active(){const w=pvp();return !!(w&&w.state&&w.state.combatEnabled);}
function lp(){try{return typeof localPlayer!=='undefined'?localPlayer:null;}catch(_){return null;}}
function norm(x,y,f){x=Number(x)||0;y=Number(y)||0;if(Math.hypot(x,y)<1e-6&&f){x=Number(f.x)||1;y=Number(f.y)||0;}const l=Math.hypot(x,y)||1;return{x:x/l,y:y/l};}
function angleDeg(a,b){const x=norm(a.x,a.y),y=norm(b.x,b.y);return Math.acos(clamp(x.x*y.x+x.y*y.y,-1,1))*180/Math.PI;}
function actorId(a){return a&&String(a.id||a.playerKey||'')||'';}
function hostiles(){const me=lp(),out=[];try{if(root.KeloArena&&root.KeloArena.isActive&&root.KeloArena.isActive()&&root.KeloArena.getHostileActors)return root.KeloArena.getHostileActors(me)||[];}catch(_){}try{if(root.keloNet&&root.keloNet.peers)Object.values(root.keloNet.peers).forEach(a=>{if(a&&a.zone==='pvp'&&(a.hp==null||a.hp>0))out.push(a);});}catch(_){}try{if(!out.length&&typeof simulatedPlayers!=='undefined'&&Array.isArray(simulatedPlayers))simulatedPlayers.forEach(a=>{if(a&&a.hp>0)out.push(a);});}catch(_){}return out;}
function bestTarget(dir,maxAngle,maxDistance){const me=lp();if(!me)return null;let best=null,score=Infinity;hostiles().forEach(a=>{if(!a||actorId(a)===actorId(me))return;const dx=(Number(a.x)||0)-me.x,dy=(Number(a.y)||0)-me.y,d=Math.hypot(dx,dy);if(d<=0||d>maxDistance)return;const td=norm(dx,dy),ang=angleDeg(dir,td);if(ang>maxAngle)return;const s=(ang/maxAngle)*.78+(d/maxDistance)*.22;if(s<score){score=s;best={actor:a,dir:td,angle:ang,distance:d};}});return best;}
function setAimDir(dir,source){const me=lp(),w=pvp();if(!me||!w||typeof w.setAimWorld!=='function')return false;w.setAimWorld({x:me.x+dir.x*100,y:me.y+dir.y*100},source||'pvp-visual-pass',1);return true;}
function touchAssist(clientX,clientY){if(!active()||!root.KeloCamera)return;const me=lp(),w=pvp();if(!me||!w)return;const world=root.KeloCamera.screenToWorld(clientX,clientY),raw=norm(world.x-me.x,world.y-me.y,w.state.aim),target=bestTarget(raw,CFG.touchAssist.maxAngleDeg,CFG.touchAssist.maxDistance);metrics.lastTouchAt=performance.now();lastAim=raw;if(!target)return;const s=CFG.touchAssist.extraStrength,dir=norm(raw.x*(1-s)+target.dir.x*s,raw.y*(1-s)+target.dir.y*s,raw);if(setAimDir(dir,'pvp-visual-touch'))metrics.touchCorrections++;}
function wake(){if(root.KeloVisualSystem&&root.KeloVisualSystem.wake)root.KeloVisualSystem.wake();}
function fx(def,context,options){if(!root.KeloFX||typeof root.KeloFX.preview!=='function')return null;wake();return root.KeloFX.preview(Object.freeze(def),context||{},options||{});}
const FX={
  telegraph:Object.freeze({id:'pvp_competitive_telegraph_pulse',type:'glow',space:'WORLD',layer:'worldFX',duration:CFG.telegraph.duration,radius:CFG.telegraph.radius,color:'#8ee7ff',alpha:.34,loop:false,fadeOut:true}),
  hit:Object.freeze({id:'pvp_competitive_hit_confirm',type:'burst',space:'WORLD',layer:'foregroundFX',duration:.115,radius:17,color:'#fff0ad',accent:'#ffffff',rays:6,alpha:.74,loop:false}),
  miss:Object.freeze({id:'pvp_competitive_miss_confirm',type:'glow',space:'WORLD',layer:'foregroundFX',duration:.09,radius:8,color:'#8795a8',alpha:.22,loop:false,fadeOut:true}),
  finisher:Object.freeze({id:'pvp_competitive_finisher',type:'burst',space:'WORLD',layer:'foregroundFX',duration:.16,radius:25,color:'#ffd978',accent:'#ffffff',rays:9,alpha:.84,loop:false}),
  diagonal:Object.freeze({id:'pvp_competitive_diagonal_read',type:'glow',space:'WORLD',layer:'actorFrontFX',duration:.08,radius:13,color:'#d7f5ff',alpha:.28,loop:false,fadeOut:true})
};
function eventPoint(payload,fallbackDistance){const me=lp(),d=payload&&payload.direction||pvp()&&pvp().state&&pvp().state.aim||{x:1,y:0};if(payload&&payload.target&&Number.isFinite(payload.target.x))return{x:payload.target.x,y:payload.target.y};if(payload&&payload.position)return payload.position;if(me)return{x:me.x+d.x*(fallbackDistance||64),y:me.y+d.y*(fallbackDistance||64)};return{x:0,y:0};}
function isLocal(payload){const me=lp();if(!me)return false;const id=payload&&String(payload.actorId||payload.attackerId||payload.sourceId||'');return !id||id===actorId(me)||payload&&payload.actor===me||payload&&payload.attacker===me;}
function wireEvents(){if(!root.KeloEvents||!root.KeloCombatSchema)return;const E=root.KeloCombatSchema.events;
  root.KeloEvents.on(E.HIT_CONFIRMED,p=>{if(!active()||!isLocal(p))return;fx(FX.hit,{origin:eventPoint(p,72),direction:p&&p.direction});metrics.hitCues++;if(root.KeloScreenFX&&root.KeloScreenFX.shake){root.KeloScreenFX.shake('impact_melee_light',{seed:metrics.hitCues});metrics.recoilCues++;}});
  root.KeloEvents.on(E.ATTACK_MISSED,p=>{if(!active()||!isLocal(p))return;fx(FX.miss,{origin:eventPoint(p,84),direction:p&&p.direction});metrics.missCues++;});
  root.KeloEvents.on(E.ATTACK_ACTIVE,p=>{if(!active()||!isLocal(p))return;const dir=p&&p.direction||{x:1,y:0},pid=String(p&&p.profileId||'');if(pid==='sword_light_finisher'||pid==='sword_heavy_charge'){fx(FX.finisher,{origin:eventPoint(p,82),direction:dir},{scale:pid==='sword_heavy_charge'?1.15:1});metrics.finisherCues++;}if(Math.abs(dir.x)>=CFG.diagonal.threshold&&Math.abs(dir.y)>=CFG.diagonal.threshold){fx(FX.diagonal,{actor:lp(),actorId:actorId(lp()),origin:eventPoint(p,54),direction:dir},{scale:CFG.diagonal.readabilityScale});metrics.diagonalCues++;}});
  root.KeloEvents.on(E.DODGE_STARTED,()=>{lastDodgeStart=performance.now();});
}
function telegraphPulse(t){const w=pvp(),me=lp();if(!w||!me||w.state.armedSlot<0||t-metrics.lastPulseAt<CFG.telegraph.pulseMs)return;const slot=root.KeloAbilities&&root.KeloAbilities.hotbar&&root.KeloAbilities.hotbar.slots[w.state.armedSlot],d=slot&&slot.definition;if(!d)return;const targeting=d.targeting||{},delivery=d.delivery||{},range=targeting.range||delivery.maxDistance||delivery.distance||300,aim=w.state.aim||{x:1,y:0},pos={x:me.x+aim.x*range,y:me.y+aim.y*range};fx(FX.telegraph,{origin:pos,direction:aim},{scale:targeting.type==='position'?1.25:1});metrics.lastPulseAt=t;metrics.telegraphPulses++;}
function dodgeTrack(t){const w=pvp();if(!w||!w.state.dodgeActive||t-lastDodgeStart>CFG.dodge.trackMs)return;const aim=w.state.aim||lastAim||{x:1,y:0},target=bestTarget(aim,9,260);if(!target)return;const s=CFG.dodge.strength,dir=norm(aim.x*(1-s)+target.dir.x*s,aim.y*(1-s)+target.dir.y*s,aim);if(setAimDir(dir,'pvp-dodge-track'))metrics.dodgeTracks++;}
function cameraLead(){const w=pvp(),me=lp();if(!w||!me||!root.KeloCamera||typeof root.KeloCamera.setTarget!=='function')return;const a=w.state.aim||{x:0,y:0};root.KeloCamera.setTarget(me.x+a.x*CFG.camera.leadPx,me.y+a.y*CFG.camera.leadPx*CFG.camera.verticalScale,{snap:CFG.camera.snap,source:'pvp-visual-competitive-lead'});metrics.cameraLeads++;}
function syncHud(on){document.body.classList.toggle('kelo-pvp-competitive-hud',!!on);if(on)metrics.hudCompactions++;}
function ensureStyle(){if(document.getElementById('kelo-pvp-competitive-style'))return;const s=document.createElement('style');s.id='kelo-pvp-competitive-style';s.textContent='@media (max-width:900px){body.kelo-pvp-competitive-hud .stone-slot{transform:scale(.92);transform-origin:center bottom}body.kelo-pvp-competitive-hud #kelo-pvp-exit{top:max(116px,calc(env(safe-area-inset-top) + 108px))!important;padding:7px 10px!important;opacity:.82}body.kelo-pvp-competitive-hud .stone-slot:active{transform:scale(.86)}}';document.head.appendChild(s);}
function tick(){const t=performance.now(),on=active();if(on!==lastCombat){syncHud(on);lastCombat=on;}if(!on)return;telegraphPulse(t);dodgeTrack(t);cameraLead();}
function pointer(e){if(!active()||e.pointerType!=='touch')return;if(e.target!==root.canvas&&!(e.target&&e.target.closest&&e.target.closest('.stone-slot')))return;touchAssist(e.clientX,e.clientY);}
ensureStyle();wireEvents();root.addEventListener('pointermove',pointer,true);root.addEventListener('pointerup',pointer,true);
if(root.KeloSimulation&&root.KeloSimulation.after)root.KeloSimulation.after('pvp-visual-competitive-pass',tick,965);
root.KELO_PVP_VISUAL_COMPETITIVE_AUDIT={version:VERSION,ready:true,gameplayAuthority:false,targetLock:false,touchAssist:CFG.touchAssist,telegraph:CFG.telegraph,cameraLeadPx:CFG.camera.leadPx,dodgeTrackMs:CFG.dodge.trackMs,diagonalThreshold:CFG.diagonal.threshold,metrics:metrics};
root.KeloPvPVisualCompetitivePass=Object.freeze({version:VERSION,config:CFG,metrics:function(){return Object.freeze(Object.assign({},metrics));}});
})(typeof globalThis!=='undefined'?globalThis:window);
