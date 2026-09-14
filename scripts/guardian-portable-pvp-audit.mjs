/* KELO-INDEX
 * area: QA / GUARDIAN PVP AUTHORITY
 * keys: GUARDIAN PORTABLE PVP AUTHORITY EXPORT IMPORT PARITY WORKER WEBRTC RENDER FALLBACK
 * purpose: prueba que Node y Guardian comparten un core PvP restaurable y que KeloNetAuthority enruta realtime sin abrir autoridad económica al cliente
 * online: determinista local + invariantes estáticos del data plane Guardian
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const adapter=require('../server/pvp-authority.js');
assert.equal(adapter.CORE_VERSION,'pvp-authority-core-v1');
assert.equal(adapter.STATE_SCHEMA,'kelo-pvp-authority-state-v1');
function actor(id,name){return{id,name,x:0,y:0,vx:0,vy:0,radius:20,hp:100,maxHp:100,mana:100,maxMana:100,zone:'plaza',face:'down',gait:'idle'};}
function intent(sequence,action='input',phase='held',extra={}){return Object.assign({sequence,moveX:0,moveY:0,aimX:1,aimY:0,action,phase,clientTime:1_000_000},extra);}
function normalize(snapshot){const players={};Object.keys(snapshot.players||{}).sort().forEach(id=>{const p=snapshot.players[id];players[id]={id:p.id,x:+p.x.toFixed(6),y:+p.y.toFixed(6),hp:p.hp,mana:+p.mana.toFixed(6),ackSequence:p.ackSequence,zone:p.zone,cooldowns:p.cooldowns,attackPhase:p.attackPhase,attackKind:p.attackKind,castPhase:p.castPhase,dash:p.dash,basicResource:p.basicResource,specialResource:p.specialResource,comboStep:p.comboStep,dodgeCooldown:+Number(p.dodgeCooldown||0).toFixed(6),statuses:p.statuses};});return{serverTick:snapshot.serverTick,players,projectiles:(snapshot.projectiles||[]).map(p=>({id:p.id,ownerId:p.ownerId,abilityKey:p.abilityKey,x:+p.x.toFixed(6),y:+p.y.toFixed(6),vx:+Number(p.vx||0).toFixed(6),vy:+Number(p.vy||0).toFixed(6),radius:p.radius}))};}
const a=adapter.createPvpAuthority();
const a1=actor('p1','Uno'),a2=actor('p2','Dos');
assert.equal(a.ingest(a1,intent(1,'enter_pvp','pressed'),1_000_000).ok,true);
assert.equal(a.ingest(a2,intent(1,'enter_pvp','pressed'),1_000_000).ok,true);
for(let i=0;i<8;i++)a.step(adapter.FIXED_DT,1_000_000+i*1000/60);
assert.equal(a.ingest(a1,intent(2,'ability','cast',{abilityKey:'fireball'}),1_000_150).ok,true);
for(let i=0;i<8;i++)a.step(adapter.FIXED_DT,1_000_150+i*1000/60);
const exported=a.exportState(1_000_300);
assert.equal(exported.schema,adapter.STATE_SCHEMA);assert.ok(exported.actors.length>=2);assert.ok(exported.serverTick>0);
for(let i=0;i<12;i++)a.step(adapter.FIXED_DT,1_000_300+(i+1)*1000/60);
const expected=normalize(a.snapshot(1_000_500));
a.dispose();
const b=adapter.createPvpAuthority();
const audit=b.importState(exported,1_000_300);assert.equal(audit.portable,true);assert.equal(audit.exportImport,true);assert.equal(audit.serverTick,exported.serverTick);
for(let i=0;i<12;i++)b.step(adapter.FIXED_DT,1_000_300+(i+1)*1000/60);
const actual=normalize(b.snapshot(1_000_500));
assert.deepEqual(actual,expected,'portable authority must continue deterministically after import');
b.dispose();
const core=fs.readFileSync(path.join(root,'src/online/pvp-authority-core.js'),'utf8');
const worker=fs.readFileSync(path.join(root,'src/online/guardian-pvp-worker.js'),'utf8');
const host=fs.readFileSync(path.join(root,'src/systems/guardian-simulation-host.js'),'utf8');
const net=fs.readFileSync(path.join(root,'engine-net.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/ui/guardian-ui.js'),'utf8');
assert.match(core,/exportState/);assert.match(core,/importState/);assert.doesNotMatch(core,/WebSocket|RTCPeerConnection|supabase/i);assert.match(worker,/pvp-authority-core\.js/);assert.doesNotMatch(worker,/setInterval\s*\(/);assert.doesNotMatch(host,/setInterval\s*\(/);assert.match(host,/KeloSimulation\.after\('guardian:simulation-host'/);assert.match(host,/guardian:pvp_state_chunk/);assert.match(host,/guardian:pvp_state_ack/);assert.match(host,/durableEconomyAuthority:false/);assert.match(net,/guardian-webrtc/);assert.match(net,/server-websocket/);assert.match(net,/DURABLE_SERVER_OFFLINE/);assert.match(net,/KeloGuardianSimulationHost/);assert.match(net,/kelo:guardian-pvp-snapshot/);assert.match(net,/durableServerFailClosed:true/);assert.match(ui,/guardian-simulation-host\.js/);assert.match(ui,/PvP authority/);assert.match(ui,/durableEconomyAuthority:false/);
console.log('GUARDIAN_PORTABLE_PVP_AUDIT_OK',{core:adapter.CORE_VERSION,stateSchema:adapter.STATE_SCHEMA,parity:true,guardianWebRtc:true,renderFallback:true,durableEconomyClientAuthority:false});
