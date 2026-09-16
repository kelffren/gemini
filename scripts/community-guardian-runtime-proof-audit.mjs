import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const proofPath = 'src/creators/assets/community-guardian-provenance-runtime.mjs';
const runtimePath = 'src/creators/assets/community-asset-runtime.mjs';
const policyPath = 'src/creators/assets/community-asset-policy.mjs';
const publisherPath = 'src/creators/assets/community-asset-publisher.mjs';
const migrationPath = 'supabase/migrations/20260916080000_asset_guardian_publication_provenance.sql';

const proofSource = fs.readFileSync(proofPath, 'utf8');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const policySource = fs.readFileSync(policyPath, 'utf8');
const publisherSource = fs.readFileSync(publisherPath, 'utf8');
const migrationSource = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

assert.match(proofSource, /from\('asset_guardian_provenance'\)/, 'runtime proof must read the server-owned aggregate table');
assert.match(proofSource, /select\('revision_id,asset_hash,preset,contributor_count,guardian_verified_at'\)/, 'runtime proof must select explicit public columns');
assert.doesNotMatch(proofSource, /manifest\.guardianVerified/, 'runtime must not trust manifest guardianVerified');
assert.doesNotMatch(proofSource, /manifest\.guardianProvenance/, 'runtime must not trust manifest guardianProvenance');
assert.match(proofSource, /revisionId.*assetHash|assetHash.*revisionId/s, 'runtime proof must bind immutable revision and hash');
assert.match(policySource, /revisionId: immutableRevisionId/, 'community manifest must carry immutable revision id');
assert.match(publisherSource, /revisionId: uploaded\.revisionId/, 'publisher must propagate server revision id');
assert.match(runtimeSource, /kelo:community-player-assets-ready/, 'render-ready event must remain available');
assert.match(runtimeSource, /kelo:community-asset-provenance-ready/, 'runtime must emit per-asset provenance result');
assert.ok(
  runtimeSource.indexOf("emit('kelo:community-player-assets-ready'") < runtimeSource.indexOf('void resolvePlayerProofs'),
  'render readiness must not wait for provenance network lookup',
);
assert.match(migrationSource, /revoke all on public\.asset_guardian_provenance from anon, authenticated;/, 'client writes must be revoked');
assert.match(migrationSource, /grant select on public\.asset_guardian_provenance to anon, authenticated;/, 'client may only read published aggregate proof');

const mod = await import(pathToFileURL(proofPath).href + `?audit=${Date.now()}`);
const revisionId = '11111111-1111-4111-8111-111111111111';
const hash = 'a'.repeat(64);
const baseManifest = { id: 'community-a', revisionId, sha256: hash };

function fakeClient({ row = null, error = null } = {}) {
  const state = { table: null, columns: null, filters: {} };
  const chain = {
    select(columns) { state.columns = columns; return chain; },
    eq(key, value) { state.filters[key] = value; return chain; },
    async maybeSingle() { return { data: row, error }; },
  };
  return {
    state,
    from(table) { state.table = table; return chain; },
  };
}

const forged = await mod.resolveGuardianProvenance({
  id: 'forged',
  sha256: hash,
  guardianVerified: true,
  guardianProvenance: { contributorCount: 999 },
}, { client: fakeClient().from ? fakeClient() : null, force: true });
assert.equal(forged.verified, false, 'forged client badge must not verify without immutable revision binding');
assert.equal(mod.guardianBadgeModel(forged).visible, false, 'unverified proof must never render a badge');

const validRow = {
  revision_id: revisionId,
  asset_hash: hash,
  preset: 'aura-field-v1',
  contributor_count: 2,
  guardian_verified_at: '2026-09-16T07:00:00.000Z',
};
const validClient = fakeClient({ row: validRow });
const verified = await mod.resolveGuardianProvenance(baseManifest, { client: validClient, force: true });
assert.equal(verified.verified, true, 'matching server row should verify');
assert.equal(verified.statement, 'Built with 2 Kelo Guardians');
assert.equal(mod.guardianBadgeModel(verified).visible, true, 'verified proof should expose badge model');
assert.equal(validClient.state.table, 'asset_guardian_provenance');
assert.equal(validClient.state.filters.revision_id, revisionId);
assert.equal(validClient.state.filters.asset_hash, hash);
assert.equal(validClient.state.columns, 'revision_id,asset_hash,preset,contributor_count,guardian_verified_at');

const mismatched = await mod.resolveGuardianProvenance(baseManifest, {
  client: fakeClient({ row: { ...validRow, asset_hash: 'b'.repeat(64) } }),
  force: true,
});
assert.equal(mismatched.verified, false, 'mismatched hash must fail closed');
assert.equal(mismatched.status, 'invalid-server-proof');

const lowQuorum = await mod.resolveGuardianProvenance(baseManifest, {
  client: fakeClient({ row: { ...validRow, contributor_count: 1 } }),
  force: true,
});
assert.equal(lowQuorum.verified, false, 'runtime must reject malformed low-quorum rows even if database constraints are bypassed');

const noProof = await mod.resolveGuardianProvenance(baseManifest, { client: fakeClient(), force: true });
assert.equal(noProof.verified, false);
assert.equal(noProof.status, 'no-server-proof');

const queryFailure = await mod.resolveGuardianProvenance(baseManifest, {
  client: fakeClient({ error: { code: '42501' } }),
  force: true,
});
assert.equal(queryFailure.verified, false, 'RLS/query failures must fail closed');
assert.equal(queryFailure.status, 'proof-query-error');

console.log('COMMUNITY_GUARDIAN_RUNTIME_PROOF_OK');
