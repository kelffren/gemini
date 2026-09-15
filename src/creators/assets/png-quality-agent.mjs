/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PNG QUALITY AGENT FIDELITY PSNR EDGE ALPHA PIXEL ART
 * purpose: deterministic before/after judge for image optimization candidates
 * public-api: evaluatePixelFidelity(), judgePixelFidelity()
 * state-owned: none
 * online: N/A; creator/build-time quality gate
 * reuse: lossless optimizer now, adaptive palette search later
 * do-not: approve by file size alone or let a visual/LLM opinion override failed hard metrics
 */

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

function luminance(r, g, b) {
  return (77 * r + 150 * g + 29 * b) / 256;
}

export function evaluatePixelFidelity(originalRgba, candidateRgba, width, height) {
  if (!originalRgba || !candidateRgba || originalRgba.length !== candidateRgba.length || originalRgba.length !== width * height * 4) {
    return {
      comparable:false,
      exactPixels:false,
      changedPixels:null,
      changedPixelRatio:1,
      meanAbsRgb:Infinity,
      rmseRgb:Infinity,
      psnrRgb:0,
      maxRgbDelta:255,
      alphaChangedPixels:null,
      alphaChangedRatio:1,
      alphaMaxDelta:255,
      edgeMae:Infinity,
      largeDeltaRatio:1
    };
  }

  const pixelCount = width * height;
  let changedPixels = 0;
  let alphaChangedPixels = 0;
  let alphaMaxDelta = 0;
  let maxRgbDelta = 0;
  let absRgb = 0;
  let squaredRgb = 0;
  let largeDeltaPixels = 0;

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4;
    let changed = false;
    let pixelRgbMax = 0;
    for (let channel = 0; channel < 3; channel += 1) {
      const delta = Math.abs(originalRgba[offset + channel] - candidateRgba[offset + channel]);
      absRgb += delta;
      squaredRgb += delta * delta;
      if (delta > maxRgbDelta) maxRgbDelta = delta;
      if (delta > pixelRgbMax) pixelRgbMax = delta;
      if (delta) changed = true;
    }
    const alphaDelta = Math.abs(originalRgba[offset + 3] - candidateRgba[offset + 3]);
    if (alphaDelta) {
      alphaChangedPixels += 1;
      changed = true;
      if (alphaDelta > alphaMaxDelta) alphaMaxDelta = alphaDelta;
    }
    if (pixelRgbMax > 12) largeDeltaPixels += 1;
    if (changed) changedPixels += 1;
  }

  let edgeError = 0;
  let edgeCount = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const oLum = luminance(originalRgba[offset], originalRgba[offset + 1], originalRgba[offset + 2]);
      const cLum = luminance(candidateRgba[offset], candidateRgba[offset + 1], candidateRgba[offset + 2]);
      if (x + 1 < width) {
        const n = offset + 4;
        const oEdge = Math.abs(oLum - luminance(originalRgba[n], originalRgba[n + 1], originalRgba[n + 2]));
        const cEdge = Math.abs(cLum - luminance(candidateRgba[n], candidateRgba[n + 1], candidateRgba[n + 2]));
        edgeError += Math.abs(oEdge - cEdge);
        edgeCount += 1;
      }
      if (y + 1 < height) {
        const n = offset + width * 4;
        const oEdge = Math.abs(oLum - luminance(originalRgba[n], originalRgba[n + 1], originalRgba[n + 2]));
        const cEdge = Math.abs(cLum - luminance(candidateRgba[n], candidateRgba[n + 1], candidateRgba[n + 2]));
        edgeError += Math.abs(oEdge - cEdge);
        edgeCount += 1;
      }
    }
  }

  const meanAbsRgb = absRgb / Math.max(1, pixelCount * 3);
  const mseRgb = squaredRgb / Math.max(1, pixelCount * 3);
  const rmseRgb = Math.sqrt(mseRgb);
  const psnrRgb = mseRgb === 0 ? Infinity : 10 * Math.log10((255 * 255) / mseRgb);

  return {
    comparable:true,
    exactPixels:changedPixels === 0,
    changedPixels,
    changedPixelRatio:changedPixels / Math.max(1, pixelCount),
    meanAbsRgb,
    rmseRgb,
    psnrRgb,
    maxRgbDelta,
    alphaChangedPixels,
    alphaChangedRatio:alphaChangedPixels / Math.max(1, pixelCount),
    alphaMaxDelta,
    edgeMae:edgeError / Math.max(1, edgeCount),
    largeDeltaRatio:largeDeltaPixels / Math.max(1, pixelCount)
  };
}

export function judgePixelFidelity(metrics, policy = 'strict', overrides = {}) {
  if (!metrics?.comparable) return {pass:false, score:0, policy, reasons:['not-comparable']};

  if (policy === 'strict') {
    return {
      pass:metrics.exactPixels,
      score:metrics.exactPixels ? 1 : 0,
      policy,
      reasons:metrics.exactPixels ? [] : ['pixel-difference']
    };
  }

  const limits = {
    minPsnrRgb:50,
    maxMeanAbsRgb:0.75,
    maxAlphaDelta:0,
    maxEdgeMae:0.55,
    maxLargeDeltaRatio:0.001,
    ...overrides
  };
  const checks = [
    ['psnr', metrics.psnrRgb >= limits.minPsnrRgb],
    ['mean-rgb', metrics.meanAbsRgb <= limits.maxMeanAbsRgb],
    ['alpha', metrics.alphaMaxDelta <= limits.maxAlphaDelta],
    ['edges', metrics.edgeMae <= limits.maxEdgeMae],
    ['large-delta', metrics.largeDeltaRatio <= limits.maxLargeDeltaRatio]
  ];
  const reasons = checks.filter(([, pass]) => !pass).map(([name]) => name);
  const psnrScore = metrics.psnrRgb === Infinity ? 1 : clamp01((metrics.psnrRgb - 35) / 20);
  const meanScore = clamp01(1 - metrics.meanAbsRgb / Math.max(0.0001, limits.maxMeanAbsRgb * 2));
  const edgeScore = clamp01(1 - metrics.edgeMae / Math.max(0.0001, limits.maxEdgeMae * 2));
  const alphaScore = metrics.alphaMaxDelta <= limits.maxAlphaDelta ? 1 : 0;
  const largeDeltaScore = clamp01(1 - metrics.largeDeltaRatio / Math.max(0.000001, limits.maxLargeDeltaRatio * 2));
  const score = 0.30 * psnrScore + 0.25 * meanScore + 0.20 * edgeScore + 0.15 * alphaScore + 0.10 * largeDeltaScore;

  return {pass:reasons.length === 0, score:Number(score.toFixed(6)), policy, reasons, limits};
}
