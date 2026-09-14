/* KELO-INDEX
 * area: QA / GUARDIAN
 * keys: GUARDIAN AUDIT HOST LEASE AUTH IOS
 * hace: valida contratos básicos del coordinador Guardian y sus fronteras de autoridad
 * online: N/A; audit local determinista
 */
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createGuardianCoordinator}=require('../server/guardian-coordinator.js');
let now=1_000_000;
const identity={
  async verifyAccessToken(token){if(token!=='ok')throw new Error('AUTH_TOKEN_REQUIRED');return{id:'acc-1'};},
  async getAccountAccess(){return{status:'active',roles:['admin'],permissions:[]};}
};
const guardian=createGuardianCoordinator({identity,now:()=>now,masterLeaseMs:12000,staleMs:20000});
const admin={accountId:'acc-1',roles:['admin'],permissions:[]};
const player={accountId:'acc-2',roles:['player'],permissions:[]};
const base={nodeId:'g_testnode_1234',capabilities:{platform:'ios',deviceClass:'phone',visibility:'visible',webrtc:true,cores:6},preferences:{allowAssets:true,allowRelay:true,allowCompute:false}};
let s=guardian.enable(admin,base);assert.equal(s.node.role,'donor-ready');assert.ok(s.node.recommendedRoles.includes('relay-ready'));assert.equal(s.masterEligible,true);
assert.throws(()=>guardian.startMaster(player,{...base,nodeId:'g_player_1234'}),/GUARDIAN_MASTER_PERMISSION_DENIED/);
s=guardian.startMaster(admin,base);assert.equal(s.node.role,'master-host');assert.equal(s.network.masterActive,true);
now+=5000;s=guardian.heartbeat(admin,base);assert.equal(s.node.role,'master-host');
now+=13000;guardian.sweep(now);s=guardian.status(admin,{nodeId:base.nodeId});assert.equal(s.network.masterActive,false);assert.equal(s.node.role,'donor-ready');
console.log('GUARDIAN_AUDIT_OK',guardian.audit());