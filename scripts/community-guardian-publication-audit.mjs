/* KELO-INDEX
 * area: QA / COMMUNITY ASSET GUARDIAN PROVENANCE
 * purpose: fail closed if creator publication can mint or spoof Guardian verification
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const migration=fs.readFileSync(path.join(root,'supabase/migrations/20260916080000_asset_guardian_publication_provenance.sql'),'utf8');
const edge=fs.readFileSync(path.join(root,'supabase/functions/kelo-community-asset-publish/index.ts'),'utf8');

// Public proof is a server-owned aggregate, readable only for active publications.
assert.match(migration,/create table if not exists public\.asset_guardian_provenance/i);
assert.match(migration,/alter table public\.asset_guardian_provenance enable row level security/i);
assert.match(migration,/revoke all on public\.asset_guardian_provenance from anon, authenticated/i);
assert.match(migration,/grant select on public\.asset_guardian_provenance to anon, authenticated/i);
assert.match(migration,/p\.revision_id = asset_guardian_provenance\.revision_id[\s\S]*p\.is_active = true/i);

// Only the service role may bridge private Guardian quorum into public provenance.
assert.match(migration,/create or replace function public\.record_asset_guardian_provenance/i);
assert.match(migration,/security definer[\s\S]*set search_path\s*=\s*''/i);
assert.match(migration,/revoke all on function public\.record_asset_guardian_provenance\(uuid,text\) from public, anon, authenticated/i);
assert.match(migration,/grant execute on function public\.record_asset_guardian_provenance\(uuid,text\) to service_role/i);
assert.match(migration,/from kelo_private\.guardian_community_assets/i);
assert.match(migration,/lower\(v_revision\.content_hash\) <> v_hash/i);
assert.match(migration,/v_guardian\.contributor_count < 2/i);
assert.doesNotMatch(migration,/anonymousContributorTokens|node_id/i,'public provenance must not persist Guardian identity tokens or node IDs');

// Edge computes the content hash itself and requests proof only with server credentials.
assert.match(edge,/const hash=await sha256Hex\(bytes\)/);
assert.match(edge,/rpc\('record_asset_guardian_provenance',\{p_revision_id:revisionId,p_asset_hash:assetHash\},adminHeaders\(\)\)/);
assert.match(edge,/guardianVerified:guardian\.verified/);
assert.match(edge,/serverStructuralVerified:true/);
assert.match(edge,/publishing without Guardian badge/);
assert.doesNotMatch(edge,/form\.get\(['"]guardian/i,'client form fields must never supply Guardian proof');
assert.doesNotMatch(edge,/p_metadata:\{[^}]*guardianVerified/i,'creator-writeable revision metadata must not contain authoritative Guardian flags');
assert.doesNotMatch(edge,/p_metadata:\{[^}]*serverStructuralVerified/i,'creator-writeable revision metadata must not contain authoritative server verification flags');
assert.doesNotMatch(edge,/serverVerified:true/,'ambiguous legacy serverVerified flag is forbidden');

console.log('COMMUNITY_GUARDIAN_PUBLICATION_AUDIT_OK',{
  guardianAuthority:'server-owned-provenance',
  clientCanMintBadge:false,
  revisionHashBound:true,
  quorumSource:'kelo_private.guardian_community_assets',
  publicIdentityLeak:false,
  structuralVerificationSeparated:true,
  failClosedBadge:true
});
