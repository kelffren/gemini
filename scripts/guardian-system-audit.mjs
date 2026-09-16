/* KELO-INDEX
 * area: QA / GUARDIAN
 * keys: GUARDIAN AUDIT HOST LEASE AUTH IOS REGION SCHEDULER REWARD PROOF SUPABASE WEBRTC SIGNAL DATACHANNEL HOT MIRROR FAILOVER CHECKPOINT WEBGPU GPU ASSET QUORUM COMMUNITY RECEIPT PROVENANCE PERSISTENCE
 * hace: valida control plane, WebGPU, Community Builder cross-device server-authoritative y Hot Mirror sin segundo loop ni autoridad gameplay cliente
 * online: audit local determinista + contratos estáticos Supabase/WebRTC/WebGPU/Community/Hot Mirror
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {createGuardianCoordinator,rankFor}=require('../server/guardian-coordinator.js');
let now=1_000_000;
const identity={
  async verifyAccessToken(token){if(token!=='ok')throw new Error('AUTH_TOKEN_REQUIRED');return{id:'acc-1'};},
  async getAccountAccess(){return{status:'active',roles:['admin'],permissions:[]};}
};
const guardian=createGuardianCoordinator({identity,now:()=>now,masterLeaseMs:12000,staleMs:20000,workloadLeaseMs:15000});
const admin={accountId:'acc-1',roles:['admin'],permissions:[]};
const eu={accountId:'acc-eu',roles:['player'],permissions:[]};
const usa={accountId:'acc-us',roles:['player'],permissions:[]};
const helper={accountId:'acc-help',roles:['player'],permissions:[]};
const base={nodeId:'g_testnode_1234',capabilities:{platform:'ios',deviceClass:'phone',visibility:'visible',webrtc:true,cores:6,memoryGb:6,webgpu:false,gpuTier:'none',gpuCapacityUnits:0,gpuProbeReady:true},preferences:{allowAssets:true,allowRelay:true,allowCompute:false,allowGpuAssets:false,gpuSharePct:25,maxUploadMbps:20}};
let s=guardian.enable(admin,base);assert.equal(s.node.role,'donor-ready');assert.ok(s.node.recommendedRoles.includes('relay-ready'));assert.ok(s.node.recommendedRoles.includes('host-ready'));assert.equal(s.node.recommendedRoles.includes('asset-gpu-worker'),false);assert.equal(s.masterEligible,true);
assert.throws(()=>guardian.startMaster(usa,{...base,nodeId:'g_player_1234'}),/GUARDIAN_MASTER_PERMISSION_DENIED/);
s=guardian.startMaster(admin,base);assert.equal(s.node.role,'master-host');assert.equal(s.network.masterActive,true);
now+=5000;s=guardian.heartbeat(admin,base);assert.equal(s.node.role,'master-host');
now+=13000;guardian.sweep(now);s=guardian.status(admin,{nodeId:base.nodeId});assert.equal(s.network.masterActive,false);assert.equal(s.node.role,'donor-ready');

const euNode={...base,nodeId:'g_europe_12345',capabilities:{...base.capabilities,platform:'desktop',cores:12,memoryGb:32},preferences:{...base.preferences,allowCompute:true,maxUploadMbps:100}};
const usNode={...base,nodeId:'g_usa_node_123',capabilities:{...base.capabilities,platform:'desktop',cores:8,memoryGb:16},preferences:{...base.preferences,allowCompute:true,maxUploadMbps:80}};
const helpNode={...base,nodeId:'g_help_node_12',capabilities:{...base.capabilities,platform:'desktop',cores:10,memoryGb:16,webgpu:true,gpuTier:'high',gpuCapacityUnits:80,gpuProbeReady:true},preferences:{...base.preferences,allowCompute:true,allowGpuAssets:true,gpuSharePct:50,maxUploadMbps:90}};
guardian.enable(eu,euNode);guardian.enable(usa,usNode);const helperStatus=guardian.enable(helper,helpNode);assert.ok(helperStatus.node.recommendedRoles.includes('asset-gpu-worker'));assert.equal(helperStatus.network.gpuAssetDonors,1);assert.equal(helperStatus.network.gpuCapacityUnits,40);assert.equal(helperStatus.network.gpuCapacityVerified,false);
guardian.observe({accountId:eu.accountId,nodeId:euNode.nodeId},{region:'eu-west',rttMs:18,uploadMbps:300,cpuLoad:.15,tickHz:60,packetLossPct:.1,rttByRegion:{'eu-west':18,'us-east':92}});
guardian.observe({accountId:usa.accountId,nodeId:usNode.nodeId},{region:'us-east',rttMs:15,uploadMbps:250,cpuLoad:.22,tickHz:60,packetLossPct:.1,rttByRegion:{'eu-west':98,'us-east':15}});
guardian.observe({accountId:helper.accountId,nodeId:helpNode.nodeId},{region:'us-east',rttMs:20,uploadMbps:500,cpuLoad:.18,tickHz:60,packetLossPct:.05,rttByRegion:{'eu-west':89,'us-east':20}});
guardian.setRegionalDemand('eu-west',1);
const euPlan=guardian.planWorkload({type:'primary-host',region:'eu-west',limit:3});assert.equal(euPlan.candidates[0].nodeId,euNode.nodeId);assert.equal(euPlan.demandMultiplier,1.75);
const relayPlan=guardian.planWorkload({type:'relay',region:'us-east',limit:3});assert.ok(relayPlan.candidates.some(c=>c.nodeId===helpNode.nodeId));
const gpuPlan=guardian.planWorkload({type:'asset-gpu-worker',region:'us-east',limit:3});assert.equal(gpuPlan.candidates[0].nodeId,helpNode.nodeId);assert.equal(gpuPlan.candidates[0].gpuCapacityUnits,40);
const support=guardian.planSupport({primaryNodeKey:`${usa.accountId}:${usNode.nodeId}`,region:'us-east',cpuLoad:.91,uploadPressure:.93,packetLossPct:4,tickHz:48,regionalPressure:.2});assert.ok(support.needs.some(x=>x.reason==='NETWORK_PRESSURE'));assert.ok(support.needs.some(x=>x.reason==='SIMULATION_PRESSURE'));assert.ok(support.needs.some(x=>x.reason==='FAILOVER_SAFETY'));
const assigned=guardian.assignWorkload({type:'hot-mirror',region:'eu-west',purpose:'eu-primary-backup'});assert.equal(assigned.ok,true);assert.equal(assigned.assignment.type,'hot-mirror');assert.equal(guardian.audit().activeWorkloads,1);
const owner=assigned.plan.candidates[0];assert.equal(guardian.acknowledgeWorkload({accountId:owner.accountId,nodeId:owner.nodeId},assigned.assignment.id).id,assigned.assignment.id);
assert.equal(guardian.releaseWorkload(assigned.assignment.id),true);assert.equal(guardian.audit().activeWorkloads,0);

const availability=guardian.recordVerifiedContribution({accountId:eu.accountId,nodeId:euNode.nodeId},{type:'availability_seconds',seconds:3600,region:'eu-west'});assert.equal(availability.kcMinted,0);assert.equal(availability.demandMultiplier,1);assert.ok(availability.rawUnits<10);
const host=guardian.recordVerifiedContribution({accountId:eu.accountId,nodeId:euNode.nodeId},{type:'host_seconds',seconds:3600,region:'eu-west'});assert.equal(host.demandMultiplier,1.75);assert.ok(host.weightedUnits>host.rawUnits);assert.equal(host.kcMinted,0);
const gpuProof=guardian.recordVerifiedContribution({accountId:helper.accountId,nodeId:helpNode.nodeId},{type:'asset_gpu_seconds',seconds:60,region:'us-east'});assert.equal(gpuProof.kcMinted,0);assert.equal(gpuProof.service.gpuAssetSeconds,60);assert.ok(gpuProof.rawUnits>0);
assert.equal(rankFor(50000).multiplier,2);assert.equal(rankFor(250000).multiplier,3);
assert.equal(guardian.audit().serverAuthorityPreserved,true);assert.equal(guardian.audit().rewardMetricsClientTrusted,false);assert.equal(guardian.audit().kcMintAuthority,false);assert.equal(guardian.audit().gpuAssetScheduling,true);

const authority=fs.readFileSync(path.join(root,'src/systems/guardian-authority.js'),'utf8');
const client=fs.readFileSync(path.join(root,'src/systems/guardian-system.js'),'utf8');
const gpuWorker=fs.readFileSync(path.join(root,'src/systems/guardian-asset-gpu-worker.mjs'),'utf8');
const community=fs.readFileSync(path.join(root,'src/systems/guardian-community-identity.js'),'utf8');
const registry=fs.readFileSync(path.join(root,'src/core/feature-registry.js'),'utf8');
const mirror=fs.readFileSync(path.join(root,'src/systems/guardian-hot-mirror.js'),'utf8');
const ui=fs.readFileSync(path.join(root,'src/ui/guardian-ui.js'),'utf8');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260914052544_guardian_webrtc_control_plane_v2.sql'),'utf8');
const gpuMigration=fs.readFileSync(path.join(root,'supabase/migrations/20260916053000_guardian_gpu_asset_capacity_v3.sql'),'utf8');
const communityMigration=fs.readFileSync(path.join(root,'supabase/migrations/20260916065500_guardian_community_profile_v1.sql'),'utf8');

assert.match(authority,/guardian_signal_send/);assert.match(authority,/guardian_signal_poll/);assert.match(authority,/primarySupabaseRpc:true/);assert.match(authority,/httpFallback:true/);assert.match(authority,/guardian_community_profile/);assert.match(authority,/guardian_community_attest/);assert.match(authority,/communityServerAuthority:true/);
assert.match(client,/RTCPeerConnection/);assert.match(client,/createDataChannel\('kelo-guardian'/);assert.match(client,/KeloSimulation\.after\('guardian:runtime'/);assert.doesNotMatch(client,/setInterval\s*\(/);assert.match(client,/clientGameplayAuthority:false/);assert.match(client,/sendToMaster/);assert.match(client,/broadcast/);assert.match(client,/allowGpuAssets/);assert.match(client,/gpuCapacityUnits/);assert.match(client,/requestAdapter/);assert.doesNotMatch(client,/adapter\.info/);assert.match(client,/gpuVendorExposed:false/);
assert.match(gpuWorker,/guardian:asset_gpu_job/);assert.match(gpuWorker,/guardian:asset_gpu_result/);assert.match(gpuWorker,/createComputePipeline/);assert.match(gpuWorker,/crypto\.subtle\.digest\('SHA-256'/);assert.match(gpuWorker,/arbitraryShaderAllowed:false/);assert.match(gpuWorker,/requiresAssetForgeQA:true/);assert.doesNotMatch(gpuWorker,/eval\s*\(/);assert.doesNotMatch(gpuWorker,/new Function/);assert.doesNotMatch(gpuWorker,/setInterval\s*\(/);
assert.match(community,/guardian:community_receipt/);assert.match(community,/kelo:guardian-asset-provenance/);assert.match(community,/anonymousContributorTokens/);assert.match(community,/crypto\.subtle\.digest\('SHA-256'/);assert.match(community,/communityAttest/);assert.match(community,/communityProfile/);assert.match(community,/serverAuthoritativeProfile:true/);assert.match(community,/localCacheAuthority:false/);assert.match(community,/minimumDistinctAccounts:2/);assert.match(community,/nodeIdPublished:false/);assert.match(community,/economicAuthority:false/);assert.match(community,/gameplayAuthority:false/);assert.match(community,/leaderboardAuthority:false/);assert.doesNotMatch(community,/profile\.consensusBuilds\s*\+\+/);assert.doesNotMatch(community,/setInterval\s*\(/);assert.doesNotMatch(community,/eval\s*\(/);assert.doesNotMatch(community,/new Function/);
assert.match(registry,/guardian-community-identity\.js/);
assert.match(mirror,/guardian:mirror_checkpoint/);assert.match(mirror,/guardian:mirror_ack/);assert.match(mirror,/guardian:mirror_takeover/);assert.match(mirror,/KeloSimulation\.after\('guardian:hot-mirror'/);assert.match(mirror,/startMasterHost\(\)/);assert.match(mirror,/authoritativeGameplay:false/);assert.match(mirror,/clientGameplayAuthority:false/);assert.doesNotMatch(mirror,/setInterval\s*\(/);assert.doesNotMatch(mirror,/STATE\.gold\s*=/);assert.doesNotMatch(mirror,/\.hp\s*=\s*msg/);
assert.match(ui,/guardian-hot-mirror\.js/);assert.match(ui,/KeloGuardianMirror/);assert.match(ui,/communityGpuMeter:true/);assert.match(ui,/DONAR GPU PARA CREAR ASSETS/);assert.match(ui,/GPUu/);assert.match(ui,/mirrorReadOnly:true/);assert.match(ui,/gameplayAuthority:false/);
assert.match(migration,/create table if not exists public\.guardian_signals/);assert.match(migration,/create or replace function public\.guardian_signal_send/);assert.match(migration,/create or replace function public\.guardian_signal_poll/);assert.match(migration,/GUARDIAN_SIGNAL_PAIR_DENIED/);assert.match(migration,/enable row level security/);assert.match(migration,/security definer/);
assert.match(gpuMigration,/asset-gpu-worker/);assert.match(gpuMigration,/gpuCapacityUnits/);assert.match(gpuMigration,/gpuSharePct/);assert.match(gpuMigration,/gpuCapacityVerified/);assert.match(gpuMigration,/security definer/);assert.doesNotMatch(gpuMigration,/grant\s+execute\s+on\s+function\s+kelo_private/i);
assert.match(communityMigration,/guardian_community_attestations/);assert.match(communityMigration,/guardian_community_contributions/);assert.match(communityMigration,/guardian_community_profile\(\)/);assert.match(communityMigration,/guardian_community_attest/);assert.match(communityMigration,/count\(distinct a\.user_id\)/);assert.match(communityMigration,/recommended_roles@>array\['asset-gpu-worker'\]/);assert.match(communityMigration,/enable row level security/);assert.match(communityMigration,/revoke all on public\.guardian_community_contributions/);assert.match(communityMigration,/set search_path=''/);assert.doesNotMatch(communityMigration,/grant\s+execute\s+on\s+function\s+kelo_private/i);assert.doesNotMatch(communityMigration,/grant\s+.*\s+to\s+anon/i);

console.log('GUARDIAN_AUDIT_OK',{...guardian.audit(),supabaseControlPlane:true,webrtcDataPlane:true,webgpuAssetCompute:true,hashValidation:true,communityGpuMeter:true,communityIdentity:true,communityCrossDeviceProfile:true,communityServerAuthority:true,anonymousAssetProvenance:true,hotMirror:true,automaticMasterClaim:true,secondLoop:false,clientGameplayAuthority:false});
