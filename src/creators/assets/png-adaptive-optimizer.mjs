/* KELO-INDEX
 * area: CREATORS / ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG ADAPTIVE PALETTE QUALITY AGENT SHARP PIXEL ART
 * purpose: search near-lossless PNG palette candidates and keep only candidates approved by the deterministic quality agent
 * public-api: optimizePngAdaptive()
 * state-owned: none
 * online: N/A; creator/build-time capability only
 * consumes: png-space-optimizer.mjs, png-quality-agent.mjs, optional sharp dependency
 * do-not: resize, resample, change dimensions, silently alter alpha, or bypass quality gates
 */

import {decodePngRgba, optimizePngLossless} from './png-space-optimizer.mjs';
import {evaluatePixelFidelity, judgePixelFidelity} from './png-quality-agent.mjs';

async function loadSharp() {
  try {
    return (await import('sharp')).default;
  } catch {
    const error = new Error('PNG_SPACE_ADAPTIVE_REQUIRES_SHARP');
    error.hint = 'Install sharp (tested target: 0.35.x) or use strict lossless mode.';
    throw error;
  }
}

function defaultProfiles() {
  return [
    {colours:256, dither:0},
    {colours:224, dither:0},
    {colours:192, dither:0},
    {colours:160, dither:0},
    {colours:128, dither:0},
    {colours:112, dither:0},
    {colours:96, dither:0},
    {colours:80, dither:0},
    {colours:64, dither:0},
    {colours:48, dither:0},
    {colours:32, dither:0}
  ];
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
  const original = decodePngRgba(buffer);
  const sharp = await loadSharp();
  const profiles = options.profiles || defaultProfiles();
  const qualityPolicy = options.qualityPolicy || 'pixel-art';
  const qualityLimits = options.qualityLimits || {};
  const candidates = [];

  for (const profile of profiles) {
    let generated;
    try {
      generated = await sharp(buffer, {animated:false})
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

    // Tighten every adaptive candidate losslessly after quantization.
    const tightened = optimizePngLossless(generated, options.losslessOptions);
    const candidateBuffer = tightened.buffer;
    const decoded = await decodeWithSharp(sharp, candidateBuffer);
    if (decoded.width !== original.ihdr.width || decoded.height !== original.ihdr.height) {
      candidates.push({
        label:`sharp-palette:${profile.colours}:dither-${profile.dither}`,
        bytes:candidateBuffer.length,
        pass:false,
        score:0,
        reasons:['dimension-change']
      });
      continue;
    }

    const metrics = evaluatePixelFidelity(original.rgba, decoded.rgba, decoded.width, decoded.height);
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
      largeDeltaRatio:0
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
