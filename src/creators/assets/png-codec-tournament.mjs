/* KELO-INDEX
 * area: CREATORS / ASSET BYTES
 * owner: Kelo Creator Asset Bridge
 * keys: PNG TOURNAMENT OXIPNG ZOPFLIPNG ECT LOSSLESS VERIFY COLOR METADATA HDR
 * purpose: let independent PNG optimizers compete, then accept only the smallest candidate proven pixel-exact and rendering-metadata-safe
 * public-api: optimizePngTournament()
 * state-owned: none; temporary files only
 * online: N/A; build/publish-time capability
 * consumes: Kelo lossless optimizer plus optional oxipng/zopflipng/ect CLIs
 * do-not: trust a tool exit code as proof of fidelity or mutate the source file
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {decodePngRgba, optimizePngLossless} from './png-space-optimizer.mjs';
import {evaluatePixelFidelity, judgePixelFidelity} from './png-quality-agent.mjs';
import {pngRenderMetadataFingerprint, pngAncillaryChunkNames} from './png-render-metadata.mjs';

function commandAvailable(command) {
  const probe = spawnSync(command, ['--version'], {stdio:'ignore'});
  return !probe.error || probe.error?.code !== 'ENOENT';
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, {cwd, encoding:'utf8', timeout:10 * 60 * 1000});
  return {
    ok:!result.error && result.status === 0,
    status:result.status,
    signal:result.signal,
    stdout:String(result.stdout || '').slice(-4000),
    stderr:String(result.stderr || '').slice(-4000),
    error:result.error ? String(result.error.message || result.error) : null
  };
}

function validateCandidate(buffer, original, originalVisualFingerprint) {
  try {
    const decoded = decodePngRgba(buffer);
    if (decoded.ihdr.width !== original.ihdr.width || decoded.ihdr.height !== original.ihdr.height) {
      return {pass:false, score:0, reasons:['dimension-change'], metrics:null, metadataSafe:false};
    }
    const metrics = evaluatePixelFidelity(original.rgba, decoded.rgba, original.ihdr.width, original.ihdr.height);
    const verdict = judgePixelFidelity(metrics, 'strict');
    const metadataSafe = pngRenderMetadataFingerprint(decoded) === originalVisualFingerprint;
    const reasons = [...verdict.reasons];
    if (!metadataSafe) reasons.push('render-metadata-change');
    return {pass:verdict.pass && metadataSafe, score:verdict.score, reasons, metrics, metadataSafe};
  } catch (error) {
    return {pass:false, score:0, reasons:['decode-error'], metrics:null, metadataSafe:false, error:String(error?.message || error)};
  }
}

function candidate(label, tool, buffer, validation, runInfo = null) {
  return {
    label,
    tool,
    buffer,
    bytes:buffer?.length ?? null,
    pass:Boolean(validation?.pass),
    score:validation?.score ?? 0,
    reasons:validation?.reasons || [],
    metrics:validation?.metrics || null,
    metadataSafe:validation?.metadataSafe ?? null,
    error:validation?.error || null,
    run:runInfo
  };
}

function publicCandidate(item) {
  return {
    label:item.label,
    tool:item.tool,
    bytes:item.bytes,
    pass:item.pass,
    score:item.score,
    reasons:item.reasons,
    exactPixels:item.metrics?.exactPixels ?? null,
    metadataSafe:item.metadataSafe,
    error:item.error,
    run:item.run ? {ok:item.run.ok, status:item.run.status, signal:item.run.signal, error:item.run.error, stderr:item.run.stderr} : null
  };
}

export function optimizePngTournament(sourceBuffer, options = {}) {
  const effort = options.effort || 'balanced';
  const original = decodePngRgba(sourceBuffer);
  const sourceFingerprint = pngRenderMetadataFingerprint(original);
  const metadataChunks = pngAncillaryChunkNames(original);
  const kelo = optimizePngLossless(sourceBuffer, options.losslessOptions);
  const keloValidation = validateCandidate(kelo.buffer, original, sourceFingerprint);
  const candidates = [candidate('kelo:lossless', 'kelo', kelo.buffer, keloValidation)];
  const available = {
    oxipng:commandAvailable('oxipng'),
    zopflipng:commandAvailable('zopflipng'),
    ect:commandAvailable('ect')
  };

  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kelo-png-tournament-'));
  const sourcePath = path.join(temp, 'source.png');
  fs.writeFileSync(sourcePath, sourceBuffer);

  try {
    if (available.oxipng) {
      const profiles = effort === 'deep'
        ? [
            {label:'oxipng:o4', args:['-o', '4']},
            {label:'oxipng:o6', args:['-o', '6']},
            {label:'oxipng:o6-zopfli', args:['-o', '6', '-z']}
          ]
        : [{label:'oxipng:o4', args:['-o', '4']}];
      for (const profile of profiles) {
        const target = path.join(temp, `${profile.label.replaceAll(':', '-')}.png`);
        fs.copyFileSync(sourcePath, target);
        const runInfo = run('oxipng', [...profile.args, target], temp);
        if (!runInfo.ok || !fs.existsSync(target)) {
          candidates.push(candidate(profile.label, 'oxipng', null, {pass:false, reasons:['tool-error']}, runInfo));
          continue;
        }
        const bytes = fs.readFileSync(target);
        candidates.push(candidate(profile.label, 'oxipng', bytes, validateCandidate(bytes, original, sourceFingerprint), runInfo));
      }
    }

    if (available.zopflipng) {
      const output = path.join(temp, 'zopflipng.png');
      const args = ['-y'];
      if (effort === 'deep') args.push('-m', '--filters=0me');
      if (metadataChunks.length) args.push(`--keepchunks=${metadataChunks.join(',')}`);
      args.push(sourcePath, output);
      const runInfo = run('zopflipng', args, temp);
      if (!runInfo.ok || !fs.existsSync(output)) {
        candidates.push(candidate('zopflipng', 'zopflipng', null, {pass:false, reasons:['tool-error']}, runInfo));
      } else {
        const bytes = fs.readFileSync(output);
        candidates.push(candidate('zopflipng', 'zopflipng', bytes, validateCandidate(bytes, original, sourceFingerprint), runInfo));
      }
    }

    if (available.ect && effort === 'deep') {
      for (const level of ['-4', '-9']) {
        const target = path.join(temp, `ect${level}.png`);
        fs.copyFileSync(sourcePath, target);
        const runInfo = run('ect', [level, '-quiet', target], temp);
        if (!runInfo.ok || !fs.existsSync(target)) {
          candidates.push(candidate(`ect:${level}`, 'ect', null, {pass:false, reasons:['tool-error']}, runInfo));
          continue;
        }
        const bytes = fs.readFileSync(target);
        candidates.push(candidate(`ect:${level}`, 'ect', bytes, validateCandidate(bytes, original, sourceFingerprint), runInfo));
      }
    }
  } finally {
    fs.rmSync(temp, {recursive:true, force:true});
  }

  const accepted = candidates.filter(item => item.pass && item.buffer).sort((a, b) => a.bytes - b.bytes || b.score - a.score);
  const winner = accepted[0] || candidates[0];
  const savedBytes = Math.max(0, sourceBuffer.length - winner.bytes);
  return {
    buffer:winner.buffer,
    report:{
      version:'kelo-png-codec-tournament-v1.1',
      effort,
      sourceBytes:sourceBuffer.length,
      optimizedBytes:winner.bytes,
      savedBytes,
      savedPercent:sourceBuffer.length ? Number(((savedBytes / sourceBuffer.length) * 100).toFixed(3)) : 0,
      availableTools:available,
      renderMetadataFingerprintVersion:'png-third-edition-color-hdr-v1',
      winner:publicCandidate(winner),
      candidates:candidates.map(publicCandidate)
    }
  };
}
