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
assert.ok(enabled.node.recommendedRoles.includes('asset-seeder')||enabled.node.recommendedRoles.includes('relay'));
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

console.log('Guardian device-host smoke test OK');
