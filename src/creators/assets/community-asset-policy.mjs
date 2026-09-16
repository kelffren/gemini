const MiB = 1024 * 1024;

export const COMMUNITY_ASSET_POLICY = Object.freeze({
  version: 1,
  autoPublishMimeTypes: new Set(['image/png', 'image/webp', 'image/jpeg']),
  manualReviewMimeTypes: new Set(['image/gif']),
  blockedMimeTypes: new Set(['image/svg+xml', 'text/html', 'application/javascript', 'text/javascript']),
  maxBytes: 8 * MiB,
  maxWidth: 4096,
  maxHeight: 4096,
  maxPixels: 16_777_216,
  maxNameLength: 80,
  maxTags: 8,
  maxTagLength: 24,
});

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

export function normalizeCommunityAssetMetadata(metadata = {}) {
  const name = cleanText(metadata.name || 'Untitled asset', COMMUNITY_ASSET_POLICY.maxNameLength);
  const type = cleanText(metadata.type || 'cosmetic', 32).toLowerCase();
  const tags = [...new Set((Array.isArray(metadata.tags) ? metadata.tags : [])
    .map(tag => cleanText(tag, COMMUNITY_ASSET_POLICY.maxTagLength).toLowerCase())
    .filter(Boolean))]
    .slice(0, COMMUNITY_ASSET_POLICY.maxTags);

  return {
    name,
    type,
    tags,
    description: cleanText(metadata.description, 280),
  };
}

async function sha256Hex(blob) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await globalThis.crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function readImageDimensions(blob) {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close?.();
    return dimensions;
  }

  if (typeof Image !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => reject(new Error('image_decode_failed'));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  return { width: null, height: null };
}

function finalStatus(reasons, needsReview) {
  if (reasons.some(reason => reason.severity === 'blocked')) return 'blocked';
  if (needsReview || reasons.some(reason => reason.severity === 'review')) return 'manual_review';
  return 'auto_publish';
}

/**
 * Fast UX gate only. The upload API MUST repeat MIME sniffing, size/dimension checks,
 * hash verification, rate limiting, ownership checks and malware/content controls.
 */
export async function validateCommunityAsset(file, metadata = {}) {
  const reasons = [];
  const mime = String(file?.type || '').toLowerCase();
  const bytes = Number(file?.size || 0);
  const normalizedMetadata = normalizeCommunityAssetMetadata(metadata);

  if (!(file instanceof Blob)) {
    return { status: 'blocked', reasons: [{ code: 'not_a_blob', severity: 'blocked' }], metadata: normalizedMetadata };
  }

  if (!bytes || bytes > COMMUNITY_ASSET_POLICY.maxBytes) {
    reasons.push({
      code: bytes ? 'file_too_large' : 'empty_file',
      severity: 'blocked',
      limit: COMMUNITY_ASSET_POLICY.maxBytes,
    });
  }

  let needsReview = false;
  if (COMMUNITY_ASSET_POLICY.blockedMimeTypes.has(mime)) {
    reasons.push({ code: 'active_content_not_allowed', severity: 'blocked', mime });
  } else if (COMMUNITY_ASSET_POLICY.manualReviewMimeTypes.has(mime)) {
    reasons.push({ code: 'animated_format_review', severity: 'review', mime });
    needsReview = true;
  } else if (!COMMUNITY_ASSET_POLICY.autoPublishMimeTypes.has(mime)) {
    reasons.push({ code: 'unsupported_mime', severity: 'blocked', mime });
  }

  let dimensions = { width: null, height: null };
  if (mime.startsWith('image/') && !COMMUNITY_ASSET_POLICY.blockedMimeTypes.has(mime) && bytes) {
    try {
      dimensions = await readImageDimensions(file);
      if (dimensions.width && dimensions.height) {
        const pixels = dimensions.width * dimensions.height;
        if (
          dimensions.width > COMMUNITY_ASSET_POLICY.maxWidth ||
          dimensions.height > COMMUNITY_ASSET_POLICY.maxHeight ||
          pixels > COMMUNITY_ASSET_POLICY.maxPixels
        ) {
          reasons.push({ code: 'dimensions_too_large', severity: 'blocked', ...dimensions, pixels });
        }
      } else {
        reasons.push({ code: 'dimensions_unverified', severity: 'review' });
        needsReview = true;
      }
    } catch {
      reasons.push({ code: 'image_decode_failed', severity: 'blocked' });
    }
  }

  const sha256 = await sha256Hex(file);
  if (!sha256) {
    reasons.push({ code: 'sha256_unavailable', severity: 'review' });
    needsReview = true;
  }

  return {
    status: finalStatus(reasons, needsReview),
    policyVersion: COMMUNITY_ASSET_POLICY.version,
    mime,
    bytes,
    dimensions,
    sha256,
    metadata: normalizedMetadata,
    reasons,
  };
}

export function buildCommunityManifest({ file, validation, remoteUrl, creatorId, assetId, version = 1 }) {
  if (!validation || validation.status !== 'auto_publish') {
    throw new Error('asset_not_approved_for_auto_publish');
  }
  if (!remoteUrl) throw new Error('remote_url_required');

  const id = assetId || `community-${validation.sha256.slice(0, 24)}`;
  return Object.freeze({
    schema: 'kelo.community-asset.v1',
    id,
    version,
    creatorId: String(creatorId || 'anonymous'),
    name: validation.metadata.name,
    type: validation.metadata.type,
    tags: validation.metadata.tags,
    mime: validation.mime || file.type,
    bytes: validation.bytes || file.size,
    width: validation.dimensions.width,
    height: validation.dimensions.height,
    sha256: validation.sha256,
    url: String(remoteUrl),
    licenseId: 'KELO-COMMUNITY',
    moderation: 'automatic',
    createdAt: new Date().toISOString(),
  });
}
