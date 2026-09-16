/* KELO-INDEX
 * area: CREATORS / ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG ADAPTIVE PALETTE QUALITY AGENT SHARP PIXEL ART ICC METADATA PROFILE
 * purpose: search near-lossless PNG palette candidates using an asset-specific quality policy and retain only approved candidates
 * public-api: optimizePngAdaptive()
 * state-owned: none
 * online: N/A; creator/build-time capability only
 * consumes: png-space-optimizer.mjs, png-quality-agent.mjs, asset-image-profiler.mjs, optional sharp dependency
 * do-not: resize, resample, change dimensions, silently alter alpha/color metadata, or bypass quality gates
 */

import {decodePngRgba, optimizePngLossless} from './png-space-optimizer.mjs';
import {evaluatePixelFidelity, judgePixelFidelity} from './png-quality-agent.mjs';
import {profileAssetImage} from './asset-image-profiler.mjs';

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    const error = new Error('PNG_SPACE_ADAPTIVE_REQUIRES_SHARP');
    error.hint = 'Install sharp (tested target: 0.35.x) or use strict lossless mode.';
    throw error;
  }
}

function searchProfiles(assetProfile) {
  const unique = assetProfile?.metrics?.uniqueColors || 4097;
  const targets = unique <= 32
    ? [32, 24, 16]
    : unique <= 64
      ? [64, 48, 40, 32]
      : unique <= 128
        ? [128, 112, 96, 80, 64]
        : [256, 224, 192, 160, 128, 112, 96, 80, 64, 48, 32];
  return targets.map(colours => ({colours, dither:0}));
}

async function decodeWithSharp(sharp, buffer) {
  const {data, info} = await sharp(buffer, {animated:false})
    .ensureAlpha()
    .raw()
    .toBuffer({resolveWithObject:true});
  return {rgba:data, width:info.width, height:info.height};
}

export async function optimizePngAdaptive(buffer, options = {}) {
  const strict = optimizePngLossless(buffer, options.losslessOptions);
  const sourcePng = decodePngRgba(buffer);
  const sharp = await loadSharp();
  const originalVisual = await decodeWithSharp(sharp, buffer);
  const assetProfile = options.assetProfile || profileAssetImage(
    originalVisual.rgba,
    originalVisual.width,
    originalVisual.height,
    {sourceName:options.sourceName || ''}
  );
  const profiles = options.profiles || searchProfiles(assetProfile);
  const qualityPolicy = options.qualityPolicy || assetProfile.adaptivePolicy || 'balanced';
  const qualityLimits = options.qualityLimits || {};
  const candidates = [];

  for (const profile of profiles) {
    let generated;
    try {
      generated = await sharp(buffer, {animated:false})
        .keepMetadata()
        .png({
          palette:true,
          colours:profile.colours,
          dither:profile.dither,
          effort:10,
          compressionLevel:9,
          adaptiveFiltering:true
        })
        .toBuffer();
    } catch (error) {
      candidates.push({
        label:`sharp-palette:${profile.colours}:dither-${profile.dither}`,
        bytes:null,
        pass:false,
        score:0,
        reasons:['encode-error'],
        error:String(error?.message || error)
      });
      continue;
    }

    const tightened = optimizePngLossless(generated, options.losslessOptions);
    const candidateBuffer = tightened.buffer;
    const decoded = await decodeWithSharp(sharp, candidateBuffer);
    if (decoded.width !== sourcePng.ihdr.width || decoded.height !== sourcePng.ihdr.height) {
      candidates.push({
        label:`sharp-palette:${profile.colours}:dither-${profile.dither}`,
        bytes:candidateBuffer.length,
        pass:false,
        score:0,
        reasons:['dimension-change']
      });
      continue;
    }

    const metrics = evaluatePixelFidelity(originalVisual.rgba, decoded.rgba, decoded.width, decoded.height);
    const verdict = judgePixelFidelity(metrics, qualityPolicy, qualityLimits);
    candidates.push({
      label:`sharp-palette:${profile.colours}:dither-${profile.dither}`,
      buffer:candidateBuffer,
      bytes:candidateBuffer.length,
      profile,
      metrics,
      pass:verdict.pass,
      score:verdict.score,
      reasons:verdict.reasons,
      strictTightening:tightened.report
    });
  }

  const accepted = candidates
    .filter(candidate => candidate.pass && candidate.buffer)
    .sort((a, b) => a.bytes - b.bytes || b.score - a.score);

  const strictBaseline = {
    label:'strict-lossless',
    buffer:strict.buffer,
    bytes:strict.buffer.length,
    pass:true,
    score:1,
    metrics:{
      exactPixels:true,
      changedPixels:0,
      changedPixelRatio:0,
      meanAbsRgb:0,
      rmseRgb:0,
      psnrRgb:Infinity,
      maxRgbDelta:0,
      alphaChangedPixels:0,
      alphaChangedRatio:0,
      alphaMaxDelta:0,
      edgeMae:0,
      largeDeltaRatio:0,
      borderChangedPixels:0,
      borderChangedRatio:0,
      borderMeanAbsRgb:0,
      borderMaxRgbDelta:0
    }
  };

  const allAccepted = [strictBaseline, ...accepted].sort((a, b) => a.bytes - b.bytes || b.score - a.score);
  const winner = allAccepted[0];
  const savedBytes = Math.max(0, buffer.length - winner.bytes);
  const savedPercent = buffer.length ? (savedBytes / buffer.length) * 100 : 0;

  return {
    buffer:winner.buffer,
    report:{
      status:winner.bytes < buffer.length ? 'optimized' : 'unchanged',
      mode:winner.label === 'strict-lossless' ? 'strict-fallback' : 'adaptive',
      originalBytes:buffer.length,
      optimizedBytes:winner.bytes,
      savedBytes,
      savedPercent:Number(savedPercent.toFixed(3)),
      assetProfile,
      qualityPolicy,
      winner:{
        label:winner.label,
        bytes:winner.bytes,
        qualityScore:winner.score,
        metrics:winner.metrics
      },
      strictBaseline:strict.report,
      candidateCount:candidates.length,
      acceptedAdaptive:candidates.filter(candidate => candidate.pass).length,
      rejectedAdaptive:candidates.filter(candidate => !candidate.pass).length,
      candidates:candidates.map(candidate => ({
        label:candidate.label,
        bytes:candidate.bytes,
        pass:candidate.pass,
        score:candidate.score,
        reasons:candidate.reasons,
        metrics:candidate.metrics || null,
        error:candidate.error || null
      }))
    }
  };
}
