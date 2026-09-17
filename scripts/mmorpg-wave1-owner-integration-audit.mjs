/* KELO-INDEX
 * area: MMORPG / WAVE 1 OWNER INTEGRATION QA
 * owner: Main Stability Gate
 * purpose: prove Wave 1 bindings reuse current owners and preserve authority boundaries
 */
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {createMmorpgWave1OwnerIntegration,principalFromResolved}=require('../server/mmorpg-wave1-owner-integration.js');
const {createOnlineIdentityStore}=require('../server/online-identity-store.js');

const bindings=JSON.parse(fs.readFileSync('docs/mmorpg-wave1-owner-bindings.json','utf8'));
const manifest=JSON.parse(fs.readFileSync('docs/mmorpg-community-systems.json','utf8'));
const wave1Ids=manifest.systems.filter(row=>row.wave===1).map(row=>row.id).sort();
const boundIds=bindings.bindings.map(row=>row.systemId).sort();
assert.equal(bindings.schemaVersion,1);
assert.equal(bindings.wave,1);
assert.deepEqual(boundIds,wave1Ids,'owner bindings must cover every Wave 1 system exactly once');
assert.equal(boundIds.length,9);
assert.equal(new Set(boundIds).size,9);
for(const row of bindings.bindings){
  assert.ok(['foundation-active','integrated','live-verified'].includes(row.status),`invalid binding status ${row.systemId}:${row.status}`);
  assert.ok(Array.isArray(row.owners)&&row.owners.length,`owner required ${row.systemId}`);
  assert.ok(Array.isArray(row.evidence)&&row.evidence.length,`evidence required ${row.systemId}`);
  if(row.status==='integrated')assert.ok(!row.missingForIntegrated?.length,`integrated binding cannot declare missingForIntegrated: ${row.systemId}`);
}

