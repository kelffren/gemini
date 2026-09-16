import { DynamicAssetStreamManager } from './dynamic-asset-streaming.mjs';
import { guardianBadgeModel, resolveGuardianProvenance } from './community-guardian-provenance-runtime.mjs';

export const communityAssetStream = new DynamicAssetStreamManager();

function emit(name, detail) {
  if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    globalThis.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

async function resolveAssetProof(playerId, asset) {
  const proof = await resolveGuardianProvenance(asset?.manifest || {});
  const detail = Object.freeze({
    playerId,
    assetId: asset?.manifest?.id || null,
    key: asset?.key || null,
    proof,
    badge: guardianBadgeModel(proof),
  });
  emit('kelo:community-asset-provenance-ready', detail);
  return detail;
}

async function resolvePlayerProofs(playerId, assets) {
  const settled = await Promise.allSettled(assets.map(asset => resolveAssetProof(playerId, asset)));
  const proofs = settled
    .filter(entry => entry.status === 'fulfilled')
    .map(entry => entry.value);
  emit('kelo:community-player-provenance-ready', { playerId, proofs });
}

async function onPlayerAssets(event) {
  const detail = event?.detail || {};
  const playerId = detail.playerId;
  if (playerId == null) return;

  try {
    const assets = await communityAssetStream.syncPlayerAssets(
      playerId,
      Array.isArray(detail.assets) ? detail.assets : [],
      {
        visible: Boolean(detail.visible),
        distance: Number.isFinite(detail.distance) ? detail.distance : Infinity,
        profileOpen: Boolean(detail.profileOpen),
      },
    );

    // Rendering stays fast: verified provenance is resolved independently after bytes are ready.
    emit('kelo:community-player-assets-ready', { playerId, assets });
    void resolvePlayerProofs(playerId, assets);
  } catch (error) {
    emit('kelo:community-player-assets-error', {
      playerId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

if (typeof globalThis.addEventListener === 'function' && !globalThis.__KELO_COMMUNITY_ASSET_RUNTIME__) {
  globalThis.__KELO_COMMUNITY_ASSET_RUNTIME__ = true;
  globalThis.addEventListener('kelo:community-player-assets', onPlayerAssets);
  globalThis.addEventListener('kelo:community-player-left', event => {
    const playerId = event?.detail?.playerId;
    if (playerId != null) communityAssetStream.releasePlayer(playerId);
  });

  const garbageTimer = setInterval(() => communityAssetStream.collectGarbage().catch(() => {}), 5 * 60 * 1000);
  if (typeof garbageTimer?.unref === 'function') garbageTimer.unref();
  emit('kelo:community-asset-runtime-ready', { version: 2, guardianProvenance: 'server-authoritative' });
}
