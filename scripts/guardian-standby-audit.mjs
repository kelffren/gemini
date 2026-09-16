/* KELO-INDEX
 * area: QA / GUARDIAN STANDBY
 * keys: GUARDIAN STANDBY SERVER SELECTED CLAIM PRIVACY FENCING EPOCH RPC HOT MIRROR
 * purpose: bloquea regresiones que permitan autoselección, fallback HTTP privilegiado o filtración global de la identidad standby
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

const authority=read('src/systems/guardian-authority.js');
const guardian=read('src/systems/guardian-system.js');
const mirror=read('src/systems/guardian-hot-mirror.js');
const assignment=read('supabase/migrations/20260916081157_guardian_standby_assignment_v1.sql');
const privacy=read('supabase/migrations/20260916081739_guardian_standby_response_privacy_v1.sql');

// Client may invoke only the narrow Supabase RPC. There is deliberately no HTTP
// fallback until the fallback server has an equivalent server-selected assignment contract.
assert.match(authority,/claimStandby:payload=>guarded\(\(\)=>rpc\('guardian_master_claim_standby'/);
assert.match(authority,/standbyClaimRpc:true/);
assert.match(authority,/standbyClaimHttpFallback:false/);
assert.doesNotMatch(authority,/preferRpc\('guardian_master_claim_standby'/);

// Guardian exposes assignment state but cannot manufacture it locally.
assert.match(guardian,/standbyAssigned:standby\?\.mine===true/);
assert.match(guardian,/async function claimStandbyHost\(\)/);
assert.match(guardian,/GUARDIAN_STANDBY_NOT_ASSIGNED/);
assert.match(guardian,/KeloGuardianAuthority\.claimStandby/);
assert.match(guardian,/serverSelectedStandby:true/);
assert.match(guardian,/standbySelfAssignment:false/);
assert.doesNotMatch(guardian,/standbyAssigned\s*=\s*true/);

// Hot Mirror uses the server-selected route for ordinary donors and preserves the
// permanent-permission route only for existing authorized/admin hosts.
assert.match(mirror,/g\.standbyAssigned===true/);
assert.match(mirror,/KeloGuardian\.claimStandbyHost/);
assert.match(mirror,/claimMode:useAssignedStandby\?'server-standby':'permanent-permission'/);
assert.match(mirror,/permanentMasterPermissionRequired:false/);
assert.match(mirror,/serverSelectedStandby:true/);
assert.doesNotMatch(mirror,/setInterval\s*\(/);

// Server assignment is singleton, short-lived, epoch-bound and selected from fresh
// visible host-ready nodes. Direct table access remains unavailable to clients.
assert.match(assignment,/create table if not exists public\.guardian_master_standby/);
assert.match(assignment,/assignment_epoch bigint not null default 0/);
assert.match(assignment,/master_epoch bigint not null default 0/);
assert.match(assignment,/guardian_refresh_standby/);
assert.match(assignment,/recommended_roles@>array\['host-ready'\]/);
assert.match(assignment,/last_heartbeat_at>now\(\)-interval '45 seconds'/);
assert.match(assignment,/expires_at=now\(\)\+interval '90 seconds'/);
assert.match(assignment,/guardian_master_claim_standby/);
assert.match(assignment,/GUARDIAN_STANDBY_NOT_ASSIGNED/);
assert.match(assignment,/v_standby\.master_epoch<>v_lease\.epoch/);
assert.match(assignment,/epoch=epoch\+1/);
assert.match(assignment,/revoke all on public\.guardian_master_standby from public,anon,authenticated/);
assert.match(assignment,/revoke all on function public\.guardian_master_claim_standby\(text\) from public,anon/);
assert.match(assignment,/grant execute on function public\.guardian_master_claim_standby\(text\) to authenticated,service_role/);
assert.doesNotMatch(assignment,/grant\s+(?:select|insert|update|delete).*guardian_master_standby.*authenticated/i);

// Other donors may know a standby exists, but only the selected node and current
// Master receive its node ID/details. This reduces targeting/fingerprinting surface.
assert.match(privacy,/guardian-supabase-v4-standby-private/);
assert.match(privacy,/v_standby\.user_id=p_uid and v_standby\.node_id=p_node_id/);
assert.match(privacy,/v_lease\.user_id=p_uid and v_lease\.node_id=p_node_id/);
assert.match(privacy,/'standbyActive',v_standby_active/);
assert.doesNotMatch(privacy,/'standbyNodeId'/);

console.log('GUARDIAN_STANDBY_AUDIT_OK',{
  serverSelected:true,
  assignmentLease:true,
  monotonicMasterEpoch:true,
  selfAssignment:false,
  rpcOnlyClaim:true,
  httpFallback:false,
  standbyIdentityScoped:true,
  economicAuthority:false
});
