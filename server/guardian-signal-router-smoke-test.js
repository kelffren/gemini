'use strict';
const assert=require('node:assert/strict');
const {createGuardianSignalRouter,sanitizeSignal}=require('./guardian-signal-router');

let clock=5_000_000;
function socket(){const sent=[];return{readyState:1,sent,send(raw){sent.push(JSON.parse(raw));}};}
function person(id,account,node){return{id,accountId:account,roles:[],permissions:[],ws:socket(),node};}
const a=person('a','acct-a','guardian_node_a');
const b=person('b','acct-b','guardian_node_b');
const c=person('c','acct-c','guardian_node_c');
const enabled=new Set(['acct-a:guardian_node_a','acct-b:guardian_node_b','acct-c:guardian_node_c']);
const guardian={
  status(actor,{nodeId}){return{node:enabled.has(actor.accountId+':'+nodeId)?{enabled:true,nodeId}:null};},
  planWorkload(input){
    const all=[{nodeKey:'acct-b:guardian_node_b',nodeId:'guardian_node_b',score:100},{nodeKey:'acct-c:guardian_node_c',nodeId:'guardian_node_c',score:90}];
    const ex=new Set(input.excludeNodeKeys||[]);return{candidates:all.filter(x=>!ex.has(x.nodeKey)&&enabled.has(x.nodeKey))};
  }
};
const router=createGuardianSignalRouter({guardian,now:()=>clock});
router.bind(a,a.node,'bind-a');router.bind(b,b.node,'bind-b');router.bind(c,c.node,'bind-c');
assert.equal(router.audit().bindings,3);
const session=router.requestPeer(a,{region:'nyc',requestId:'req-1'});
assert.equal(session.role,'offerer');assert.equal(session.peerNodeId,b.node);assert.match(session.sessionId,/^gs_/);
assert.equal(b.ws.sent.some(x=>x.t==='guardian:peer:invite'&&x.sessionId===session.sessionId),true);
router.routeSignal(a,{sessionId:session.sessionId,signal:{kind:'offer',sdp:'v=0\r\n'}});
const offered=b.ws.sent.find(x=>x.t==='guardian:peer:signal'&&x.signal?.kind==='offer');assert.ok(offered);assert.equal(offered.peerNodeId,a.node);
router.routeSignal(b,{sessionId:session.sessionId,signal:{kind:'answer',sdp:'v=0\r\n'}});
assert.equal(a.ws.sent.some(x=>x.t==='guardian:peer:signal'&&x.signal?.kind==='answer'),true);
assert.throws(()=>router.routeSignal(c,{sessionId:session.sessionId,signal:{kind:'ice',candidate:'candidate:1 1 udp 1 127.0.0.1 9 typ host'}}),/GUARDIAN_SIGNAL_SESSION_FORBIDDEN/);
assert.throws(()=>sanitizeSignal({kind:'offer',sdp:'x'.repeat(25000)}),/GUARDIAN_SIGNAL_SDP_INVALID/);
clock+=50000;const kept=router.routeSignal(a,{sessionId:session.sessionId,signal:{kind:'keepalive'}});assert.equal(kept.keptAlive,true);
clock+=20000;assert.equal(router.sweep(clock).sessions,1);
clock+=41000;assert.equal(router.sweep(clock).sessions,0);assert.equal(a.ws.sent.some(x=>x.t==='guardian:peer:closed'&&x.reason==='ttl-expired'),true);
const session2=router.requestPeer(a,{region:'nyc'});router.unbind(b,'socket-close');assert.equal(router.audit().sessions,0);assert.equal(a.ws.sent.some(x=>x.t==='guardian:peer:closed'&&x.sessionId===session2.sessionId),true);
router.bind(b,b.node,'bind-b2');const session3=router.requestPeer(a,{region:'nyc'});enabled.delete('acct-b:guardian_node_b');assert.throws(()=>router.routeSignal(a,{sessionId:session3.sessionId,signal:{kind:'keepalive'}}),/GUARDIAN_SIGNAL_CAPACITY/);assert.equal(router.audit().sessions,0);
const unauth={id:'x',accountId:null,roles:[],permissions:[],ws:socket()};assert.throws(()=>router.bind(unauth,'guardian_bad_x'),/GUARDIAN_SIGNAL_AUTH_REQUIRED/);
console.log('Guardian signaling smoke test OK');
