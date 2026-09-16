/* KELO-INDEX
 * area: CREATORS / ASSET QUALITY
 * owner: Kelo Creator Asset Bridge
 * keys: PNG QUALITY AGENT FIDELITY PSNR EDGE ALPHA BORDER SEAM PIXEL ART RENDER EXACT
 * purpose: deterministic before/after judge for image optimization candidates with asset-class-specific hard gates
 * public-api: evaluatePixelFidelity(), judgePixelFidelity()
 * state-owned: none
 * online: N/A; creator/build-time quality gate
 * reuse: lossless optimizer, adaptive palette search, codec tournament, DELIVERY variants
 * do-not: approve by file size alone or let a visual/LLM opinion override failed hard metrics
 */

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

function luminance(r, g, b) {
  return (77 * r + 150 * g + 29 * b) / 256;
}

function exactByteEquality(a, b) {
  if (Buffer.isBuffer(a) && Buffer.isBuffer(b)) return a.equals(b);
  if (!a || !b || a.length !== b.length) return false;
  for (let index = 0; index < a.length; index += 1) if (a[index] !== b[index]) return false;
  return true;
}

function exactMetrics() {
  return {
    comparable:true,
    exactPixels:true,
    renderExactPixels:true,
    changedPixels:0,
    changedPixelRatio:0,
    renderChangedPixels:0,
    renderChangedPixelRatio:0,
    hiddenTransparentRgbChangedPixels:0,
    hiddenTransparentRgbChangedRatio:0,
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
  };
}

export function evaluatePixelFidelity(originalRgba, candidateRgba, width, height) {
  if (!originalRgba || !candidateRgba || originalRgba.length !== candidateRgba.length || originalRgba.length !== width * height * 4) {
    return {
      comparable:false,
      exactPixels:false,
      renderExactPixels:false,
      changedPixels:null,
      changedPixelRatio:1,
      renderChangedPixels:null,
      renderChangedPixelRatio:1,
      hiddenTransparentRgbChangedPixels:null,
      hiddenTransparentRgbChangedRatio:1,
      meanAbsRgb:Infinity,
      rmseRgb:Infinity,
      psnrRgb:0,
      maxRgbDelta:255,
      alphaChangedPixels:null,
      alphaChangedRatio:1,
      alphaMaxDelta:255,
      edgeMae:Infinity,
      largeDeltaRatio:1,
      borderChangedPixels:null,
      borderChangedRatio:1,
      borderMeanAbsRgb:Infinity,
      borderMaxRgbDelta:255
    };
  }

  const pixelCount = width * height;
  if (exactByteEquality(originalRgba, candidateRgba)) return exactMetrics();

  let changedPixels = 0;
  let renderChangedPixels = 0;
  let hiddenTransparentRgbChangedPixels = 0;
  let alphaChangedPixels = 0;
  let alphaMaxDelta = 0;
  let maxRgbDelta = 0;
  let absRgb = 0;
  let squaredRgb = 0;
  let largeDeltaPixels = 0;
  let borderPixels = 0;
  let borderChangedPixels = 0;
  let borderAbsRgb = 0;
  let borderMaxRgbDelta = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixel = y * width + x;
      const offset = pixel * 4;
      const onBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      let changed = false;
      let pixelRgbMax = 0;
      let pixelRgbAbs = 0;
      for (let channel = 0; channel < 3; channel += 1) {
        const delta = Math.abs(originalRgba[offset + channel] - candidateRgba[offset + channel]);
        absRgb += delta;
        squaredRgb += delta * delta;
        pixelRgbAbs += delta;
        if (delta > maxRgbDelta) maxRgbDelta = delta;
        if (delta > pixelRgbMax) pixelRgbMax = delta;
        if (delta) changed = true;
      }
      const originalAlpha = originalRgba[offset + 3];
      const candidateAlpha = candidateRgba[offset + 3];
      const alphaDelta = Math.abs(originalAlpha - candidateAlpha);
      if (alphaDelta) {
        alphaChangedPixels += 1;
        changed = true;
        if (alphaDelta > alphaMaxDelta) alphaMaxDelta = alphaDelta;
      }
      const bothFullyTransparent = originalAlpha === 0 && candidateAlpha === 0;
      const renderChanged = alphaDelta > 0 || (!bothFullyTransparent && pixelRgbMax > 0);
      if (renderChanged) renderChangedPixels += 1;
      else if (bothFullyTransparent && pixelRgbMax > 0) hiddenTransparentRgbChangedPixels += 1;

      if (pixelRgbMax > 12) largeDeltaPixels += 1;
      if (changed) changedPixels += 1;
      if (onBorder) {
        borderPixels += 1;
        borderAbsRgb += pixelRgbAbs;
        if (changed) borderChangedPixels += 1;
        if (pixelRgbMax > borderMaxRgbDelta) borderMaxRgbDelta = pixelRgbMax;
      }
    }
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
    renderExactPixels:renderChangedPixels === 0,
    changedPixels,
    changedPixelRatio:changedPixels / Math.max(1, pixelCount),
    renderChangedPixels,
    renderChangedPixelRatio:renderChangedPixels / Math.max(1, pixelCount),
    hiddenTransparentRgbChangedPixels,
    hiddenTransparentRgbChangedRatio:hiddenTransparentRgbChangedPixels / Math.max(1, pixelCount),
    meanAbsRgb,
    rmseRgb,
    psnrRgb,
    maxRgbDelta,
    alphaChangedPixels,
    alphaChangedRatio:alphaChangedPixels / Math.max(1, pixelCount),
    alphaMaxDelta,
    edgeMae:edgeError / Math.max(1, edgeCount),
    largeDeltaRatio:largeDeltaPixels / Math.max(1, pixelCount),
    borderChangedPixels,
    borderChangedRatio:borderChangedPixels / Math.max(1, borderPixels),
    borderMeanAbsRgb:borderAbsRgb / Math.max(1, borderPixels * 3),
    borderMaxRgbDelta
  };
}