const verified={
  authenticated:true,source:'supabase-auth-rls',
  accountId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  characterId:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  roles:['creator','moderator'],permissions:['world.publish']
};
const principal=principalFromResolved(verified);
assert.equal(principal.creatorId,'creator:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
assert.equal(principal.serverVerified,true);
assert.ok(principal.capabilities.includes('creator.build'));
assert.ok(principal.capabilities.includes('creator.review'));
assert.ok(principal.capabilities.includes('creator.publish'));
assert.equal(principalFromResolved({...verified,source:'client-claim'}),null,'client-derived identity must never become Creator Principal');

const fakeIdentity={resolve:async()=>verified};
const integration=createMmorpgWave1OwnerIntegration({identity:fakeIdentity,guardian:{version:'guardian-test'},aoi:{cell:512,radius:1350,hysteresis:180}});
const resolved=await integration.resolveCreator({});
assert.equal(resolved.principal.serverVerified,true);
assert.equal(integration.can(resolved.principal,'creator.publish'),true);
assert.throws(()=>integration.requireCapability(resolved.principal,'creator.permissions'),/CREATOR_CAPABILITY_DENIED/);
assert.throws(()=>integration.guardClientMessage({t:'world:mutation'}),/CLIENT_AUTHORITY_WRITE_FORBIDDEN/);
assert.throws(()=>integration.guardClientMessage({t:'pose',authoritative:true}),/CLIENT_AUTHORITY_CLAIM_FORBIDDEN/);
assert.throws(()=>integration.guardClientMessage({t:'pose',source:'server-authoritative'}),/CLIENT_AUTHORITY_CLAIM_FORBIDDEN/);
assert.equal(integration.guardClientMessage({t:'pose',x:1,y:2}).t,'pose');
assert.equal(integration.guardGuardianEnvelope({t:'mirror',authoritative:false}).authoritative,false);
assert.throws(()=>integration.guardGuardianEnvelope({authoritative:true}),/GUARDIAN_AUTHORITY_FORBIDDEN/);
assert.equal(integration.aoi.cell,512);
assert.equal(integration.aoi.serverFiltered,true);
assert.equal(integration.aoi.boundedSubscriptions,true);

const offlineIdentity=createOnlineIdentityStore({});
assert.equal(offlineIdentity.audit().creatorPrincipal,true);
assert.equal(offlineIdentity.audit().creatorPrincipalSource,'verified-account-access');
const offline=await offlineIdentity.resolve({});
assert.equal(offline.creatorPrincipal,null);

const serverIndex=fs.readFileSync('server/index.js','utf8');
assert.match(serverIndex,/AOI_CELL=512,AOI_RADIUS=1350,AOI_HYSTERESIS=180/);
assert.match(serverIndex,/_aoiRelevant:new Set\(\)/);
assert.match(serverIndex,/source:'server-authoritative-aoi'/);
assert.match(serverIndex,/function publicStateFor\(viewer,index\)/);

const genericProps=fs.readFileSync('src/environment/generic-props.js','utf8');
assert.match(genericProps,/atlas-contract-viewport-v2/);
assert.match(genericProps,/syncResidency/);

const guardian=fs.readFileSync('src/systems/guardian-system.js','utf8');
assert.match(guardian,/authoritative:false/,'Guardian data plane must remain non-authoritative');
assert.match(guardian,/backgroundContinuousGuaranteed:false/);

const identitySource=fs.readFileSync('server/online-identity-store.js','utf8');
assert.match(identitySource,/principalFromResolved/);
assert.match(identitySource,/creatorPrincipal:principalFromResolved\(resolved\)/);
assert.match(identitySource,/source:'supabase-auth-rls'/);

const onlineDoc=fs.readFileSync('docs/systems/ONLINE_FOUNDATION.md','utf8');
for(const token of ['`maps`','`map_versions`','`map_version_chunks`','`map_asset_refs`','`map_publications`'])assert.ok(onlineDoc.includes(token),`online map version owner missing ${token}`);
assert.match(onlineDoc,/map_versions` es cabecera inmutable/);
assert.match(onlineDoc,/server_idempotency/);
assert.match(onlineDoc,/server_outbox/);
assert.match(onlineDoc,/server_audit_events/);

const creatorRevision=fs.readFileSync('src/creators/core/creator-revision.mjs','utf8');
assert.match(creatorRevision,/immutable generic revision metadata/);
assert.match(creatorRevision,/documentHash/);
const mapForge=fs.readFileSync('src/world/map-forge/map-forge-core.mjs','utf8');
assert.match(mapForge,/deterministic generator core/);
assert.match(mapForge,/serializeMapDefinition/);

const tuning=fs.readFileSync('src/systems/game-tuning-system.js','utf8');
assert.match(tuning,/serverPublishBoundary:true/);
assert.match(tuning,/NO tratar localStorage como autoridad de producción/);
const bugs=fs.readFileSync('src/core/bug-observability.mjs','utf8');
assert.match(bugs,/never mutate gameplay\/editor authority/);

const renderer=fs.readFileSync('src/environment/world-map.js','utf8');
assert.match(renderer,/online: N\/A; presentación local del mundo/,'renderer must not be promoted to world authority');

const byStatus=Object.fromEntries(bindings.bindings.map(row=>[row.systemId,row.status]));
assert.equal(byStatus['area-of-interest'],'integrated');
assert.equal(byStatus['creator-identity-reputation'],'integrated');
assert.equal(byStatus['creator-permissions'],'integrated');
assert.equal(byStatus['world-version-control'],'integrated');
assert.equal(byStatus['world-partition'],'foundation-active');
assert.equal(byStatus['persistent-world-state'],'foundation-active');
assert.equal(byStatus['world-event-ledger'],'foundation-active');
assert.equal(byStatus['mmo-trust-liveops-control-plane'],'foundation-active');

console.log(`MMORPG WAVE1 OWNER INTEGRATION AUDIT PASS bindings=${boundIds.length} integrated=${bindings.bindings.filter(x=>x.status==='integrated').length} foundation=${bindings.bindings.filter(x=>x.status==='foundation-active').length}`);
