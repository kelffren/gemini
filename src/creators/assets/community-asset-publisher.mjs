import { buildCommunityManifest, validateCommunityAsset } from './community-asset-policy.mjs';

export function getCommunityAssetTransport() {
  const transport = globalThis.KELO_COMMUNITY_ASSET_TRANSPORT;
  return transport && typeof transport === 'object' ? transport : null;
}

export async function prepareCommunityAsset(file, metadata = {}) {
  const validation = await validateCommunityAsset(file, metadata);
  return { file, validation, canAutoPublish: validation.status === 'auto_publish' };
}

/**
 * Transport contract:
 * uploadAsset({file, validation, creatorId}) -> {url, assetId?, version?}
 * publishManifest(manifest) -> optional persisted representation
 * queueForReview({file, validation, creatorId}) -> optional review ticket
 */
export async function publishCommunityAsset({ file, metadata = {}, creatorId = 'anonymous', transport = getCommunityAssetTransport() }) {
  const validation = await validateCommunityAsset(file, metadata);

  if (validation.status === 'blocked') {
    return { ok: false, status: 'blocked', validation };
  }

  if (validation.status === 'manual_review') {
    if (transport?.queueForReview) {
      const ticket = await transport.queueForReview({ file, validation, creatorId });
      return { ok: true, status: 'manual_review', validation, ticket };
    }
    return { ok: false, status: 'manual_review', reason: 'review_transport_not_configured', validation };
  }

  if (!transport?.uploadAsset || !transport?.publishManifest) {
    return {
      ok: false,
      status: 'backend_not_configured',
      reason: 'KELO_COMMUNITY_ASSET_TRANSPORT requires uploadAsset and publishManifest',
      validation,
    };
  }

  const uploaded = await transport.uploadAsset({ file, validation, creatorId });
  if (!uploaded?.url) throw new Error('community_asset_upload_missing_url');

  const manifest = buildCommunityManifest({
    file,
    validation,
    remoteUrl: uploaded.url,
    creatorId,
    assetId: uploaded.assetId,
    version: uploaded.version || 1,
  });

  const persisted = await transport.publishManifest(manifest);
  return { ok: true, status: 'published', validation, manifest, persisted: persisted ?? null };
}
