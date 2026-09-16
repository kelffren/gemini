/* KELO-INDEX
 * area: CREATORS / ASSET DELIVERY
 * owner: Kelo Creator Asset Bridge
 * keys: RUNTIME IMAGE VARIANTS WEBP AVIF LOSSLESS RENDER EXACT ADAPTIVE BOUNDARY SEARCH QUALITY GATE SAFARI PARETO
 * purpose: derive smaller runtime delivery variants while preserving canonical source/authoring bytes and concentrating expensive encodes near the measured quality boundary
 * public-api: buildRuntimeImageVariants()
 * state-owned: none; returns candidate bytes + manifest only
 * online: N/A; build/publish-time capability. Runtime consumption is a separate owner decision.
 * consumes: Sharp, PNG optimizer, image profiler, quality agent, boundary search, Pareto analysis
 * do-not: replace canonical source bytes, resize, or promote a candidate that fails its policy
 */

import {optimizePngLossless} from './png-space-optimizer.mjs';
import {profileAssetImage} from './asset-image-profiler.mjs';
import {evaluatePixelFidelity, judgePixelFidelity} from './png-quality-agent.mjs';
import {buildQualityParetoFrontier} from './quality-pareto.mjs';
import {searchIntegerQualityBoundary} from './quality-boundary-search.mjs';

async function loadSharp() {
  try { return (await import('sharp')).default; }
  catch {
    const error = new Error('RUNTIME_IMAGE_VARIANTS_REQUIRES_SHARP');
    error.hint = 'Install sharp >=0.35 to build WebP/AVIF runtime variants.';
    throw error;
  }
}

