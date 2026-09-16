/* KELO-INDEX
 * area: CREATORS / COMMUNITY ASSETS / GUARDIAN PROVENANCE
 * owner: Kelo Community Asset Pipeline
 * purpose: verify public Guardian aggregate proof after community asset bytes are render-ready
 * trust: server avatar manifest revisionId + sha256 bind the query; client Guardian claims are ignored
 * online: reuses KeloOnlineAuth Supabase client + RLS; never blocks asset rendering
 */

const VERSION = 'kelo-community-guardian-runtime-sidecar-v1';
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const ERROR_CACHE_TTL_MS = 30 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_RE = /^[0-9a-f]{64}$/i;
const PRESETS = new Set(['material-noise-v1', 'aura-field-v1', 'terrain-speckle-v1']);
const proofCache = new Map();
const playerProofKeys = new Map();

function frozen(value) { return Object.freeze(value); }

function emit(name, detail) {
  if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    globalThis.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

function playerRecord(playerId) {
  const id = String(playerId ?? '');
  const net = globalThis.keloNet;
  if (net?.id === id && typeof globalThis.localPlayer === 'object') return globalThis.localPlayer;
  return net?.peers?.[id] || null;
}

function bindingFromManifest(manifest = {}) {
  const revisionId = String(manifest?.revisionId || '').trim().toLowerCase();
  const assetHash = String(manifest?.sha256 || '').trim().toLowerCase();
  return frozen({
    revisionId: UUID_RE.test(revisionId) ? revisionId : null,
    assetHash: SHA256_RE.test(assetHash) ? assetHash : null,
  });
}

function clientFromRuntime() {
  try { return globalThis.KeloOnlineAuth?.getClient?.() || null; }
  catch { return null; }
}

function unverified(status, binding, extra = {}) {
  return frozen({
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

  return frozen({
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
  if (proof?.verified !== true) return frozen({ visible: false, label: '', detail: '' });
  return frozen({
    visible: true,
    label: 'Guardian Verified',
    detail: proof.statement || `Built with ${Number(proof.contributorCount) || 0} Kelo Guardians`,
  });
}

/**
 * Server-owned truth only. `manifest.guardianVerified`, `manifest.guardianProvenance`,
 * contributor tokens and client statements are intentionally never read.
 */
export async function resolveGuardianProvenance(
  manifest,
  { client = clientFromRuntime(), cacheTtlMs = DEFAULT_CACHE_TTL_MS, force = false } = {},
) {
  const binding = bindingFromManifest(manifest);
  if (!binding.revisionId || !binding.assetHash) return unverified('missing-server-binding', binding);

  const cacheKey = `${binding.revisionId}:${binding.assetHash}`;
  const cached = proofCache.get(cacheKey);
  if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
  if (!client || typeof client.from !== 'function') return unverified('backend-unavailable', binding);

  try {
    const query = await client
      .from('asset_guardian_provenance')
      .select('revision_id,asset_hash,preset,contributor_count,guardian_verified_at')
      .eq('revision_id', binding.revisionId)
      .eq('asset_hash', binding.assetHash)
      .maybeSingle();

    if (query?.error) {
      const value = unverified('proof-query-error', binding, { errorCode: String(query.error.code || 'UNKNOWN') });
      proofCache.set(cacheKey, { value, expiresAt: Date.now() + ERROR_CACHE_TTL_MS });
      return value;
    }

    const verified = query?.data ? normalizeVerifiedRow(query.data, binding) : null;
    const value = verified || unverified(query?.data ? 'invalid-server-proof' : 'no-server-proof', binding);
    proofCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + Math.max(1_000, Number(cacheTtlMs) || DEFAULT_CACHE_TTL_MS),
    });
    return value;
  } catch {
    return unverified('proof-query-failed', binding);
  }
}

export function clearGuardianProvenanceCache() { proofCache.clear(); }

async function resolveAssetProof(playerId, asset) {
  const manifest = asset?.manifest || {};
  const proof = await resolveGuardianProvenance(manifest);
  const detail = frozen({
    playerId: String(playerId),
    assetId: manifest?.id || null,
    key: asset?.key || null,
    proof,
    badge: guardianBadgeModel(proof),
  });
  emit('kelo:community-asset-provenance-ready', detail);
  return detail;
}

async function onAssetsReady(event) {
  const detail = event?.detail || {};
  const playerId = detail.playerId;
  if (playerId == null) return;
  const assets = Array.isArray(detail.assets) ? detail.assets : [];
  const generation = Number(detail.generation) || 0;
  const settled = await Promise.allSettled(assets.map(asset => resolveAssetProof(playerId, asset)));
  const proofs = settled.filter(entry => entry.status === 'fulfilled').map(entry => entry.value);

  // Discard stale async results when a newer equipment generation has already landed.
  const latestGeneration = playerProofKeys.get(String(playerId));
  if (latestGeneration != null && generation < latestGeneration) return;
  playerProofKeys.set(String(playerId), generation);

  const player = playerRecord(playerId);
  if (player) {
    player.communityGuardianProofs = proofs;
    player.communityGuardianVerifiedCount = proofs.filter(entry => entry.proof?.verified === true).length;
  }
  emit('kelo:community-player-provenance-ready', frozen({ playerId: String(playerId), generation, proofs }));
}

function onPlayerLeft(event) {
  const playerId = event?.detail?.playerId;
  if (playerId == null) return;
  playerProofKeys.delete(String(playerId));
  const player = playerRecord(playerId);
  if (player) {
    player.communityGuardianProofs = [];
    player.communityGuardianVerifiedCount = 0;
  }
}

if (typeof globalThis.addEventListener === 'function' && !globalThis.__KELO_COMMUNITY_GUARDIAN_PROVENANCE__) {
  globalThis.__KELO_COMMUNITY_GUARDIAN_PROVENANCE__ = frozen({
    version: VERSION,
    resolveGuardianProvenance,
    guardianBadgeModel,
    clearCache: clearGuardianProvenanceCache,
  });
  globalThis.addEventListener('kelo:community-player-assets-ready', onAssetsReady);
  globalThis.addEventListener('kelo:community-player-left', onPlayerLeft);
  emit('kelo:community-guardian-provenance-runtime-ready', { version: VERSION, serverAuthoritative: true });
}

export { VERSION as COMMUNITY_GUARDIAN_RUNTIME_PROOF_VERSION };