const POLICY_LIMITS = {
  balanced:{minPsnrRgb:50, maxMeanAbsRgb:0.75, maxAlphaDelta:0, maxEdgeMae:0.55, maxLargeDeltaRatio:0.001, maxBorderMeanAbsRgb:0.9, maxBorderRgbDelta:18},
  'pixel-art':{minPsnrRgb:58, maxMeanAbsRgb:0.28, maxAlphaDelta:0, maxEdgeMae:0.22, maxLargeDeltaRatio:0.00025, maxBorderMeanAbsRgb:0.35, maxBorderRgbDelta:8},
  'ui-crisp':{minPsnrRgb:56, maxMeanAbsRgb:0.35, maxAlphaDelta:0, maxEdgeMae:0.25, maxLargeDeltaRatio:0.0003, maxBorderMeanAbsRgb:0.4, maxBorderRgbDelta:8},
  'fx-alpha':{minPsnrRgb:49, maxMeanAbsRgb:0.9, maxAlphaDelta:0, maxEdgeMae:0.75, maxLargeDeltaRatio:0.0015, maxBorderMeanAbsRgb:1.2, maxBorderRgbDelta:24},
  'seam-safe':{minPsnrRgb:60, maxMeanAbsRgb:0.20, maxAlphaDelta:0, maxEdgeMae:0.18, maxLargeDeltaRatio:0.0001, maxBorderMeanAbsRgb:0, maxBorderRgbDelta:0}
};

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

  if (policy === 'render-exact') {
    const pass = metrics.renderExactPixels === true && metrics.alphaMaxDelta === 0;
    return {
      pass,
      score:pass ? 1 : 0,
      policy,
      reasons:pass ? [] : [
        ...(metrics.alphaMaxDelta === 0 ? [] : ['alpha']),
        ...(metrics.renderExactPixels ? [] : ['visible-pixel-difference'])
      ],
      limits:{alphaExact:true, visibleRgbExact:true, hiddenTransparentRgbMayChange:true}
    };
  }

  const limits = {...(POLICY_LIMITS[policy] || POLICY_LIMITS.balanced), ...overrides};
  const checks = [
    ['psnr', metrics.psnrRgb >= limits.minPsnrRgb],
    ['mean-rgb', metrics.meanAbsRgb <= limits.maxMeanAbsRgb],
    ['alpha', metrics.alphaMaxDelta <= limits.maxAlphaDelta],
    ['edges', metrics.edgeMae <= limits.maxEdgeMae],
    ['large-delta', metrics.largeDeltaRatio <= limits.maxLargeDeltaRatio],
    ['border-mean', metrics.borderMeanAbsRgb <= limits.maxBorderMeanAbsRgb],
    ['border-max', metrics.borderMaxRgbDelta <= limits.maxBorderRgbDelta]
  ];
  const reasons = checks.filter(([, pass]) => !pass).map(([name]) => name);
  const psnrScore = metrics.psnrRgb === Infinity ? 1 : clamp01((metrics.psnrRgb - 35) / 25);
  const meanScore = clamp01(1 - metrics.meanAbsRgb / Math.max(0.0001, limits.maxMeanAbsRgb * 2));
  const edgeScore = clamp01(1 - metrics.edgeMae / Math.max(0.0001, limits.maxEdgeMae * 2));
  const alphaScore = metrics.alphaMaxDelta <= limits.maxAlphaDelta ? 1 : 0;
  const largeDeltaScore = clamp01(1 - metrics.largeDeltaRatio / Math.max(0.000001, limits.maxLargeDeltaRatio * 2));
  const borderScore = limits.maxBorderRgbDelta === 0
    ? (metrics.borderMaxRgbDelta === 0 ? 1 : 0)
    : clamp01(1 - metrics.borderMeanAbsRgb / Math.max(0.0001, limits.maxBorderMeanAbsRgb * 2));
  const score = 0.25 * psnrScore + 0.20 * meanScore + 0.18 * edgeScore + 0.14 * alphaScore + 0.08 * largeDeltaScore + 0.15 * borderScore;

  return {pass:reasons.length === 0, score:Number(score.toFixed(6)), policy, reasons, limits};
}
