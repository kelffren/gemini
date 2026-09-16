/* KELO-INDEX
 * area: QA / GUARDIAN COMMUNITY LIVE
 * purpose: bloquea regresiones de seguridad del harness live antes de ejecutarlo contra Supabase
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const smoke=fs.readFileSync(path.join(root,'scripts/guardian-community-live-smoke.mjs'),'utf8');
const workflow=fs.readFileSync(path.join(root,'.github/workflows/guardian-community-live-verification.yml'),'utf8');

assert.match(smoke,/\/auth\/v1\/token\?grant_type=password/);
assert.match(smoke,/\/rest\/v1\/rpc\//);
assert.match(smoke,/SUPABASE_PUBLISHABLE_KEY/);
assert.match(smoke,/KELO_GUARDIAN_TEST_ADMIN_EMAIL/);
assert.match(smoke,/KELO_GUARDIAN_TEST_DONOR_EMAIL/);
assert.match(smoke,/guardian_community_profile/);
assert.match(smoke,/guardian_enable/);
assert.match(smoke,/guardian_master_start/);
assert.match(smoke,/guardian_community_attest/);
assert.match(smoke,/guardian_community_asset_status/);
assert.match(smoke,/guardian_disable/);
assert.match(smoke,/TEST_ACCOUNTS_MUST_BE_DISTINCT/);
assert.match(smoke,/REPLAY_MUST_NOT_DOUBLE_CREDIT/);
assert.match(smoke,/CROSS_DEVICE_PROFILE_RECOVERY_FAILED/);
assert.doesNotMatch(smoke,/SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|sb_secret_/i);
assert.doesNotMatch(workflow,/service[_-]?role|sb_secret_|SUPABASE_SECRET/i);
assert.match(workflow,/workflow_dispatch:/);
assert.doesNotMatch(workflow,/\npush:|\npull_request:|\nschedule:/);
assert.match(workflow,/SUPABASE_PUBLISHABLE_KEY: \$\{\{ secrets\.SUPABASE_PUBLISHABLE_KEY \}\}/);
assert.match(workflow,/KELO_GUARDIAN_TEST_ADMIN_PASSWORD: \$\{\{ secrets\.KELO_GUARDIAN_TEST_ADMIN_PASSWORD \}\}/);
assert.match(workflow,/KELO_GUARDIAN_TEST_DONOR_PASSWORD: \$\{\{ secrets\.KELO_GUARDIAN_TEST_DONOR_PASSWORD \}\}/);
assert.match(workflow,/node scripts\/guardian-community-live-smoke\.mjs/);

console.log('GUARDIAN_COMMUNITY_LIVE_HARNESS_AUDIT_OK',{
  manualOnly:true,
  publishableKeyOnly:true,
  twoDistinctAuthenticatedAccounts:true,
  noServiceRole:true,
  cleanupEphemeralNodes:true
});
