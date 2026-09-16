/* KELO-INDEX
 * area: QA / GUARDIAN ROOM HOST
 * keys: GUARDIAN ROOM HOST LEASE EPOCH STALE SNAPSHOT INPUT LOG AUTHORITY
 * purpose: valida por contrato que el room host permanece efímero, cercado por lease y sin autoridad persistente
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {TextEncoder} from 'node:util';
const source=fs.readFileSync(new URL('../src/systems/guardian-room-host.js',import.meta.url),'utf8');
const listeners=new Map(),broadcasts=[];
let tickFn=null;
let gs={enabled:true,nodeId:'g_master',masterActive:true,master:{nodeId:'g_master',epoch:7,expiresAt:Date.now()+60000}};
class CustomEvent{constructor(type,opts={}){this.type=type;this.detail=opts.detail;}}
const root={console,TextEncoder,Date,Math,Object,Array,String,Number,Boolean,JSON,Map,Set,RegExp,CustomEvent,document:{visibilityState:'visible'},addEventListener(type,fn){if(!listeners.has(type))listeners.set(type,[]);listeners.get(type).push(fn);},dispatchEvent(ev){for(const fn of listeners.get(ev.type)||[])fn(ev);return true;},KeloSimulation:{after(name,fn){assert.equal(name,'guardian:room-host');tickFn=fn;}},KeloGuardian:{state:()=>gs,sendToMaster:()=>true,broadcast:msg=>{broadcasts.push(msg);return 1;}}};
root.globalThis=root;root.window=root;
vm.createContext(root);vm.runInContext(source,root,{filename:'guardian-room-host.js'});
assert.ok(root.KeloGuardianRoomHost);assert.ok(tickFn);
root.KeloGuardianRoomHost.startLab('lab-1');
assert.equal(root.KeloGuardianRoomHost.submitInput({kind:'move',actorId:'a1',moveX:1,moveY:0,aimX:1,aimY:0},'lab-1'),true);
for(let i=0;i<10;i++)tickFn();
let state=root.KeloGuardianRoomHost.state();assert.equal(state.hostedRooms.length,1);assert.equal(state.stats.acceptedInputs,1);assert.ok(broadcasts.some(m=>m.t==='guardian:room_snapshot'));
const original=broadcasts.find(m=>m.t==='guardian:room_snapshot');
const input={t:'guardian:room_input',schema:1,roomId:'lab-1',epoch:7,clientSeq:2,input:{kind:'move',actorId:'peer-1',moveX:0,moveY:1}};
root.dispatchEvent(new CustomEvent('kelo:guardian-data',{detail:{fromNodeId:'peer-1',payload:input}}));
root.dispatchEvent(new CustomEvent('kelo:guardian-data',{detail:{fromNodeId:'peer-1',payload:input}}));
assert.equal(root.KeloGuardianRoomHost.state().stats.staleInputs,1);
gs={enabled:true,nodeId:'g_master',masterActive:false,master:{nodeId:'g_next',epoch:8,expiresAt:Date.now()+60000}};
root.dispatchEvent(new CustomEvent('kelo:guardian-state',{detail:gs}));
state=root.KeloGuardianRoomHost.state();assert.equal(state.hostedRooms.length,0);assert.ok(state.stats.leaseResets>=1);
root.dispatchEvent(new CustomEvent('kelo:guardian-data',{detail:{fromNodeId:'g_next',payload:{...original,epoch:8,masterNodeId:'g_next',seq:10,roomId:'lab-1'}}}));
const receivedBefore=root.KeloGuardianRoomHost.state().stats.snapshotsReceived;
root.dispatchEvent(new CustomEvent('kelo:guardian-data',{detail:{fromNodeId:'g_next',payload:{...original,epoch:8,masterNodeId:'g_next',seq:9,roomId:'lab-1'}}}));
assert.equal(root.KeloGuardianRoomHost.state().stats.snapshotsReceived,receivedBefore);
assert.equal(root.KELO_GUARDIAN_ROOM_HOST_AUDIT.authoritativeGameplay,false);
assert.equal(root.KELO_GUARDIAN_ROOM_HOST_AUDIT.economyAuthority,false);
assert.equal(source.includes('setInterval('),false);
assert.equal(/localStorage\.(getItem|setItem|removeItem)/.test(source),false);
console.log('GUARDIAN_ROOM_HOST_AUDIT_OK',root.KeloGuardianRoomHost.state());
