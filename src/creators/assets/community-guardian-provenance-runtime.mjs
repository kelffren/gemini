/* KELO-INDEX
 * area: CREATORS / COMMUNITY ASSETS / GUARDIAN PROVENANCE
 * owner: Kelo Community Asset Pipeline
 * purpose: resolve public Guardian proof from server-owned Supabase truth without trusting manifest claims
 * trust: manifest guardianVerified/guardianProvenance are hints only and are NEVER authoritative
 * online: reuses KeloOnlineAuth Supabase client and RLS; no second client/transport
 */

const VERSION = 'kelo-community-guardian-runtime-proof-v1';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const PRESETS = new Set(['material-noise-v1', 'aura-field-v1', 'terrain-speckle-v1']);
const proofCache = new Map();

function freeze(value) {
  return Object.freeze(value);
}

function bindingFromManifest(manifest = {}) {
  const revisionId = String(manifest?.revisionId || '').trim().toLowerCase();
  const assetHash = String(manifest?.sha256 || '').trim().toLowerCase();
  return {
    revisionId: UUID_RE.test(revisionId) ? revisionId : null,
    assetHash: SHA256_RE.test(assetHash) ? assetHash : null,
  };
}

function clientFromRuntime() {
  try {
    return globalThis.KeloOnlineAuth?.getClient?.() || null;
  } catch {
    return null;
  }
}

function result(status, binding, extra = {}) {
  return freeze({
    version: VERSION,
    verified: false,
    status,
    revisionId: binding?.revisionId || null,
    assetHash: binding?.assetHash || null,
    source: null,
    communityBuilt: false,
    preset: null,
    contributorCount: 0,
    verifiedAt: null,
    statement: null,
    ...extra,
  });
}

function normalizeVerifiedRow(row, binding) {
  const revisionId = String(row?.revision_id || '').toLowerCase();
  const assetHash = String(row?.asset_hash || '').toLowerCase();
  const preset = String(row?.preset || '');
  const contributorCount = Number(row?.contributor_count || 0);
  const verifiedAt = String(row?.guardian_verified_at || '');

  if (revisionId !== binding.revisionId || assetHash !== binding.assetHash) return null;
  if (!PRESETS.has(preset) || !Number.isInteger(contributorCount) || contributorCount < 2) return null;
  if (!verifiedAt || Number.isNaN(Date.parse(verifiedAt))) return null;

  return freeze({
    version: VERSION,
    verified: true,
    status: 'verified',
    revisionId,
    assetHash,
    source: 'guardian-community-supabase-v1',
    communityBuilt: true,
    preset,
    contributorCount,
    verifiedAt,
    statement: `Built with ${contributorCount} Kelo Guardians`,
  });
}

export function guardianBadgeModel(proof) {
  if (proof?.verified !== true) return freeze({ visible: false, label: '', detail: '' });
  return freeze({
    visible: true,
    label: 'Guardian Verified',
    detail: proof.statement || `Built with ${Number(proof.contributorCount) || 0} Kelo Guardians`,
  });
}

/**
 * Resolve Guardian provenance from the public, RLS-protected aggregate table.
 * Any Guardian-looking fields embedded in the manifest are deliberately ignored.
 */
export async function resolveGuardianProvenance(
  manifest,
  { client = clientFromRuntime(), cacheTtlMs = DEFAULT_CACHE_TTL_MS, force = false } = {},
) {
  const binding = bindingFromManifest(manifest);
  if (!binding.revisionId || !binding.assetHash) return result('missing-server-binding', binding);

  const cacheKey = `${binding.revisionId}:${binding.assetHash}`;
  const cached = proofCache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;

  if (!client || typeof client.from !== 'function') return result('backend-unavailable', binding);

  try {
    const query = await client
      .from('asset_guardian_provenance')
      .select('revision_id,asset_hash,preset,contributor_count,guardian_verified_at')
      .eq('revision_id', binding.revisionId)
      .eq('asset_hash', binding.assetHash)
      .maybeSingle();

    if (query?.error) {
      const value = result('proof-query-error', binding, { errorCode: String(query.error.code || 'UNKNOWN') });
      proofCache.set(cacheKey, { value, expiresAt: Date.now() + Math.min(cacheTtlMs, 30_000) });
      return value;
    }

    const verified = query?.data ? normalizeVerifiedRow(query.data, binding) : null;
    const value = verified || result(query?.data ? 'invalid-server-proof' : 'no-server-proof', binding);
    proofCache.set(cacheKey, { value, expiresAt: Date.now() + Math.max(1_000, Number(cacheTtlMs) || DEFAULT_CACHE_TTL_MS) });
    return value;
  } catch {
    return result('proof-query-failed', binding);
  }
}

export function clearGuardianProvenanceCache() {
  proofCache.clear();
}

export { VERSION as COMMUNITY_GUARDIAN_RUNTIME_PROOF_VERSION };