async function decodeVisual(sharp, buffer) {
  const {data, info} = await sharp(buffer, {animated:false}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  return {rgba:data, width:info.width, height:info.height};
}

function candidateSummary(candidate) {
  return {
    label:candidate.label, format:candidate.format, track:candidate.track, bytes:candidate.bytes,
    pass:candidate.pass, score:candidate.score, reasons:candidate.reasons || [], metrics:candidate.metrics || null,
    options:candidate.options || null, error:candidate.error || null
  };
}

function chooseSmallest(candidates) {
  return candidates.filter(candidate => candidate.pass && candidate.buffer).sort((a,b) => a.bytes-b.bytes || b.score-a.score)[0] || null;
}

async function evaluateCandidate(sharp, originalVisual, buffer, descriptor, policy, limits) {
  try {
    const decoded = await decodeVisual(sharp, buffer);
    if (decoded.width !== originalVisual.width || decoded.height !== originalVisual.height) {
      return {...descriptor, buffer:null, bytes:buffer.length, pass:false, score:0, reasons:['dimension-change']};
    }
    const metrics = evaluatePixelFidelity(originalVisual.rgba, decoded.rgba, decoded.width, decoded.height);
    const verdict = judgePixelFidelity(metrics, policy, limits);
    return {...descriptor, buffer, bytes:buffer.length, pass:verdict.pass, score:verdict.score, reasons:verdict.reasons, metrics};
  } catch (error) {
    return {...descriptor, buffer:null, bytes:buffer?.length ?? null, pass:false, score:0, reasons:['decode-error'], error:String(error?.message || error)};
  }
}

function webpPreset(profile) {
  if (profile.kind === 'ui') return 'icon';
  if (profile.kind.includes('sprite') || profile.kind === 'pixel-art') return 'drawing';
  return 'picture';
}

function searchSummary(search) {
  if (!search) return null;
  return {
    version:search.version,
    range:search.range,
    budget:search.budget,
    order:search.order,
    boundaryPass:search.boundaryPass,
    bestByBytes:search.bestByBytes ? {
      quality:search.bestByBytes.quality,
      bytes:search.bestByBytes.bytes,
      score:search.bestByBytes.score,
      pass:search.bestByBytes.pass
    } : null,
    evaluated:search.evaluated.map(item=>({quality:item.quality,phase:item.phase,bytes:item.bytes,pass:item.pass,score:item.score,reasons:item.reasons||[]}))
  };
}

async function runExplicitQualities(qualities,evaluate) {
  const evaluated=[];
  for (const quality of [...new Set(qualities.map(Number))].filter(Number.isFinite).sort((a,b)=>b-a)) {
    const result=await evaluate(quality);
    evaluated.push({quality,phase:'explicit',...result});
  }
  return {
    version:'kelo-quality-explicit-list-v1',
    range:{min:Math.min(...evaluated.map(item=>item.quality)),max:Math.max(...evaluated.map(item=>item.quality))},
    budget:{maxEvaluations:evaluated.length,used:evaluated.length,coarseStep:null,neighborRadius:null},
    order:evaluated.map(item=>item.quality),
    boundaryPass:evaluated.filter(item=>item.pass).length ? Math.min(...evaluated.filter(item=>item.pass).map(item=>item.quality)) : null,
    bestByBytes:evaluated.filter(item=>item.pass&&Number.isFinite(item.bytes)).sort((a,b)=>a.bytes-b.bytes||b.score-a.score)[0]||null,
    evaluated
  };
}

export async function buildRuntimeImageVariants(sourceBuffer, options = {}) {
  const sharp = await loadSharp();
  const originalVisual = await decodeVisual(sharp, sourceBuffer);
  const profile = options.assetProfile || profileAssetImage(originalVisual.rgba, originalVisual.width, originalVisual.height, {sourceName:options.sourceName || ''});
  const policy = options.qualityPolicy || profile.adaptivePolicy || 'balanced';
  const limits = options.qualityLimits || {};
  const strictPng = optimizePngLossless(sourceBuffer, options.losslessOptions);
  const candidates = [{
    label:'png:strict', format:'png', track:'lossless', buffer:strictPng.buffer, bytes:strictPng.buffer.length,
    pass:true, score:1, reasons:[], metrics:{exactPixels:true,renderExactPixels:true}, options:{optimizer:'kelo-lossless'}
  }];
  const searches={webp:null,avif:null};

  try {
    const buffer = await sharp(sourceBuffer,{animated:false}).keepMetadata().webp({lossless:true,quality:100,effort:6,exact:true}).toBuffer();
    candidates.push(await evaluateCandidate(sharp, originalVisual, buffer,
      {label:'webp:lossless',format:'webp',track:'lossless',options:{lossless:true,quality:100,effort:6,exact:true}}, 'strict', {}));
  } catch (error) {
    candidates.push({label:'webp:lossless',format:'webp',track:'lossless',bytes:null,pass:false,score:0,reasons:['encode-error'],error:String(error?.message || error)});
  }

  if (profile.runtimeCandidates.includes('webp-render-exact')) {
    try {
      const buffer = await sharp(sourceBuffer,{animated:false}).keepMetadata().webp({lossless:true,quality:100,effort:6,exact:false}).toBuffer();
      candidates.push(await evaluateCandidate(sharp, originalVisual, buffer,
        {label:'webp:render-exact',format:'webp',track:'render-lossless',options:{lossless:true,quality:100,effort:6,exact:false}}, 'render-exact', {}));
    } catch (error) {
      candidates.push({label:'webp:render-exact',format:'webp',track:'render-lossless',bytes:null,pass:false,score:0,reasons:['encode-error'],error:String(error?.message || error)});
    }
  }

  try {
    const buffer = await sharp(sourceBuffer,{animated:false}).keepMetadata().avif({lossless:true,effort:9,chromaSubsampling:'4:4:4',bitdepth:8}).toBuffer();
    candidates.push(await evaluateCandidate(sharp, originalVisual, buffer,
      {label:'avif:lossless',format:'avif',track:'lossless',options:{lossless:true,effort:9,chromaSubsampling:'4:4:4',bitdepth:8}}, 'strict', {}));
  } catch (error) {
    candidates.push({label:'avif:lossless',format:'avif',track:'lossless',bytes:null,pass:false,score:0,reasons:['encode-error'],error:String(error?.message || error)});
  }

  if (profile.runtimeCandidates.includes('webp-adaptive')) {
    const evaluateWebp=async quality => {
      let candidate;
      try {
        const buffer=await sharp(sourceBuffer,{animated:false}).keepMetadata().webp({quality,alphaQuality:100,effort:6,smartSubsample:true,preset:webpPreset(profile),exact:true}).toBuffer();
        candidate=await evaluateCandidate(sharp,originalVisual,buffer,
          {label:`webp:q${quality}`,format:'webp',track:'adaptive',options:{quality,alphaQuality:100,effort:6,exact:true}},policy,limits);
      } catch (error) {
        candidate={label:`webp:q${quality}`,format:'webp',track:'adaptive',bytes:null,pass:false,score:0,reasons:['encode-error'],error:String(error?.message||error)};
      }
      candidates.push(candidate);
      return candidate;
    };
    const search=options.webpQualities?.length
      ? await runExplicitQualities(options.webpQualities,evaluateWebp)
      : await searchIntegerQualityBoundary({
          min:options.webpMinQuality ?? (profile.kind==='fx'?64:70),
          max:100,
          coarseStep:options.webpCoarseStep ?? 8,
          maxEvaluations:options.webpMaxEvaluations ?? 7,
          neighborRadius:1,
          evaluate:evaluateWebp
        });
    searches.webp=searchSummary(search);
  }

  if (profile.runtimeCandidates.includes('avif-adaptive')) {
    const evaluateAvif=async quality => {
      let candidate;
      try {
        const buffer=await sharp(sourceBuffer,{animated:false}).keepMetadata().avif({quality,effort:8,chromaSubsampling:'4:4:4',bitdepth:8,tune:'iq'}).toBuffer();
        candidate=await evaluateCandidate(sharp,originalVisual,buffer,
          {label:`avif:q${quality}`,format:'avif',track:'adaptive',options:{quality,effort:8,chromaSubsampling:'4:4:4',bitdepth:8,tune:'iq'}},policy,limits);
      } catch (error) {
        candidate={label:`avif:q${quality}`,format:'avif',track:'adaptive',bytes:null,pass:false,score:0,reasons:['encode-error'],error:String(error?.message||error)};
      }
      candidates.push(candidate);
      return candidate;
    };
    const search=options.avifQualities?.length
      ? await runExplicitQualities(options.avifQualities,evaluateAvif)
      : await searchIntegerQualityBoundary({
          min:options.avifMinQuality ?? (profile.kind==='fx'?56:64),
          max:100,
          coarseStep:options.avifCoarseStep ?? 10,
          maxEvaluations:options.avifMaxEvaluations ?? 7,
          neighborRadius:1,
          evaluate:evaluateAvif
        });
    searches.avif=searchSummary(search);
  }

  const losslessWinner = chooseSmallest(candidates.filter(candidate => candidate.track === 'lossless'));
  const renderLosslessWinner = chooseSmallest(candidates.filter(candidate => candidate.track === 'render-lossless'));
  const adaptiveWinner = chooseSmallest(candidates.filter(candidate => candidate.track === 'adaptive'));
  const runtimeWinner = chooseSmallest(candidates);
  const summaries = candidates.map(candidateSummary);
  const paretoFrontier = buildQualityParetoFrontier(summaries);

  return {
    report:{
      sourceBytes:sourceBuffer.length, profile, qualityPolicy:policy, strictPngReport:strictPng.report,
      losslessWinner:losslessWinner ? candidateSummary(losslessWinner) : null,
      renderLosslessWinner:renderLosslessWinner ? candidateSummary(renderLosslessWinner) : null,
      adaptiveWinner:adaptiveWinner ? candidateSummary(adaptiveWinner) : null,
      runtimeWinner:runtimeWinner ? candidateSummary(runtimeWinner) : null,
      searches,
      paretoFrontier,
      candidates:summaries
    },
    buffers:Object.fromEntries(candidates.filter(candidate => candidate.pass && candidate.buffer).map(candidate => [candidate.label,candidate.buffer]))
  };
}
