import './community-guardian-provenance-runtime.mjs?v=1';
import { DynamicAssetStreamManager } from './dynamic-asset-streaming.mjs';

export const communityAssetStream = new DynamicAssetStreamManager();

function emit(name, detail) {
  if (typeof globalThis.dispatchEvent === 'function' && typeof CustomEvent !== 'undefined') {
    globalThis.dispatchEvent(new CustomEvent(name, { detail }));
  }
}

function playerRecord(playerId) {
  const id = String(playerId);
  const net = globalThis.keloNet;
  if (net?.id === id && typeof globalThis.localPlayer === 'object') return globalThis.localPlayer;
  return net?.peers?.[id] || null;
}

function attachResult({ playerId, assets = [], errors = [], generation = 0 }) {
  const player = playerRecord(playerId);
  if (player) {
    player.communityAssetEntries = assets;
    player.communityAssetErrors = errors;
    player.communityAssetGeneration = generation;
    player.communityAssetState = errors.length ? (assets.length ? 'partial' : 'fallback') : 'ready';
  }
  emit('kelo:community-player-assets-ready', { playerId, assets, errors, generation });
  if (errors.length) {
    emit('kelo:community-player-assets-error', {
      playerId,
      recoverable: true,
      fallback: 'base-avatar',
      errors,
    });
  }
}

async function onPlayerAssets(event) {
  const detail = event?.detail || {};
  const playerId = detail.playerId;
  if (playerId == null) return;

  try {
    await communityAssetStream.syncPlayerAssets(
      playerId,
      Array.isArray(detail.assets) ? detail.assets : [],
      {
        visible: Boolean(detail.visible),
        distance: Number.isFinite(detail.distance) ? detail.distance : Infinity,
        profileOpen: Boolean(detail.profileOpen),
      },
    );
  } catch (error) {
    const player = playerRecord(playerId);
    if (player) {
      player.communityAssetEntries = [];
      player.communityAssetState = 'fallback';
    }
    emit('kelo:community-player-assets-error', {
      playerId,
      recoverable: true,
      fallback: 'base-avatar',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

if (typeof globalThis.addEventListener === 'function' && !globalThis.__KELO_COMMUNITY_ASSET_RUNTIME__) {
  globalThis.__KELO_COMMUNITY_ASSET_RUNTIME__ = Object.freeze({ version: 3, stream: communityAssetStream, guardianProvenance: 'sidecar' });
  globalThis.addEventListener('kelo:community-player-assets', onPlayerAssets);
  globalThis.addEventListener('kelo:community-player-left', event => {
    const playerId = event?.detail?.playerId;
    if (playerId == null) return;
    communityAssetStream.releasePlayer(playerId);
    const player = playerRecord(playerId);
    if (player) {
      player.communityAssetEntries = [];
      player.communityAssetState = 'released';
    }
  });
  communityAssetStream.addEventListener('player-assets-ready', event => attachResult(event.detail || {}));

  const garbageTimer = setInterval(() => communityAssetStream.collectGarbage().catch(() => {}), 5 * 60 * 1000);
  if (typeof garbageTimer?.unref === 'function') garbageTimer.unref();
  emit('kelo:community-asset-runtime-ready', { version: 3, fallback: 'base-avatar', guardianProvenance: 'sidecar' });
}
