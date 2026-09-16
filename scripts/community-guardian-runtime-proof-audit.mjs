import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const sidecarPath = 'src/creators/assets/community-guardian-provenance-runtime.mjs';
const runtimePath = 'src/creators/assets/community-asset-runtime.mjs';
const serverManifestPath = 'server/avatar-sync-store.js';
const migrationPath = 'supabase/migrations/20260916080000_asset_guardian_publication_provenance.sql';

const sidecarSource = fs.readFileSync(sidecarPath, 'utf8');
const runtimeSource = fs.readFileSync(runtimePath, 'utf8');
const serverManifestSource = fs.readFileSync(serverManifestPath, 'utf8');
const migrationSource = fs.readFileSync(migrationPath, 'utf8').toLowerCase();

assert.match(sidecarSource, /from\('asset_guardian_provenance'\)/, 'sidecar must read the server-owned aggregate table');
assert.match(sidecarSource, /select\('revision_id,asset_hash,preset,contributor_count,guardian_verified_at'\)/, 'sidecar must request explicit public columns');
const manifestReads = [...sidecarSource.matchAll(/manifest\?\.([A-Za-z0-9_]+)/g)].map(match => match[1]);
assert.deepEqual([...new Set(manifestReads)].sort(), ['id', 'revisionId', 'sha256'], 'sidecar may read asset identity plus the two server binding fields only');
const bindingFunction = /function bindingFromManifest\(manifest = \{\}\) \{([\s\S]*?)\n\}/.exec(sidecarSource)?.[1] || '';
const authorityReads = [...bindingFunction.matchAll(/manifest\?\.([A-Za-z0-9_]+)/g)].map(match => match[1]);
assert.deepEqual([...new Set(authorityReads)].sort(), ['revisionId', 'sha256'], 'Guardian authority binding must use revisionId + sha256 only');
assert.match(sidecarSource, /kelo:community-player-assets-ready/, 'sidecar must subscribe after render-ready');
assert.match(sidecarSource, /kelo:community-asset-provenance-ready/, 'sidecar must emit per-asset proof');
assert.match(sidecarSource, /kelo:community-player-provenance-ready/, 'sidecar must emit per-player proof batch');
assert.match(runtimeSource, /community-guardian-provenance-runtime\.mjs\?v=1/, 'lazy community runtime must load the Guardian sidecar');
assert.match(runtimeSource, /emit\('kelo:community-player-assets-ready'/, 'render-ready event remains owned by community runtime');
assert.doesNotMatch(runtimeSource, /asset_guardian_provenance/, 'core streaming runtime must not query Guardian storage itself');
assert.match(serverManifestSource, /revisionId/, 'server community manifest must include immutable revisionId');
assert.match(serverManifestSource, /sha256/, 'server community manifest must include SHA-256');
assert.match(serverManifestSource, /communityClientUrlTrusted:false/, 'community client URL must remain untrusted');
assert.match(migrationSource, /revoke all on public\.asset_guardian_provenance from anon, authenticated;/, 'clients must not write provenance');
assert.match(migrationSource, /grant select on public\.asset_guardian_provenance to anon, authenticated;/, 'clients may only read published aggregate proof');

const mod = await import(pathToFileURL(sidecarPath).href + `?audit=${Date.now()}`);
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
  return { state, from(table) { state.table = table; return chain; } };
}

const forgedClient = fakeClient();
const forged = await mod.resolveGuardianProvenance({
  id: 'forged',
  sha256: hash,
  guardianVerified: true,
  guardianProvenance: { contributorCount: 999 },
}, { client: forgedClient, force: true });
assert.equal(forged.verified, false, 'forged client badge without revision binding must fail closed');
assert.equal(forged.status, 'missing-server-binding');
assert.equal(mod.guardianBadgeModel(forged).visible, false);

const validRow = {
  revision_id: revisionId,
  asset_hash: hash,
  preset: 'aura-field-v1',
  contributor_count: 2,
  guardian_verified_at: '2026-09-16T07:00:00.000Z',
};
const validClient = fakeClient({ row: validRow });
const verified = await mod.resolveGuardianProvenance(baseManifest, { client: validClient, force: true });
assert.equal(verified.verified, true);
assert.equal(verified.statement, 'Built with 2 Kelo Guardians');
assert.equal(mod.guardianBadgeModel(verified).visible, true);
assert.equal(validClient.state.table, 'asset_guardian_provenance');
assert.equal(validClient.state.filters.revision_id, revisionId);
assert.equal(validClient.state.filters.asset_hash, hash);
assert.equal(validClient.state.columns, 'revision_id,asset_hash,preset,contributor_count,guardian_verified_at');

const mismatch = await mod.resolveGuardianProvenance(baseManifest, {
  client: fakeClient({ row: { ...validRow, asset_hash: 'b'.repeat(64) } }),
  force: true,
});
assert.equal(mismatch.verified, false);
assert.equal(mismatch.status, 'invalid-server-proof');

const lowQuorum = await mod.resolveGuardianProvenance(baseManifest, {
  client: fakeClient({ row: { ...validRow, contributor_count: 1 } }),
  force: true,
});
assert.equal(lowQuorum.verified, false, 'malformed low-quorum proof must fail closed even if DB constraints are bypassed');

const noProof = await mod.resolveGuardianProvenance(baseManifest, { client: fakeClient(), force: true });
assert.equal(noProof.verified, false);
assert.equal(noProof.status, 'no-server-proof');

const queryFailure = await mod.resolveGuardianProvenance(baseManifest, {
  client: fakeClient({ error: { code: '42501' } }),
  force: true,
});
assert.equal(queryFailure.verified, false);
assert.equal(queryFailure.status, 'proof-query-error');

console.log('COMMUNITY_GUARDIAN_RUNTIME_SIDECAR_OK');
