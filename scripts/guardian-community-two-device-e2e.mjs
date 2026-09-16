/* KELO-INDEX
 * area: QA / GUARDIAN COMMUNITY
 * keys: GUARDIAN COMMUNITY TWO DEVICE QUORUM CROSS DEVICE SUPABASE ATTESTATION
 * purpose: prueba determinista del contrato persistente con dos cuentas/nodos sin necesitar un proyecto Supabase remoto
 * do-not: NO sustituye prueba live; NO autoridad producción; NO red real
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260916065500_guardian_community_profile_v1.sql'),'utf8');
const community=fs.readFileSync(path.join(root,'src/systems/guardian-community-identity.js'),'utf8');
const authority=fs.readFileSync(path.join(root,'src/systems/guardian-authority.js'),'utf8');
const PRESETS=new Set(['material-noise-v1','aura-field-v1','terrain-speckle-v1']);

class CommunityPersistenceModel{
  constructor(){this.now=1_000_000;this.master={epoch:7,expiresAt:this.now+60_000};this.nodes=new Map();this.attestations=[];this.assets=new Map();this.contributions=new Map();}
  tick(ms){this.now+=ms;}
  nodeKey(userId,nodeId){return `${userId}:${nodeId}`;}
  enableGpuNode(userId,nodeId,{heartbeatAt=this.now,enabled=true,gpu=true}={}){this.nodes.set(this.nodeKey(userId,nodeId),{userId,nodeId,heartbeatAt,enabled,roles:gpu?new Set(['asset-gpu-worker']):new Set()});}
  profile(userId){const rows=[...this.contributions.values()].filter(r=>r.userId===userId).sort((a,b)=>b.verifiedAt-a.verifiedAt);return{consensusBuilds:rows.length,firstContributionAt:rows.length?Math.min(...rows.map(r=>r.verifiedAt)):null,lastContributionAt:rows.length?Math.max(...rows.map(r=>r.verifiedAt)):null,recentReceipts:rows.slice(0,50)};}
  attest({userId,nodeId,assetHash,preset='material-noise-v1',epoch=this.master.epoch,jobId=`community:${assetHash}`}){
    assert.match(nodeId,/^[A-Za-z0-9:_-]{8,96}$/,'node format');
    assert.match(assetHash,/^[a-f0-9]{64}$/,'hash format');
    assert.equal(jobId,`community:${assetHash}`,'job/hash binding');
    assert.ok(PRESETS.has(preset),'preset allowlist');
    assert.equal(epoch,this.master.epoch,'live master epoch');
    assert.ok(this.master.expiresAt>this.now,'master lease live');
    const node=this.nodes.get(this.nodeKey(userId,nodeId));
    assert.ok(node?.enabled,'node enabled');
    assert.ok(node.heartbeatAt>this.now-45_000,'fresh heartbeat');
    assert.ok(node.roles.has('asset-gpu-worker'),'GPU worker eligibility');
    const duplicate=this.attestations.some(a=>a.jobId===jobId&&a.userId===userId&&a.nodeId===nodeId);
    if(!duplicate)this.attestations.push({jobId,userId,nodeId,assetHash,preset,epoch,createdAt:this.now});
    const matching=this.attestations.filter(a=>a.jobId===jobId&&a.epoch===epoch&&a.assetHash===assetHash&&a.preset===preset);
    const matchingAccounts=new Set(matching.map(a=>a.userId));
    let verified=this.assets.has(assetHash);
    if(matchingAccounts.size>=2){
      verified=true;
      const previous=this.assets.get(assetHash);
      this.assets.set(assetHash,{assetHash,jobId,preset,epoch,contributors:Math.max(previous?.contributors||0,matchingAccounts.size),verifiedAt:previous?.verifiedAt||this.now});
      for(const uid of matchingAccounts){
        const key=`${uid}:${assetHash}`;
        const old=this.contributions.get(key);
        this.contributions.set(key,{userId:uid,assetHash,preset,contributors:Math.max(old?.contributors||0,matchingAccounts.size),verifiedAt:old?.verifiedAt||this.now,consensus:true});
      }
    }
    return{verified,matchingAccounts:matchingAccounts.size,profile:this.profile(userId)};
  }
}

// Static contract: the migration must implement the same security invariants as the model.
assert.match(migration,/count\(distinct a\.user_id\)/i);
assert.match(migration,/unique\(user_id,asset_hash\)/i);
assert.match(migration,/guardian_master_lease/i);
assert.match(migration,/last_heartbeat_at>now\(\)-interval '45 seconds'/i);
assert.match(migration,/asset-gpu-worker/i);
assert.match(migration,/auth\.uid\(\)/i);
assert.match(migration,/enable row level security/i);
assert.match(migration,/security definer set search_path=''/i);
assert.match(migration,/revoke all on function public\.guardian_community_attest/i);
assert.match(authority,/communityProfile:/);
assert.match(authority,/communityAttest:/);
assert.match(authority,/communityAssetStatus:/);
assert.match(community,/serverAuthoritative:true/);
assert.match(community,/syncState/);
assert.doesNotMatch(community,/consensusBuilds\s*\+\s*1/,'client must not mint Builder credit');

const model=new CommunityPersistenceModel();
const hashA='a'.repeat(64),hashB='b'.repeat(64);
model.enableGpuNode('user-a','guardian_a_0001');
model.enableGpuNode('user-a','guardian_a_0002');
model.enableGpuNode('user-b','guardian_b_0001');
model.enableGpuNode('user-c','guardian_c_0001',{gpu:false});

// 1) First account alone cannot verify an asset.
let result=model.attest({userId:'user-a',nodeId:'guardian_a_0001',assetHash:hashA});
assert.equal(result.verified,false);
assert.equal(result.matchingAccounts,1);
assert.equal(result.profile.consensusBuilds,0);

// 2) A second node owned by the same account still cannot fake quorum.
result=model.attest({userId:'user-a',nodeId:'guardian_a_0002',assetHash:hashA});
assert.equal(result.verified,false);
assert.equal(result.matchingAccounts,1);
assert.equal(result.profile.consensusBuilds,0);

// 3) A distinct authenticated account on an eligible GPU node creates quorum.
model.tick(1000);
result=model.attest({userId:'user-b',nodeId:'guardian_b_0001',assetHash:hashA});
assert.equal(result.verified,true);
assert.equal(result.matchingAccounts,2);
assert.equal(result.profile.consensusBuilds,1);
assert.equal(model.profile('user-a').consensusBuilds,1);
assert.equal(model.profile('user-b').consensusBuilds,1);
assert.equal(model.assets.get(hashA).contributors,2);

// 4) Cross-device recovery is account scoped: a new device reads the same server profile.
model.enableGpuNode('user-a','guardian_a_phone2');
const recoveredOnSecondDevice=model.profile('user-a');
assert.equal(recoveredOnSecondDevice.consensusBuilds,1);
assert.equal(recoveredOnSecondDevice.recentReceipts[0].assetHash,hashA);

// 5) Replays are idempotent: same user + same asset never increments builds twice.
result=model.attest({userId:'user-a',nodeId:'guardian_a_0001',assetHash:hashA});
assert.equal(result.profile.consensusBuilds,1);
assert.equal(model.profile('user-b').consensusBuilds,1);

// 6) Different hashes never combine into quorum.
result=model.attest({userId:'user-a',nodeId:'guardian_a_0001',assetHash:hashB,preset:'aura-field-v1'});
assert.equal(result.verified,false);
assert.equal(result.matchingAccounts,1);
assert.equal(model.profile('user-a').consensusBuilds,1);

// 7) Non-GPU workers cannot attest.
assert.throws(()=>model.attest({userId:'user-c',nodeId:'guardian_c_0001',assetHash:hashB,preset:'aura-field-v1'}),/GPU worker eligibility/);

// 8) Stale epoch cannot earn credit.
assert.throws(()=>model.attest({userId:'user-b',nodeId:'guardian_b_0001',assetHash:hashB,preset:'aura-field-v1',epoch:6}),/live master epoch/);

// 9) Stale heartbeat cannot earn credit.
model.enableGpuNode('user-c','guardian_c_gpu01',{gpu:true,heartbeatAt:model.now-46_000});
assert.throws(()=>model.attest({userId:'user-c',nodeId:'guardian_c_gpu01',assetHash:hashB,preset:'aura-field-v1'}),/fresh heartbeat/);

console.log('GUARDIAN_COMMUNITY_TWO_DEVICE_E2E_OK',{
  quorumAccounts:2,
  sameAccountMultiNodeCannotQuorum:true,
  crossDeviceAccountRecovery:true,
  duplicateCreditBlocked:true,
  staleEpochBlocked:true,
  staleHeartbeatBlocked:true,
  gpuEligibilityRequired:true,
  clientCreditAuthority:false,
  remoteSupabaseRequiredForLive:false
});
