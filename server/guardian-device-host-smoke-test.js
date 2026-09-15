'use strict';
const assert=require('node:assert/strict');
const {createGuardianCoordinator,sanitizePreferences}=require('./guardian-coordinator');

let clock=1_000_000;
const identity={verifyAccessToken:async()=>({id:'unused'}),getAccountAccess:async()=>({status:'active',roles:[],permissions:[]})};
const guardian=createGuardianCoordinator({identity,now:()=>clock,masterLeaseMs:25000,staleMs:45000});
const donor={accountId:'donor-account',roles:[],permissions:[]};
const admin={accountId:'admin-account',roles:['admin'],permissions:['guardian.master_host']};
const donorInput={
  nodeId:'guardian_donor_test',
  capabilities:{platform:'desktop',deviceClass:'desktop',visibility:'visible',effectiveType:'4g',online:true,webrtc:true,serviceWorker:true,cores:8,memoryGb:16},
  preferences:{idleDonation:true,wifiOnly:true,chargingOnly:false,allowAssets:true,allowRelay:true,allowCompute:false,maxUploadMbps:12,storageMb:1024}
};
const adminInput={...donorInput,nodeId:'guardian_admin_test'};

const enabled=guardian.enable(donor,donorInput);
assert.equal(enabled.ok,true);
assert.equal(enabled.node.role,'donor-ready');
assert.equal(enabled.masterEligible,false);
assert.ok(enabled.node.recommendedRoles.includes('asset-seeder-ready'));
assert.ok(enabled.node.recommendedRoles.includes('relay-ready'));
assert.throws(()=>guardian.startMaster(donor,donorInput),/GUARDIAN_MASTER_PERMISSION_DENIED/);

let hosted=guardian.startMaster(admin,adminInput);
assert.equal(hosted.masterEligible,true);
assert.equal(hosted.node.role,'master-host');
assert.ok(hosted.node.masterLeaseExpiresAt>clock);

clock+=10_000;
hosted=guardian.heartbeat(admin,adminInput);
assert.equal(hosted.node.role,'master-host');
assert.ok(hosted.node.masterLeaseExpiresAt>clock);

clock+=26_000;
const swept=guardian.sweep(clock);
assert.equal(swept.masterActive,false);
const afterExpiry=guardian.status(admin,{nodeId:'guardian_admin_test'});
assert.notEqual(afterExpiry.node?.role,'master-host');

const hidden={...adminInput,capabilities:{...adminInput.capabilities,visibility:'hidden'}};
hosted=guardian.startMaster(admin,adminInput);
assert.equal(hosted.node.role,'master-host');
const hiddenBeat=guardian.heartbeat(admin,hidden);
assert.equal(hiddenBeat.node.role,'donor-ready');
assert.equal(hiddenBeat.node.masterLeaseExpiresAt,null);

const prefs=sanitizePreferences({wifiOnly:false,chargingOnly:true,allowAssets:false,allowRelay:true,allowCompute:true,maxUploadMbps:999,storageMb:1});
assert.equal(prefs.wifiOnly,false);
assert.equal(prefs.chargingOnly,true);
assert.equal(prefs.allowAssets,false);
assert.equal(prefs.maxUploadMbps,200);
assert.equal(prefs.storageMb,64);

// Workload contract: client can ACK/report, but the report does not create verified units or KC.
let workClock=2_000_000;
const mesh=createGuardianCoordinator({identity,now:()=>workClock,workloadLeaseMs:30000,staleMs:45000});
const nodeA={accountId:'mesh-a',roles:[],permissions:[]};
const nodeB={accountId:'mesh-b',roles:[],permissions:[]};
const meshBase={capabilities:{platform:'desktop',deviceClass:'desktop',visibility:'visible',effectiveType:'4g',online:true,webrtc:true,serviceWorker:true,cores:8,memoryGb:16},preferences:{idleDonation:true,wifiOnly:false,chargingOnly:false,allowAssets:true,allowRelay:true,allowCompute:true,maxUploadMbps:20,storageMb:2048}};
mesh.enable(nodeA,{...meshBase,nodeId:'guardian_mesh_node_a'});
mesh.enable(nodeB,{...meshBase,nodeId:'guardian_mesh_node_b'});
const assigned=mesh.assignWorkload({type:'witness',region:'global',leaseMs:10000,purpose:'ci-witness',task:{kind:'witness',nonce:'ci-nonce'}});
assert.equal(assigned.ok,true);
assert.equal(assigned.assignment.attempt,1);
assert.equal(assigned.assignment.state,'assigned');
assert.equal(assigned.assignment.task.kind,'witness');
const firstNodeId=assigned.node.nodeId;
const firstActor=firstNodeId==='guardian_mesh_node_a'?nodeA:nodeB;
const firstRef={accountId:firstActor.accountId,nodeId:firstNodeId};
const acked=mesh.acknowledgeWorkload(firstRef,assigned.assignment.id);
assert.equal(acked.state,'running');
const reported=mesh.reportWorkloadResult(firstRef,assigned.assignment.id,{status:'completed',digest:'a'.repeat(64),durationMs:12,bytes:0,detail:'ci'});
assert.equal(reported.state,'reported');
let firstStatus=mesh.status(firstActor,{nodeId:firstNodeId});
assert.equal(firstStatus.node.service.verifiedUnits,0);
assert.equal(firstStatus.node.service.rewardedUnits,0);
assert.equal(firstStatus.node.service.workloadsCompleted,0);
assert.equal(firstStatus.rewardPolicy.clientResultTrusted,false);

// If the trusted server never verifies/releases the client result, its lease expires and the same workload fails over.
workClock+=30_001;
mesh.sweep(workClock);
workClock+=1_001;
const failoverSummary=mesh.sweep(workClock);
assert.equal(failoverSummary.assignedWorkloads,1);
const secondNodeId=firstNodeId==='guardian_mesh_node_a'?'guardian_mesh_node_b':'guardian_mesh_node_a';
const secondActor=secondNodeId==='guardian_mesh_node_a'?nodeA:nodeB;
const secondStatus=mesh.status(secondActor,{nodeId:secondNodeId});
assert.equal(secondStatus.node.assignments.length,1);
assert.equal(secondStatus.node.assignments[0].id,assigned.assignment.id);
assert.equal(secondStatus.node.assignments[0].attempt,2);
assert.equal(secondStatus.node.assignments[0].state,'assigned');
assert.equal(mesh.audit().automaticFailover,true);
assert.equal(mesh.audit().clientWorkloadResultsTrusted,false);

// Only a trusted server-side release counts the workload as completed.
assert.equal(mesh.releaseWorkload(assigned.assignment.id),true);
const completedStatus=mesh.status(secondActor,{nodeId:secondNodeId});
assert.equal(completedStatus.node.service.workloadsCompleted,1);
assert.equal(completedStatus.node.service.verifiedUnits,0);

console.log('Guardian device-host + workload failover smoke test OK');
