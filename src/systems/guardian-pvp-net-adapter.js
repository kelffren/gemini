/* KELO-INDEX
 * area: NETWORK / GUARDIAN PVP ADAPTER
 * owner: KeloGuardianPvPNetAdapter
 * keys: GUARDIAN PVP NET ADAPTER INTENT SNAPSHOT RECONCILIATION FALLBACK CENTRAL SERVER
 * purpose: enruta temporalmente PvP hacia Guardian cuando el servidor central está offline, sin tocar rutas sociales/economía
 * consumes: KeloNetAuthority + KeloGuardianPvPHost + KeloSimulation
 * online: fail-closed; si vuelve el servidor central, detiene el modo Guardian para evitar doble autoridad
 * do-not: NO reemplazar commerce/forge/account APIs, NO segundo loop, NO permitir dos autoridades PvP simultáneas
 */
(function(root){
'use strict';
if(root.KeloGuardianPvPNetAdapter||!root.KeloNetAuthority||!root.KeloGuardianPvPHost)return;
const VERSION='kelo-guardian-pvp-net-adapter-v1',SEND_HZ=30,SEND_DT=1/SEND_HZ,MAX_EVENTS=256;
const base=root.KeloNetAuthority,consumed=new Set();
let sequence=1,sendAcc=0,lastAck=0,lastError=null,forcedStop=false;
function host(){return root.KeloGuardianPvPHost;}
function guardianActive(){try{return !!host().isActive();}catch(_){return false;}}
function baseOnline(){try{return !!base.isOnline?.();}catch(_){return false;}}
function isOnline(){return guardianActive()||baseOnline();}
function unit(x,y){x=Number(x)||0;y=Number(y)||0;const l=Math.hypot(x,y);if(l>1){x/=l;y/=l;}return{x,y};}
function move(){return{x:typeof root.input!=='undefined'?Number(root.input.normX)||0:0,y:typeof root.input!=='undefined'?Number(root.input.normY)||0:0};}
function aim(){try{const a=root.KeloPvPWorld?.state?.aim;if(a&&Number.isFinite(Number(a.x))&&Number.isFinite(Number(a.y)))return{x:Number(a.x),y:Number(a.y)};}catch(_){}return{x:1,y:0};}
function makeIntent(raw){
 const source=raw&&typeof raw==='object'?raw:{},m=unit(source.moveX!=null?source.moveX:move().x,source.moveY!=null?source.moveY:move().y),a=unit(source.aimX!=null?source.aimX:aim().x,source.aimY!=null?source.aimY:aim().y);
 return {sequence:sequence++,moveX:m.x,moveY:m.y,aimX:a.x,aimY:a.y,action:String(source.action||'input'),phase:String(source.phase||'none'),abilityKey:source.abilityKey||null,slot:Number.isInteger(Number(source.slot))?Number(source.slot):null,direction:source.direction||null,position:source.position||null,targetId:source.targetId||null,attackId:source.attackId||null,swordEntityId:source.swordEntityId||null,clientTime:Number(source.clientTime)||Date.now()};
}
function sendCombatIntent(raw){
 if(!guardianActive())return base.sendCombatIntent?.(raw)||false;
 if(baseOnline()){lastError='GUARDIAN_PVP_DOUBLE_AUTHORITY_BLOCKED';host().stop();forcedStop=true;emit();return false;}
 const intent=makeIntent(raw),sent=host().submitIntent(intent);return sent||false;
}
function peerBase(p){return{id:p.id,name:p.name||'Guardian',x:Number(p.x)||0,y:Number(p.y)||0,vx:0,vy:0,radius:20,hp:Number.isFinite(Number(p.hp))?Number(p.hp):100,maxHp:Number.isFinite(Number(p.maxHp))?Number(p.maxHp):100,mana:Number.isFinite(Number(p.mana))?Number(p.mana):100,maxMana:Number.isFinite(Number(p.maxMana))?Number(p.maxMana):100,_face:p.face||'down',_gait:p.gait||'idle',zone:p.zone||'pvp',_snapshots:[],__guardianPvp:true};}
function upsertPeer(p,serverTime){
 if(!p||!p.id)return;const localId=host().actorId();if(String(p.id)===String(localId))return;
 const peers=root.keloNet?.peers;if(!peers)return;const peer=peers[p.id]||peerBase(p);peer.name=p.name||peer.name;peer.hp=Number.isFinite(Number(p.hp))?Number(p.hp):peer.hp;peer.maxHp=Number.isFinite(Number(p.maxHp))?Number(p.maxHp):peer.maxHp;peer.mana=Number.isFinite(Number(p.mana))?Number(p.mana):peer.mana;peer.maxMana=Number.isFinite(Number(p.maxMana))?Number(p.maxMana):peer.maxMana;peer.zone=p.zone||'pvp';peer._face=p.face||peer._face;peer._gait=p.gait||peer._gait;peer.__guardianPvp=true;peer._snapshots=Array.isArray(peer._snapshots)?peer._snapshots:[];peer._snapshots.push({time:Number(serverTime)||Date.now(),x:Number(p.x)||0,y:Number(p.y)||0,face:peer._face,gait:peer._gait,zone:peer.zone,hp:peer.hp,mana:peer.mana});while(peer._snapshots.length>32)peer._snapshots.shift();peers[p.id]=peer;
}
function reconcileLocal(p,snapshot){
 if(!p||typeof root.localPlayer==='undefined'||!root.localPlayer)return;const lp=root.localPlayer,rx=Number(p.x),ry=Number(p.y);
 if(Number.isFinite(rx)&&Number.isFinite(ry)){const error=Math.hypot(rx-lp.x,ry-lp.y),blend=error>80?1:error>8?.5:.2;lp.x+=(rx-lp.x)*blend;lp.y+=(ry-lp.y)*blend;}
 if(Number.isFinite(Number(p.hp)))lp.hp=Number(p.hp);if(Number.isFinite(Number(p.maxHp)))lp.maxHp=Number(p.maxHp);if(Number.isFinite(Number(p.mana)))lp.mana=Number(p.mana);if(Number.isFinite(Number(p.maxMana)))lp.maxMana=Number(p.maxMana);if(p.face)lp._face=p.face;if(p.gait)lp._gait=p.gait;
 lastAck=Math.max(lastAck,Number(p.ackSequence)||0);try{root.KeloPvPWorld?.reconcileAuthority?.(Object.assign({serverTick:Number(snapshot.serverTick)||0},p));}catch(_){}
}
function visualEvent(ev,serverTime){
 if(!ev||!ev.id||consumed.has(ev.id)||!root.KeloVisualEventBus)return;consumed.add(ev.id);while(consumed.size>MAX_EVENTS)consumed.delete(consumed.values().next().value);
 const peers=root.keloNet?.peers||{},localId=host().actorId(),actor=String(ev.actorId||'')===String(localId)?root.localPlayer:peers[ev.actorId]||null,target=String(ev.targetId||'')===String(localId)?root.localPlayer:peers[ev.targetId]||null;
 const basePayload={remote:true,networkReplay:true,serverTime:Number(serverTime)||Date.now(),actorId:ev.actorId||null,actor,targetActorId:ev.targetId||null,targetActor:target,projectileId:ev.projectileId||ev.projectile?.id||null,abilityKey:ev.abilityKey||ev.projectile?.abilityKey||null,direction:ev.direction||null,target:ev.target||ev.position||null,origin:ev.position||null,amount:ev.amount||null};
 if(ev.type==='PROJECTILE_SPAWNED')root.KeloVisualEventBus.emit('PROJECTILE_SPAWNED',Object.assign(basePayload,{gameplayObject:ev.projectile||null}));else if(['PROJECTILE_HIT','PROJECTILE_EXPIRED','DASH_STARTED','DASH_ENDED','DEATH'].includes(ev.type))root.KeloVisualEventBus.emit(ev.type,basePayload);
}
function ingestSnapshot(event){
 const detail=event?.detail||{},s=detail.snapshot;if(!s||!guardianActive())return;const localId=detail.localActorId||host().actorId(),players=s.players||{},live=new Set();
 if(root.keloNet){root.keloNet.pvpSource='guardian-temporary-authority';root.keloNet.pvpProjectiles=Array.isArray(s.projectiles)?s.projectiles.slice():[];}
 const local=players[localId];if(local)reconcileLocal(local,s);
 Object.keys(players).forEach(id=>{if(id===localId)return;live.add(id);upsertPeer(players[id],s.serverTime);});
 const peers=root.keloNet?.peers||{};Object.keys(peers).forEach(id=>{if(peers[id]?.__guardianPvp&&!live.has(id))delete peers[id];});
 (Array.isArray(s.events)?s.events:[]).forEach(ev=>visualEvent(ev,s.serverTime));emit();
}
function tick(context){
 if(!guardianActive())return;
 if(baseOnline()){host().stop();lastError='GUARDIAN_PVP_CENTRAL_SERVER_RETURNED';forcedStop=true;emit();return;}
 let dt=Math.max(0,Math.min(.1,Number(context?.dt)||0));sendAcc+=dt;
 if(!root.KeloPvPWorld?.state?.combatEnabled){sendAcc=0;return;}
 while(sendAcc>=SEND_DT){sendAcc-=SEND_DT;sendCombatIntent({action:'input',phase:'held',clientTime:Date.now()});}
}
function state(){return Object.freeze({version:VERSION,active:guardianActive(),centralOnline:baseOnline(),mode:guardianActive()?'guardian-temporary':baseOnline()?'central':'offline',lastAck,forcedStop,lastError});}
function emit(){try{root.dispatchEvent(new CustomEvent('kelo:guardian-pvp-net-state',{detail:state()}));}catch(_){} }
const patched=Object.freeze(Object.assign({},base,{isOnline,sendCombatIntent,getLastPvpAck:()=>guardianActive()?lastAck:(base.getLastPvpAck?.()||0),guardianMode:()=>guardianActive()}));
root.KeloNetAuthority=patched;
root.addEventListener('kelo:guardian-pvp-snapshot',ingestSnapshot,{passive:true});
root.addEventListener('kelo:guardian-pvp-state',emit,{passive:true});
if(!root.KeloSimulation||typeof root.KeloSimulation.after!=='function')throw new Error('GUARDIAN_PVP_NET_SIMULATION_OWNER_UNAVAILABLE');
root.KeloSimulation.after('guardian:pvp-net-adapter',tick,380);
root.KeloGuardianPvPNetAdapter=Object.freeze({version:VERSION,state,baseAuthority:base});
root.KELO_GUARDIAN_PVP_NET_ADAPTER_AUDIT=Object.freeze({version:VERSION,owner:'KeloGuardianPvPNetAdapter',centralFallback:true,doubleAuthorityBlocked:true,secondLoop:false,persistentAuthority:false,economyAuthority:false});
emit();
})(typeof globalThis!=='undefined'?globalThis:window);
